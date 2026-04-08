/**
 * Task template registry.
 *
 * Contains metadata for standardized coding tasks that exercise
 * common rule categories. Prompt text lives in markdown files
 * under src/runner/task-templates/. This module provides the
 * registry for listing and looking up templates.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuleCategory } from '../types.js';

/** Metadata for a task template (without the full prompt text). */
export interface TaskTemplateMeta {
  id: string;
  name: string;
  description: string;
  expectedFiles: string[];
  exercises: RuleCategory[];
}

/** Registry of available task templates. */
const TASK_TEMPLATES: TaskTemplateMeta[] = [
  {
    id: 'rest-endpoint',
    name: 'REST API Endpoint',
    description: 'Build a REST API endpoint for managing user bookmarks (POST, GET, DELETE).',
    expectedFiles: [
      'src/routes/bookmarks.ts',
      'src/types.ts',
      'tests/routes/bookmarks.test.ts',
    ],
    exercises: ['naming', 'forbidden-pattern', 'structure', 'test-requirement'],
  },
  {
    id: 'utility-module',
    name: 'Utility Module with Tests',
    description: 'Build a string utility module with validation, formatting, and full test coverage.',
    expectedFiles: [
      'src/utils/string-utils.ts',
      'tests/utils/string-utils.test.ts',
    ],
    exercises: ['naming', 'forbidden-pattern', 'structure', 'test-requirement', 'import-pattern'],
  },
  {
    id: 'react-component',
    name: 'React Component',
    description: 'Build a reusable data table component with sorting, filtering, and pagination.',
    expectedFiles: [
      'src/components/data-table.tsx',
      'src/components/data-table.types.ts',
      'tests/components/data-table.test.tsx',
    ],
    exercises: ['naming', 'forbidden-pattern', 'structure', 'test-requirement'],
  },
];

/**
 * List all available task templates.
 *
 * @returns Array of task template metadata
 */
export function listTaskTemplates(): TaskTemplateMeta[] {
  return TASK_TEMPLATES;
}

/**
 * Find a task template by ID.
 *
 * @param id - Template identifier
 * @returns The template metadata, or undefined if not found
 */
export function findTaskTemplate(id: string): TaskTemplateMeta | undefined {
  return TASK_TEMPLATES.find((t) => t.id === id);
}

/**
 * Load the full prompt text for a task template.
 *
 * Reads from the markdown file under src/runner/task-templates/.
 * Returns null if the template file does not exist yet (Phase 4).
 *
 * @param id - Template identifier
 * @returns Prompt text, or null if the file is not available
 */
export function loadTaskPrompt(id: string): string | null {
  const template = findTaskTemplate(id);
  if (!template) {
    return null;
  }

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const templatePath = resolve(thisDir, 'task-templates', `${id}.md`);

  if (!existsSync(templatePath)) {
    return null;
  }

  return readFileSync(templatePath, 'utf-8');
}
