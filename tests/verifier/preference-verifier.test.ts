/**
 * Tests for preference verifier counting logic.
 *
 * Uses real code snippets in temp files to verify that
 * the preference verifier counts preferred vs alternative
 * patterns correctly and returns proper compliance ratios.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyPreferenceRule } from '../../src/verifier/preference-verifier.js';
import type { Rule } from '../../src/types.js';

const testDir = join(tmpdir(), 'ruleprobe-pref-test-' + Date.now());

function makeRule(pairId: string): Rule {
  return {
    id: `preference-${pairId}-1`,
    category: 'preference',
    source: `Prefer X over Y`,
    description: `Preference check for ${pairId}`,
    severity: 'warning',
    verifier: 'preference',
    pattern: { type: 'prefer-pair', target: pairId, expected: 'preferred', scope: 'project' },
  };
}

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('preference verifier: const-vs-let', () => {
  it('returns compliance 1 when all const', () => {
    const file = join(testDir, 'all-const.ts');
    writeFileSync(file, `
const a = 1;
const b = 2;
const c = 3;
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    expect(result.compliance).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('returns compliance 0 when all let', () => {
    const file = join(testDir, 'all-let.ts');
    writeFileSync(file, `
let a = 1;
let b = 2;
let c = 3;
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    expect(result.compliance).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('returns intermediate compliance for mixed usage', () => {
    const file = join(testDir, 'mixed-const-let.ts');
    writeFileSync(file, `
const a = 1;
const b = 2;
const c = 3;
let d = 4;
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    expect(result.compliance).toBe(0.75);
    expect(result.passed).toBe(false); // below 0.8 threshold
  });
});

describe('preference verifier: interface-vs-type', () => {
  it('returns compliance 1 when all interfaces', () => {
    const file = join(testDir, 'all-interface.ts');
    writeFileSync(file, `
interface Foo { name: string; }
interface Bar { value: number; }
`);
    const result = verifyPreferenceRule(makeRule('interface-vs-type'), [file]);
    expect(result.compliance).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('returns compliance ratio for mixed interface and type', () => {
    const file = join(testDir, 'mixed-interface-type.ts');
    writeFileSync(file, `
interface Foo { name: string; }
interface Bar { value: number; }
type Baz = { id: string };
`);
    const result = verifyPreferenceRule(makeRule('interface-vs-type'), [file]);
    // 2 interfaces, 1 type = 2/3 ~ 0.667
    expect(result.compliance).toBeCloseTo(0.667, 2);
    expect(result.passed).toBe(false);
  });
});

describe('preference verifier: named-vs-default-exports', () => {
  it('reports high compliance for all named exports', () => {
    const file = join(testDir, 'named-exports.ts');
    writeFileSync(file, `
export const foo = 1;
export function bar() {}
export class Baz {}
`);
    const result = verifyPreferenceRule(makeRule('named-vs-default-exports'), [file]);
    expect(result.compliance).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('reports lower compliance when default export present', () => {
    const file = join(testDir, 'default-export.ts');
    writeFileSync(file, `
export const foo = 1;
const bar = 2;
export default bar;
`);
    const result = verifyPreferenceRule(makeRule('named-vs-default-exports'), [file]);
    expect(result.compliance).toBeLessThan(1);
  });
});

describe('preference verifier: unknown pair', () => {
  it('returns compliance 1 with "not yet verifiable" note for unknown pairs', () => {
    const file = join(testDir, 'unknown.ts');
    writeFileSync(file, 'const x = 1;\n');
    const result = verifyPreferenceRule(makeRule('unknown-pair'), [file]);
    expect(result.compliance).toBe(1);
    expect(result.evidence[0]!.found).toContain('not yet verifiable');
  });
});

describe('preference verifier: no matching files', () => {
  it('returns compliance 1 when no files match extensions', () => {
    const file = join(testDir, 'readme.md');
    writeFileSync(file, '# Hello\n');
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    expect(result.compliance).toBe(1);
    expect(result.passed).toBe(true);
  });
});
