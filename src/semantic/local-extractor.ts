/**
 * Single-pass local AST extractor for semantic analysis.
 *
 * Walks the codebase once with tree-sitter, extracting numeric AST
 * vectors from each file. Produces a RawExtractionPayload containing
 * only opaque data (counts, hashes, flags). No source code, variable
 * names, file paths, comments, or imports leave the machine.
 *
 * Performance: one fs.readdir + one parser.parse() per file.
 * Parse, extract, discard. Memory bounded.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import type { RawExtractionPayload, RawFileVector } from './types.js';
import { walkSourceFiles, isTestFile } from './file-walker.js';
import type { TreeSitterNode } from '../verifier/treesitter-loader.js';
import {
  visitNode,
  hasDeviationComment,
  sha256,
  TEST_CODE_FLAG,
} from './ast-visitor.js';
import type { DepthAccumulator } from './ast-visitor.js';

/** Minimal tree-sitter module interface for extraction. */
interface TreeSitterModule {
  Parser: {
    init(): Promise<void>;
    new(): TreeSitterParserInstance;
  };
  Language: {
    load(path: string): Promise<TreeSitterLangRef>;
  };
}

/** Tree-sitter parser instance. */
interface TreeSitterParserInstance {
  setLanguage(lang: TreeSitterLangRef): void;
  parse(text: string): TreeSitterTreeRef;
  delete(): void;
}

/** Opaque language reference. */
interface TreeSitterLangRef {
  // opaque
}

/** Parsed tree reference. */
interface TreeSitterTreeRef {
  rootNode: TreeSitterNode;
  delete(): void;
}

/**
 * Extract raw AST vectors from all TS/JS files in a project.
 *
 * Walks the project directory once, parses each file with tree-sitter,
 * extracts numeric vectors, and discards the AST. File identifiers are
 * opaque sequential integers (no path information transmitted).
 *
 * @param projectDir - Root directory of the project to analyze
 * @returns Raw extraction payload ready to send to the API service
 */
export async function extractRawVectors(
  projectDir: string,
): Promise<RawExtractionPayload> {
  const filePaths = walkSourceFiles(projectDir);
  const mod = await loadTreeSitterForExtraction();

  const fileVectors: Record<string, RawFileVector> = {};
  const contentHashes: string[] = [];

  let fileIndex = 0;

  for (const filePath of filePaths) {
    let source: string;
    try {
      source = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const contentHash = sha256(source);
    contentHashes.push(contentHash);

    const vector = await extractFileVector(mod, filePath, source);
    if (vector === null) {
      continue;
    }

    const opaqueId = String(fileIndex);
    fileIndex++;

    if (isTestFile(filePath)) {
      vector.nodeTypeCounts[TEST_CODE_FLAG] = 1;
    }

    fileVectors[opaqueId] = vector;
  }

  contentHashes.sort();
  const extractionHash = sha256(contentHashes.join(':'));

  return { fileVectors, rules: [], extractionHash };
}

/** Cached language references to avoid reloading WASM per file. */
const langCache = new Map<string, TreeSitterLangRef>();

/** Cached parser instance to avoid WASM table exhaustion on large repos. */
let cachedParser: TreeSitterParserInstance | null = null;

/**
 * Extract a RawFileVector from a single file's source and AST.
 */
async function extractFileVector(
  mod: TreeSitterModule | null,
  filePath: string,
  source: string,
): Promise<RawFileVector | null> {
  if (mod === null) {
    return extractWithoutTreeSitter(source);
  }

  const lang = resolveLanguage(filePath);
  if (lang === null) {
    return null;
  }

  const wasmPath = resolveExtractionWasmPath(lang);
  if (wasmPath === null) {
    return extractWithoutTreeSitter(source);
  }

  let loadedLang = langCache.get(lang);
  if (!loadedLang) {
    try {
      loadedLang = await mod.Language.load(wasmPath);
      langCache.set(lang, loadedLang);
    } catch {
      return extractWithoutTreeSitter(source);
    }
  }

  if (!cachedParser) {
    cachedParser = new mod.Parser();
  }
  cachedParser.setLanguage(loadedLang);

  const tree = cachedParser.parse(source);
  const root = tree.rootNode;

  const nodeTypeCounts: Record<string, number> = {};
  const nestingDepths: Record<string, number> = {};
  const subTreeHashes: string[] = [];
  const depthAccumulators: Record<string, DepthAccumulator> = {};

  visitNode(root, 0, nodeTypeCounts, depthAccumulators, subTreeHashes);

  for (const [nodeType, acc] of Object.entries(depthAccumulators)) {
    nestingDepths[nodeType] = acc.count > 0 ? acc.total / acc.count : 0;
  }

  if (hasDeviationComment(root)) {
    nodeTypeCounts['__flag:deviationComment'] = 1;
  }

  tree.delete();

  return { nodeTypeCounts, nestingDepths, subTreeHashes };
}

/**
 * Fallback extraction when tree-sitter is not available.
 * Returns minimal vectors with no AST data.
 */
function extractWithoutTreeSitter(source: string): RawFileVector {
  const lineCount = source.split('\n').length;
  return {
    nodeTypeCounts: { __lineCount: lineCount },
    nestingDepths: {},
    subTreeHashes: [],
  };
}

/**
 * Determine the tree-sitter language from a file path extension.
 */
function resolveLanguage(filePath: string): string | null {
  if (filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts')) {
    return 'typescript';
  }
  if (filePath.endsWith('.tsx')) {
    return 'tsx';
  }
  if (
    filePath.endsWith('.js') ||
    filePath.endsWith('.mjs') ||
    filePath.endsWith('.cjs') ||
    filePath.endsWith('.jsx')
  ) {
    return 'javascript';
  }
  return null;
}

/**
 * Resolve the WASM grammar path for a given language.
 */
function resolveExtractionWasmPath(language: string): string | null {
  const packageMap: Record<string, string> = {
    typescript: 'tree-sitter-typescript',
    tsx: 'tree-sitter-typescript',
    javascript: 'tree-sitter-javascript',
  };
  const wasmMap: Record<string, string> = {
    typescript: 'tree-sitter-typescript.wasm',
    tsx: 'tree-sitter-tsx.wasm',
    javascript: 'tree-sitter-javascript.wasm',
  };

  const pkg = packageMap[language];
  const wasm = wasmMap[language];
  if (pkg === undefined || wasm === undefined) {
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve(`${pkg}/package.json`);
    return resolve(dirname(pkgPath), wasm);
  } catch {
    return null;
  }
}

/** Lazy-loaded tree-sitter module. */
let cachedModule: TreeSitterModule | null | undefined;

/**
 * Load tree-sitter for extraction. Cached after first call.
 */
async function loadTreeSitterForExtraction(): Promise<TreeSitterModule | null> {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  try {
    const mod = await import('web-tree-sitter');
    const ns = (mod.default ?? mod) as Record<string, unknown>;
    const ParserCtor = ns['Parser'] as TreeSitterModule['Parser'];
    const LanguageRef = ns['Language'] as TreeSitterModule['Language'];
    await ParserCtor.init();
    cachedModule = { Parser: ParserCtor, Language: LanguageRef };
    return cachedModule;
  } catch {
    cachedModule = null;
    return null;
  }
}
