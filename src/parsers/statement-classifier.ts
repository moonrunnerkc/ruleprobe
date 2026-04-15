/**
 * Pass 2: Statement classification (keyword + structure).
 *
 * Barrel module re-exporting classification functions from split files.
 * Contains only classifyAllStatements (orchestration logic).
 *
 * Classification steps:
 *   2A: Code block handling (classify-statement.ts)
 *   2B: Keyword-driven classification (classify-statement.ts)
 *   2C: Context filtering (classify-statement.ts)
 *   2D: Confidence scoring (classify-statement.ts)
 */

export { classifyCodeBlock, classifyStatement } from './classify-statement.js';

import type { ContentBlock, ClassifiedStatement } from './pipeline-types.js';
import { classifyCodeBlock, classifyStatement } from './classify-statement.js';
import { getBlockText } from './classification-patterns.js';

/**
 * Classify all blocks from a flattened document into statements.
 *
 * @param flatBlocks - Flattened blocks from Pass 1
 * @returns Array of classified statements
 */
export function classifyAllStatements(
  flatBlocks: Array<{
    block: ContentBlock;
    sectionHeader: string;
    sectionDepth: number;
  }>,
): ClassifiedStatement[] {
  const results: ClassifiedStatement[] = [];
  let precedingText = '';

  for (const { block, sectionHeader, sectionDepth } of flatBlocks) {
    const text = getBlockText(block);
    if (text.trim().length === 0) {
      continue;
    }

    if (block.type === 'code_block') {
      const { category, confidence } = classifyCodeBlock(
        block.content,
        block.language,
        precedingText,
      );
      results.push({
        text: block.content,
        category,
        confidence,
        sectionHeader,
        blockType: block.type,
        sectionDepth,
      });
    } else {
      const { category, confidence } = classifyStatement(
        text,
        block.type,
        sectionHeader,
        precedingText,
      );
      results.push({
        text,
        category,
        confidence,
        sectionHeader,
        blockType: block.type,
        sectionDepth,
      });
    }

    precedingText = text;
  }

  return results;
}
