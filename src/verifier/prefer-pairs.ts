/**
 * Prefer-pair definitions for preference-based rule verification.
 *
 * Each pair maps a preferred pattern (X) and its alternative (Y)
 * to AST node queries that can count occurrences of each.
 * Adding a new prefer-pair requires only adding an entry to
 * PREFER_PAIRS; no other code changes needed.
 */

/** A single prefer-pair definition. */
export interface PreferPair {
  /** Unique identifier for this pair. */
  id: string;
  /** Human-readable name of the preferred pattern. */
  preferredLabel: string;
  /** Human-readable name of the alternative. */
  alternativeLabel: string;
  /** Keywords that identify this pair in instruction text. */
  keywords: { preferred: string[]; alternative: string[] };
  /** File extensions this pair applies to. */
  extensions: string[];
}

/**
 * All known prefer-pairs.
 *
 * Each pair defines the preferred and alternative pattern with
 * keywords for extraction matching and file extension filters.
 */
export const PREFER_PAIRS: PreferPair[] = [
  {
    id: 'functional-vs-class-components',
    preferredLabel: 'functional components',
    alternativeLabel: 'class components',
    keywords: {
      preferred: ['functional component', 'function component', 'arrow component'],
      alternative: ['class component'],
    },
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
  },
  {
    id: 'const-vs-let',
    preferredLabel: 'const',
    alternativeLabel: 'let',
    keywords: {
      preferred: ['const'],
      alternative: ['let'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'named-vs-default-exports',
    preferredLabel: 'named exports',
    alternativeLabel: 'default exports',
    keywords: {
      preferred: ['named export'],
      alternative: ['default export'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'interface-vs-type',
    preferredLabel: 'interface',
    alternativeLabel: 'type alias',
    keywords: {
      preferred: ['interface'],
      alternative: ['type alias', 'type '],
    },
    extensions: ['.ts', '.tsx'],
  },
  {
    id: 'async-await-vs-then',
    preferredLabel: 'async/await',
    alternativeLabel: '.then() chains',
    keywords: {
      preferred: ['async/await', 'async await'],
      alternative: ['.then(', 'then()', 'promise chain', '.then chain'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'arrow-vs-function-declarations',
    preferredLabel: 'arrow functions',
    alternativeLabel: 'function declarations',
    keywords: {
      preferred: ['arrow function'],
      alternative: ['function declaration', 'function keyword'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'template-literals-vs-concatenation',
    preferredLabel: 'template literals',
    alternativeLabel: 'string concatenation',
    keywords: {
      preferred: ['template literal', 'template string', 'backtick'],
      alternative: ['string concatenation', 'string concat', '+ operator'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'optional-chaining-vs-nested-conditionals',
    preferredLabel: 'optional chaining',
    alternativeLabel: 'nested conditionals',
    keywords: {
      preferred: ['optional chaining', '?.'],
      alternative: ['nested conditional', 'nested ternary', 'nested if'],
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
];

/**
 * Find a prefer-pair by matching keywords against instruction text.
 *
 * Looks for keywords from both the preferred and alternative sides
 * to identify which pair the instruction is referencing.
 *
 * @param text - The instruction line text (already stripped of formatting)
 * @returns The matching prefer-pair, or null if none found
 */
export function findPreferPair(text: string): PreferPair | null {
  const lower = text.toLowerCase();
  for (const pair of PREFER_PAIRS) {
    const hasPreferred = pair.keywords.preferred.some((k) => lower.includes(k.toLowerCase()));
    const hasAlternative = pair.keywords.alternative.some((k) => lower.includes(k.toLowerCase()));
    if (hasPreferred || hasAlternative) {
      return pair;
    }
  }
  return null;
}
