/**
 * Parser router for instruction files.
 *
 * Detects the instruction file type from its path and orchestrates
 * parsing and rule extraction into a complete RuleSet.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { InstructionFileType, RuleSet } from '../types.js';
import { parseMarkdown } from './markdown-parser.js';
import { extractRules } from './rule-extractor.js';

/**
 * Map of filename patterns to instruction file types.
 * Checked in order; first match wins.
 */
const FILE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: InstructionFileType }> = [
  { pattern: /^CLAUDE\.md$/i, type: 'claude.md' },
  { pattern: /^AGENTS\.md$/i, type: 'agents.md' },
  { pattern: /^\.cursorrules$/i, type: 'cursorrules' },
  { pattern: /^copilot-instructions\.md$/i, type: 'copilot-instructions' },
  { pattern: /^GEMINI\.md$/i, type: 'gemini.md' },
  { pattern: /^\.windsurfrules$/i, type: 'windsurfrules' },
];

/**
 * Detect the instruction file type from a file path.
 *
 * Matches the basename against known instruction file patterns.
 * Returns "unknown" if no pattern matches.
 *
 * @param filePath - Path to the instruction file
 * @returns The detected instruction file type
 */
export function detectFileType(filePath: string): InstructionFileType {
  const name = basename(filePath);

  for (const entry of FILE_TYPE_PATTERNS) {
    if (entry.pattern.test(name)) {
      return entry.type;
    }
  }

  return 'unknown';
}

/**
 * Parse an instruction file and extract machine-verifiable rules.
 *
 * Reads the file, detects its type, parses the markdown into sections,
 * extracts rules, and returns a complete RuleSet.
 *
 * @param filePath - Absolute or relative path to the instruction file
 * @returns A RuleSet containing extracted rules and unparseable lines
 * @throws Error if the file cannot be read
 */
export function parseInstructionFile(filePath: string): RuleSet {
  const content = readFileSync(filePath, 'utf-8');
  return parseInstructionContent(content, filePath);
}

/**
 * Parse instruction file content directly (without reading from disk).
 *
 * Useful for testing or when the content is already in memory.
 *
 * @param content - Raw markdown content of the instruction file
 * @param filePath - Path used for file type detection and metadata
 * @returns A RuleSet containing extracted rules and unparseable lines
 */
export function parseInstructionContent(
  content: string,
  filePath: string,
): RuleSet {
  const sourceType = detectFileType(filePath);
  const sections = parseMarkdown(content);
  const { rules, unparseable } = extractRules(sections);

  return {
    sourceFile: filePath,
    sourceType,
    rules,
    unparseable,
  };
}
