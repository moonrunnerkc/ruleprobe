/**
 * Tests for structural feature extractors.
 *
 * Verifies each topic extractor produces correct feature measurements
 * given known raw AST vectors.
 */

import { describe, it, expect } from 'vitest';
import type { RawFileVector } from '../../../../src/semantic/types.js';
import { TOPIC_EXTRACTORS, getExtractor, countNodeType, getDepth } from '../../../../src/semantic/engine/fingerprint/structural-features/index.js';
import { extractErrorHandling } from '../../../../src/semantic/engine/fingerprint/structural-features/error-handling.js';
import { extractComponentStructure } from '../../../../src/semantic/engine/fingerprint/structural-features/component-structure.js';
import { extractDataFetching } from '../../../../src/semantic/engine/fingerprint/structural-features/data-fetching.js';
import { extractFileOrganization } from '../../../../src/semantic/engine/fingerprint/structural-features/file-organization.js';
import { extractTestingPatterns } from '../../../../src/semantic/engine/fingerprint/structural-features/testing-patterns.js';
import { extractNamingConventions } from '../../../../src/semantic/engine/fingerprint/structural-features/naming-conventions.js';
import { extractApiPatterns } from '../../../../src/semantic/engine/fingerprint/structural-features/api-patterns.js';
import { extractStateManagement } from '../../../../src/semantic/engine/fingerprint/structural-features/state-management.js';
import { extractValidation } from '../../../../src/semantic/engine/fingerprint/structural-features/validation.js';
import { extractLogging } from '../../../../src/semantic/engine/fingerprint/structural-features/logging.js';
import { BASE_TOPICS } from '../../../../src/semantic/engine/fingerprint/topic-registry.js';

function makeVector(overrides?: Partial<RawFileVector>): RawFileVector {
  return {
    nodeTypeCounts: {},
    nestingDepths: {},
    subTreeHashes: [],
    ...overrides,
  };
}

describe('TOPIC_EXTRACTORS map', () => {
  it('has an extractor for every base topic', () => {
    for (const topic of BASE_TOPICS) {
      expect(TOPIC_EXTRACTORS.has(topic.topic)).toBe(true);
    }
  });

  it('has exactly 15 extractors', () => {
    expect(TOPIC_EXTRACTORS.size).toBe(15);
  });

  it('getExtractor returns the correct function', () => {
    expect(getExtractor('error-handling')).toBe(extractErrorHandling);
    expect(getExtractor('logging')).toBe(extractLogging);
  });

  it('getExtractor returns undefined for unknown topic', () => {
    expect(getExtractor('nonexistent')).toBeUndefined();
  });
});

describe('countNodeType utility', () => {
  it('returns the count for a present node type', () => {
    const v = makeVector({ nodeTypeCounts: { try_statement: 5 } });
    expect(countNodeType(v, 'try_statement')).toBe(5);
  });

  it('returns 0 for an absent node type', () => {
    const v = makeVector();
    expect(countNodeType(v, 'try_statement')).toBe(0);
  });
});

describe('getDepth utility', () => {
  it('returns the depth for a present key', () => {
    const v = makeVector({ nestingDepths: { if_statement: 3 } });
    expect(getDepth(v, 'if_statement')).toBe(3);
  });

  it('returns 0 for an absent key', () => {
    const v = makeVector();
    expect(getDepth(v, 'if_statement')).toBe(0);
  });
});

describe('extractErrorHandling', () => {
  it('extracts try-catch counts', () => {
    const v = makeVector({ nodeTypeCounts: { try_statement: 3, catch_clause: 3 } });
    const features = extractErrorHandling(v);
    const tryCatch = features.find((f) => f.featureId === 'try-catch-typed');
    expect(tryCatch?.value).toBe(3);
  });

  it('extracts throw count', () => {
    const v = makeVector({ nodeTypeCounts: { throw_statement: 2 } });
    const features = extractErrorHandling(v);
    const rethrow = features.find((f) => f.featureId === 'error-rethrow');
    expect(rethrow?.value).toBe(2);
  });

  it('returns all 8 features', () => {
    const features = extractErrorHandling(makeVector());
    expect(features.length).toBe(8);
  });
});

