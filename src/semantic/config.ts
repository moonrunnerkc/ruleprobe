/**
 * Semantic analysis configuration.
 *
 * Resolves license key and API endpoint from CLI flags, environment
 * variables, and the .ruleprobe/config.json file (in that priority order).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SemanticAnalysisConfig } from './types.js';

/**
 * Default API endpoint for local development.
 * Updated to the production VPS URL once the API service is deployed.
 */
const LOCAL_DEV_ENDPOINT = 'http://localhost:3000';

/** Environment variable name for the API endpoint override. */
const API_ENDPOINT_ENV_VAR = 'RULEPROBE_API_ENDPOINT';

/** Environment variable name for the license key. */
const LICENSE_KEY_ENV_VAR = 'RULEPROBE_LICENSE_KEY';

/** Relative path to the dotfile-based config within the project. */
const DOTFILE_CONFIG_PATH = '.ruleprobe/config.json';

/**
 * Default maximum LLM calls per semantic analysis run.
 * Hard stop to control Anthropic API costs.
 * Based on analysis of typical instruction file sizes (10-40 rules).
 */
const DEFAULT_MAX_LLM_CALLS = 20;

/**
 * Pre-calibration fast-path similarity threshold.
 * Rules scoring above this are resolved without LLM.
 * Will be updated after calibration on excalidraw and PostHog fixtures.
 */
const PRE_CALIBRATION_FAST_PATH_THRESHOLD = 0.85;

/** Shape of the .ruleprobe/config.json file's semantic fields. */
interface DotfileConfig {
  licenseKey?: string;
  apiEndpoint?: string;
}

/**
 * Options passed from the CLI to override config resolution.
 * Each field corresponds to a CLI flag.
 */
export interface SemanticCliOptions {
  licenseKey?: string;
  maxLlmCalls?: number;
  noCache?: boolean;
  semanticLog?: boolean;
  costReport?: boolean;
}

/**
 * Read and parse the .ruleprobe/config.json file from a project directory.
 *
 * @param projectDir - Root directory of the project
 * @returns Parsed dotfile config, or null if the file does not exist or is invalid
 */
function readDotfileConfig(projectDir: string): DotfileConfig | null {
  const configPath = join(projectDir, DOTFILE_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as DotfileConfig;
  } catch {
    return null;
  }
}

/**
 * Resolve the semantic analysis configuration.
 *
 * Priority order for license key: CLI flag > env var > .ruleprobe/config.json
 * Priority order for API endpoint: env var > .ruleprobe/config.json > default
 *
 * @param projectDir - Root directory of the project being analyzed
 * @param cliOptions - Options from CLI flags
 * @returns Resolved semantic analysis config, or null if no license key is available
 */
export function resolveSemanticConfig(
  projectDir: string,
  cliOptions: SemanticCliOptions,
): SemanticAnalysisConfig | null {
  const dotfile = readDotfileConfig(projectDir);

  const licenseKey =
    cliOptions.licenseKey ??
    process.env[LICENSE_KEY_ENV_VAR] ??
    dotfile?.licenseKey ??
    undefined;

  if (licenseKey === undefined) {
    return null;
  }

  const apiEndpoint =
    process.env[API_ENDPOINT_ENV_VAR] ??
    dotfile?.apiEndpoint ??
    LOCAL_DEV_ENDPOINT;

  return {
    apiEndpoint,
    licenseKey,
    maxLlmCalls: cliOptions.maxLlmCalls ?? DEFAULT_MAX_LLM_CALLS,
    useCache: cliOptions.noCache !== true,
    fastPathThreshold: PRE_CALIBRATION_FAST_PATH_THRESHOLD,
  };
}
