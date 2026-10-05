import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import { INSTRUCTION_FILE_NAMES } from '../types.js';

/** Discover root formats and scoped instructions, excluding dependencies and external symlinks. */
export function discoverInstructionFiles(projectDir: string): string[] {
  const root = resolve(projectDir);
  const files = globSync([
    ...INSTRUCTION_FILE_NAMES, '**/AGENTS.md', '.cursor/rules/*.mdc', '.github/instructions/**/*.instructions.md',
  ], { cwd: root, nodir: true, dot: true, follow: false,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'] }).sort();
  const seen = new Set<string>();
  return files.flatMap(file => {
    const fullPath = resolve(root, file);
    const real = realpathSync(fullPath);
    const path = relative(realpathSync(root), real).replaceAll('\\', '/');
    if (path === '..' || path.startsWith('../') || isAbsolute(path)) return [];
    // Identical content in different directories still has different applicability.
    const key = `${real}:${dirname(fullPath)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [fullPath];
  });
}
