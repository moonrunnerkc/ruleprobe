/**
 * Pass 2A/2B: Statement and code block classification.
 *
 * Contains the core classification logic that maps text statements
 * to StatementCategory values using keyword and structure signals.
 */

import type { ContentBlock } from './pipeline-types.js';
import type { StatementCategory } from './pipeline-types.js';
import { DIFFICULTY_CONFIDENCE } from './pipeline-types.js';
import {
  CLI_TOOL_NAMES,
  EXAMPLE_CONTEXT_RE,
  COMMAND_CONTEXT_RE,
  IMPERATIVE_VERB_START_RE,
  CONDITIONAL_IMPERATIVE_RE,
  LABELLED_IMPERATIVE_RE,
  CAUTIONARY_RE,
  MUST_ALWAYS_NEVER_RE,
  ALL_EVERY_MUST_RE,
  QUALIFIED_RE,
  CONSIDER_GERUND_RE,
  PREFER_PATTERN_RE,
  TOOL_NAME_RE,
  BACKTICK_COMMAND_RE,
  BACKTICK_CLI_INVOCATION_RE,
  BOLD_TOOL_RE,
  FILE_PATH_RE,
  PLACEMENT_RE,
  FILE_GLOB_RE,
  CASE_STYLE_RE,
  NAMING_DIRECTIVE_RE,
  WORKFLOW_GIT_RE,
  COMMIT_TYPE_RE,
  WORKFLOW_CI_RE,
  WORKFLOW_PROCESS_RE,
  AGENT_BEHAVIOR_RE,
  NUMERIC_LIMIT_RE,
  STRUCTURAL_DIRECTIVE_RE,
  PATTERN_REF_RE,
  LANG_SPECIFIC_RE,
  DESCRIPTIVE_IS_RE,
  API_REFERENCE_RE,
  DESCRIPTIVE_USAGE_RE,
  SEE_REFERENCE_RE,
  EXAMPLE_LABEL_RE,
  BOLD_REFERENCE_RE,
  LINK_ONLY_RE,
  METADATA_RE,
  stripMarkdownFormatting,
  hasActionableContext,
  hasFileStructureContext,
} from './classification-patterns.js';

/**
 * Classify a fenced code block.
 *
 * @param content - The code block content
 * @param language - The language tag (bash, sh, etc.)
 * @param precedingText - Text of the block immediately before this code block
 * @returns Category and confidence
 */
