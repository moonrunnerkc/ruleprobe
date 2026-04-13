/**
 * Tree-sitter WASM loader and parser.
 *
 * Provides the initialization, grammar loading, and parsing functions
 * that the tree-sitter checks and verifier depend on. Separated from
 * the checks themselves to keep files under 300 lines.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import type { Evidence } from '../types.js';

/** Supported languages for tree-sitter analysis. */
export type TreeSitterLanguage = 'python' | 'go';

/** Minimal type surface for web-tree-sitter. */
interface TreeSitterModule {
  Parser: {
    init(): Promise<void>;
    new(): TreeSitterParser;
  };
  Language: {
    load(path: string): Promise<TreeSitterLang>;
  };
}

/** Tree-sitter parser instance. */
export interface TreeSitterParser {
  setLanguage(lang: TreeSitterLang): void;
  parse(text: string): TreeSitterTree;
  delete(): void;
}

/** Opaque language reference. */
export interface TreeSitterLang {
  // opaque
}

/** Parsed syntax tree. */
export interface TreeSitterTree {
  rootNode: TreeSitterNode;
  delete(): void;
}

/** A node in the tree-sitter syntax tree. */
export interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  childCount: number;
  children: TreeSitterNode[];
  namedChildren: TreeSitterNode[];
  childForFieldName(name: string): TreeSitterNode | null;
}

/** Lazy-loaded tree-sitter module cache. */
let parserModule: TreeSitterModule | null = null;

/**
 * Cached parser instances per language. Reusing parsers avoids the
 * WASM table exhaustion that occurs when creating thousands of
 * short-lived Parser objects (PostHog has 7000+ Python files).
 * Language.load is also cached to avoid redundant WASM loads.
 */
const parserCache = new Map<TreeSitterLanguage, { parser: TreeSitterParser; lang: TreeSitterLang }>();

/**
 * Initialize tree-sitter if not already loaded.
 *
 * @returns The tree-sitter module, or null if not installed
 */
export async function loadTreeSitter(): Promise<TreeSitterModule | null> {
  if (parserModule) {
    return parserModule;
  }

  try {
    const mod = await import('web-tree-sitter');
    // ESM: Parser/Language are direct exports. CJS: they're on mod.default.
    const ns = (mod.default ?? mod) as Record<string, unknown>;
    const ParserCtor = (ns['Parser'] ?? mod.Parser) as unknown as { init: () => Promise<void>; new(): TreeSitterParser };
    const LanguageRef = (ns['Language'] ?? mod.Language) as unknown as TreeSitterModule['Language'];
    await ParserCtor.init();
    parserModule = {
      Parser: ParserCtor as unknown as TreeSitterModule['Parser'],
      Language: LanguageRef,
    };
    return parserModule;
  } catch {
    return null;
  }
}

/**
 * Resolve the path to a tree-sitter WASM grammar file.
 */
export function resolveWasmPath(language: TreeSitterLanguage): string | null {
  const packageName = `tree-sitter-${language}`;
  const wasmFile = `tree-sitter-${language}.wasm`;

  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const wasmPath = resolve(dirname(pkgPath), wasmFile);
    if (existsSync(wasmPath)) {
      return wasmPath;
    }
  } catch {
    // Package not installed
  }

  return null;
}

/**
 * Parse a file with tree-sitter and return the root node.
 *
 * Reuses a single Parser instance per language to avoid WASM table
 * exhaustion on large codebases. The caller must call tree.delete()
 * when done but must NOT delete the parser (it is shared).
 *
 * @param filePath - Path to the source file
 * @param language - Which language grammar to use
 * @returns Parse result, or null if parsing fails
 */
export async function parseWithTreeSitter(
  filePath: string,
  language: TreeSitterLanguage,
): Promise<{ root: TreeSitterNode; tree: TreeSitterTree } | null> {
  const mod = await loadTreeSitter();
  if (!mod) {
    return null;
  }

  let cached = parserCache.get(language);
  if (!cached) {
    const wasmPath = resolveWasmPath(language);
    if (!wasmPath) {
      return null;
    }
    const lang = await mod.Language.load(wasmPath);
    const parser = new mod.Parser();
    parser.setLanguage(lang);
    cached = { parser, lang };
    parserCache.set(language, cached);
  }

  const source = readFileSync(filePath, 'utf-8');
  const tree = cached.parser.parse(source);

  return { root: tree.rootNode, tree };
}

/**
 * Check whether tree-sitter and a language grammar are available.
 */
export async function isTreeSitterAvailable(language: TreeSitterLanguage): Promise<boolean> {
  const mod = await loadTreeSitter();
  if (!mod) {
    return false;
  }
  return resolveWasmPath(language) !== null;
}

/**
 * Detect the tree-sitter language from a file extension.
 */
export function detectLanguage(filePath: string): TreeSitterLanguage | null {
  if (filePath.endsWith('.py')) {
    return 'python';
  }
  if (filePath.endsWith('.go')) {
    return 'go';
  }
  return null;
}

/** Collect all nodes of a given type recursively. */
export function collectNodesByType(node: TreeSitterNode, type: string): TreeSitterNode[] {
  const results: TreeSitterNode[] = [];
  const visit = (n: TreeSitterNode): void => {
    if (n.type === type) {
      results.push(n);
    }
    for (const child of n.children) {
      visit(child);
    }
  };
  visit(node);
  return results;
}
