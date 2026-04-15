/**
 * Tests for topic registry: base taxonomy, keyword matching, runtime extension.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TopicRegistry,
  BASE_TOPICS,
  BASE_TOPIC_COUNT,
} from '../../../../src/semantic/engine/fingerprint/topic-registry.js';

describe('TopicRegistry base taxonomy', () => {
  it('has exactly 15 base topics', () => {
    expect(BASE_TOPICS.length).toBe(BASE_TOPIC_COUNT);
    expect(BASE_TOPIC_COUNT).toBe(15);
  });

  it('every topic has a non-empty topic id', () => {
    for (const t of BASE_TOPICS) {
      expect(t.topic).toBeTruthy();
      expect(typeof t.topic).toBe('string');
    }
  });

  it('every topic has at least one keyword', () => {
    for (const t of BASE_TOPICS) {
      expect(t.keywords.length).toBeGreaterThan(0);
    }
  });

  it('profilable topics have at least one node type', () => {
    const nonProfilable = new Set(['workflow']);
    for (const t of BASE_TOPICS) {
      if (!nonProfilable.has(t.topic)) {
        expect(t.nodeTypes.length).toBeGreaterThan(0);
      }
    }
  });

  it('profilable topics have at least one feature', () => {
    const nonProfilable = new Set(['workflow']);
    for (const t of BASE_TOPICS) {
      if (!nonProfilable.has(t.topic)) {
        expect(t.features.length).toBeGreaterThan(0);
      }
    }
  });

  it('workflow topic has no AST features (non-profilable)', () => {
    const workflow = BASE_TOPICS.find((t) => t.topic === 'workflow');
    expect(workflow).toBeDefined();
    expect(workflow?.nodeTypes.length).toBe(0);
    expect(workflow?.features.length).toBe(0);
  });

  it('all feature ids are unique within a topic', () => {
    for (const t of BASE_TOPICS) {
      const ids = t.features.map((f) => f.featureId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('all topic ids are unique', () => {
    const ids = BASE_TOPICS.map((t) => t.topic);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TopicRegistry.findTopics', () => {
  let registry: TopicRegistry;

  beforeEach(() => {
    registry = new TopicRegistry();
  });

  it('matches error-handling topic from rule text', () => {
    const topics = registry.findTopics('Use try/catch for error handling');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('matches component-structure from "functional component"', () => {
    const topics = registry.findTopics('Prefer functional component patterns');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('component-structure');
  });

  it('matches testing-patterns from "arrange-act-assert"', () => {
    const topics = registry.findTopics('Use arrange-act-assert in test structure');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('testing-patterns');
  });

  it('matches data-fetching from "data fetching"', () => {
    const topics = registry.findTopics('Centralize data fetching');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('data-fetching');
  });

  it('matches naming-conventions from "naming convention"', () => {
    const topics = registry.findTopics('Follow naming convention for hooks');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('naming-conventions');
  });

  it('matches api-patterns from "middleware"', () => {
    const topics = registry.findTopics('Use middleware for auth');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('api-patterns');
  });

  it('matches state-management from "reducer"', () => {
    const topics = registry.findTopics('Use reducer for complex state');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('state-management');
  });

  it('matches validation from "schema"', () => {
    const topics = registry.findTopics('Validate with schema before saving');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('validation');
  });

  it('matches logging from "structured logging"', () => {
    const topics = registry.findTopics('Always use structured logging');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('logging');
  });

  it('matches file-organization from "barrel"', () => {
    const topics = registry.findTopics('Use barrel exports for modules');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('file-organization');
  });

  it('returns empty for unrelated rule text', () => {
    const topics = registry.findTopics('Use a database migration tool');
    expect(topics.length).toBe(0);
  });

  it('is case-insensitive', () => {
    const topics = registry.findTopics('USE TRY/CATCH FOR ERROR HANDLING');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('can match multiple topics at once', () => {
    const topics = registry.findTopics(
      'Use error handling in API route handler middleware',
    );
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('error-handling');
    expect(ids).toContain('api-patterns');
  });
});

describe('TopicRegistry runtime topics', () => {
  let registry: TopicRegistry;

  beforeEach(() => {
    registry = new TopicRegistry();
  });

  it('starts with only base topics', () => {
    expect(registry.topicCount()).toBe(BASE_TOPIC_COUNT);
  });

  it('registers a runtime topic', () => {
    registry.registerRuntimeTopic({
      topic: 'custom-auth',
      keywords: ['authentication', 'auth flow'],
      nodeTypes: ['call_expression'],
      features: [
        {
          featureId: 'jwt-check',
          query: 'call_expression',
          extractionType: 'count',
          languages: ['typescript'],
        },
      ],
    });
    expect(registry.topicCount()).toBe(BASE_TOPIC_COUNT + 1);
  });

  it('runtime topic is findable by keyword', () => {
    registry.registerRuntimeTopic({
      topic: 'custom-auth',
      keywords: ['authentication'],
      nodeTypes: ['call_expression'],
      features: [],
    });
    const topics = registry.findTopics('Use authentication guards');
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('custom-auth');
  });

  it('does not register duplicate topic ids', () => {
    registry.registerRuntimeTopic({
      topic: 'error-handling',
      keywords: ['error'],
      nodeTypes: [],
      features: [],
    });
    expect(registry.topicCount()).toBe(BASE_TOPIC_COUNT);
  });

  it('clearRuntimeTopics removes all runtime topics', () => {
    registry.registerRuntimeTopic({
      topic: 'custom-auth',
      keywords: ['auth'],
      nodeTypes: [],
      features: [],
    });
    expect(registry.topicCount()).toBe(BASE_TOPIC_COUNT + 1);
    registry.clearRuntimeTopics();
    expect(registry.topicCount()).toBe(BASE_TOPIC_COUNT);
  });

  it('getTopic returns a base topic by id', () => {
    const topic = registry.getTopic('error-handling');
    expect(topic).toBeDefined();
    expect(topic?.topic).toBe('error-handling');
  });

  it('getTopic returns undefined for unknown topic', () => {
    expect(registry.getTopic('nonexistent')).toBeUndefined();
  });

  it('getTopic returns a runtime topic by id', () => {
    registry.registerRuntimeTopic({
      topic: 'custom-auth',
      keywords: ['auth'],
      nodeTypes: [],
      features: [],
    });
    const topic = registry.getTopic('custom-auth');
    expect(topic).toBeDefined();
    expect(topic?.topic).toBe('custom-auth');
  });
});
