/**
 * Tree-sitter rule verifier.
 *
 * Verifies rules against Python and Go files using tree-sitter
 * WASM grammars. Routes each rule's pattern type to the correct
 * language-specific check. Gracefully skips if tree-sitter or the
 * required grammar is not installed.
 */

import { extname } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import { parseWithTreeSitter, detectLanguage } from './treesitter-loader.js';
import type { TreeSitterLanguage } from './treesitter-loader.js';
import {
  checkPythonSnakeCase,
  checkPythonClassNaming,
  checkGoNaming,
  checkFunctionLength,
} from './treesitter-checks.js';

/**
 * Verify a tree-sitter rule against all Python/Go files.
 *
 * Parses each file with the appropriate language grammar, then
 * routes to the matching check. If tree-sitter or a grammar is
 * not installed, the rule passes with a skip note.
 *
 * @param rule - The rule to verify
 * @param filePaths - Paths to Python/Go files to check
 * @returns A RuleResult with pass/fail and evidence
 */
export async function verifyTreeSitterRule(
  rule: Rule,
  filePaths: string[],
): Promise<RuleResult> {
  const allEvidence: Evidence[] = [];
  const targetLang = getTargetLanguage(rule);

  // Filter to files matching the rule's target language
  const relevantFiles = targetLang
    ? filePaths.filter((f) => detectLanguage(f) === targetLang)
    : filePaths;

  if (relevantFiles.length === 0) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  for (const fp of relevantFiles) {
    const lang = detectLanguage(fp);
    if (!lang) {
      continue;
    }

    const parsed = await parseWithTreeSitter(fp, lang);
    if (!parsed) {
      allEvidence.push({
        file: fp,
        line: null,
        found: `tree-sitter not available for ${lang} (install web-tree-sitter and tree-sitter-${lang})`,
        expected: rule.pattern.type,
        context: '',
      });
      continue;
    }

    const evidence = runTreeSitterCheck(rule, fp, parsed.root, lang);
    allEvidence.push(...evidence);

    parsed.tree.delete();
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    compliance: allEvidence.length === 0 ? 1 : 0,
    evidence: allEvidence,
  };
}

/**
 * Determine which language a rule targets based on its pattern.
 */
function getTargetLanguage(rule: Rule): TreeSitterLanguage | null {
  const target = rule.pattern.target;
  if (target.includes('.py') || target === 'python') {
    return 'python';
  }
  if (target.includes('.go') || target === 'go') {
    return 'go';
  }
  return null;
}

/**
 * Route a rule to the correct tree-sitter check for a language.
 */
function runTreeSitterCheck(
  rule: Rule,
  filePath: string,
  root: Parameters<typeof checkPythonSnakeCase>[0],
  language: TreeSitterLanguage,
): Evidence[] {
  const patternType = rule.pattern.type;

  switch (patternType) {
    case 'python-snake-case':
      return language === 'python' ? checkPythonSnakeCase(root, filePath) : [];
    case 'python-class-naming':
      return language === 'python' ? checkPythonClassNaming(root, filePath) : [];
    case 'go-naming':
      return language === 'go' ? checkGoNaming(root, filePath) : [];
    case 'function-length': {
      const maxLines = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 50;
      const funcTypes = language === 'python'
        ? ['function_definition']
        : ['function_declaration'];
      return checkFunctionLength(root, filePath, maxLines, funcTypes);
    }
    default:
      return [];
  }
}
