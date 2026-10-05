import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { minimatch } from 'minimatch';
import type { InstructionScope } from '../types.js';

function scopePatterns(value: unknown, field: string): string[] {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  if (!values.every(item => typeof item === 'string')) throw new Error(`${field} must be a string or an array of strings.`);
  const patterns: string[] = [];
  for (const value of values as string[]) {
    let depth = 0;
    let start = 0;
    for (let index = 0; index <= value.length; index++) {
      const char = value[index];
      if (char && '{[('.includes(char)) depth++;
      if (char && '}])'.includes(char)) depth--;
      if (index === value.length || (char === ',' && depth === 0)) {
        const pattern = value.slice(start, index).trim();
        if (pattern) patterns.push(pattern);
        start = index + 1;
      }
    }
  }
  if (patterns.some(pattern => isAbsolute(pattern) || pattern.split('/').includes('..') || pattern.startsWith('!'))) {
    throw new Error(`${field} requires relative inclusion globs; absolute paths, parent traversal and negation are unsupported.`);
  }
  return patterns;
}

/** Strip scope frontmatter without shifting the source line numbers. */
export function parseInstructionScope(content: string, filePath: string): { content: string; scope?: InstructionScope } {
  const absolutePath = resolve(filePath);
  const cursor = /\.mdc$/i.test(filePath);
  const copilot = /\.instructions\.md$/i.test(filePath);
  if (!cursor && !copilot) {
    return { content, ...(basename(filePath).toUpperCase() === 'AGENTS.MD'
      ? { scope: { baseDir: dirname(absolutePath), patterns: ['**/*'], conditional: false } } : {}) };
  }
  const lines = content.split(/\r?\n/);
  let metadata: Record<string, unknown> = {};
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end < 0) throw new Error(`Unclosed frontmatter in ${filePath}`);
    const document = parseDocument(lines.slice(1, end).join('\n'));
    if (document.errors.length || document.warnings.length) {
      throw new Error(`Invalid scope frontmatter in ${filePath}: ${[...document.errors, ...document.warnings].map(error => error.message).join('; ')}`);
    }
    const data: unknown = document.toJS({ maxAliasCount: 0 });
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) throw new Error(`Expected frontmatter object in ${filePath}`);
    metadata = (data ?? {}) as Record<string, unknown>;
    lines.fill('', 0, end + 1);
  }
  const always = metadata['alwaysApply'];
  if (always !== undefined && typeof always !== 'boolean') throw new Error(`alwaysApply must be boolean in ${filePath}`);
  const patterns = scopePatterns(metadata[cursor ? 'globs' : 'applyTo'], cursor ? 'globs' : 'applyTo');
  if (copilot && patterns.length === 0) throw new Error(`Missing applyTo scope in ${filePath}`);
  const normalized = absolutePath.replaceAll('\\', '/');
  const marker = cursor ? '/.cursor/rules/' : '/.github/instructions/';
  const index = normalized.lastIndexOf(marker);
  const baseDir = index >= 0 ? normalized.slice(0, index) : dirname(absolutePath);
  return {
    content: lines.join('\n'),
    scope: { baseDir, patterns: always === true ? ['**/*'] : patterns,
      conditional: cursor && always !== true && patterns.length === 0 },
  };
}

export function scopeApplies(scope: InstructionScope | undefined, absoluteFile: string): boolean {
  if (!scope) return true;
  if (scope.conditional) return false;
  const path = relative(scope.baseDir, absoluteFile).replaceAll('\\', '/');
  if (path === '..' || path.startsWith('../') || isAbsolute(path)) return false;
  return scope.patterns.some(pattern => minimatch(path, pattern, { dot: true }));
}
