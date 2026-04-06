/**
 * Rule extractor for markdown instruction files.
 *
 * Takes parsed markdown sections and identifies lines that express
 * machine-verifiable rules. Delegates pattern definitions to
 * rule-patterns.ts. Handles line classification, matching, deduplication,
 * and unparseable collection.
 */

import type { Rule, MarkdownSection } from '../types.js';
import { RULE_MATCHERS } from './rule-patterns.js';

/** Counter for generating unique rule IDs across extraction runs. */
let ruleCounter = 0;

/**
 * Reset the internal rule ID counter. Useful between test runs
 * to get deterministic IDs.
 */
export function resetRuleCounter(): void {
  ruleCounter = 0;
}

/**
 * Lines matching these patterns are structural markdown or meta-content
 * that should not be treated as rule candidates.
 */
const SKIP_PATTERNS: RegExp[] = [
  /^```/,                            // code fence
  /^\|/,                             // table row
  /^[-*]\s*\[\s*[xX ]?\s*\]/,       // checklist item
  /^---+$/,                          // horizontal rule
  /^#+\s/,                           // header (already handled)
  /^\s*$/,                           // blank line
  /^!\[/,                            // image
  /^>/,                              // blockquote
];

/**
 * Lines matching these patterns are subjective or vague statements
 * that cannot be machine-verified. They go into unparseable.
 */
const SUBJECTIVE_MARKERS: RegExp[] = [
  /^(write|use|follow|keep|maintain)\s+(clean|clear|good|best|simple|readable)/i,
  /\bbest\s+practices?\b/i,
  /\bclean\s+code\b/i,
  /\breadable\b(?!.*\b(?:camel|pascal|kebab|snake)\b)/i,
];

/**
 * Check whether a line looks like it contains an instruction (imperative
 * statement, requirement, or constraint) rather than documentation prose.
 */
function isInstructionCandidate(line: string): boolean {
  const instructionPatterns = [
    /^[-*+]\s+/,                     // unordered list item
    /^\d+\.\s+/,                     // ordered list item
    /\b(must|should|always|never|no|don'?t|avoid|use|require|ensure)\b/i,
    /\b(camel|pascal|kebab|snake)[\s-]*case\b/i,
    /\bconsole\.?log\b/i,
    /\bdefault\s+export/i,
    /\bany\s+type/i,
    /\bJSDoc\b/i,
    /\bstrict\s+mode\b/i,
    /\btest\s+file/i,
    /\brelative\s+import/i,
    /\bpath\s+alias/i,
    /\bmax(?:imum)?\s+(?:line|file)\b/i,
    /\bnamed\s+export/i,
  ];

  return instructionPatterns.some((p) => p.test(line));
}

/**
 * Check whether a line should be skipped entirely (structural markdown).
 */
function shouldSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(line.trim()));
}

/**
 * Check whether a line is subjective and cannot be machine-verified.
 */
function isSubjective(line: string): boolean {
  return SUBJECTIVE_MARKERS.some((p) => p.test(line));
}

/**
 * Strip common markdown formatting from a line for cleaner matching.
 */
function stripFormatting(line: string): string {
  return line
    .replace(/^[-*+]\s+/, '')        // list marker
    .replace(/^\d+\.\s+/, '')        // ordered list marker
    .replace(/`([^`]+)`/g, '$1')     // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')   // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .trim();
}

/**
 * Classify a line for extraction purposes.
 *
 * @returns 'skip' for structural markdown, 'subjective' for vague lines,
 *   'candidate' for instruction lines, 'prose' for non-instruction text
 */
function classifyLine(line: string, stripped: string): 'skip' | 'subjective' | 'candidate' | 'prose' {
  if (shouldSkipLine(line)) {
    return 'skip';
  }
  if (stripped.length === 0) {
    return 'skip';
  }
  if (isSubjective(stripped)) {
    return 'subjective';
  }
  if (!isInstructionCandidate(stripped)) {
    return 'prose';
  }
  return 'candidate';
}

/**
 * Match a single line against all known rule matchers.
 *
 * A single line can express multiple rules (e.g. "TypeScript strict mode,
 * no any types"). Returns all matching Rules, or an empty array if no
 * matcher applies.
 */
function matchLine(line: string, stripped: string): Rule[] {
  const matched: Rule[] = [];
  const seenMatchers = new Set<string>();

  for (const matcher of RULE_MATCHERS) {
    if (seenMatchers.has(matcher.id)) {
      continue;
    }
    for (const pattern of matcher.patterns) {
      const match = stripped.match(pattern);
      if (match) {
        ruleCounter++;
        matched.push({
          id: `${matcher.id}-${ruleCounter}`,
          category: matcher.category,
          source: line,
          description: matcher.description,
          severity: matcher.severity,
          verifier: matcher.verifier,
          pattern: matcher.buildPattern(stripped, match),
        });
        seenMatchers.add(matcher.id);
        break;
      }
    }
  }
  return matched;
}

/**
 * Deduplicate rules by their matcher ID prefix.
 *
 * When multiple lines express the same rule, keep only the first occurrence.
 */
function deduplicateRules(rules: Rule[]): Rule[] {
  const seen = new Set<string>();
  const result: Rule[] = [];

  for (const rule of rules) {
    const prefix = rule.id.replace(/-\d+$/, '');
    if (!seen.has(prefix)) {
      seen.add(prefix);
      result.push(rule);
    }
  }

  return result;
}

/**
 * Extract machine-verifiable rules from parsed markdown sections.
 *
 * Scans every line in every section, attempting to match it against
 * known rule patterns. Lines that look like instructions but don't
 * match any pattern go into the unparseable array. Structural markdown
 * (code fences, tables, images) is silently skipped.
 *
 * @param sections - Parsed markdown sections from parseMarkdown()
 * @returns Object containing extracted rules and unparseable lines
 */
export function extractRules(sections: MarkdownSection[]): {
  rules: Rule[];
  unparseable: string[];
} {
  const rules: Rule[] = [];
  const unparseable: string[] = [];

  for (const section of sections) {
    for (const line of section.lines) {
      const stripped = stripFormatting(line);
      const classification = classifyLine(line, stripped);

      switch (classification) {
        case 'skip':
        case 'prose':
          continue;
        case 'subjective':
          unparseable.push(line);
          continue;
        case 'candidate': {
          const matched = matchLine(line, stripped);
          if (matched.length > 0) {
            rules.push(...matched);
          } else {
            unparseable.push(line);
          }
          break;
        }
      }
    }
  }

  return {
    rules: deduplicateRules(rules),
    unparseable,
  };
}
