/**
 * Parser router for instruction files.
 *
 * Detects the instruction file type from its path and orchestrates
 * the three-pass extraction pipeline into a complete RuleSet.
 *
 * Pass 1: Structural markdown decomposition (structural-parser.ts)
 * Pass 2: Statement classification (statement-classifier.ts)
 * Pass 3: Rule assembly (rule-assembler.ts)
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { InstructionFileType, RuleSet } from '../types.js';
import {
  parseStructuredMarkdown,
  flattenBlocks,
} from './structural-parser.js';
import { classifyAllStatements } from './statement-classifier.js';
import { assembleRules, resetAssemblerCounter } from './rule-assembler.js';

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
  { pattern: /^\.rules$/i, type: 'rules' },
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
 * Reads the file, detects its type, runs the three-pass extraction
 * pipeline, and returns a complete RuleSet.
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
 * Runs the three-pass extraction pipeline:
 * 1. Structural decomposition (markdown sections and typed blocks)
 * 2. Statement classification (keyword + structure signals)
 * 3. Rule assembly (convert to Rule[] with matcher integration)
 *
 * @param content - Raw markdown content of the instruction file
 * @param filePath - Path used for file type detection and metadata
 * @returns A RuleSet containing extracted rules and unparseable lines
 */
export function parseInstructionContent(
  content: string,
  filePath: string,
): RuleSet {
  let sourceType = detectFileType(filePath);

  // Reset counter for deterministic IDs per parse call
  resetAssemblerCounter();

  // Pass 1: Structural decomposition
  const doc = parseStructuredMarkdown(content);

  // Pass 2: Statement classification
  const flatBlocks = flattenBlocks(doc);
  const classified = classifyAllStatements(flatBlocks);

  // Pass 3: Rule assembly
  const { rules, unparseable, unclassified } = assembleRules(classified);

  // Combine unparseable and unclassified for the RuleSet interface
  const allUnparseable = [...unparseable, ...unclassified];

  if (sourceType === 'unknown' && filePath.endsWith('.md') && rules.length > 0) {
    sourceType = 'generic-markdown';
  }

  return {
    sourceFile: filePath,
    sourceType,
    rules,
    unparseable: allUnparseable,
  };
}
