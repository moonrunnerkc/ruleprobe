/**
 * Composite pattern definitions: multi-node conjunctions per topic.
 *
 * Individual node counts lose important structural information.
 * "try-catch with logging" is try_statement + catch_clause + a logging
 * call_expression co-occurring in the same file, not just their
 * individual counts. Composites capture these co-occurrences.
 *
 * Each composite definition specifies which node types must all be
 * present (above a minimum count) for the composite to fire.
 */

import type { RawFileVector } from '../../types.js';
import type { PatternTopic } from '../../types.js';

/**
 * A composite pattern definition: a named multi-node conjunction.
 *
 * The composite fires (value = 1) when ALL required node types are
 * present in the file at or above their minimum counts.
 */
export interface CompositeDefinition {
  /** Unique composite name within the topic */
  compositeId: string;
  /** Required node types and their minimum counts */
  requiredNodes: ReadonlyArray<{ nodeType: string; minCount: number }>;
}

/**
 * Result of evaluating one composite definition against a file vector.
 */
export interface CompositeResult {
  /** The composite identifier */
  compositeId: string;
  /** 1 if all required nodes are present at sufficient count, 0 otherwise */
  value: number;
}

/**
 * Minimum count threshold: node must appear at least this many times
 * for a composite to consider it "present."
 *
 * Source: a single occurrence is sufficient to indicate the pattern
 * exists in the file. Higher thresholds would miss files with only
 * one try-catch block, for example.
 */
const DEFAULT_MIN_COUNT = 1;

/** Composites for the error-handling topic. */
export const ERROR_HANDLING_COMPOSITES: ReadonlyArray<CompositeDefinition> = [
  {
    compositeId: 'try-catch-with-logging',
    requiredNodes: [
      { nodeType: 'try_statement', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'catch_clause', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'call_expression', minCount: DEFAULT_MIN_COUNT },
    ],
  },
  {
    compositeId: 'try-catch-with-rethrow',
    requiredNodes: [
      { nodeType: 'try_statement', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'catch_clause', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'throw_statement', minCount: DEFAULT_MIN_COUNT },
    ],
  },
  {
    compositeId: 'custom-error-class',
    requiredNodes: [
      { nodeType: 'class_declaration', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'throw_statement', minCount: DEFAULT_MIN_COUNT },
    ],
  },
];

/** Composites for the component-structure topic. */
export const COMPONENT_STRUCTURE_COMPOSITES: ReadonlyArray<CompositeDefinition> = [
  {
    compositeId: 'functional-component-with-hooks',
    requiredNodes: [
      { nodeType: 'arrow_function', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'call_expression', minCount: 2 },
    ],
  },
  {
    compositeId: 'class-component-with-lifecycle',
    requiredNodes: [
      { nodeType: 'class_declaration', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'method_definition', minCount: DEFAULT_MIN_COUNT },
    ],
  },
  {
    compositeId: 'component-with-prop-types',
    requiredNodes: [
      { nodeType: 'arrow_function', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'interface_declaration', minCount: DEFAULT_MIN_COUNT },
    ],
  },
];

/** Composites for the testing-patterns topic. */
export const TESTING_PATTERNS_COMPOSITES: ReadonlyArray<CompositeDefinition> = [
  {
    compositeId: 'describe-it-with-assertions',
    requiredNodes: [
      { nodeType: 'call_expression', minCount: 3 },
      { nodeType: 'member_expression', minCount: DEFAULT_MIN_COUNT },
    ],
  },
  {
    compositeId: 'test-with-setup-teardown',
    requiredNodes: [
      { nodeType: 'call_expression', minCount: 2 },
      { nodeType: 'arrow_function', minCount: 2 },
    ],
  },
  {
    compositeId: 'test-with-mocks',
    requiredNodes: [
      { nodeType: 'call_expression', minCount: 3 },
      { nodeType: 'arrow_function', minCount: DEFAULT_MIN_COUNT },
      { nodeType: 'member_expression', minCount: 2 },
    ],
  },
];

/**
 * Registry of composite definitions keyed by topic.
 *
 * Only topics with defined composites appear here. Topics without
 * composites use empty arrays and contribute zero composite signal.
 */
export const COMPOSITE_REGISTRY: ReadonlyMap<PatternTopic, ReadonlyArray<CompositeDefinition>> =
  new Map<PatternTopic, ReadonlyArray<CompositeDefinition>>([
    ['error-handling', ERROR_HANDLING_COMPOSITES],
    ['component-structure', COMPONENT_STRUCTURE_COMPOSITES],
    ['testing-patterns', TESTING_PATTERNS_COMPOSITES],
  ]);

/**
 * Evaluate all composite definitions for a topic against a file vector.
 *
 * @param topicId - The topic to evaluate composites for
 * @param vector - The raw file vector
 * @returns Array of composite results (empty if no composites defined for topic)
 */
export function evaluateComposites(
  topicId: PatternTopic,
  vector: RawFileVector,
): CompositeResult[] {
  const definitions = COMPOSITE_REGISTRY.get(topicId);
  if (!definitions) {
    return [];
  }

  return definitions.map((def) => ({
    compositeId: def.compositeId,
    value: evaluateOne(def, vector),
  }));
}

/**
 * Evaluate a single composite definition against a file vector.
 *
 * @param def - The composite definition
 * @param vector - The raw file vector
 * @returns 1 if all required nodes meet their minimum counts, 0 otherwise
 */
function evaluateOne(def: CompositeDefinition, vector: RawFileVector): number {
  for (const req of def.requiredNodes) {
    const count = vector.nodeTypeCounts[req.nodeType] ?? 0;
    if (count < req.minCount) {
      return 0;
    }
  }
  return 1;
}
