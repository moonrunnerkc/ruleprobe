/**
 * Topic registry for ASPE pattern classification.
 *
 * Maintains a base taxonomy of 10 pattern topics with keyword mappings
 * and feature definitions. Supports runtime extension for novel
 * instruction text that does not match any base topic.
 */

import type { PatternTopic } from '../../types.js';
import { BASE_TOPICS, BASE_TOPIC_COUNT } from './base-topics.js';

/** Extraction type for a feature: what kind of data it produces. */
export type ExtractionType = 'count' | 'depth' | 'signature';

/** Definition of a single feature within a topic. */
export interface FeatureDefinition {
  /** Unique feature identifier */
  featureId: string;
  /** AST node type or pattern to look for */
  query: string;
  /** What kind of measurement to extract */
  extractionType: ExtractionType;
  /** Languages this feature applies to */
  languages: string[];
}

/** Full definition of a pattern topic. */
export interface TopicDefinition {
  /** The topic identifier */
  topic: PatternTopic;
  /** Keywords used to match rule text to this topic */
  keywords: string[];
  /** AST node types relevant to this topic */
  nodeTypes: string[];
  /** Feature definitions for this topic */
  features: FeatureDefinition[];
}

/**
 * Registry of pattern topics for structural profiling.
 *
 * Provides base taxonomy lookup and runtime extension for
 * topics discovered from novel instruction text.
 */
export class TopicRegistry {
  private readonly baseTaxonomy: ReadonlyArray<TopicDefinition>;
  private readonly runtimeTopics: TopicDefinition[] = [];

  constructor() {
    this.baseTaxonomy = BASE_TOPICS;
  }

  /**
   * Find all topics matching the given rule text.
   *
   * Searches keyword lists of all registered topics (base + runtime).
   * Returns topics whose keywords appear in the rule text.
   *
   * @param ruleText - The rule text to classify
   * @returns Array of matching topic definitions
   */
  findTopics(ruleText: string): TopicDefinition[] {
    const lower = ruleText.toLowerCase();
    const matches: TopicDefinition[] = [];

    for (const topic of this.allTopics()) {
      const hit = topic.keywords.some((kw) => lower.includes(kw));
      if (hit) {
        matches.push(topic);
      }
    }

    return matches;
  }

  /**
   * Get a specific topic by its identifier.
   *
   * @param topicId - The topic identifier to look up
   * @returns The topic definition, or undefined if not found
   */
  getTopic(topicId: PatternTopic): TopicDefinition | undefined {
    return this.allTopics().find((t) => t.topic === topicId);
  }

  /**
   * Register a runtime topic discovered from novel instruction text.
   *
   * Runtime topics are ephemeral (per analysis run) and supplement
   * the base taxonomy for rules that reference unfamiliar patterns.
   *
   * @param definition - The runtime topic definition
   */
  registerRuntimeTopic(definition: TopicDefinition): void {
    const existing = this.getTopic(definition.topic);
    if (!existing) {
      this.runtimeTopics.push(definition);
    }
  }

  /**
   * Get all registered topics (base + runtime).
   *
   * @returns Combined array of all topic definitions
   */
  allTopics(): ReadonlyArray<TopicDefinition> {
    return [...this.baseTaxonomy, ...this.runtimeTopics];
  }

  /**
   * Get only the base taxonomy topics.
   *
   * @returns Array of base topic definitions
   */
  baseTopics(): ReadonlyArray<TopicDefinition> {
    return this.baseTaxonomy;
  }

  /**
   * Clear all runtime topics (for reuse between analysis runs).
   */
  clearRuntimeTopics(): void {
    this.runtimeTopics.length = 0;
  }

  /**
   * Get the count of all topics (base + runtime).
   *
   * @returns Total topic count
   */
  topicCount(): number {
    return this.baseTaxonomy.length + this.runtimeTopics.length;
  }
}

export { BASE_TOPICS, BASE_TOPIC_COUNT };
