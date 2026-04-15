/**
 * Runtime topic extension for novel instruction phrasings.
 *
 * When a rule's text does not match any base topic keywords,
 * this module extracts content keywords (nouns after directive verbs)
 * from the rule text and checks whether any correspond to AST node
 * type names present in the raw vectors. If yes, a temporary topic
 * is registered for that analysis run.
 *
 * No NLP library dependencies. Uses basic regex noun extraction.
 */

import type { RawFileVector } from '../../types.js';
import type { TopicDefinition } from './topic-registry.js';

/**
 * Directive verbs that precede nouns in instruction text.
 * Words following these verbs are likely the subject of the rule.
 *
 * Source: corpus analysis of 5,092 statements from 72 instruction files.
 */
const DIRECTIVE_VERBS = [
  'use', 'prefer', 'avoid', 'follow', 'require',
  'enforce', 'ensure', 'include', 'add', 'apply',
  'implement', 'create', 'write', 'define', 'declare',
  'import', 'export', 'return', 'throw', 'catch',
];

/**
 * Common function words to exclude from content keyword extraction.
 * These never correspond to AST node types.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'over', 'out', 'up', 'down',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'each', 'every', 'all', 'any', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own',
  'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when',
  'while', 'that', 'which', 'who', 'whom', 'this', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
  'you', 'your', 'he', 'she', 'his', 'her', 'my', 'me',
  'always', 'never', 'must', 'instead',
]);

/**
 * Known AST node types from tree-sitter TypeScript/JavaScript grammar.
 *
 * Subset of common types that might appear in instruction text as
 * recognizable programming concepts.
 */
const KNOWN_AST_NODE_TYPES = new Set([
  'function_declaration', 'arrow_function', 'class_declaration',
  'method_definition', 'variable_declarator', 'variable_declaration',
  'if_statement', 'for_statement', 'for_in_statement', 'while_statement',
  'do_statement', 'switch_statement', 'switch_case',
  'try_statement', 'catch_clause', 'throw_statement',
  'return_statement', 'yield_expression', 'await_expression',
  'call_expression', 'new_expression', 'member_expression',
  'assignment_expression', 'binary_expression', 'ternary_expression',
  'template_string', 'template_substitution',
  'import_statement', 'export_statement', 'export_specifier',
  'type_alias_declaration', 'interface_declaration', 'enum_declaration',
  'type_annotation', 'type_predicate', 'as_expression',
  'object_pattern', 'array_pattern', 'spread_element',
  'jsx_element', 'jsx_self_closing_element', 'jsx_expression',
  'comment', 'program',
  'object', 'pair', 'array',
  'formal_parameters', 'required_parameter', 'optional_parameter',
  'predefined_type',
]);

/**
 * Extract content keywords from rule text.
 *
 * Extracts words that follow directive verbs and multi-word noun
 * phrases, filtering out stop words. Returns lowercased tokens.
 *
 * @param ruleText - The rule text to extract keywords from
 * @returns Array of extracted content keywords
 */
export function extractContentKeywords(ruleText: string): string[] {
  const lower = ruleText.toLowerCase();
  const words = lower.split(/[\s,;:.()\[\]{}"'`]+/).filter(Boolean);
  const keywords: Set<string> = new Set();

  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? '';
    if (DIRECTIVE_VERBS.includes(word) && i + 1 < words.length) {
      const next = words[i + 1] ?? '';
      if (!STOP_WORDS.has(next) && next.length > 2) {
        keywords.add(next);
      }
    }
    if (!STOP_WORDS.has(word) && word.length > 2) {
      keywords.add(word);
    }
  }

  return Array.from(keywords);
}

/**
 * Map extracted keywords to AST node type names.
 *
 * Checks each keyword against known AST node types, allowing
 * both exact matches and underscore-separated partial matches
 * (e.g., "function" matches "function_declaration").
 *
 * Also checks if any keyword appears as a key in any file's
 * nodeTypeCounts, which catches node types not in our hardcoded list.
 *
 * @param keywords - Content keywords from rule text
 * @param fileVectors - Raw file vectors from the payload
 * @returns Matched AST node type names
 */
export function mapKeywordsToNodeTypes(
  keywords: string[],
  fileVectors: Record<string, RawFileVector>,
): string[] {
  const matched = new Set<string>();

  const allNodeTypes = new Set<string>();
  for (const vec of Object.values(fileVectors)) {
    for (const nt of Object.keys(vec.nodeTypeCounts)) {
      allNodeTypes.add(nt);
    }
  }

  for (const kw of keywords) {
    for (const nt of KNOWN_AST_NODE_TYPES) {
      if (nt.includes(kw) || kw.includes(nt.replace(/_/g, ''))) {
        matched.add(nt);
      }
    }
    for (const nt of allNodeTypes) {
      if (nt.includes(kw)) {
        matched.add(nt);
      }
    }
  }

  return Array.from(matched);
}

/**
 * Attempt to derive a runtime topic from rule text and raw vectors.
 *
 * Returns a TopicDefinition if AST node types can be derived from
 * the rule text, or undefined if no mapping is possible.
 *
 * @param ruleText - The rule text to derive a topic from
 * @param ruleId - The rule identifier (used to name the topic)
 * @param fileVectors - Raw file vectors from the payload
 * @returns A topic definition, or undefined if not derivable
 */
export function deriveRuntimeTopic(
  ruleText: string,
  ruleId: string,
  fileVectors: Record<string, RawFileVector>,
): TopicDefinition | undefined {
  const keywords = extractContentKeywords(ruleText);
  if (keywords.length === 0) {
    return undefined;
  }

  const nodeTypes = mapKeywordsToNodeTypes(keywords, fileVectors);
  if (nodeTypes.length === 0) {
    return undefined;
  }

  const topicId = `runtime-${ruleId}`;
  return {
    topic: topicId,
    keywords,
    nodeTypes,
    features: nodeTypes.map((nt) => ({
      featureId: `${topicId}-${nt}`,
      query: nt,
      extractionType: 'count' as const,
      languages: ['typescript', 'tsx', 'javascript'],
    })),
  };
}
