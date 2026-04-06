/**
 * Rule extractor for markdown instruction files.
 *
 * Takes parsed markdown sections and identifies lines that express
 * machine-verifiable rules. Uses keyword-based pattern matching against
 * a dictionary of known rule types. Deliberately conservative: misses
 * a rule rather than misinterprets one. Unmatched lines go into the
 * unparseable array for transparency.
 */

import type {
  Rule,
  RuleCategory,
  VerifierType,
  VerificationPattern,
  MarkdownSection,
} from '../types.js';

/**
 * A matcher definition that maps natural language patterns in instruction
 * files to structured, machine-verifiable rules.
 */
interface RuleMatcher {
  /** Unique identifier prefix for rules produced by this matcher. */
  id: string;
  /** Regex patterns that match instruction lines this rule covers. */
  patterns: RegExp[];
  /** The rule category. */
  category: RuleCategory;
  /** Which verifier handles this rule. */
  verifier: VerifierType;
  /** Human-readable description of what this rule checks. */
  description: string;
  /** Default severity. */
  severity: 'error' | 'warning';
  /** Build the verification pattern from the matched line. */
  buildPattern: (line: string, match: RegExpMatchArray) => VerificationPattern;
}

/**
 * Dictionary of known rule matchers.
 *
 * Each matcher has one or more regex patterns covering varied phrasings
 * of the same underlying rule. The patterns are intentionally broad enough
 * to catch common instruction file patterns while being specific enough
 * to avoid false matches.
 */
