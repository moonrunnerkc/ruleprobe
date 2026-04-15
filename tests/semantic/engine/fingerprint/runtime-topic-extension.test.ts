/**
 * Tests for runtime topic extension.
 *
 * Verifies extractContentKeywords, mapKeywordsToNodeTypes,
 * and deriveRuntimeTopic produce correct results and handle
 * edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  extractContentKeywords,
  mapKeywordsToNodeTypes,
  deriveRuntimeTopic,
} from '../../../../src/semantic/engine/fingerprint/runtime-topic-extension.js';
import type { RawFileVector } from '../../../../src/semantic/types.js';

describe('extractContentKeywords', () => {
  it('extracts nouns following directive verbs', () => {
    const keywords = extractContentKeywords('Use interfaces for all public APIs');
    expect(keywords).toContain('interfaces');
    expect(keywords).toContain('public');
    expect(keywords).toContain('apis');
  });

  it('excludes stop words', () => {
    const keywords = extractContentKeywords('Use the correct pattern for all of the things');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('for');
    expect(keywords).not.toContain('all');
    expect(keywords).not.toContain('of');
  });

  it('excludes short words (2 chars or less)', () => {
    const keywords = extractContentKeywords('Do it or go be');
    expect(keywords).not.toContain('it');
    expect(keywords).not.toContain('or');
    expect(keywords).not.toContain('go');
    expect(keywords).not.toContain('be');
  });

  it('returns empty for all-stop-word text', () => {
    const keywords = extractContentKeywords('is the of in for on with');
    expect(keywords.length).toBe(0);
  });

  it('handles empty input', () => {
    const keywords = extractContentKeywords('');
    expect(keywords.length).toBe(0);
  });

  it('lowercases all keywords', () => {
    const keywords = extractContentKeywords('Use TypeScript for ALL modules');
    for (const kw of keywords) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  it('splits on punctuation and delimiters', () => {
    const keywords = extractContentKeywords('Use: function_declaration; arrow_function');
    expect(keywords).toContain('function_declaration');
    expect(keywords).toContain('arrow_function');
  });

  it('deduplicates keywords', () => {
    const keywords = extractContentKeywords('Create function, use function, define function');
    const functionCount = keywords.filter((k) => k === 'function').length;
    expect(functionCount).toBe(1);
  });
});

describe('mapKeywordsToNodeTypes', () => {
  const sampleVectors: Record<string, RawFileVector> = {
    '1': {
      nodeTypeCounts: { function_declaration: 5, arrow_function: 3, class_declaration: 1 },
      nestingDepths: {},
      subTreeHashes: [],
    },
    '2': {
      nodeTypeCounts: { call_expression: 10, import_statement: 4 },
      nestingDepths: {},
      subTreeHashes: [],
    },
  };

  it('maps "function" to function_declaration', () => {
    const matched = mapKeywordsToNodeTypes(['function'], sampleVectors);
    expect(matched).toContain('function_declaration');
  });

  it('maps "arrow" to arrow_function via known+file vectors', () => {
    const matched = mapKeywordsToNodeTypes(['arrow'], sampleVectors);
    expect(matched).toContain('arrow_function');
  });

  it('maps "class" to class_declaration', () => {
    const matched = mapKeywordsToNodeTypes(['class'], sampleVectors);
    expect(matched).toContain('class_declaration');
  });

  it('maps "import" to import_statement', () => {
    const matched = mapKeywordsToNodeTypes(['import'], sampleVectors);
    expect(matched).toContain('import_statement');
  });

  it('returns empty for keywords with no AST match', () => {
    const matched = mapKeywordsToNodeTypes(['database', 'migration'], sampleVectors);
    expect(matched.length).toBe(0);
  });

  it('maps from file vectors even for unknown types', () => {
    const vectors: Record<string, RawFileVector> = {
      '1': {
        nodeTypeCounts: { custom_node_xyzzy: 2 },
        nestingDepths: {},
        subTreeHashes: [],
      },
    };
    const matched = mapKeywordsToNodeTypes(['xyzzy'], vectors);
    expect(matched).toContain('custom_node_xyzzy');
  });
});

describe('deriveRuntimeTopic', () => {
  const sampleVectors: Record<string, RawFileVector> = {
    '1': {
      nodeTypeCounts: { function_declaration: 5, arrow_function: 3 },
      nestingDepths: {},
      subTreeHashes: [],
    },
  };

  it('derives a topic when AST node types can be mapped', () => {
    const topic = deriveRuntimeTopic(
      'Always create function declarations instead of arrow functions',
      'rule-1',
      sampleVectors,
    );
    expect(topic).toBeDefined();
    expect(topic?.topic).toBe('runtime-rule-1');
    expect(topic?.nodeTypes.length).toBeGreaterThan(0);
  });

  it('returns undefined when no AST mapping exists', () => {
    const topic = deriveRuntimeTopic(
      'water the plants on tuesday mornings',
      'rule-2',
      { '1': { nodeTypeCounts: {}, nestingDepths: {}, subTreeHashes: [] } },
    );
    expect(topic).toBeUndefined();
  });

  it('returns undefined for empty rule text', () => {
    const topic = deriveRuntimeTopic('', 'rule-3', sampleVectors);
    expect(topic).toBeUndefined();
  });

  it('generates feature definitions for each matched node type', () => {
    const topic = deriveRuntimeTopic(
      'Prefer arrow function expressions',
      'rule-4',
      sampleVectors,
    );
    expect(topic).toBeDefined();
    if (topic) {
      expect(topic.features.length).toBe(topic.nodeTypes.length);
      for (const feature of topic.features) {
        expect(feature.featureId).toContain('runtime-rule-4');
        expect(feature.extractionType).toBe('count');
      }
    }
  });

  it('includes extracted keywords in the topic definition', () => {
    const topic = deriveRuntimeTopic(
      'Use function declarations for exports',
      'rule-5',
      sampleVectors,
    );
    expect(topic).toBeDefined();
    expect(topic?.keywords.length).toBeGreaterThan(0);
    expect(topic?.keywords).toContain('function');
  });
});
