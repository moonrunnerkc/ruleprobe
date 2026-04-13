/**
 * Preference rule matchers.
 *
 * Matches "prefer X over Y" / "use X instead of Y" patterns
 * in instruction files and maps them to prefer-pair verifications.
 * Each matcher detects a specific prefer-pair from the PREFER_PAIRS
 * definitions.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers for preference-based rules.
 *
 * Each matcher detects a "prefer X over Y" pattern in instruction text
 * and maps it to a prefer-pair ID for verification.
 */
export const PREFERENCE_MATCHERS: RuleMatcher[] = [
  {
    id: 'preference-const-over-let',
    patterns: [
      /\bprefer\s+const\b.*\bover\b.*\blet\b/i,
      /\bconst\s+over\s+let\b/i,
      /\buse\s+const\b.*\binstead\s+of\b.*\blet\b/i,
      /\bfavor\s+const\b.*\bover\b.*\blet\b/i,
      /\bprefer\s+const\b(?!.*\bover\b)/i,
      /\bimmutable\s+by\s+default\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer const over let for variable declarations',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'const-vs-let',
      expected: 'const',
      scope: 'project',
    }),
  },
  {
    id: 'preference-named-over-default-exports',
    patterns: [
      /\bprefer\s+named\s+exports?\b.*\bover\b.*\bdefault\b/i,
      /\bnamed\s+exports?\s+over\s+default\b/i,
      /\buse\s+named\s+exports?\b.*\binstead\s+of\b.*\bdefault\b/i,
      /\bfavor\s+named\s+exports?\b/i,
      /\bprefer\s+named\s+exports?\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer named exports over default exports',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'named-vs-default-exports',
      expected: 'named exports',
      scope: 'project',
    }),
  },
  {
    id: 'preference-interface-over-type',
    patterns: [
      /\bprefer\s+interface\b.*\bover\b.*\btype\b/i,
      /\binterface\s+over\s+type\b/i,
      /\buse\s+interface\b.*\binstead\s+of\b.*\btype\b/i,
      /\bfavor\s+interface\b.*\b(?:for|over)\b/i,
      /\binterface\b.*\bfor\s+object\s+shapes?\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer interface over type for object shapes',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'interface-vs-type',
      expected: 'interface',
      scope: 'project',
    }),
  },
  {
    id: 'preference-async-await-over-then',
    patterns: [
      /\bprefer\s+async\s*\/?\s*await\b.*\bover\b.*\.?then\b/i,
      /\basync\s*\/?\s*await\s+over\b.*\.?then\b/i,
      /\buse\s+async\s*\/?\s*await\b.*\binstead\s+of\b.*\.?then\b/i,
      /\bprefer\s+async\s*\/?\s*await\b/i,
      /\bfavor\s+async\s*\/?\s*await\b/i,
      /\basync\b.*\binstead\s+of\b.*\bthen\b.*\bchain/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer async/await over .then() chains',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'async-await-vs-then',
      expected: 'async/await',
      scope: 'project',
    }),
  },
  {
    id: 'preference-arrow-over-function',
    patterns: [
      /\bprefer\s+arrow\s+functions?\b.*\bover\b.*\bfunction\s+declarations?\b/i,
      /\barrow\s+functions?\s+over\s+function\s+declarations?\b/i,
      /\buse\s+arrow\s+functions?\b.*\binstead\s+of\b.*\bfunction\b/i,
      /\bfavor\s+arrow\s+functions?\b/i,
      /\bprefer\s+arrow\s+functions?\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer arrow functions over function declarations',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'arrow-vs-function-declarations',
      expected: 'arrow functions',
      scope: 'project',
    }),
  },
  {
    id: 'preference-template-literals',
    patterns: [
      /\bprefer\s+template\s+(?:literals?|strings?)\b.*\bover\b.*\bconcatenation\b/i,
      /\btemplate\s+(?:literals?|strings?)\s+over\b.*\bconcatenation\b/i,
      /\buse\s+template\s+(?:literals?|strings?)\b.*\binstead\s+of\b.*\bconcatenation\b/i,
      /\bprefer\s+template\s+(?:literals?|strings?)\b/i,
      /\bprefer\s+backticks?\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer template literals over string concatenation',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'template-literals-vs-concatenation',
      expected: 'template literals',
      scope: 'project',
    }),
  },
  {
    id: 'preference-optional-chaining',
    patterns: [
      /\bprefer\s+optional\s+chaining\b/i,
      /\boptional\s+chaining\s+over\b/i,
      /\buse\s+optional\s+chaining\b/i,
      /\bfavor\s+optional\s+chaining\b/i,
      /\buse\s+\?\.\s/i,
      /\boptional\s+chaining\b.*\bnullish\s+coalescing\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer optional chaining over nested conditionals',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'optional-chaining-vs-nested-conditionals',
      expected: 'optional chaining',
      scope: 'project',
    }),
  },
  {
    id: 'preference-functional-components',
    patterns: [
      /\bprefer\s+functional\s+components?\b.*\bover\b.*\bclass\b/i,
      /\bfunctional\s+components?\s+over\s+class\b/i,
      /\buse\s+function(?:al)?\s+components?\b.*\binstead\s+of\b.*\bclass\b/i,
      /\bfavor\s+functional\s+components?\b/i,
      /\bprefer\s+function\s+components?\b/i,
      /\bno\s+class\s+components?\b/i,
      /\buse\s+functional\s+components?\b/i,
      /\bfunctional\s+components?\s+with\s+hooks\b/i,
    ],
    category: 'preference',
    verifier: 'preference',
    description: 'Prefer functional components over class components',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-pair',
      target: 'functional-vs-class-components',
      expected: 'functional components',
      scope: 'project',
    }),
  },
];
