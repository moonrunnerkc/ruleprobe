import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { verifyRegexRule } from '../../src/verifier/regex-verifier.js';
import { verifyFileSystemRule } from '../../src/verifier/file-verifier.js';
import type { Rule } from '../../src/types.js';

const tmpDir = resolve(import.meta.dirname, '..', '.tmp-extended-tests');

/** Build a Rule for testing. */
function makeRule(
  patternType: string,
  verifier: 'regex' | 'filesystem',
  expected: string | boolean = false,
): Rule {
  return {
    id: `test-${patternType}`,
    category: 'forbidden-pattern',
    source: 'test rule',
    description: `test ${patternType}`,
    severity: 'error',
    verifier,
    pattern: { type: patternType, target: '*.ts', expected, scope: 'file' },
  };
}

/** Create a temp file with content and return its path. */
function createTempFile(name: string, content: string): string {
  const dir = join(tmpDir, 'src');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

function cleanup(): void {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('regex verifier: ts-directives check', () => {
  it('detects @ts-ignore comments', () => {
    const file = createTempFile('directives.ts', '// @ts-ignore\nconst x = 1;\n');
    const result = verifyRegexRule(makeRule('no-ts-directives', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(false);
    expect(result.evidence[0]!.found).toContain('@ts-ignore');
    cleanup();
  });

  it('detects @ts-nocheck comments', () => {
    const file = createTempFile('nocheck.ts', '// @ts-nocheck\nconst x = 1;\n');
    const result = verifyRegexRule(makeRule('no-ts-directives', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(false);
    cleanup();
  });

  it('passes clean files', () => {
    const file = createTempFile('clean.ts', 'const x = 1;\nexport { x };\n');
    const result = verifyRegexRule(makeRule('no-ts-directives', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(true);
    cleanup();
  });
});

describe('regex verifier: test .only() check', () => {
  it('detects describe.only', () => {
    const file = createTempFile('focus.test.ts', "describe.only('test', () => {});\n");
    const result = verifyRegexRule(makeRule('no-test-only', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(false);
    cleanup();
  });

  it('passes clean test files', () => {
    const file = createTempFile('clean.test.ts', "describe('test', () => {});\n");
    const result = verifyRegexRule(makeRule('no-test-only', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(true);
    cleanup();
  });
});

describe('regex verifier: test .skip() check', () => {
  it('detects it.skip', () => {
    const file = createTempFile('skipped.test.ts', "it.skip('test', () => {});\n");
    const result = verifyRegexRule(makeRule('no-test-skip', 'regex'), [file], tmpDir);
    expect(result.passed).toBe(false);
    cleanup();
  });
});

describe('regex verifier: quote style check', () => {
  it('detects double-quoted imports', () => {
    const file = createTempFile('quotes.ts', 'import { x } from "module";\n');
    const result = verifyRegexRule(makeRule('quote-style', 'regex', 'single'), [file], tmpDir);
    expect(result.passed).toBe(false);
    cleanup();
  });

  it('passes single-quoted imports', () => {
    const file = createTempFile('quotes-ok.ts', "import { x } from 'module';\n");
    const result = verifyRegexRule(makeRule('quote-style', 'regex', 'single'), [file], tmpDir);
    expect(result.passed).toBe(true);
    cleanup();
  });
});

describe('filesystem verifier: file exists checks', () => {
  it('detects missing README', () => {
    const dir = join(tmpDir, 'no-readme');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.ts'), 'export {};');
    const files = [join(dir, 'index.ts')];
    const result = verifyFileSystemRule(makeRule('readme-exists', 'filesystem'), dir, files);
    expect(result.passed).toBe(false);
    cleanup();
  });

  it('passes when README exists', () => {
    const dir = join(tmpDir, 'has-readme');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), '# Project');
    const files = [join(dir, 'README.md')];
    const result = verifyFileSystemRule(makeRule('readme-exists', 'filesystem'), dir, files);
    expect(result.passed).toBe(true);
    cleanup();
  });
});

describe('filesystem verifier: pinned dependencies', () => {
  it('detects unpinned dependencies', () => {
    const dir = join(tmpDir, 'unpinned');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: { lodash: '^4.17.21' },
    }));
    const result = verifyFileSystemRule(
      makeRule('pinned-dependencies', 'filesystem'),
      dir,
      [join(dir, 'package.json')],
    );
    expect(result.passed).toBe(false);
    expect(result.evidence[0]!.found).toContain('^4.17.21');
    cleanup();
  });

  it('passes with pinned dependencies', () => {
    const dir = join(tmpDir, 'pinned');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: { lodash: '4.17.21' },
    }));
    const result = verifyFileSystemRule(
      makeRule('pinned-dependencies', 'filesystem'),
      dir,
      [join(dir, 'package.json')],
    );
    expect(result.passed).toBe(true);
    cleanup();
  });
});

describe('filesystem verifier: formatter config', () => {
  it('detects missing formatter config', () => {
    const dir = join(tmpDir, 'no-formatter');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.ts'), 'export {};');
    const result = verifyFileSystemRule(
      makeRule('formatter-config-exists', 'filesystem'),
      dir,
      [join(dir, 'index.ts')],
    );
    expect(result.passed).toBe(false);
    cleanup();
  });

  it('passes when .prettierrc exists', () => {
    const dir = join(tmpDir, 'has-prettier');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.prettierrc'), '{}');
    const result = verifyFileSystemRule(
      makeRule('formatter-config-exists', 'filesystem'),
      dir,
      [join(dir, '.prettierrc')],
    );
    expect(result.passed).toBe(true);
    cleanup();
  });
});
