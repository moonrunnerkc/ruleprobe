import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import type { ESLint as ESLintInstance } from 'eslint';
import { parseEslintConfigAsync, parseConfigObject } from './parse-eslint-config.js';
import type { ParsedEslintConfig } from './types.js';

export interface ResolveConfigOptions {
  cwd?: string;
  files?: string[];
  configJson?: boolean;
}

/** Resolve each file with the repository's ESLint. JSON mode never loads repository modules. */
export async function resolveEslintConfigs(
  configFile: string,
  options: ResolveConfigOptions = {},
): Promise<ParsedEslintConfig[]> {
  const absoluteConfig = resolve(configFile);
  const cwd = resolve(options.cwd ?? dirname(absoluteConfig));
  if (options.configJson) {
    const data: unknown = JSON.parse(readFileSync(absoluteConfig, 'utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data) && 'files' in data) {
      const files: unknown = data.files;
      if (!files || typeof files !== 'object' || Array.isArray(files)) {
        throw new Error('JSON snapshots require a files object keyed by relative source paths.');
      }
      const entries = Object.entries(files);
      const requested = options.files?.map(file => relative(cwd, resolve(cwd, file)).replaceAll('\\', '/'));
      if (requested?.some(file => !Object.hasOwn(files, file))) {
        throw new Error('A requested file is missing from the JSON snapshot.');
      }
      return entries.filter(([file]) => !requested || requested.includes(file)).map(([file, config]) => {
        if (!config || typeof config !== 'object' || Array.isArray(config) || !('rules' in config)
          || !config.rules || typeof config.rules !== 'object' || Array.isArray(config.rules)) {
          throw new Error(`Invalid resolved rules snapshot for ${file}`);
        }
        return { ...parseConfigObject(config, configFile), filePath: file, resolution: 'json', fallbackReason: undefined };
      });
    }
    return [{ ...parseConfigObject(data, configFile), resolution: 'fallback',
      fallbackReason: 'JSON contains static rules, not per-file calculateConfigForFile snapshots.' }];
  }

  if (extname(configFile) === '.json') {
    return [{ ...await parseEslintConfigAsync(configFile), resolution: 'fallback',
      fallbackReason: 'Static JSON config; extends, overrides, plugins and file applicability are not resolved.' }];
  }
  const paths = options.files ?? globSync('**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}', {
    cwd, nodir: true, ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'],
  }).sort();
  if (paths.length === 0) return [];

  try {
    const require = createRequire(absoluteConfig);
    const { ESLint } = require('eslint') as { ESLint: typeof ESLintInstance };
    const eslint = new ESLint({ cwd, overrideConfigFile: absoluteConfig });
    const configs: ParsedEslintConfig[] = [];
    for (const file of paths) {
      const absoluteFile = resolve(cwd, file);
      const config: unknown = await eslint.calculateConfigForFile(absoluteFile);
      configs.push({
        ...parseConfigObject(config ?? { rules: {} }, configFile),
        filePath: relative(cwd, absoluteFile).replaceAll('\\', '/'), resolution: 'eslint',
        ignored: config === undefined,
      });
    }
    return configs;
  } catch (error) {
    const fallback = await parseEslintConfigAsync(configFile);
    return [{ ...fallback, resolution: 'fallback',
      fallbackReason: `ESLint resolution failed: ${error instanceof Error ? error.message : String(error)}. Static rules do not establish file applicability.` }];
  }
}
