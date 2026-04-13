/**
 * Qualifier detection for instruction file rules.
 *
 * Detects the strength/qualifier of an instruction line via
 * deterministic keyword/phrase matching. No NLP, no LLM.
 * Returns a QualifierType that indicates how strictly the
 * rule should be interpreted.
 */

import type { QualifierType } from '../types.js';

/**
 * Ordered list of qualifier patterns. Checked in order; first match wins.
 * More specific patterns (multi-word) come before less specific ones.
 */
const QUALIFIER_PATTERNS: Array<{ qualifier: QualifierType; patterns: RegExp[] }> = [
  {
    qualifier: 'avoid-unless',
    patterns: [
      /\bavoid\s+unless\b/i,
      /\bdon'?t\s+unless\b/i,
      /\bonly\s+when\s+necessary\b/i,
      /\bexcept\s+when\b/i,
      /\bunless\s+absolutely\b/i,
      /\bunless\s+(?:performance|necessary|required)\b/i,
    ],
  },
  {
    qualifier: 'when-possible',
    patterns: [
      /\bwhen\s+possible\b/i,
      /\bwhere\s+(?:possible|feasible)\b/i,
      /\bif\s+(?:possible|practical|feasible)\b/i,
      /\bideally\b/i,
      /\bwhenever\s+possible\b/i,
      /\bwhere\s+it\s+makes\s+sense\b/i,
    ],
  },
  {
    qualifier: 'try-to',
    patterns: [
      /\btry\s+to\b/i,
      /\baim\s+(?:for|to)\b/i,
      /\bstrive\s+to\b/i,
      /\bshould\s+generally\b/i,
      /\bgenerally\s+(?:use|prefer|avoid)\b/i,
    ],
  },
  {
    qualifier: 'prefer',
    patterns: [
      /\bprefer\b/i,
      /\bfavor\b/i,
      /\bdefault\s+to\b/i,
      /\bover\b.*\bwhen\b/i,
      /\binstead\s+of\b/i,
    ],
  },
  {
    qualifier: 'never',
    patterns: [
      /\bnever\b/i,
      /\bdo\s+not\b/i,
      /\bdon'?t\b/i,
      /\bmust\s+not\b/i,
      /\bforbidden\b/i,
      /\bprohibited\b/i,
      /\bnot\s+allowed\b/i,
      /\bno\s+\w+/i,
    ],
  },
  {
    qualifier: 'always',
    patterns: [
      /\balways\b/i,
      /\bmust\b/i,
      /\brequired\b/i,
      /\bensure\b/i,
      /\bshall\b/i,
    ],
  },
];

/**
 * Detect the qualifier type from an instruction line.
 *
 * Scans the text against ordered keyword/phrase patterns.
 * More specific qualifiers (avoid-unless, when-possible) are
 * checked before less specific ones (never, always).
 * Returns 'always' if no qualifier keyword is found.
 *
 * @param text - The instruction line text
 * @returns Detected qualifier type
 */
export function detectQualifier(text: string): QualifierType {
  for (const { qualifier, patterns } of QUALIFIER_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return qualifier;
      }
    }
  }
  return 'always';
}
