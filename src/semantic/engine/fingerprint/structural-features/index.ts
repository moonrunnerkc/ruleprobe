/**
 * Index of structural feature extractors, keyed by topic.
 *
 * Maps each base topic to its feature extractor function.
 * Used by the fingerprint generator to extract per-topic
 * features from raw file vectors.
 */

import type { PatternTopic } from '../../../types.js';
import type { FeatureExtractor } from './shared.js';
import { extractErrorHandling } from './error-handling.js';
import { extractComponentStructure } from './component-structure.js';
import { extractDataFetching } from './data-fetching.js';
import { extractFileOrganization } from './file-organization.js';
import { extractTestingPatterns } from './testing-patterns.js';
import { extractNamingConventions } from './naming-conventions.js';
import { extractApiPatterns } from './api-patterns.js';
import { extractStateManagement } from './state-management.js';
import { extractValidation } from './validation.js';
import { extractLogging } from './logging.js';
import { extractTooling } from './tooling.js';
import { extractCodeStyle } from './code-style.js';
import { extractLanguageRequirements } from './language-requirements.js';
import { extractWorkflow } from './workflow.js';
import { extractFileStructureSemantic } from './file-structure-semantic.js';

export type { FeatureExtraction, FeatureExtractor } from './shared.js';
export { countNodeType, getDepth, hasSignatureMatch } from './shared.js';

/**
 * Map of base topic identifiers to their feature extractor functions.
 *
 * Each extractor receives a RawFileVector and produces an array
 * of FeatureExtraction results for that topic.
 */
export const TOPIC_EXTRACTORS: ReadonlyMap<PatternTopic, FeatureExtractor> =
  new Map<PatternTopic, FeatureExtractor>([
    ['error-handling', extractErrorHandling],
    ['component-structure', extractComponentStructure],
    ['data-fetching', extractDataFetching],
    ['file-organization', extractFileOrganization],
    ['testing-patterns', extractTestingPatterns],
    ['naming-conventions', extractNamingConventions],
    ['api-patterns', extractApiPatterns],
    ['state-management', extractStateManagement],
    ['validation', extractValidation],
    ['logging', extractLogging],
    ['tooling', extractTooling],
    ['code-style', extractCodeStyle],
    ['language-requirements', extractLanguageRequirements],
    ['workflow', extractWorkflow],
    ['file-structure-semantic', extractFileStructureSemantic],
  ]);

/**
 * Get the feature extractor for a topic.
 *
 * @param topic - The pattern topic identifier
 * @returns The extractor function, or undefined for unknown topics
 */
export function getExtractor(
  topic: PatternTopic,
): FeatureExtractor | undefined {
  return TOPIC_EXTRACTORS.get(topic);
}
