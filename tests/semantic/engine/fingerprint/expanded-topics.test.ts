/**
 * Tests for expanded topic keyword matching.
 *
 * Validates that previously not-verifiable rules from the 5-repo E2E
 * audit now match the correct topic via keyword expansion or new topics.
 *
 * Source: ~/ruleprobe-real-test/not-verifiable-audit.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TopicRegistry } from '../../../../src/semantic/engine/fingerprint/topic-registry.js';

describe('New topic: tooling', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('matches "Run npm run compile"', () => {
    const ids = registry.findTopics('Run npm run compile').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "use yarn for package management"', () => {
    const ids = registry.findTopics('use yarn for package management').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "Run cargo test before submitting"', () => {
    const ids = registry.findTopics('Run cargo test before submitting').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "Run cargo build to verify compilation"', () => {
    const ids = registry.findTopics('Run cargo build to verify compilation').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "use flox for environment management"', () => {
    const ids = registry.findTopics('use flox for environment management').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "Use just for task automation"', () => {
    const ids = registry.findTopics('Use just for task automation').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "npm run build"', () => {
    const ids = registry.findTopics('npm run build').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "set up ci/cd pipeline"', () => {
    const ids = registry.findTopics('set up ci/cd pipeline').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches "configure eslint rules"', () => {
    const ids = registry.findTopics('configure eslint rules').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });

  it('matches vite bundler reference', () => {
    const ids = registry.findTopics('Use vite as the bundler').map((t) => t.topic);
    expect(ids).toContain('tooling');
  });
});

describe('New topic: code-style', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('matches "Prefer early return pattern"', () => {
    const ids = registry.findTopics('Prefer early return pattern').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "Use guard clause to reduce nesting"', () => {
    const ids = registry.findTopics('Use guard clause to reduce nesting').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "Avoid mutation of data"', () => {
    const ids = registry.findTopics('Avoid mutation of data').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "Use optional chaining where applicable"', () => {
    const ids = registry.findTopics('Use optional chaining where applicable').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "Favor readability and clarity"', () => {
    const ids = registry.findTopics('Favor readability and clarity').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "composition over inheritance"', () => {
    const ids = registry.findTopics('Use composition over inheritance').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "prioritize correctness"', () => {
    const ids = registry.findTopics('Prioritize correctness above all').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });

  it('matches "Use const over let wherever possible"', () => {
    const ids = registry.findTopics('Use const over let wherever possible').map((t) => t.topic);
    expect(ids).toContain('code-style');
  });
});

describe('New topic: language-requirements', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('matches "Use TypeScript for all new code"', () => {
    const ids = registry.findTopics('Use TypeScript for all new code').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "Enable strict mode in tsconfig"', () => {
    const ids = registry.findTopics('Enable strict mode in tsconfig').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "No any types allowed"', () => {
    const ids = registry.findTopics('No any types allowed in production code').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "Use Result type for error returns"', () => {
    const ids = registry.findTopics('Use Result type for error returns').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "Add doc comments to all public APIs"', () => {
    const ids = registry.findTopics('Add doc comment to all public APIs').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "Write Python docstrings"', () => {
    const ids = registry.findTopics('Write Python docstrings for all functions').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });

  it('matches "No bare except in Python"', () => {
    const ids = registry.findTopics('No bare except should be used').map((t) => t.topic);
    expect(ids).toContain('language-requirements');
  });
});

describe('New topic: workflow', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('matches "Use conventional commit messages"', () => {
    const ids = registry.findTopics('Use conventional commit messages').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "Do not give unsolicited explanations"', () => {
    const ids = registry.findTopics('Do not give unsolicited explanations').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "Be succinct in responses"', () => {
    const ids = registry.findTopics('Be succinct in responses').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "Use LSP for code navigation"', () => {
    const ids = registry.findTopics('Use LSP for code navigation').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "Use go to definition instead of grep"', () => {
    const ids = registry.findTopics('Use go to definition instead of grep').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "PR title should follow convention"', () => {
    const ids = registry.findTopics('PR title should follow convention').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });

  it('matches "Always run ci check before merge"', () => {
    const ids = registry.findTopics('Always run ci check before merge').map((t) => t.topic);
    expect(ids).toContain('workflow');
  });
});

describe('New topic: file-structure-semantic', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('matches "Co-locate tests with source files"', () => {
    const ids = registry.findTopics('Co-locate tests with source files').map((t) => t.topic);
    expect(ids).toContain('file-structure-semantic');
  });

  it('matches "Use barrel exports for module indexes"', () => {
    const ids = registry.findTopics('Use barrel export for module indexes').map((t) => t.topic);
    expect(ids).toContain('file-structure-semantic');
  });

  it('matches "Feature folder organization"', () => {
    const ids = registry.findTopics('Use feature folder organization').map((t) => t.topic);
    expect(ids).toContain('file-structure-semantic');
  });

  it('matches "All components live in src/components"', () => {
    const ids = registry.findTopics('All components live in src/components').map((t) => t.topic);
    expect(ids).toContain('file-structure-semantic');
  });
});

describe('Expanded keywords on existing topics', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('error-handling matches "propagate error"', () => {
    const ids = registry.findTopics('Always propagate error to caller').map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('error-handling matches "unwrap()"', () => {
    const ids = registry.findTopics('Avoid unwrap() in production code').map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('error-handling matches "panic"', () => {
    const ids = registry.findTopics('Never panic in library code').map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('naming-conventions matches "camelcase"', () => {
    const ids = registry.findTopics('Use camelcase for variables').map((t) => t.topic);
    expect(ids).toContain('naming-conventions');
  });

  it('naming-conventions matches "snake_case"', () => {
    const ids = registry.findTopics('Use snake_case for python modules').map((t) => t.topic);
    expect(ids).toContain('naming-conventions');
  });

  it('naming-conventions matches "SCREAMING_SNAKE"', () => {
    const ids = registry.findTopics('Use SCREAMING_SNAKE for constants').map((t) => t.topic);
    expect(ids).toContain('naming-conventions');
  });

  it('testing-patterns matches "vitest"', () => {
    const ids = registry.findTopics('Use vitest for all unit tests').map((t) => t.topic);
    expect(ids).toContain('testing-patterns');
  });

  it('testing-patterns matches "jest"', () => {
    const ids = registry.findTopics('Configure jest for integration tests').map((t) => t.topic);
    expect(ids).toContain('testing-patterns');
  });

  it('testing-patterns matches "tests"', () => {
    const ids = registry.findTopics('Always write tests for new features').map((t) => t.topic);
    expect(ids).toContain('testing-patterns');
  });

  it('file-organization matches "import order"', () => {
    const ids = registry.findTopics('Follow import order convention').map((t) => t.topic);
    expect(ids).toContain('file-organization');
  });

  it('file-organization matches "mod.rs"', () => {
    const ids = registry.findTopics('Every module must have mod.rs').map((t) => t.topic);
    expect(ids).toContain('file-organization');
  });

  it('api-patterns matches "grpc"', () => {
    const ids = registry.findTopics('Use grpc for inter-service communication').map((t) => t.topic);
    expect(ids).toContain('api-patterns');
  });

  it('api-patterns matches "protobuf"', () => {
    const ids = registry.findTopics('Define protobuf schemas for all services').map((t) => t.topic);
    expect(ids).toContain('api-patterns');
  });

  it('data-fetching matches "graphql"', () => {
    const ids = registry.findTopics('Use graphql for data queries').map((t) => t.topic);
    expect(ids).toContain('data-fetching');
  });

  it('data-fetching matches "server action"', () => {
    const ids = registry.findTopics('Use server action for mutations').map((t) => t.topic);
    expect(ids).toContain('data-fetching');
  });

  it('component-structure matches "react component"', () => {
    const ids = registry.findTopics('Every react component should be functional').map((t) => t.topic);
    expect(ids).toContain('component-structure');
  });

  it('component-structure matches "props"', () => {
    const ids = registry.findTopics('Always destructure props in components').map((t) => t.topic);
    expect(ids).toContain('component-structure');
  });

  it('validation matches "zod"', () => {
    const ids = registry.findTopics('Use zod for runtime validation').map((t) => t.topic);
    expect(ids).toContain('validation');
  });

  it('validation matches "extend_schema"', () => {
    const ids = registry.findTopics('Use extend_schema for API documentation').map((t) => t.topic);
    expect(ids).toContain('validation');
  });
});

describe('Negative cases: unrelated text still unmatched', () => {
  let registry: TopicRegistry;
  beforeEach(() => { registry = new TopicRegistry(); });

  it('returns empty for abstract philosophical text', () => {
    const topics = registry.findTopics('The meaning of life is 42');
    expect(topics.length).toBe(0);
  });

  it('returns empty for random non-code text', () => {
    const topics = registry.findTopics('Please water the plants on Tuesday');
    expect(topics.length).toBe(0);
  });
});
