/**
 * Types for the three-pass extraction pipeline.
 *
 * Pass 1 (structural decomposition) produces DocumentStructure.
 * Pass 2 (statement classification) produces ClassifiedStatement[].
 * Pass 3 (rule assembly) produces ExtractedRule[] (Rule[]).
 */

/**
 * A typed content block within a markdown section.
 * Discriminated union on the 'type' field.
 */
export type ContentBlock =
  | BulletBlock
  | NumberedBlock
  | ParagraphBlock
  | CodeBlockContent
  | BoldLineBlock
  | CheckboxBlock
  ;

/** A bullet list item (unordered: -, *, +). */
export interface BulletBlock {
  type: 'bullet';
  text: string;
  indent: number;
  children: ContentBlock[];
}

/** A numbered list item (1., 2., etc). */
export interface NumberedBlock {
  type: 'numbered';
  text: string;
  number: number;
  children: ContentBlock[];
}

/** A plain paragraph of text. */
export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

/** A fenced code block with optional language tag. */
export interface CodeBlockContent {
  type: 'code_block';
  language: string;
  content: string;
  /** Whether this is an inline backtick span (false for fenced blocks). */
  isInline: boolean;
}

/** A bold-prefixed line like "**Key**: value". */
export interface BoldLineBlock {
  type: 'bold_line';
  text: string;
}

/** A checkbox item (- [ ] or - [x]). */
export interface CheckboxBlock {
  type: 'checkbox';
  text: string;
  checked: boolean;
}

/** A section in the document tree, corresponding to a markdown header. */
export interface Section {
  header: string;
  depth: number;
  blocks: ContentBlock[];
  children: Section[];
}

/** Top-level document structure produced by Pass 1. */
export interface DocumentStructure {
  sections: Section[];
  /** Content blocks appearing before the first header. */
  preamble: ContentBlock[];
}

/**
 * Categories for classifying instruction file statements.
 * Difficulty levels in parentheses; higher = harder to extract.
 */
export type StatementCategory =
  | 'IMPERATIVE_DIRECT'       // (1)
  | 'IMPERATIVE_QUALIFIED'    // (2)
  | 'PREFER_PATTERN'          // (1)
  | 'TOOLING_COMMAND'         // (1)
  | 'FILE_STRUCTURE'          // (2)
  | 'NAMING_CONVENTION'       // (1)
  | 'WORKFLOW'                // (2)
  | 'CODE_STYLE'              // (2)
  | 'PATTERN_REFERENCE'       // (3)
  | 'LANGUAGE_SPECIFIC'       // (3)
  | 'AGENT_BEHAVIOR'          // (N/A, not code-verifiable)
  | 'CONTEXT_ONLY'            // (N/A, should be filtered)
  | 'UNKNOWN'                 // unclassifiable
  ;

/** A statement after classification in Pass 2. */
export interface ClassifiedStatement {
  /** The raw text of the statement. */
  text: string;
  /** The assigned category. */
  category: StatementCategory;
  /** Confidence level (0 to 1). */
  confidence: number;
  /** The section header this statement appeared under. */
  sectionHeader: string;
  /** The content block type from Pass 1. */
  blockType: ContentBlock['type'];
  /** Section depth where this statement was found. */
  sectionDepth: number;
}

/** Confidence constants keyed by difficulty level. */
export const DIFFICULTY_CONFIDENCE = {
  /** Difficulty 1: exact keyword match. */
  EASY: 0.95,
  /** Difficulty 2: structural + keyword. */
  MEDIUM: 0.85,
  /** Difficulty 3: domain-specific or reference-based. */
  HARD: 0.70,
  /** Context-only signal. */
  CONTEXT: 0.90,
  /** No match at all. */
  NONE: 0.50,
} as const;