const RULE_MATCHERS: RuleMatcher[] = [
  {
    id: 'naming-camelcase-variables',
    patterns: [
      /\bcamel\s*case\b.*\b(variable|function|method|property|param)/i,
      /\b(variable|function|method|property|param)\w*\b.*\bcamel\s*case\b/i,
      /\bcamel\s*case\s+(for\s+)?(all\s+)?(variable|function|method)/i,
      /\b(variable|function)\s+names?:?\s*camel\s*case\b/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Variables and functions must use camelCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'camelCase',
      target: 'variables',
      expected: 'camelCase',
      scope: 'file',
    }),
  },
  {
    id: 'naming-camelcase-general',
    patterns: [
      /\bcamel\s*case\b(?!.*\b(files?|types?|interfaces?|class(?:es)?|components?|PascalCase|variables?|functions?|methods?|propert(?:y|ies)|params?)\b)/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Identifiers must use camelCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'camelCase',
      target: 'identifiers',
      expected: 'camelCase',
      scope: 'file',
    }),
  },
  {
    id: 'naming-pascalcase-types',
    patterns: [
      /\bPascal\s*Case\b.*\b(type|interface|class|component|enum)/i,
      /\b(type|interface|class|component|enum)\w*\b.*\bPascal\s*Case\b/i,
      /\bPascal\s*Case\s+(for\s+)?(all\s+)?(type|interface|class|component)/i,
      /\b(type|interface|class)\s+names?:?\s*Pascal\s*Case\b/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Types, interfaces, and classes must use PascalCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'PascalCase',
      target: 'types',
      expected: 'PascalCase',
      scope: 'file',
    }),
  },
  {
    id: 'naming-kebab-case-files',
    patterns: [
      /\bkebab[\s-]*case\b.*\bfile/i,
      /\bfile\s+names?:?\s*kebab[\s-]*case\b/i,
      /\bfile\b.*\bkebab[\s-]*case\b/i,
      /\bkebab[\s-]*case\b.*\bnamed?\b/i,
    ],
    category: 'naming',
    verifier: 'filesystem',
    description: 'File names must use kebab-case',
    severity: 'error',
    buildPattern: () => ({
      type: 'kebab-case',
      target: 'filenames',
      expected: 'kebab-case',
      scope: 'project',
    }),
  },
  {
    id: 'forbidden-no-any-type',
    patterns: [
      /\bno\s+any\s+type/i,
      /\bnever\s+use\s+any\b/i,
      /\bavoid\s+any\s+type/i,
      /\bno\s+`?any`?\s+type/i,
      /\bdon'?t\s+use\s+any\b(?!\s+(?:of|other|more))/i,
      /\bwithout\s+any\s+type/i,
      /\bno\s+any\b(?=.*\btype)/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'The "any" type must not be used',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-any',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }),
  },
  {
    id: 'forbidden-no-console-log',
    patterns: [
      /\bno\s+console\.?log\b/i,
      /\bnever\s+use\s+console\.?log\b/i,
      /\bavoid\s+console\.?log\b/i,
      /\bdon'?t\s+use\s+console\.?log\b/i,
      /\bno\s+console\.\s*log\b.*\bproduction\b/i,
      /\bconsole\.?log\b.*\bforbidden\b/i,
      /\bconsole\.?log\b.*\bnot\s+allowed\b/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'console.log must not be used in production code',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-console-log',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }),
  },
  {
    id: 'structure-named-exports-only',
    patterns: [
      /\bnamed\s+exports?\s+only\b/i,
      /\bno\s+default\s+exports?\b/i,
      /\bnever\s+use\s+default\s+exports?\b/i,
      /\bavoid\s+default\s+exports?\b/i,
      /\bdon'?t\s+use\s+default\s+exports?\b/i,
      /\buse\s+named\s+exports?\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Only named exports are allowed, no default exports',
    severity: 'error',
    buildPattern: () => ({
      type: 'named-exports-only',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }),
  },
  {
    id: 'structure-max-line-length',
    patterns: [
      /\bmax(?:imum)?\s+(?:line\s+)?length[:\s]+(\d+)/i,
      /\bline\s+length[:\s]+(?:max(?:imum)?\s+)?(\d+)/i,
      /\b(\d+)\s+(?:character|char|col(?:umn)?)\s+(?:line\s+)?(?:limit|max|length)/i,
      /\blines?\s+(?:should|must)\s+(?:not\s+)?(?:exceed|be\s+(?:longer|more)\s+than)\s+(\d+)/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'regex',
    description: 'Lines must not exceed the maximum length',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => {
      const maxLength = match[1] ?? '120';
      return {
        type: 'max-line-length',
        target: '*.ts',
        expected: maxLength,
        scope: 'file',
      };
    },
  },
  {
    id: 'structure-max-file-length',
    patterns: [
      /\bmax(?:imum)?\s+file\s+length[:\s]+(\d+)/i,
      /\bfile\s+length[:\s]+(?:max(?:imum)?\s+)?(\d+)/i,
      /\bfiles?\s+(?:should|must)\s+(?:not\s+)?(?:exceed|be\s+(?:longer|more)\s+than)\s+(\d+)\s+lines/i,
      /\b(\d+)\s+lines?\b.*\bmax(?:imum)?\s+file\b/i,
    ],
    category: 'structure',
    verifier: 'regex',
    description: 'Files must not exceed the maximum line count',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => {
      const maxLines = match[1] ?? '300';
      return {
        type: 'max-file-length',
        target: '*.ts',
        expected: maxLines,
        scope: 'file',
      };
    },
  },
  {
    id: 'test-files-exist',
    patterns: [
      /\ball\s+files?\s+must\s+have\s+tests?\b/i,
      /\btest\s+files?\s+(for\s+)?(every|each|all)\b/i,
      /\bevery\s+(?:source\s+)?file\s+(?:must\s+|should\s+)?have\s+(?:a\s+)?(?:corresponding\s+)?test/i,
      /\bco[\s-]?located\b.*\btests?\b/i,
      /\btests?\b.*\bco[\s-]?located\b/i,
      /\btest\s+files?:?\s+co[\s-]?located\b/i,
    ],
    category: 'test-requirement',
    verifier: 'filesystem',
    description: 'Every source file must have a corresponding test file',
    severity: 'error',
    buildPattern: () => ({
      type: 'test-files-exist',
      target: 'src/**/*.ts',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'test-named-pattern',
    patterns: [
      /\btest\s+files?\b.*\bnamed\b.*\b\.test\.ts\b/i,
      /\bnamed\b.*\*\.test\.ts\b/i,
      /\b\.test\.ts\b.*\btest\s+files?\b/i,
    ],
    category: 'test-requirement',
    verifier: 'filesystem',
    description: 'Test files must be named *.test.ts',
    severity: 'error',
    buildPattern: () => ({
      type: 'test-file-naming',
      target: 'tests/**',
      expected: '*.test.ts',
      scope: 'project',
    }),
  },
  {
    id: 'import-no-deep-relative',
    patterns: [
      /\bno\s+(?:deep\s+)?relative\s+imports?\s+deeper\s+than\s+(\d+)/i,
      /\brelative\s+imports?\b.*\bno\s+(?:more|deeper)\s+than\s+(\d+)/i,
      /\bno\s+deep\s+relative\s+imports?\b/i,
      /\bavoid\s+deep\s+relative\s+imports?\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'Relative imports must not go too deep',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => {
      const maxDepth = match[1] ?? '2';
      return {
        type: 'no-deep-relative-imports',
        target: '*.ts',
        expected: maxDepth,
        scope: 'file',
      };
    },
  },
  {
    id: 'import-no-path-aliases',
    patterns: [
      /\buse\s+(?:relative\s+)?path(?:s)?\b.*\bno\s+(?:path\s+)?aliases\b/i,
      /\bno\s+path\s+aliases\b/i,
      /\bimports?\s+use\s+relative\s+paths?\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'Imports must use relative paths, not path aliases',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-path-aliases',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }),
  },
  {
    id: 'structure-jsdoc-required',
    patterns: [
      /\bevery\s+(?:public\s+)?function\s+(?:must\s+|should\s+)?ha(?:ve|s)\s+(?:a\s+)?JSDoc\b/i,
      /\bJSDoc\b.*\b(?:required|mandatory)\b/i,
      /\b(?:required|mandatory)\b.*\bJSDoc\b/i,
      /\bJSDoc\s+comment\b.*\bevery\b/i,
      /\ball\s+(?:public\s+)?functions?\s+(?:need|require)\s+JSDoc\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Every public function must have a JSDoc comment',
    severity: 'warning',
    buildPattern: () => ({
      type: 'jsdoc-required',
      target: '*.ts',
      expected: true,
      scope: 'file',
    }),
  },
  {
    id: 'structure-strict-mode',
    patterns: [
      /\bTypeScript\s+strict\s+mode\b/i,
      /\bstrict\s+mode\b.*\bTypeScript\b/i,
      /\btsconfig\b.*\bstrict\b/i,
      /\bstrict:\s*true\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'TypeScript strict mode must be enabled',
    severity: 'error',
    buildPattern: () => ({
      type: 'strict-mode',
      target: 'tsconfig.json',
      expected: true,
      scope: 'project',
    }),
  },
];

/**
 * Lines matching these patterns are structural markdown or meta-content
 * that should not be treated as rule candidates. Skipping them avoids
 * polluting the unparseable array with non-instruction content.
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
  // Lines starting with list markers or containing imperative verbs
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
 * Check whether a line should be skipped entirely (structural markdown
 * that is not an instruction candidate).
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

/** Counter for generating unique rule IDs when duplicates arise. */
let ruleCounter = 0;

/**
 * Reset the internal rule ID counter. Useful between test runs
 * to get deterministic IDs.
 */
export function resetRuleCounter(): void {
  ruleCounter = 0;
}

/**
 * Match a single line against all known rule matchers.
 *
 * A single line can express multiple rules (e.g. "TypeScript strict mode, no any types").
 * Returns all matching Rules, or an empty array if no matcher applies.
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
 * When multiple lines in an instruction file express the same rule
 * (e.g. "Use camelCase for variables" and "Variable names: camelCase"),
 * keep only the first occurrence.
 */
function deduplicateRules(rules: Rule[]): Rule[] {
  const seen = new Set<string>();
  const result: Rule[] = [];

  for (const rule of rules) {
    // Extract the matcher ID prefix (everything before the counter suffix)
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
      if (shouldSkipLine(line)) {
        continue;
      }

      const stripped = stripFormatting(line);

      if (stripped.length === 0) {
        continue;
      }

      // Subjective lines go to unparseable regardless of instruction candidacy
      if (isSubjective(stripped)) {
        unparseable.push(line);
        continue;
      }

      // Skip non-instruction prose (documentation, descriptions)
      if (!isInstructionCandidate(stripped)) {
        continue;
      }

      const matched = matchLine(line, stripped);
      if (matched.length > 0) {
        rules.push(...matched);
      } else {
        // Looks like an instruction but we can't extract a rule from it
        unparseable.push(line);
      }
    }
  }

  return {
    rules: deduplicateRules(rules),
    unparseable,
  };
}
