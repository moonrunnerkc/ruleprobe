/**
 * ESLint config file parser.
 *
 * Reads ESLint config files and extracts rule entries with severity
 * and options. Supports:
 * - .eslintrc.json and eslint.config.json (synchronous JSON parsing)
 * - .eslintrc.js, .eslintrc.cjs, .eslintrc.mjs (async dynamic import)
 * - eslint.config.js, .mjs, .cjs (async dynamic import)
 * - eslint.config.ts (async dynamic import)
 *
 * Uses direct JSON parsing for JSON configs rather than ESLint's
 * loadConfigFromFile because loadConfigFromFile requires all referenced
 * plugins to be installed, which is brittle in CI/CD pipelines.
 */

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import type { ParsedEslintConfig, ParsedEslintRule } from './types.js';

/** Normalize a severity value to "error" | "warn" | "off". */
function normalizeSeverity(severity: unknown): 'error' | 'warn' | 'off' {
  if (severity === 'error' || severity === 2) return 'error';
  if (severity === 'warn' || severity === 1) return 'warn';
  if (severity === 'off' || severity === 0) return 'off';
  return 'off';
}

/**
 * Parse a rule entry from the config format.
 *
 * ESLint rules can be:
 * - A severity string or number: "error", "warn", "off", 0, 1, 2
 * - An array where the first element is severity: ["error", { ...options }]
 */
function parseRuleEntry(ruleName: string, value: unknown): ParsedEslintRule {
  if (typeof value === 'string' || typeof value === 'number') {
    return {
      ruleName,
      severity: normalizeSeverity(value),
      options: [],
    };
  }

  if (Array.isArray(value) && value.length >= 1) {
    const severity = normalizeSeverity(value[0]);
    const options = value.slice(1);
    return { ruleName, severity, options };
  }

  // Fallback: treat as off if unparseable
  return { ruleName, severity: 'off', options: [] };
}

/**
 * Extract rules from a legacy .eslintrc config object.
 *
 * Legacy configs have a top-level "rules" key with rule entries.
 */
function extractLegacyRules(configObj: Record<string, unknown>): ParsedEslintRule[] {
  const rulesObj = configObj['rules'];
  if (!rulesObj || typeof rulesObj !== 'object' || Array.isArray(rulesObj)) {
    return [];
  }

  const rules: ParsedEslintRule[] = [];
  for (const [ruleName, ruleValue] of Object.entries(rulesObj as Record<string, unknown>)) {
    rules.push(parseRuleEntry(ruleName, ruleValue));
  }
  return rules;
}

/**
 * Extract rules from a flat config array.
 *
 * Flat config is an array of config objects, each of which may
 * have a "rules" key.
 */
function extractFlatConfigRules(configArray: unknown[]): ParsedEslintRule[] {
  const rules: ParsedEslintRule[] = [];
  for (const configObj of configArray) {
    if (configObj && typeof configObj === 'object' && !Array.isArray(configObj)) {
      const obj = configObj as Record<string, unknown>;
      if (obj['rules'] && typeof obj['rules'] === 'object' && !Array.isArray(obj['rules'])) {
        for (const [ruleName, ruleValue] of Object.entries(obj['rules'] as Record<string, unknown>)) {
          rules.push(parseRuleEntry(ruleName, ruleValue));
        }
      }
    }
  }
  return rules;
}

/** File extensions that require dynamic import (JS-like configs). */
const JS_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts']);

/**
 * Parse an ESLint config file synchronously.
 *
 * Only supports JSON config files. For JS/TS config files,
 * use parseEslintConfigAsync instead.
 *
 * @param filePath - Absolute or relative path to the ESLint config file
 * @returns A ParsedEslintConfig with all rules found in the file
 * @throws If the file is a JS/TS config or cannot be read/parsed
 */
export function parseEslintConfig(filePath: string): ParsedEslintConfig {
  const ext = extname(filePath).toLowerCase();

  if (JS_EXTENSIONS.has(ext)) {
    throw new Error(
      `JS/TS ESLint config files (${filePath}) require runtime module resolution. ` +
      `Use the async parseEslintConfigAsync function instead.`,
    );
  }

  // JSON config files
  const content = readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse ESLint config at ${filePath}: ${message}`);
  }

  // Determine config format: array = flat config, object = legacy
  if (Array.isArray(parsed)) {
    return {
      rules: extractFlatConfigRules(parsed),
      sourceFile: filePath,
    };
  }

  if (parsed && typeof parsed === 'object') {
    return {
      rules: extractLegacyRules(parsed as Record<string, unknown>),
      sourceFile: filePath,
    };
  }

  throw new Error(`Unexpected ESLint config format at ${filePath}: expected object or array`);
}

/**
 * Parse an ESLint config file asynchronously.
 *
 * Supports all formats including JS/TS config files that require
 * dynamic import. JSON configs are parsed synchronously as a fast path.
 *
 * @param filePath - Absolute or relative path to the ESLint config file
 * @returns A ParsedEslintConfig with all rules found in the file
 * @throws If the file cannot be read, parsed, or imported
 */
export async function parseEslintConfigAsync(filePath: string): Promise<ParsedEslintConfig> {
  const ext = extname(filePath).toLowerCase();

  // JSON configs can be parsed synchronously
  if (!JS_EXTENSIONS.has(ext)) {
    return parseEslintConfig(filePath);
  }

  // JS/TS configs require dynamic import
  const absolutePath = resolve(filePath);
  const fileUrl = new URL(`file://${absolutePath}`).href;

  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ fileUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to import ESLint config at ${filePath}: ${message}. ` +
      `Ensure all plugin dependencies are installed, or convert to .eslintrc.json for reliable parsing.`,
    );
  }

  const config = (mod as Record<string, unknown>)['default'] ?? mod;

  if (Array.isArray(config)) {
    return {
      rules: extractFlatConfigRules(config),
      sourceFile: filePath,
    };
  }

  if (config && typeof config === 'object') {
    return {
      rules: extractLegacyRules(config as Record<string, unknown>),
      sourceFile: filePath,
    };
  }

  throw new Error(`Unexpected ESLint config format in ${filePath}: expected object or array`);
}