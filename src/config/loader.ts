/**
 * Configuration file discovery and loading.
 *
 * Searches for ruleprobe configuration in standard locations,
 * loads it, and validates the structure. Supports .ts, .js, and
 * .json config formats.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { RuleProbeConfig, CustomRule, RuleOverride } from './types.js';
import type { RuleCategory, VerifierType } from '../types.js';

/** Valid rule categories. */
const VALID_CATEGORIES: Set<string> = new Set([
  'naming', 'forbidden-pattern', 'structure', 'import-pattern',
  'error-handling', 'type-safety', 'code-style', 'agent-behavior',
]);

/** Valid verifier types. */
const VALID_VERIFIERS: Set<string> = new Set(['ast', 'regex', 'filesystem']);

/** Config file names searched in order of priority. */
const CONFIG_FILE_NAMES = [
  'ruleprobe.config.ts',
  'ruleprobe.config.js',
  'ruleprobe.config.json',
  '.ruleproberc.json',
];

/**
 * Discover a config file by walking up from a starting directory.
 *
 * Checks each standard config file name in the directory, then
 * moves to the parent until the filesystem root is reached.
 *
 * @param startDir - Directory to start searching from
 * @returns Absolute path to the config file, or null if not found
 */
export function findConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);
  const root = resolve('/');

  while (dir !== root) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

/**
 * Load and parse a JSON config file.
 *
 * @param filePath - Absolute path to a .json config file
 * @returns Parsed configuration
 * @throws Error if the file cannot be read or parsed
 */
function loadJsonConfig(filePath: string): RuleProbeConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must export an object: ${filePath}`);
  }
  return parsed as RuleProbeConfig;
}

/**
 * Load and import a .ts or .js config file using dynamic import.
 *
 * For TypeScript files, the consumer must have a loader registered
 * (tsx, ts-node, etc). This function handles both default and
 * named exports.
 *
 * @param filePath - Absolute path to a .ts or .js config file
 * @returns Parsed configuration
 * @throws Error if the file cannot be imported or has no valid export
 */
async function loadModuleConfig(filePath: string): Promise<RuleProbeConfig> {
  const imported: unknown = await import(filePath);
  const mod = imported as Record<string, unknown>;

  if (mod['default'] && typeof mod['default'] === 'object') {
    return mod['default'] as RuleProbeConfig;
  }

  if (mod['config'] && typeof mod['config'] === 'object') {
    return mod['config'] as RuleProbeConfig;
  }

  if (typeof mod === 'object' && !Array.isArray(mod)) {
    return mod as unknown as RuleProbeConfig;
  }

  throw new Error(
    `Config file must export a default object or a named "config" export: ${filePath}`,
  );
}

/**
 * Validate that a custom rule has all required fields and valid values.
 *
 * @param rule - The custom rule to validate
 * @param index - Index in the rules array (for error messages)
 * @throws Error if the rule is invalid
 */
function validateCustomRule(rule: CustomRule, index: number): void {
  const prefix = `config.rules[${index}]`;

  if (!rule.id || typeof rule.id !== 'string') {
    throw new Error(`${prefix}.id must be a non-empty string`);
  }
  if (!rule.category || typeof rule.category !== 'string') {
    throw new Error(`${prefix}.category must be a valid RuleCategory`);
  }
  if (typeof rule.category === 'string' && !VALID_CATEGORIES.has(rule.category)) {
    throw new Error(`${prefix}.category must be one of: ${[...VALID_CATEGORIES].join(', ')}; got "${rule.category}"`);
  }
  if (!rule.description || typeof rule.description !== 'string') {
    throw new Error(`${prefix}.description must be a non-empty string`);
  }
  if (!rule.verifier || typeof rule.verifier !== 'string') {
    throw new Error(`${prefix}.verifier must be one of: ${[...VALID_VERIFIERS].join(', ')}`);
  }
  if (typeof rule.verifier === 'string' && !VALID_VERIFIERS.has(rule.verifier)) {
    throw new Error(`${prefix}.verifier must be one of: ${[...VALID_VERIFIERS].join(', ')}; got "${rule.verifier}"`);
  }
  if (!rule.pattern || typeof rule.pattern !== 'object') {
    throw new Error(`${prefix}.pattern must be a VerificationPattern object`);
  }
  if (!rule.pattern.type || typeof rule.pattern.type !== 'string') {
    throw new Error(`${prefix}.pattern.type must be a non-empty string`);
  }
}

/**
 * Validate a rule override definition.
 *
 * @param override - The override to validate
 * @param index - Index in the overrides array (for error messages)
 * @throws Error if the override is invalid
 */
function validateOverride(override: RuleOverride, index: number): void {
  const prefix = `config.overrides[${index}]`;

  if (!override.ruleId || typeof override.ruleId !== 'string') {
    throw new Error(`${prefix}.ruleId must be a non-empty string`);
  }
}

/**
 * Validate a loaded config object structure.
 *
 * @param config - The config to validate
 * @throws Error if any field is invalid
 */
export function validateConfig(config: RuleProbeConfig): void {
  if (config.rules) {
    if (!Array.isArray(config.rules)) {
      throw new Error('config.rules must be an array');
    }
    for (let i = 0; i < config.rules.length; i++) {
      validateCustomRule(config.rules[i]!, i);
    }
  }

  if (config.overrides) {
    if (!Array.isArray(config.overrides)) {
      throw new Error('config.overrides must be an array');
    }
    for (let i = 0; i < config.overrides.length; i++) {
      validateOverride(config.overrides[i]!, i);
    }
  }

  if (config.exclude) {
    if (!Array.isArray(config.exclude)) {
      throw new Error('config.exclude must be an array of strings');
    }
    for (const id of config.exclude) {
      if (typeof id !== 'string') {
        throw new Error('config.exclude entries must be strings');
      }
    }
  }
}

/**
 * Load a config file from an explicit path or auto-discover it.
 *
 * When configPath is provided, loads that file directly. Otherwise,
 * searches for a config file starting from the current directory.
 * Returns null if no config file is found during auto-discovery.
 *
 * @param configPath - Explicit path to a config file, or undefined for auto-discovery
 * @param searchDir - Directory to start auto-discovery from (defaults to cwd)
 * @returns Parsed and validated config, or null if not found
 * @throws Error if the file is specified but doesn't exist, or if validation fails
 */
export async function loadConfig(
  configPath?: string,
  searchDir?: string,
): Promise<RuleProbeConfig | null> {
  let filePath: string | null;

  if (configPath) {
    filePath = resolve(configPath);
    if (!existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }
  } else {
    filePath = findConfigFile(searchDir ?? process.cwd());
    if (!filePath) {
      return null;
    }
  }

  let config: RuleProbeConfig;

  if (filePath.endsWith('.json')) {
    config = loadJsonConfig(filePath);
  } else {
    config = await loadModuleConfig(filePath);
  }

  validateConfig(config);
  return config;
}
