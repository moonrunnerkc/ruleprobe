/**
 * Tests for LLM extraction: prompt building, response parsing, and pipeline.
 *
 * These tests validate the deterministic parts of LLM extraction
 * without making actual API calls. The provider interface is tested
 * with a test implementation that returns controlled responses.
 */

import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt, parseExtractionResponse } from '../../src/llm/extract.js';
import { extractWithLlm } from '../../src/llm/pipeline.js';
import type { LlmProvider, LlmExtractionResult } from '../../src/llm/types.js';
import type { RuleSet } from '../../src/types.js';

const SAMPLE_PATTERN_TYPES = [
  'camelCase', 'no-any', 'no-console-log', 'kebab-case',
  'test-files-exist', 'line-length', 'no-enum', 'no-empty-catch',
];

describe('buildExtractionPrompt', () => {
  it('includes all pattern types in the system prompt', () => {
    const prompt = buildExtractionPrompt(
      ['Use snake_case for variables'],
      SAMPLE_PATTERN_TYPES,
    );

    for (const type of SAMPLE_PATTERN_TYPES) {
      expect(prompt.system).toContain(type);
    }
  });

  it('includes all lines in the user prompt', () => {
    const lines = ['Rule one', 'Rule two', 'Rule three'];
    const prompt = buildExtractionPrompt(lines, SAMPLE_PATTERN_TYPES);

    for (const line of lines) {
      expect(prompt.user).toContain(line);
    }
  });

  it('numbers lines in the user prompt', () => {
    const prompt = buildExtractionPrompt(
      ['First', 'Second'],
      SAMPLE_PATTERN_TYPES,
    );

    expect(prompt.user).toContain('1. First');
    expect(prompt.user).toContain('2. Second');
  });

  it('includes available categories in the system prompt', () => {
    const prompt = buildExtractionPrompt(['test'], SAMPLE_PATTERN_TYPES);
    expect(prompt.system).toContain('naming');
    expect(prompt.system).toContain('error-handling');
    expect(prompt.system).toContain('type-safety');
  });
});