export function classifyCodeBlock(
  content: string,
  language: string,
  precedingText: string,
): { category: StatementCategory; confidence: number } {
  const lang = language.toLowerCase();
  const isShellLang = lang === 'bash' || lang === 'sh' || lang === 'shell'
    || lang === 'zsh' || lang === '';

  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const hasShellPrompt = lines.some((l) => /^\s*\$\s+/.test(l));
  const hasCLITools = CLI_TOOL_NAMES.test(content);

  if (isShellLang && (hasShellPrompt || hasCLITools)) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  if (COMMAND_CONTEXT_RE.test(precedingText) && hasCLITools) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  if (EXAMPLE_CONTEXT_RE.test(precedingText)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }

  if (lines.length <= 3 && lines.every((l) => /^[\w./-]+$/.test(l.trim()))) {
    return { category: 'FILE_STRUCTURE', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
}

/**
 * Classify a single text statement using keyword + structure signals.
 *
 * @param text - The stripped statement text
 * @param blockType - The content block type from Pass 1
 * @param sectionHeader - The section header for context
 * @param precedingText - Text of the block immediately before this one
 * @returns Category and confidence
 */
export function classifyStatement(
  text: string,
  blockType: ContentBlock['type'],
  sectionHeader: string,
  precedingText: string,
): { category: StatementCategory; confidence: number } {
  if (blockType === 'code_block') {
    return classifyCodeBlock(text, '', precedingText);
  }

  const stripped = stripMarkdownFormatting(text);

  // PREFER_PATTERN (difficulty 1)
  if (PREFER_PATTERN_RE.test(stripped)) {
    return { category: 'PREFER_PATTERN', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  // NAMING_CONVENTION (difficulty 1)
  if (CASE_STYLE_RE.test(stripped) || NAMING_DIRECTIVE_RE.test(stripped)) {
    return { category: 'NAMING_CONVENTION', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  // TOOLING_COMMAND (difficulty 1)
  if (BACKTICK_COMMAND_RE.test(text) || BOLD_TOOL_RE.test(text)) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }
  if (TOOL_NAME_RE.test(stripped) && hasActionableContext(stripped)) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }
  if (BACKTICK_CLI_INVOCATION_RE.test(text) && hasActionableContext(stripped)) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }
  if (BACKTICK_CLI_INVOCATION_RE.test(text) && /:\s*$|^[A-Za-z][^:]{0,30}:/.test(stripped)) {
    return { category: 'TOOLING_COMMAND', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // PATTERN_REFERENCE (difficulty 3)
  if (PATTERN_REF_RE.test(stripped)) {
    return { category: 'PATTERN_REFERENCE', confidence: DIFFICULTY_CONFIDENCE.HARD };
  }

  // LANGUAGE_SPECIFIC (difficulty 3)
  if (LANG_SPECIFIC_RE.test(stripped) && hasActionableContext(stripped)) {
    return { category: 'LANGUAGE_SPECIFIC', confidence: DIFFICULTY_CONFIDENCE.HARD };
  }

  // FILE_STRUCTURE (difficulty 2)
  if ((FILE_PATH_RE.test(text) && PLACEMENT_RE.test(stripped))
    || (FILE_PATH_RE.test(text) && hasFileStructureContext(sectionHeader))
    || FILE_GLOB_RE.test(stripped)
    || PLACEMENT_RE.test(stripped)) {
    return { category: 'FILE_STRUCTURE', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // AGENT_BEHAVIOR (not code-verifiable: LLM conversation style rules)
  if (AGENT_BEHAVIOR_RE.test(stripped)
    && !TOOL_NAME_RE.test(stripped)
    && !CASE_STYLE_RE.test(stripped)) {
    return { category: 'AGENT_BEHAVIOR', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // WORKFLOW (difficulty 2)
  if (WORKFLOW_GIT_RE.test(stripped) || WORKFLOW_PROCESS_RE.test(stripped)) {
    return { category: 'WORKFLOW', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }
  if (WORKFLOW_CI_RE.test(stripped) && hasActionableContext(stripped)) {
    return { category: 'WORKFLOW', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }
  if (COMMIT_TYPE_RE.test(stripped)) {
    return { category: 'WORKFLOW', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // CODE_STYLE (difficulty 2)
  if (NUMERIC_LIMIT_RE.test(stripped) || STRUCTURAL_DIRECTIVE_RE.test(stripped)) {
    return { category: 'CODE_STYLE', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // IMPERATIVE_DIRECT (difficulty 1): strong obligation
  if (MUST_ALWAYS_NEVER_RE.test(stripped) || ALL_EVERY_MUST_RE.test(stripped)) {
    return { category: 'IMPERATIVE_DIRECT', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  // IMPERATIVE_QUALIFIED (difficulty 2)
  if (QUALIFIED_RE.test(stripped) || CONSIDER_GERUND_RE.test(stripped)) {
    return { category: 'IMPERATIVE_QUALIFIED', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // IMPERATIVE_DIRECT (difficulty 1): starts with imperative verb
  if (IMPERATIVE_VERB_START_RE.test(stripped)) {
    return { category: 'IMPERATIVE_DIRECT', confidence: DIFFICULTY_CONFIDENCE.EASY };
  }

  // IMPERATIVE_DIRECT: conditional instruction (When X, ensure Y)
  if (CONDITIONAL_IMPERATIVE_RE.test(stripped)) {
    return { category: 'IMPERATIVE_DIRECT', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // IMPERATIVE_DIRECT: labelled instruction (Topic: use X)
  if (LABELLED_IMPERATIVE_RE.test(stripped)) {
    return { category: 'IMPERATIVE_DIRECT', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // IMPERATIVE_QUALIFIED: cautionary directives
  if (CAUTIONARY_RE.test(stripped)) {
    return { category: 'IMPERATIVE_QUALIFIED', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // Bold-line with actionable description
  if (blockType === 'bold_line' && hasActionableContext(stripped)) {
    return { category: 'IMPERATIVE_DIRECT', confidence: DIFFICULTY_CONFIDENCE.MEDIUM };
  }

  // Step 2C: Context filtering
  if (DESCRIPTIVE_IS_RE.test(stripped)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (API_REFERENCE_RE.test(text)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (DESCRIPTIVE_USAGE_RE.test(stripped)
    && !MUST_ALWAYS_NEVER_RE.test(stripped)
    && !IMPERATIVE_VERB_START_RE.test(stripped)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (SEE_REFERENCE_RE.test(text)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (EXAMPLE_LABEL_RE.test(stripped)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (BOLD_REFERENCE_RE.test(text.trim())) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (LINK_ONLY_RE.test(stripped)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }
  if (METADATA_RE.test(text)) {
    return { category: 'CONTEXT_ONLY', confidence: DIFFICULTY_CONFIDENCE.CONTEXT };
  }

  // Long descriptive paragraph with no imperative verbs
  const sentenceCount = (stripped.match(/[.!?]\s/g) ?? []).length + 1;
  if (blockType === 'paragraph' && sentenceCount > 3
    && !IMPERATIVE_VERB_START_RE.test(stripped)
    && !MUST_ALWAYS_NEVER_RE.test(stripped)) {
    return { category: 'CONTEXT_ONLY', confidence: 0.60 };
  }

  return { category: 'UNKNOWN', confidence: DIFFICULTY_CONFIDENCE.NONE };
}
