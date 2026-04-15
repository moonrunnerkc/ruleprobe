/**
 * Classification patterns and helpers for Pass 2.
 *
 * Contains all regex constants and utility functions used by the
 * statement classifier. Separated for file size compliance (300 line limit).
 */

import type { ContentBlock } from './pipeline-types.js';

// ---------------------------------------------------------------------------
// Step 2A: Code block patterns
// ---------------------------------------------------------------------------

/** CLI tool names that signal a shell command. */
export const CLI_TOOL_NAMES = /\b(npm|yarn|pnpm|bun|cargo|pip|go|make|gradle|maven|docker|pytest|npx|git|curl|wget|brew|apt|dnf|pacman|lage|nx|taskr|vitest|jest|tsc|eslint|prettier|biome|golangci-lint|benchstat)\b/i;

/** Phrases that precede a code block to indicate it is an example only. */
export const EXAMPLE_CONTEXT_RE = /\b(example|like\s+this|such\s+as|e\.g\.|for\s+instance|for\s+reference|sample|illustration)\b/i;

/** Phrases before a code block that indicate a command to run. */
export const COMMAND_CONTEXT_RE = /\b(run|execute|install|build|start|use|invoke)\b/i;

// ---------------------------------------------------------------------------
// Step 2B: Keyword-driven classification patterns
// ---------------------------------------------------------------------------

/**
 * Imperative verbs that commonly start actionable instructions.
 * Matched at word boundary after stripping list markers.
 */
export const IMPERATIVE_VERB_START_RE = /^(?:also\s+)?(use|run|add|create|write|ensure|include|apply|keep|make|set|follow|check|update|remove|import|pass|handle|wrap|test|put|place|install|build|start|configure|enable|disable|implement|define|declare|avoid|prefer|format|lint|require|specify|call|return|throw|validate|verify|name|mark|submit|assign|extend|override|separate|split|combine|organize|structure|move|document|annotate|sign|link|fix|provide|adopt|convert|migrate|establish|maintain|prioritize|target|resist|explain|preserve|regenerate|scaffold|propagate|reuse|minimize|maximize|restrict|limit|scope|emit|expose|inject|reference)\b/i;

/**
 * Conditional instruction: "When [condition], [imperative verb]".
 * Also captures "If [condition], [imperative verb]" and "For [X], [imperative verb]".
 */
export const CONDITIONAL_IMPERATIVE_RE = /^(?:when|if|for)\s+.+[,:]\s*(use|ensure|avoid|prefer|follow|keep|handle|create|add|remove|check|mark|run|make|set|move|include|place|write|test|pass|apply|split|return|throw|validate|verify|format|build|install|start|configure|prioritize|target|restrict|limit|scope|emit|expose|summarize|preserve|update|document|propagate|resist|implement)\b/i;

/**
 * Labelled instruction: "Topic: imperative verb...".
 * e.g. "Error handling: Prefer explicit error handling" or "jest tests: when writing..."
 */
export const LABELLED_IMPERATIVE_RE = /^[A-Za-z][^:]{0,40}:\s+(use|run|add|create|write|ensure|include|apply|keep|make|set|follow|check|update|remove|avoid|prefer|format|lint|explain|preserve|prioritize|target|when\s+\w)\b/i;

/** Cautionary directives: "Be careful", "Be cautious". */
export const CAUTIONARY_RE = /\bbe\s+(?:careful|cautious|aware|mindful)\b/i;

