/**
 * Git history rule matchers.
 *
 * Matches instructions about commit message formats, branch naming,
 * commit signing, and PR conventions. Examples:
 * - "Use conventional commits"
 * - "Prefix commits with [AI]"
 * - "Branch names must follow feature/xxx pattern"
 * - "Sign all commits"
 */

import type { RuleMatcher, VerificationPattern } from '../types.js';

/**
 * Extract a prefix from instruction text when matching commit prefix rules.
 *
 * @param text - The matched instruction text
 * @param match - The regex match result
 * @returns The extracted prefix string
 */
function extractPrefix(text: string, match: RegExpMatchArray): string {
  // Try to find a bracketed prefix like [AI], [bot], etc.
  const bracketMatch = text.match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1] !== undefined) {
    return `[${bracketMatch[1]}]`;
  }
  // Try quoted prefix
  const quoteMatch = text.match(/["']([^"']+)["']/);
  if (quoteMatch && quoteMatch[1] !== undefined) {
    return quoteMatch[1];
  }
  // Fallback: use the captured group if available
  if (match[1] !== undefined) {
    return match[1];
  }
  return '';
}

/**
 * Extract a branch pattern from instruction text.
 *
 * @param text - The matched instruction text
 * @returns A regex pattern string for branch validation
 */
function extractBranchPattern(text: string): string {
  // Match explicit patterns like "feature/xxx" or "type/description"
  const slashPattern = text.match(/\b(feature|bugfix|hotfix|release|fix|chore|refactor|docs)\/\S*/i);
  if (slashPattern) {
    return `^(feature|bugfix|hotfix|release|fix|chore|refactor|docs)/`;
  }
  // Generic "type/description" pattern
  if (/\btype\s*\/\s*description\b/i.test(text)) {
    return `^[a-z]+/[a-z]`;
  }
  // Default conventional branch pattern
  return `^(feature|bugfix|hotfix|release|fix|chore)/`;
}

/**
 * Matchers for rules verifiable via git history inspection.
 */
export const GIT_HISTORY_MATCHERS: RuleMatcher[] = [
  {
    id: 'git-conventional-commits',
    patterns: [
      /\bconventional\s+commit/i,
      /\bcommit\s+(?:message\s+)?(?:format|convention)\b.*\b(?:feat|fix|chore)\b/i,
      /\b(?:feat|fix|chore|refactor)\(?\)?:\s/i,
      /\bcommit\s+messages?\s+(?:should|must)\s+follow\b.*\bformat\b/i,
    ],
    category: 'workflow',
    verifier: 'git-history',
    description: 'Commits must follow conventional commits format',
    severity: 'warning',
    confidence: 'high',
    buildPattern: (): VerificationPattern => ({
      type: 'conventional-commits',
      target: 'conventional',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'git-commit-prefix',
    patterns: [
      /\bprefix\s+commit\w*\s+(?:message\w?\s+)?(?:with|by)\s+\[?\w+\]?/i,
      /\bcommit\s+message\w?\s+(?:should|must)\s+(?:be\s+)?prefix/i,
      /\bcommit\w*\s+(?:should|must)\s+start\s+with\b/i,
      /\b\[AI\]\b.*\bcommit/i,
      /\bcommit\b.*\b\[AI\]\b/i,
    ],
    category: 'workflow',
    verifier: 'git-history',
    description: 'Commit messages must have the specified prefix',
    severity: 'warning',
    confidence: 'medium',
    buildPattern: (text: string, match: RegExpMatchArray): VerificationPattern => ({
      type: 'commit-message-prefix',
      target: extractPrefix(text, match),
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'git-branch-naming',
    patterns: [
      /\bbranch\s+nam(?:e|ing)\b.*\b(?:pattern|format|convention)\b/i,
      /\bbranch(?:es)?\s+(?:should|must)\s+follow\b/i,
      /\bbranch\s+nam(?:e|ing)\b.*\b(?:feature|bugfix|hotfix)[\s/]/i,
      /\b(?:feature|bugfix|hotfix)\/\b.*\bbranch\b/i,
    ],
    category: 'workflow',
    verifier: 'git-history',
    description: 'Branch names must follow the specified pattern',
    severity: 'warning',
    confidence: 'medium',
    buildPattern: (text: string): VerificationPattern => ({
      type: 'branch-naming',
      target: extractBranchPattern(text),
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'git-signed-commits',
    patterns: [
      /\bsign\s+(?:all\s+)?commit/i,
      /\bcommit\s+sign(?:ing|ed)\b/i,
      /\bGPG\b.*\bcommit/i,
      /\bcommit\b.*\bGPG\b/i,
      /\bDCO\b.*\bsign[- ]off/i,
      /\bsign[- ]off\b.*\bcommit/i,
    ],
    category: 'workflow',
    verifier: 'git-history',
    description: 'Commits must be signed (GPG, SSH, or DCO sign-off)',
    severity: 'warning',
    confidence: 'medium',
    buildPattern: (): VerificationPattern => ({
      type: 'signed-commits',
      target: 'signed',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'git-commit-scope',
    patterns: [
      /\bcommit\b.*\bsmall\b/i,
      /\bsmall\s+(?:focused\s+)?commit/i,
      /\batomic\s+commit/i,
      /\bone\s+(?:thing|change)\s+per\s+commit/i,
    ],
    category: 'workflow',
    verifier: 'git-history',
    description: 'Commits should be small and focused',
    severity: 'warning',
    confidence: 'low',
    buildPattern: (): VerificationPattern => ({
      type: 'commit-message-pattern',
      target: '.{1,72}',
      expected: true,
      scope: 'project',
    }),
  },
];
