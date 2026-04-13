/**
 * Tooling rule matchers.
 *
 * Matches instructions about package managers, test frameworks,
 * and build tool requirements. Examples:
 * - "Use pnpm, not npm"
 * - "Use vitest for testing"
 * - "Use eslint for linting"
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers for tooling/dependency alignment rules.
 */
export const TOOLING_MATCHERS: RuleMatcher[] = [
  {
    id: 'tooling-package-manager-pnpm',
    patterns: [
      /\buse\s+pnpm\b/i,
      /\bpnpm\b.*\bnot\s+(?:npm|yarn)\b/i,
      /\bpackage\s+manager\b.*\bpnpm\b/i,
      /\bpnpm\b.*\bpackage\s+manager\b/i,
      /\bprefer\s+pnpm\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use pnpm as package manager',
    severity: 'warning',
    buildPattern: () => ({
      type: 'package-manager',
      target: 'pnpm',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-package-manager-yarn',
    patterns: [
      /\buse\s+yarn\b/i,
      /\byarn\b.*\bnot\s+(?:npm|pnpm)\b/i,
      /\bpackage\s+manager\b.*\byarn\b/i,
      /\byarn\b.*\bpackage\s+manager\b/i,
      /\bprefer\s+yarn\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use yarn as package manager',
    severity: 'warning',
    buildPattern: () => ({
      type: 'package-manager',
      target: 'yarn',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-package-manager-bun',
    patterns: [
      /\buse\s+bun\b(?!\s+(?:file|run))/i,
      /\bbun\b.*\bpackage\s+manager\b/i,
      /\bpackage\s+manager\b.*\bbun\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use bun as package manager',
    severity: 'warning',
    buildPattern: () => ({
      type: 'package-manager',
      target: 'bun',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-test-framework-vitest',
    patterns: [
      /\buse\s+vitest\b/i,
      /\bvitest\s+for\s+test/i,
      /\btest(?:ing|s)?\s+(?:with|using)\s+vitest\b/i,
      /\brun\s+tests?\s+(?:with|using)\s+vitest\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use vitest for testing',
    severity: 'warning',
    buildPattern: () => ({
      type: 'test-framework',
      target: 'vitest',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-test-framework-jest',
    patterns: [
      /\buse\s+jest\b/i,
      /\bjest\s+for\s+test/i,
      /\btest(?:ing|s)?\s+(?:with|using)\s+jest\b/i,
      /\brun\s+tests?\s+(?:with|using)\s+jest\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use jest for testing',
    severity: 'warning',
    buildPattern: () => ({
      type: 'test-framework',
      target: 'jest',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-test-framework-pytest',
    patterns: [
      /\buse\s+pytest\b/i,
      /\bpytest\s+for\s+test/i,
      /\btest(?:ing|s)?\s+(?:with|using)\s+pytest\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use pytest for testing',
    severity: 'warning',
    buildPattern: () => ({
      type: 'test-framework',
      target: 'pytest',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-linter-eslint',
    patterns: [
      /\buse\s+eslint\b/i,
      /\beslint\s+for\s+lint/i,
      /\blint(?:ing)?\s+(?:with|using)\s+eslint\b/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use eslint for linting',
    severity: 'warning',
    buildPattern: () => ({
      type: 'tool-present',
      target: 'eslint',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-formatter-prettier',
    patterns: [
      /\buse\s+prettier\b/i,
      /\bformat\s+(?:with|using)\s+prettier\b/i,
      /\bprettier\s+for\s+format/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use prettier for formatting',
    severity: 'warning',
    buildPattern: () => ({
      type: 'tool-present',
      target: 'prettier',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'tooling-formatter-biome',
    patterns: [
      /\buse\s+biome\b/i,
      /\bformat\s+(?:with|using)\s+biome\b/i,
      /\blint\s+(?:with|using)\s+biome\b/i,
      /\bbiome\s+for\s+(?:lint|format)/i,
    ],
    category: 'tooling',
    verifier: 'tooling',
    description: 'Project must use biome for linting/formatting',
    severity: 'warning',
    buildPattern: () => ({
      type: 'tool-present',
      target: 'biome',
      expected: true,
      scope: 'project',
    }),
  },
];