/** Strong obligation keywords. */
export const MUST_ALWAYS_NEVER_RE = /\b(must|always|never|do\s+not|don['\u2019]t|required|mandatory|no\s+exceptions?|shall\s+not|shall|forbidden|prohibited|not\s+allowed|no\s+\w+)\b/i;

/** Universal quantifier + must pattern. */
export const ALL_EVERY_MUST_RE = /\b(all|every|each)\b.*\b(must|should|shall)\b/i;

/** Qualified instruction keywords. */
export const QUALIFIED_RE = /\b(should|when\s+possible|where\s+feasible|if\s+(?:possible|practical)|ideally|try\s+to|aim\s+to|strive\s+to|generally|typically)\b/i;

/** Consider + gerund. */
export const CONSIDER_GERUND_RE = /\bconsider\s+\w+ing\b/i;

/** Prefer X over Y and variants. */
export const PREFER_PATTERN_RE = /\b(prefer\s+\S+\s+over|instead\s+of|rather\s+than|favor\s+\S+\s+over|\S+\s+over\s+\S+|avoid\s+\S+[,;]\s*use|don['']t\s+use\s+\S+[,;]\s*use\s+\S+\s+instead)\b/i;

/** Package manager / tool names. */
export const TOOL_NAME_RE = /\b(npm|yarn|pnpm|bun|cargo|pip|go\s+(?:test|build|run|install|mod)|make|gradle|maven|docker|pytest|npx|vitest|jest|eslint|prettier|biome|nx|lage|taskr|golangci-lint|tsc)\b/i;

/** Backtick-wrapped command. */
export const BACKTICK_COMMAND_RE = /`[^`]*\b(npm|yarn|pnpm|bun|cargo|pip|go|make|gradle|maven|docker|pytest|npx|git|curl|vitest|jest|eslint|prettier|biome|nx|lage|taskr|tsc)[^`]*`/i;

/** Backtick-wrapped invocation of any CLI-like command with arguments. */
export const BACKTICK_CLI_INVOCATION_RE = /`[a-z][a-z0-9_-]*\s+[^`]+`/i;

/** Bold label + tool pattern: "**Build System**: Yarn 4". */
export const BOLD_TOOL_RE = /^\*\*[^*]+\*\*[:\s]+.*\b(npm|yarn|pnpm|bun|cargo|pip|go|make|gradle|maven|docker|vitest|jest|eslint|prettier|biome)\b/i;

/** File path references. */
export const FILE_PATH_RE = /`[^`]*[/\\][^`]*`|`[^`]*\.[a-z]{1,4}`/i;

/** Placement verbs with paths. */
export const PLACEMENT_RE = /\b(place\s+in|goes?\s+in|lives?\s+in|located?\s+at|co-?locate|same\s+directory|alongside)\b/i;

/** File pattern globs. */
export const FILE_GLOB_RE = /\*\.\w+\.\w+|\*\.\w+/;

/** Case-style keywords for naming conventions. */
export const CASE_STYLE_RE = /\b(camelCase|PascalCase|snake_case|SCREAMING_SNAKE_CASE|UPPER_CASE|kebab[- ]case|lowercase|ALLCAPS)\b/i;

/** Prefix/suffix naming keywords. */
export const NAMING_DIRECTIVE_RE = /\b(prefix\s+(?:\w+\s+)?with|suffix\s+(?:\w+\s+)?with|naming\s+convention|naming\s+pattern|named?\s+like)\b/i;

/** Git/PR/commit keywords for workflow. */
export const WORKFLOW_GIT_RE = /\b(git\s+commit|pull\s+request|merge\s+request|PR\s+title|commit\s+message|branch\s+name|git\s+push|git\s+rebase|squash\s+commit|sign\s+off|DCO|code\s+review|conventional\s+commit)\b/i;

/** Commit type convention patterns (feat:, fix:, chore:). */
export const COMMIT_TYPE_RE = /^`?(feat|fix|chore|refactor|docs|test|ci|perf|style|revert)`?[:(]/i;

/** CI/CD keywords. */
export const WORKFLOW_CI_RE = /\b(CI\b|CD\b|pipeline|workflow|GitHub\s+Actions?|CircleCI|Travis|Jenkins|deploy|deployment)\b/i;

/** Process verbs for workflow. */
export const WORKFLOW_PROCESS_RE = /\b(submit|create\s+a\s+PR|open\s+a\s+(?:PR|pull\s+request|issue)|request\s+review|merge\s+into)\b/i;

/**
 * Agent behavior keywords: instructions about LLM conversation style,
 * tone, verbosity, or response formatting that cannot be verified from code.
 */
export const AGENT_BEHAVIOR_RE = /\b(be\s+(?:terse|concise|brief|verbose|helpful|friendly|professional|polite|respectful)|don['']?t\s+explain(?:\s+unless\s+asked)?|don['']?t\s+apologize|avoid\s+(?:unnecessary\s+)?explanation|keep\s+(?:responses?|answers?|replies?)\s+(?:short|brief|concise)|respond\s+(?:in|with)\s+(?:bullet|list|table)|think\s+step[- ]by[- ]step|use\s+(?:markdown|plain\s+text)\s+in\s+responses?|tone\s+should\s+be|communication\s+style|when\s+(?:responding|answering)|format\s+(?:your|the)\s+(?:response|answer|reply)|conversation(?:al)?\s+style|output\s+format\s+should\s+be)\b/i;

/** Numeric limits for code style. */
export const NUMERIC_LIMIT_RE = /\b(under\s+\d+\s+lines?|maximum\s+\d+|no\s+more\s+than\s+\d+|at\s+most\s+\d+|limit(?:ed)?\s+to\s+\d+|max\s+\d+|\d+\s+LoC)\b/i;

/** Structural directives for code style. */
export const STRUCTURAL_DIRECTIVE_RE = /\b(early\s+return|avoid\s+nest(?:ing|ed)|single\s+responsibility|keep\s+(?:functions?|methods?|files?)\s+(?:small|short|focused)|separation\s+of\s+concerns|DRY\b|SOLID\b|prefer\s+composition)\b/i;

/** Pattern reference keywords. */
export const PATTERN_REF_RE = /\b(follow(?:ing)?\s+existing|match(?:ing)?\s+existing|consistent\s+with|same\s+(?:approach|pattern|style)\s+as|use\s+the\s+project'?s|like\s+the\s+other|similar\s+to|as\s+done\s+in|existing\s+patterns?|look\s+for\s+existing)\b/i;

/** Language-specific directives. */
export const LANG_SPECIFIC_RE = /\b(?:satisfies\b|Result<|no\s+any\b|no\s+bare\s+except|unwrap\(\)|type\s+guard|interface\s+contract|doc\s+comment|propagate\s+errors?\s+with\s+\?|mod\.rs)/i;

// ---------------------------------------------------------------------------
// Step 2C: Context filtering signals
// ---------------------------------------------------------------------------

/** Describes what something IS (not what to DO). */
export const DESCRIPTIVE_IS_RE = /^(this\s+is|it\s+is|the\s+\w+\s+is|.*\bis\s+(?:a|an|the)\s+|.*\bcontains?\b|.*\bconsists?\s+of\b|.*\bprovides?\b(?!.*\b(?:must|should|always|never)\b)|.*\brepresents?\b)/i;

/** API reference patterns: "`method()` returns X", "`X` is provided when..." */
export const API_REFERENCE_RE = /^`[^`]+`\s+(returns?|is\s+provided|is\s+used|takes?\s+a|is\s+(?:either|the|called|wrapped))\b/i;

/** Descriptive usage/behavior: "X can be used to Y", "X allows Y". */
export const DESCRIPTIVE_USAGE_RE = /\b(can\s+be\s+(?:used|held|awaited|registered)|(?:is|are)\s+(?:dispatched|registered|used\s+to|run\s+on|laid\s+out|wrapped\s+in|awaited)|(?:runs?\s+an?\s+async)|dereferen|allowing\s+it\s+to\s+run)/i;

/** "See [link]" or "See `file`" references without directives. */
export const SEE_REFERENCE_RE = /^See\s+(?:`[^`]+`|\[[^\]]+\]\([^)]+\))/i;

/** Example/illustration labels without directives. */
export const EXAMPLE_LABEL_RE = /^(?:Example[s:]?|Typical\s+pattern[s:]?|Desired[:]?|Basic\s+spans[:]?)$/i;

/** Bold architecture reference: "**Label**: `path/file.ts`." */
export const BOLD_REFERENCE_RE = /^\*\*[^*]+\*\*[:\s]+`[^`]+`[.!]?$/;

/** Link/reference without directive. */
export const LINK_ONLY_RE = /^(?:https?:\/\/|See\s+https?:\/\/|Link:?\s+https?:\/\/|Reference:?\s+https?:\/\/)/i;

/** Metadata patterns: URLs, versions, authors. */
export const METADATA_RE = /^(?:\*\*(?:Repository|License|Primary\s+Language|Author|Version|Homepage|Website|URL)\*\*|(?:Repository|License|Author|Version|URL):?\s)/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown formatting for cleaner keyword matching.
 * Removes list markers, inline code backticks, bold, italic, links.
 */
export function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Check if text has actionable context (imperative verbs or obligation words).
 */
export function hasActionableContext(text: string): boolean {
  return IMPERATIVE_VERB_START_RE.test(text)
    || MUST_ALWAYS_NEVER_RE.test(text)
    || QUALIFIED_RE.test(text)
    || /\b(run|execute|install|build|start|configure|enable|disable)\b/i.test(text);
}

/**
 * Check if the section header suggests file structure context.
 */
export function hasFileStructureContext(sectionHeader: string): boolean {
  return /\b(structure|directory|folder|organization|layout|files?)\b/i.test(sectionHeader);
}

/**
 * Extract the text from a content block.
 */
export function getBlockText(block: ContentBlock): string {
  switch (block.type) {
    case 'bullet':
    case 'numbered':
    case 'paragraph':
    case 'bold_line':
    case 'checkbox':
      return block.text;
    case 'code_block':
      return block.content;
  }
}
