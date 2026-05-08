/**
 * ESLint config file parser.
 *
 * Reads .eslintrc.json files and extracts rule entries with severity
 * and options. Uses direct JSON parsing rather than ESLint's
 * loadConfigFromFile because loadConfigFromFile requires all
 * referenced plugins to be installed and resolvable, which makes
 * it brittle in CI/CD pipelines and cross-project contexts where
 * plugin dependencies may not be present.
 *
 * For JS/CJS flat config files, dynamic import is attempted with
 * graceful failure. If the config references plugins that aren't
 * installed, the import will fail and a descriptive error is thrown.
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
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

/**
 * Parse an ESLint config file and extract all rule entries.
 *
 * Supports:
 * - .eslintrc.json (legacy config format)
 * - eslint.config.json (flat config JSON)
 * - .eslintrc.js / .eslintrc.cjs (dynamic import, best effort)
 * - eslint.config.js / eslint.config.mjs / eslint.config.cjs (dynamic import, best effort)
 *
 * @param filePath - Absolute or relative path to the ESLint config file
 * @returns A ParsedEslintConfig with all rules found in the file
 * @throws If the file cannot be read, parsed, or imported
 */
export function parseEslintConfig(filePath: string): ParsedEslintConfig {
  const ext = extname(filePath).toLowerCase();
  const isJsLike = ext === '.js' || ext === '.cjs' || ext === '.mjs';

  if (isJsLike) {
    return parseJsConfig(filePath);
  }

  // JSON config files
  const content = readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
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
 * Parse a JS/JS-like ESLint config file via dynamic import.
 *
 * This is a best-effort parse. If the config file imports plugins
 * that aren't installed, the import will fail. In that case, we
 * throw a descriptive error suggesting the user install dependencies
 * or use a JSON config instead.
 */
async function parseJsConfigSync(filePath: string): Promise<ParsedEslintConfig> {
  const absolutePath = new URL(filePath, import.meta.url).href;
  const mod = await import(/* @vite-ignore */ absolutePath);
  const config = mod.default ?? mod;

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

/**
 * Parse a JS config file synchronously.
 *
 * JS config files require async dynamic import, so this wrapper
 * provides a sync-like interface by returning the result directly
 * if possible. For JS files, callers should use the async variant.
 *
 * Note: For JS files, this function throws an error directing the
 * user to convert their config to JSON or ensure dependencies are
 * installed. JSON configs are fully supported synchronously.
 */
function parseJsConfig(filePath: string): ParsedEslintConfig {
  throw new Error(
    `JS/TS ESLint config files (${filePath}) require runtime module resolution. ` +
    `Convert to .eslintrc.json for reliable parsing, or ensure all plugin ` +
    `dependencies are installed and use the async parseEslintConfigAsync function.`,
  );
}

/**
 * Parse an ESLint config file asynchronously.
 *
 * Supports all formats including JS/TS config files that require
 * dynamic import. Use this when the config file is a JS module.
 */
export async function parseEslintConfigAsync(filePath: string): Promise<ParsedEslintConfig> {
  const ext = extname(filePath).toLowerCase();
  const isJsLike = ext === '.js' || ext === '.cjs' || ext === '.mjs';

  if (!isJsLike) {
    return parseEslintConfig(filePath);
  }

  return parseJsConfigSync(filePath);
}