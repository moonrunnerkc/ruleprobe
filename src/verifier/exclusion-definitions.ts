/**
 * Exclusion definitions for prefer-pattern pairs.
 *
 * Each exclusion identifies a structurally justified use of the
 * non-preferred pattern via ts-morph AST analysis. Matched instances
 * are removed from the violation count, producing accurate compliance.
 */

import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

/**
 * A single exclusion definition for a prefer-pair.
 *
 * Defines a reason why the non-preferred pattern is structurally
 * required. The counter function counts how many instances are
 * justified by this exclusion in a given source file.
 */
export interface ExclusionDefinition {
  /** Human-readable reason this exclusion exists */
  reason: string;
  /** Short label for report output */
  label: string;
  /** Count justified instances in a source file */
  count: (sf: SourceFile) => number;
}

/**
 * Result of counting exclusions for a prefer-pair in a single file.
 */
export interface ExclusionCount {
  /** Total excluded instances across all exclusions */
  total: number;
  /** Breakdown by exclusion label */
  breakdown: Array<{ label: string; count: number; reason: string }>;
}

/**
 * Aggregate exclusion result across all files for a prefer-pair.
 */
export interface PreferPatternResult {
  preferredCount: number;
  nonPreferredCount: number;
  excludedCount: number;
  exclusionBreakdown: Array<{ label: string; count: number; reason: string }>;
  adjustedCompliance: number;
}

/**
 * Exclusions for functional-vs-class-components.
 *
 * React error boundaries and getSnapshotBeforeUpdate lifecycle
 * methods require class components; counting them as violations
 * is incorrect.
 */
export const FUNCTIONAL_VS_CLASS_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'React error boundaries require componentDidCatch or getDerivedStateFromError',
    label: 'React error boundaries',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const cls of sf.getClasses()) {
        const methods = cls.getMethods();
        const hasErrorBoundary = methods.some((m) => {
          const name = m.getName();
          return name === 'componentDidCatch' || name === 'getDerivedStateFromError';
        });
        if (hasErrorBoundary) excluded += 1;
      }
      return excluded;
    },
  },
  {
    reason: 'getSnapshotBeforeUpdate has no hooks equivalent',
    label: 'getSnapshotBeforeUpdate lifecycle',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const cls of sf.getClasses()) {
        const methods = cls.getMethods();
        const hasSnapshot = methods.some((m) => m.getName() === 'getSnapshotBeforeUpdate');
        if (hasSnapshot) excluded += 1;
      }
      return excluded;
    },
  },
];

/**
 * Exclusions for const-vs-let.
 *
 * Variables declared with let that are reassigned in scope are
 * correctly using let; counting them as violations is wrong.
 */
export const CONST_VS_LET_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Variable is reassigned later in the same scope',
    label: 'reassigned in scope',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const stmt of sf.getVariableStatements()) {
        if (stmt.getDeclarationKind() !== 'let') continue;
        for (const decl of stmt.getDeclarations()) {
          const name = decl.getName();
          const refs = decl.findReferencesAsNodes();
          const hasReassignment = refs.some((ref) => {
            const parent = ref.getParent();
            if (!parent) return false;
            const kind = parent.getKind();
            if (kind === SyntaxKind.BinaryExpression) {
              const text = parent.getText();
              const eqIndex = text.indexOf('=');
              if (eqIndex > 0 && text[eqIndex - 1] !== '!' && text[eqIndex - 1] !== '=') {
                const lhs = text.substring(0, eqIndex).trim();
                return lhs === name || lhs.endsWith(name);
              }
            }
            if (kind === SyntaxKind.PostfixUnaryExpression || kind === SyntaxKind.PrefixUnaryExpression) {
              return true;
            }
            return false;
          });
          if (hasReassignment) excluded += 1;
        }
      }
      return excluded;
    },
  },
  {
    reason: 'Loop variable in for statement initializer',
    label: 'loop variables',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.ForStatement) {
          const initText = node.getChildAtIndex(2)?.getText() ?? '';
          if (initText.startsWith('let ')) {
            const declCount = (initText.match(/,/g) || []).length + 1;
            excluded += declCount;
          }
        }
      });
      return excluded;
    },
  },
  {
    reason: 'Conditional initialization pattern (let without initializer, assigned in if/else)',
    label: 'conditional init',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const stmt of sf.getVariableStatements()) {
        if (stmt.getDeclarationKind() !== 'let') continue;
        for (const decl of stmt.getDeclarations()) {
          if (decl.getInitializer()) continue;
          const name = decl.getName();
          const nextSibling = stmt.getNextSibling();
          if (nextSibling?.getKind() === SyntaxKind.IfStatement) {
            const ifText = nextSibling.getText();
            if (ifText.includes(`${name} =`) || ifText.includes(`${name}=`)) {
              excluded += 1;
            }
          }
        }
      }
      return excluded;
    },
  },
];