describe('extractComponentStructure', () => {
  it('counts functional + arrow as functional-component', () => {
    const v = makeVector({ nodeTypeCounts: { function_declaration: 2, arrow_function: 3 } });
    const features = extractComponentStructure(v);
    const fc = features.find((f) => f.featureId === 'functional-component');
    expect(fc?.value).toBe(5);
  });

  it('counts class declarations as class-component', () => {
    const v = makeVector({ nodeTypeCounts: { class_declaration: 1 } });
    const features = extractComponentStructure(v);
    const cc = features.find((f) => f.featureId === 'class-component');
    expect(cc?.value).toBe(1);
  });

  it('returns all 8 features', () => {
    const features = extractComponentStructure(makeVector());
    expect(features.length).toBe(8);
  });
});

describe('extractDataFetching', () => {
  it('detects api-route-handler when exports and awaits present', () => {
    const v = makeVector({ nodeTypeCounts: { export_statement: 1, await_expression: 2 } });
    const features = extractDataFetching(v);
    const handler = features.find((f) => f.featureId === 'api-route-handler');
    expect(handler?.value).toBe(1);
  });

  it('returns all 7 features', () => {
    const features = extractDataFetching(makeVector());
    expect(features.length).toBe(7);
  });
});

describe('extractFileOrganization', () => {
  it('counts barrel exports', () => {
    const v = makeVector({ nodeTypeCounts: { export_statement: 10 } });
    const features = extractFileOrganization(v);
    const barrel = features.find((f) => f.featureId === 'barrel-export');
    expect(barrel?.value).toBe(10);
  });

  it('returns all 5 features', () => {
    const features = extractFileOrganization(makeVector());
    expect(features.length).toBe(5);
  });
});

describe('extractTestingPatterns', () => {
  it('counts call expressions for describe-it-blocks', () => {
    const v = makeVector({ nodeTypeCounts: { call_expression: 15 } });
    const features = extractTestingPatterns(v);
    const descIt = features.find((f) => f.featureId === 'describe-it-blocks');
    expect(descIt?.value).toBe(15);
  });

  it('returns all 7 features', () => {
    const features = extractTestingPatterns(makeVector());
    expect(features.length).toBe(7);
  });
});

describe('extractNamingConventions', () => {
  it('counts type alias declarations', () => {
    const v = makeVector({ nodeTypeCounts: { type_alias_declaration: 4 } });
    const features = extractNamingConventions(v);
    const typeSuffix = features.find((f) => f.featureId === 'type-suffix');
    expect(typeSuffix?.value).toBe(4);
  });

  it('returns all 5 features', () => {
    const features = extractNamingConventions(makeVector());
    expect(features.length).toBe(5);
  });
});

describe('extractApiPatterns', () => {
  it('detects controller pattern from class declarations', () => {
    const v = makeVector({ nodeTypeCounts: { class_declaration: 1 } });
    const features = extractApiPatterns(v);
    const ctrl = features.find((f) => f.featureId === 'controller-pattern');
    expect(ctrl?.value).toBe(1);
  });

  it('returns all 5 features', () => {
    const features = extractApiPatterns(makeVector());
    expect(features.length).toBe(5);
  });
});

describe('extractStateManagement', () => {
  it('counts call expressions as state hook usage', () => {
    const v = makeVector({ nodeTypeCounts: { call_expression: 8 } });
    const features = extractStateManagement(v);
    const useState = features.find((f) => f.featureId === 'use-state');
    expect(useState?.value).toBe(8);
  });

  it('returns all 5 features', () => {
    const features = extractStateManagement(makeVector());
    expect(features.length).toBe(5);
  });
});

describe('extractValidation', () => {
  it('counts type predicates as type guards', () => {
    const v = makeVector({ nodeTypeCounts: { type_predicate: 3 } });
    const features = extractValidation(v);
    const guard = features.find((f) => f.featureId === 'type-guard');
    expect(guard?.value).toBe(3);
  });

  it('returns all 5 features', () => {
    const features = extractValidation(makeVector());
    expect(features.length).toBe(5);
  });
});

describe('extractLogging', () => {
  it('counts member expressions as log-level-usage', () => {
    const v = makeVector({ nodeTypeCounts: { member_expression: 12 } });
    const features = extractLogging(v);
    const logLevel = features.find((f) => f.featureId === 'log-level-usage');
    expect(logLevel?.value).toBe(12);
  });

  it('counts formal parameters as logger injection', () => {
    const v = makeVector({ nodeTypeCounts: { formal_parameters: 5 } });
    const features = extractLogging(v);
    const injection = features.find((f) => f.featureId === 'logger-injection');
    expect(injection?.value).toBe(5);
  });

  it('returns all 4 features', () => {
    const features = extractLogging(makeVector());
    expect(features.length).toBe(4);
  });
});
