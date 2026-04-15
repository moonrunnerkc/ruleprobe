/**
 * Extended exclusion definitions for prefer-pattern pairs.
 *
 * Covers: interface-vs-type, arrow-vs-function-declarations,
 * template-literals-vs-concatenation, and optional-chaining-vs-nested-conditionals.
 */

import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { ExclusionDefinition } from './exclusion-definitions.js';

/**
 * Exclusions for interface-vs-type.
 *
 * Type aliases using union, intersection, mapped, conditional,
 * or template literal types cannot be expressed as interfaces.
 */
export const INTERFACE_VS_TYPE_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Union or intersection types cannot be expressed as interfaces',
    label: 'unions/intersections',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const ta of sf.getTypeAliases()) {
        const typeNode = ta.getTypeNode();
        if (!typeNode) continue;
        const text = typeNode.getText();
        if (text.includes('|') || text.includes('&')) {
          excluded += 1;
        }
      }
      return excluded;
    },
  },
  {
    reason: 'Mapped, conditional, or template literal types require type aliases',
    label: 'mapped types',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const ta of sf.getTypeAliases()) {
        const typeNode = ta.getTypeNode();
        if (!typeNode) continue;
        const kind = typeNode.getKind();
        if (kind === SyntaxKind.MappedType ||
            kind === SyntaxKind.ConditionalType ||
            kind === SyntaxKind.TemplateLiteralType) {
          excluded += 1;
        }
      }
      return excluded;
    },
  },
  {
    reason: 'Primitive aliases and utility type applications require type aliases',
    label: 'utility types',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const ta of sf.getTypeAliases()) {
        const typeNode = ta.getTypeNode();
        if (!typeNode) continue;
        const kind = typeNode.getKind();
        if (kind === SyntaxKind.StringKeyword ||
            kind === SyntaxKind.NumberKeyword ||
            kind === SyntaxKind.BooleanKeyword ||
            kind === SyntaxKind.TypeReference) {
          const text = typeNode.getText();
          if (!text.startsWith('{')) {
            excluded += 1;
          }
        }
      }
      return excluded;
    },
  },
];

/**
 * Exclusions for arrow-vs-function-declarations.
 *
 * Functions using this, generators, and constructors cannot be arrows.
 */
export const ARROW_VS_FUNCTION_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Function uses this binding (arrow functions inherit this)',
    label: 'this binding',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const fn of sf.getFunctions()) {
        const body = fn.getBody();
        if (!body) continue;
        let usesThis = false;
        body.forEachDescendant((node) => {
          if (node.getKind() === SyntaxKind.ThisKeyword) {
            usesThis = true;
          }
        });
        if (usesThis) excluded += 1;
      }
      return excluded;
    },
  },
  {
    reason: 'Generator functions cannot be arrow functions',
    label: 'generators',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      for (const fn of sf.getFunctions()) {
        if (fn.isGenerator()) excluded += 1;
      }
      return excluded;
    },
  },
];

/**
 * Exclusions for template-literals-vs-concatenation.
 *
 * Literal-only concatenation and require() paths are not
 * interpolation candidates.
 */
export const TEMPLATE_VS_CONCAT_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Concatenation of only string literals (no interpolation value)',
    label: 'literal-only',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.BinaryExpression) return;
        const text = node.getText();
        if (!text.includes('+')) return;
        const parts = text.split('+').map((p) => p.trim());
        const allLiterals = parts.every((p) =>
          (p.startsWith("'") && p.endsWith("'")) ||
          (p.startsWith('"') && p.endsWith('"'))
        );
        if (allLiterals && parts.length >= 2) {
          excluded += 1;
        }
      });
      return excluded;
    },
  },
  {
    reason: 'Concatenation inside require() calls (dynamic paths)',
    label: 'dynamic require',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.CallExpression) return;
        const text = node.getText();
        if (text.startsWith('require(') && text.includes('+')) {
          excluded += 1;
        }
      });
      return excluded;
    },
  },
];

/**
 * Exclusions for optional-chaining-vs-nested-conditionals.
 *
 * Ternaries with non-undefined defaults are meaningfully different
 * from optional chaining.
 */
export const OPTIONAL_CHAINING_VS_TERNARY_EXCLUSIONS: ExclusionDefinition[] = [
  {
    reason: 'Ternary with non-undefined default (optional chaining returns undefined)',
    label: 'non-undefined defaults',
    count: (sf: SourceFile): number => {
      let excluded = 0;
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.ConditionalExpression) return;
        const parent = node.getParent();
        if (parent?.getKind() !== SyntaxKind.ConditionalExpression) return;
        const text = node.getText();
        const colonIdx = text.lastIndexOf(':');
        if (colonIdx > -1) {
          const fallback = text.substring(colonIdx + 1).trim();
          if (fallback !== 'undefined' && fallback !== 'void 0') {
            excluded += 1;
          }
        }
      });
      return excluded;
    },
  },
];