/**
 * Exclusions for async-await-vs-then.
 *
 * .then() inside Promise combinators or on third-party thenables
 * is idiomatic and should not count as violations.
 */
export const ASYNC_AWAIT_VS_THEN_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: '.then() inside Promise.all/race/allSettled is idiomatic chaining',
    label: 'Promise combinator context',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.CallExpression) return;
        const text = node.getText();
        if (!/\.then\s*\(/.test(text)) return;
        const parentText = node.getParent()?.getText() ?? '';
        if (/Promise\.(all|race|allSettled)\s*\(/.test(parentText)) {
          excluded += 1;
        }
      });
      return excluded;
    },
  },
  {
    reason: '.then() on third-party module import (thenable compatibility)',
    label: 'third-party thenable',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.CallExpression) return;
        const text = node.getText();
        if (!/\.then\s*\(/.test(text)) return;
        const fullText = node.getText();
        if (/require\s*\(/.test(fullText)) {
          excluded += 1;
        }
      });
      return excluded;
    },
  },
];

/**
 * Exclusions for named-vs-default-exports.
 *
 * Framework entry points that require default exports
 * should not count as violations.
 */
export const NAMED_VS_DEFAULT_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Next.js pages/layouts/routes require default exports',
    label: 'Next.js pages',
    count: (_sf: SourceFile): number => {
      /** Counted at the file level in the verifier using path checks. */
      return 0;
    },
  },
  {
    reason: 'Storybook story files conventionally use default exports',
    label: 'Storybook',
    count: (_sf: SourceFile): number => {
      /** Counted at the file level in the verifier using path checks. */
      return 0;
    },
  },
];

/**
 * All exclusion definitions keyed by prefer-pair id.
 */
export { INTERFACE_VS_TYPE_EXCLUSIONS, ARROW_VS_FUNCTION_EXCLUSIONS, TEMPLATE_VS_CONCAT_EXCLUSIONS, OPTIONAL_CHAINING_VS_TERNARY_EXCLUSIONS } from './exclusion-definitions-extended.js';

import {
  INTERFACE_VS_TYPE_EXCLUSIONS,
  ARROW_VS_FUNCTION_EXCLUSIONS,
  TEMPLATE_VS_CONCAT_EXCLUSIONS,
  OPTIONAL_CHAINING_VS_TERNARY_EXCLUSIONS,
} from './exclusion-definitions-extended.js';

export const EXCLUSION_REGISTRY: ReadonlyMap<string, ExclusionDefinition[]> = new Map([
  ['functional-vs-class-components', FUNCTIONAL_VS_CLASS_EXCLUSIONS],
  ['const-vs-let', CONST_VS_LET_EXCLUSIONS],
  ['async-await-vs-then', ASYNC_AWAIT_VS_THEN_EXCLUSIONS],
  ['named-vs-default-exports', NAMED_VS_DEFAULT_EXCLUSIONS],
  ['interface-vs-type', INTERFACE_VS_TYPE_EXCLUSIONS],
  ['arrow-vs-function-declarations', ARROW_VS_FUNCTION_EXCLUSIONS],
  ['template-literals-vs-concatenation', TEMPLATE_VS_CONCAT_EXCLUSIONS],
  ['optional-chaining-vs-nested-conditionals', OPTIONAL_CHAINING_VS_TERNARY_EXCLUSIONS],
]);
