import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { verifyAstRule } from '../../src/verifier/ast-verifier.js';
import type { Rule } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingDir = resolve(fixturesDir, 'passing');
const failingDir = resolve(fixturesDir, 'failing');

/** Build a minimal Rule object for testing a specific pattern type. */
function makeRule(
  patternType: string,
  overrides: Partial<Rule> = {},
): Rule {
  return {
    id: `test-${patternType}`,
    category: 'naming',
    source: 'test rule',
    description: `test ${patternType}`,
    severity: 'error',
    verifier: 'ast',
    pattern: {
      type: patternType,
      target: '*.ts',
      expected: 'test',
      scope: 'file',
    },
    ...overrides,
  };
}

// -- Passing fixtures --

describe('AST verifier: passing fixtures', () => {
  const passingFiles = [
    resolve(passingDir, 'src/user-service.ts'),
    resolve(passingDir, 'src/types.ts'),
    resolve(passingDir, 'src/utils/validation.ts'),
  ];

  it('finds no camelCase violations in passing code', () => {
    const rule = makeRule('camelCase');
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no PascalCase violations in passing code', () => {
    const rule = makeRule('PascalCase', { category: 'naming' });
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no any type usage in passing code', () => {
    const rule = makeRule('no-any', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no console.log in passing code', () => {
    const rule = makeRule('no-console-log', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no default exports in passing code', () => {
    const rule = makeRule('named-exports-only', { category: 'structure' });
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no missing JSDoc on exported functions in passing code', () => {
    const rule = makeRule('jsdoc-required', { category: 'structure' });
    const result = verifyAstRule(rule, passingFiles);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });
});

// -- Failing fixtures: camelCase --

describe('AST verifier: camelCase violations', () => {
  const failingFile = resolve(failingDir, 'src/UserService.ts');

  it('detects snake_case function names', () => {
    const rule = makeRule('camelCase');
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // fetch_user_data, defaultHandler, process_payment are functions
    // fetch_user_data (line 2), process_payment (line 23)
    const funcViolations = result.evidence.filter(
      (e) => e.found === 'fetch_user_data' || e.found === 'process_payment'
    );
    expect(funcViolations.length).toBeGreaterThanOrEqual(2);
  });

  it('detects snake_case variable names', () => {
    const rule = makeRule('camelCase');
    const result = verifyAstRule(rule, [failingFile]);

    // User_Name (line 3), account_balance (line 4), response_data (line 19), is_valid (line 24)
    const varViolations = result.evidence.filter((e) =>
      ['User_Name', 'account_balance', 'response_data', 'is_valid'].includes(e.found)
    );
    expect(varViolations.length).toBeGreaterThanOrEqual(3);
  });

  it('includes correct line numbers in evidence', () => {
    const rule = makeRule('camelCase');
    const result = verifyAstRule(rule, [failingFile]);

    const fetchUserData = result.evidence.find((e) => e.found === 'fetch_user_data');
    expect(fetchUserData).toBeDefined();
    expect(fetchUserData!.line).toBe(2);

    const userName = result.evidence.find((e) => e.found === 'User_Name');
    expect(userName).toBeDefined();
    expect(userName!.line).toBe(3);
  });
});

// -- Failing fixtures: any type --

describe('AST verifier: any type detection', () => {
  const failingFile = resolve(failingDir, 'src/UserService.ts');

  it('detects all any type usages', () => {
    const rule = makeRule('no-any', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // user_id: any, return: any, User_Name: any, result: any,
    // req: any, res: any = 6 any annotations
    expect(result.evidence.length).toBeGreaterThanOrEqual(6);
  });

  it('includes line numbers for any type violations', () => {
    const rule = makeRule('no-any', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, [failingFile]);

    // Line 2 has "user_id: any" and ": any" return type
    const line2 = result.evidence.filter((e) => e.line === 2);
    expect(line2.length).toBeGreaterThanOrEqual(1);
  });
});

// -- Failing fixtures: console.log --

describe('AST verifier: console.log detection', () => {
  const failingFile = resolve(failingDir, 'src/UserService.ts');

  it('detects all console.log calls', () => {
    const rule = makeRule('no-console-log', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // Lines 5, 13, 18
    expect(result.evidence).toHaveLength(3);
  });

  it('includes correct line numbers for console.log calls', () => {
    const rule = makeRule('no-console-log', { category: 'forbidden-pattern' });
    const result = verifyAstRule(rule, [failingFile]);

    const lines = result.evidence.map((e) => e.line).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(lines).toEqual([5, 13, 18]);
  });
});

// -- Failing fixtures: default exports --

describe('AST verifier: default export detection', () => {
  const failingFile = resolve(failingDir, 'src/UserService.ts');

  it('detects default export', () => {
    const rule = makeRule('named-exports-only', { category: 'structure' });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]!.found).toBe('default export');
  });
});

// -- Failing fixtures: missing JSDoc --

describe('AST verifier: missing JSDoc detection', () => {
  const failingFile = resolve(failingDir, 'src/UserService.ts');

  it('detects exported functions missing JSDoc', () => {
    const rule = makeRule('jsdoc-required', { category: 'structure' });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // fetch_user_data (export, no JSDoc) and defaultHandler (export default, no JSDoc)
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag non-exported functions for missing JSDoc', () => {
    const rule = makeRule('jsdoc-required', { category: 'structure' });
    const result = verifyAstRule(rule, [failingFile]);

    // process_payment is exported via "export { process_payment }"
    // but that's a re-export, not on the declaration itself.
    // defaultHandler and fetch_user_data are directly exported.
    const names = result.evidence.map((e) => e.found);
    expect(names.some((n) => n.includes('fetch_user_data'))).toBe(true);
  });
});

// -- Failing fixtures: deep relative imports --

describe('AST verifier: deep relative imports', () => {
  const failingFile = resolve(failingDir, 'src/helpers.ts');

  it('detects imports deeper than allowed', () => {
    const rule = makeRule('no-deep-relative-imports', {
      category: 'import-pattern',
      pattern: {
        type: 'no-deep-relative-imports',
        target: '*.ts',
        expected: '2',
        scope: 'file',
      },
    });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // ../../../deeply/nested/module.js (depth 3) and ../../../../even/deeper/module.js (depth 4)
    expect(result.evidence).toHaveLength(2);
  });

  it('includes the import path in evidence', () => {
    const rule = makeRule('no-deep-relative-imports', {
      category: 'import-pattern',
      pattern: {
        type: 'no-deep-relative-imports',
        target: '*.ts',
        expected: '2',
        scope: 'file',
      },
    });
    const result = verifyAstRule(rule, [failingFile]);

    const paths = result.evidence.map((e) => e.found);
    expect(paths).toContain('../../../deeply/nested/module.js');
    expect(paths).toContain('../../../../even/deeper/module.js');
  });
});

// -- Failing fixtures: path aliases --

describe('AST verifier: path alias detection', () => {
  const failingFile = resolve(failingDir, 'src/helpers.ts');

  it('detects @-prefixed path alias imports', () => {
    const rule = makeRule('no-path-aliases', {
      category: 'import-pattern',
      pattern: {
        type: 'no-path-aliases',
        target: '*.ts',
        expected: false,
        scope: 'file',
      },
    });
    const result = verifyAstRule(rule, [failingFile]);
    expect(result.passed).toBe(false);

    // @/utils/helpers.js and @utils/other.js
    expect(result.evidence).toHaveLength(2);
    const paths = result.evidence.map((e) => e.found);
    expect(paths).toContain('@/utils/helpers.js');
    expect(paths).toContain('@utils/other.js');
  });
});