describe('parseExtractionResponse', () => {
  const lines = ['No enums allowed', 'Always handle errors'];

  it('parses valid candidates from JSON response', () => {
    const response = JSON.stringify({
      rules: [{
        id: 'no-enums',
        category: 'type-safety',
        description: 'Ban enum declarations',
        verifier: 'ast',
        patternType: 'no-enum',
        target: '*.ts',
        expected: false,
        scope: 'file',
        sourceLine: 'No enums allowed',
      }],
    });

    const result = parseExtractionResponse(response, lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.id).toBe('no-enums');
    expect(result.candidates[0]!.patternType).toBe('no-enum');
    expect(result.remaining).toEqual(['Always handle errors']);
  });

  it('rejects candidates with unknown pattern types', () => {
    const response = JSON.stringify({
      rules: [{
        id: 'unknown-check',
        category: 'naming',
        description: 'test',
        verifier: 'ast',
        patternType: 'nonexistent-check',
        target: '*.ts',
        expected: false,
        scope: 'file',
        sourceLine: 'No enums allowed',
      }],
    });

    const result = parseExtractionResponse(response, lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(0);
    expect(result.remaining).toEqual(lines);
  });

  it('rejects candidates with invalid categories', () => {
    const response = JSON.stringify({
      rules: [{
        id: 'test',
        category: 'invalid-category',
        description: 'test',
        verifier: 'ast',
        patternType: 'no-enum',
        target: '*.ts',
        expected: false,
        scope: 'file',
      }],
    });

    const result = parseExtractionResponse(response, lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(0);
  });

  it('handles invalid JSON gracefully', () => {
    const result = parseExtractionResponse('not json', lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(0);
    expect(result.remaining).toEqual(lines);
  });

  it('handles response with no rules key', () => {
    const result = parseExtractionResponse('{"other": 1}', lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(0);
    expect(result.remaining).toEqual(lines);
  });

  it('handles empty rules array', () => {
    const result = parseExtractionResponse('{"rules": []}', lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(0);
    expect(result.remaining).toEqual(lines);
  });

  it('filters out candidates with missing required fields', () => {
    const response = JSON.stringify({
      rules: [
        { id: '', category: 'naming', description: 'test', verifier: 'ast', patternType: 'no-enum', target: '*.ts', expected: false, scope: 'file' },
        { id: 'valid', category: 'type-safety', description: 'test', verifier: 'ast', patternType: 'no-enum', target: '*.ts', expected: false, scope: 'file', sourceLine: 'No enums allowed' },
      ],
    });

    const result = parseExtractionResponse(response, lines, SAMPLE_PATTERN_TYPES);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.id).toBe('valid');
  });
});

describe('extractWithLlm pipeline', () => {
  /** Test provider that returns controlled results. */
  function createTestProvider(candidates: LlmExtractionResult['candidates']): LlmProvider {
    return {
      name: 'test-provider',
      async extractRules(lines): Promise<LlmExtractionResult> {
        const coveredLines = lines.slice(0, candidates.length);
        const remaining = lines.slice(candidates.length);
        return { candidates, remaining };
      },
    };
  }

  function makeRuleSet(unparseable: string[] = []): RuleSet {
    return {
      sourceFile: 'test.md',
      sourceType: 'generic-markdown',
      rules: [{
        id: 'naming-camelcase-1',
        category: 'naming',
        source: 'test',
        description: 'camelCase',
        severity: 'error',
        verifier: 'ast',
        pattern: { type: 'camelCase', target: '*.ts', expected: false, scope: 'file' },
      }],
      unparseable,
    };
  }

  it('skips extraction when there are no unparseable lines', async () => {
    const provider = createTestProvider([]);
    const ruleSet = makeRuleSet([]);

    const result = await extractWithLlm(ruleSet, { provider });
    expect(result.rules).toHaveLength(1);
    expect(result.unparseable).toHaveLength(0);
  });

  it('appends LLM-extracted rules with correct metadata', async () => {
    const provider = createTestProvider([{
      id: 'no-enums',
      category: 'type-safety',
      description: 'Ban enum declarations',
      verifier: 'ast',
      patternType: 'no-enum',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }]);
    const ruleSet = makeRuleSet(['No enums allowed']);

    const result = await extractWithLlm(ruleSet, { provider });
    expect(result.rules).toHaveLength(2);

    const llmRule = result.rules[1]!;
    expect(llmRule.id).toBe('llm-no-enums');
    expect(llmRule.extractionMethod).toBe('llm');
    expect(llmRule.confidence).toBe('medium');
    expect(llmRule.severity).toBe('warning');
  });

  it('does not mutate the original RuleSet', async () => {
    const provider = createTestProvider([{
      id: 'test',
      category: 'naming',
      description: 'test',
      verifier: 'ast',
      patternType: 'camelCase',
      target: '*.ts',
      expected: false,
      scope: 'file',
    }]);
    const ruleSet = makeRuleSet(['some line']);

    await extractWithLlm(ruleSet, { provider });
    expect(ruleSet.rules).toHaveLength(1);
    expect(ruleSet.unparseable).toHaveLength(1);
  });

  it('deduplicates by rule ID prefix', async () => {
    const provider = createTestProvider([
      {
        id: 'no-enums',
        category: 'type-safety',
        description: 'test',
        verifier: 'ast',
        patternType: 'no-enum',
        target: '*.ts',
        expected: false,
        scope: 'file',
      },
      {
        id: 'no-enums',
        category: 'type-safety',
        description: 'duplicate',
        verifier: 'ast',
        patternType: 'no-enum',
        target: '*.ts',
        expected: false,
        scope: 'file',
      },
    ]);
    const ruleSet = makeRuleSet(['line 1', 'line 2']);

    const result = await extractWithLlm(ruleSet, { provider });
    const llmRules = result.rules.filter((r) => r.extractionMethod === 'llm');
    expect(llmRules).toHaveLength(1);
  });

  it('respects batchSize option', async () => {
    let receivedLines: string[] = [];
    const provider: LlmProvider = {
      name: 'batch-test',
      async extractRules(lines): Promise<LlmExtractionResult> {
        receivedLines = lines;
        return { candidates: [], remaining: lines };
      },
    };

    const ruleSet = makeRuleSet(['line 1', 'line 2', 'line 3', 'line 4', 'line 5']);
    await extractWithLlm(ruleSet, { provider, batchSize: 2 });

    expect(receivedLines).toHaveLength(2);
  });

  it('preserves unbatched unparseable lines', async () => {
    const provider: LlmProvider = {
      name: 'batch-test',
      async extractRules(lines): Promise<LlmExtractionResult> {
        return { candidates: [], remaining: lines };
      },
    };

    const ruleSet = makeRuleSet(['a', 'b', 'c', 'd', 'e']);
    const result = await extractWithLlm(ruleSet, { provider, batchSize: 2 });

    expect(result.unparseable).toHaveLength(5);
    expect(result.unparseable).toContain('a');
    expect(result.unparseable).toContain('e');
  });
});
