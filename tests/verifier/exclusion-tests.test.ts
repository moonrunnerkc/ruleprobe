/**
 * Tests for prefer-pattern exclusions.
 *
 * Each exclusion verifies that structurally justified uses of the
 * non-preferred pattern are excluded from the violation count.
 * Negative tests prove exclusions are precise, not permissive.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyPreferenceRule } from '../../src/verifier/preference-verifier.js';
import type { Rule } from '../../src/types.js';

const testDir = join(tmpdir(), 'ruleprobe-exclusion-test-' + Date.now());

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

describe('exclusion: functional-vs-class-components', () => {
  it('excludes React error boundary class components (componentDidCatch)', () => {
    const file = join(testDir, 'error-boundary.tsx');
    writeFileSync(file, `
import React from 'react';
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    return <div>{this.props.children}</div>;
  }
}
const App = () => <div>Hello</div>;
const Page = () => <div>Page</div>;
`);
    const result = verifyPreferenceRule(makeRule('functional-vs-class-components'), [file]);
    // 2 functional, 1 class component, but 1 excluded (error boundary)
    // compliance = 2 / (2 + 1 - 1) = 2/2 = 1.0
    expect(result.compliance).toBe(1);
    expect(result.evidence.some((e) => e.found.includes('excluded'))).toBe(true);
  });

  it('excludes class with getDerivedStateFromError', () => {
    const file = join(testDir, 'derived-error.tsx');
    writeFileSync(file, `
import React from 'react';
class ErrorFallback extends React.Component {
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return <div>Error</div>;
  }
}
const Widget = () => <div>Widget</div>;
`);
    const result = verifyPreferenceRule(makeRule('functional-vs-class-components'), [file]);
    expect(result.compliance).toBe(1);
  });

  it('does NOT exclude regular class components without error boundary methods', () => {
    const file = join(testDir, 'regular-class.tsx');
    writeFileSync(file, `
import React from 'react';
class OldComponent extends React.Component {
  render() {
    return <div>Old</div>;
  }
}
const NewComponent = () => <div>New</div>;
`);
    const result = verifyPreferenceRule(makeRule('functional-vs-class-components'), [file]);
    // 1 functional, 1 class, 0 excluded -> 1/(1+1) = 0.5
    expect(result.compliance).toBe(0.5);
    expect(result.evidence.every((e) => !e.found.includes('excluded'))).toBe(true);
  });
});

describe('exclusion: const-vs-let', () => {
  it('excludes let that is reassigned in scope', () => {
    const file = join(testDir, 'reassigned-let.ts');
    writeFileSync(file, `
const a = 1;
const b = 2;
const c = 3;
let d = 0;
d = 1;
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 3 const, 1 let, 1 excluded -> 3/(3+1-1) = 3/3 = 1
    expect(result.compliance).toBe(1);
    expect(result.evidence.some((e) => e.found.includes('excluded'))).toBe(true);
  });

  it('excludes let with increment operator', () => {
    const file = join(testDir, 'increment-let.ts');
    writeFileSync(file, `
const a = 1;
let counter = 0;
counter++;
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 1 const, 1 let, 1 excluded -> 1/(1+1-1) = 1/1 = 1
    expect(result.compliance).toBe(1);
  });

  it('does NOT exclude let that is never reassigned', () => {
    const file = join(testDir, 'unused-let.ts');
    writeFileSync(file, `
const a = 1;
const b = 2;
let c = 3;
console.log(c);
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 2 const, 1 let, 0 excluded -> 2/(2+1) = 0.667
    expect(result.compliance).toBeCloseTo(0.667, 2);
  });

  it('excludes for loop variables', () => {
    const file = join(testDir, 'for-loop.ts');
    writeFileSync(file, `
const items = [1, 2, 3];
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 1 const, 1 let (loop var), 1 excluded -> 1/(1+1-1) = 1
    expect(result.compliance).toBe(1);
  });

  it('excludes conditional initialization pattern', () => {
    const file = join(testDir, 'conditional-init.ts');
    writeFileSync(file, `
const mode = 'dark';
let result;
if (mode === 'dark') {
  result = 'black';
} else {
  result = 'white';
}
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 1 const, 1 let (conditional init), 1 excluded -> 1/(1+1-1) = 1
    expect(result.compliance).toBe(1);
  });
});

describe('exclusion: interface-vs-type', () => {
  it('excludes union type aliases', () => {
    const file = join(testDir, 'union-type.ts');
    writeFileSync(file, `
interface Foo { name: string; }
interface Bar { value: number; }
type Result = Foo | Bar;
`);
    const result = verifyPreferenceRule(makeRule('interface-vs-type'), [file]);
    // 2 interfaces, 1 type, 1 excluded -> 2/(2+1-1) = 1
    expect(result.compliance).toBe(1);
  });

  it('excludes intersection type aliases', () => {
    const file = join(testDir, 'intersection-type.ts');
    writeFileSync(file, `
interface Base { id: string; }
type Extended = Base & { extra: number };
`);
    const result = verifyPreferenceRule(makeRule('interface-vs-type'), [file]);
    // 1 interface, 1 type (intersection), 1 excluded -> 1/(1+1-1) = 1
    expect(result.compliance).toBe(1);
  });

  it('does NOT exclude object type alias without union/intersection', () => {
    const file = join(testDir, 'plain-type.ts');
    writeFileSync(file, `
interface Foo { name: string; }
type Bar = { value: number };
`);
    const result = verifyPreferenceRule(makeRule('interface-vs-type'), [file]);
    // 1 interface, 1 type, 0 excluded -> 1/2 = 0.5
    expect(result.compliance).toBe(0.5);
  });
});

describe('exclusion: arrow-vs-function-declarations', () => {
  it('excludes functions using this binding', () => {
    const file = join(testDir, 'this-binding.ts');
    writeFileSync(file, `
const arrow = () => 42;
function usesThis() {
  return this.value;
}
`);
    const result = verifyPreferenceRule(makeRule('arrow-vs-function-declarations'), [file]);
    // 1 arrow, 1 function decl, 1 excluded -> 1/(1+1-1) = 1
    expect(result.compliance).toBe(1);
  });

  it('excludes generator functions', () => {
    const file = join(testDir, 'generator.ts');
    writeFileSync(file, `
const arrow = () => 42;
function* generate() {
  yield 1;
  yield 2;
}
`);
    const result = verifyPreferenceRule(makeRule('arrow-vs-function-declarations'), [file]);
    expect(result.compliance).toBe(1);
  });

  it('does NOT exclude regular function declarations', () => {
    const file = join(testDir, 'regular-func.ts');
    writeFileSync(file, `
const arrow = () => 42;
function regular() {
  return 42;
}
`);
    const result = verifyPreferenceRule(makeRule('arrow-vs-function-declarations'), [file]);
    // 1 arrow, 1 function, 0 excluded -> 1/2 = 0.5
    expect(result.compliance).toBe(0.5);
  });
});

describe('exclusion: template-literals-vs-concatenation', () => {
  it('excludes literal-only concatenation', () => {
    const file = join(testDir, 'literal-concat.ts');
    writeFileSync(file, `
const a = \`hello \${name}\`;
const b = 'hello' + 'world';
`);
    const result = verifyPreferenceRule(makeRule('template-literals-vs-concatenation'), [file]);
    // 1 template, 1 concat, 1 excluded -> 1/(1+1-1) = 1
    expect(result.compliance).toBe(1);
  });
});

describe('compliance calculation with exclusions', () => {
  it('removes excluded from denominator, not numerator', () => {
    const file = join(testDir, 'mixed-excl.ts');
    writeFileSync(file, `
const a = 1;
const b = 2;
let c = 0;
c = 5;
let d = 'unused';
`);
    const result = verifyPreferenceRule(makeRule('const-vs-let'), [file]);
    // 2 const, 2 let, 1 excluded (c is reassigned, d is not)
    // compliance = 2 / (2 + 2 - 1) = 2/3 = 0.667
    expect(result.compliance).toBeCloseTo(0.667, 2);
  });
});
