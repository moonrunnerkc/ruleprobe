/**
 * Handlers for the "tasks" and "task" CLI commands.
 *
 * Lists available task templates and outputs full task prompts.
 */

import {
  listTaskTemplates,
  findTaskTemplate,
  loadTaskPrompt,
} from '../runner/task-templates.js';

/**
 * Execute the "tasks" command: list all available task templates.
 */
export function handleTasks(): void {
  const templates = listTaskTemplates();

  if (templates.length === 0) {
    process.stdout.write('No task templates available.\n');
    return;
  }

  process.stdout.write('Available task templates:\n\n');
  for (const t of templates) {
    process.stdout.write(`  ${t.id}\n`);
    process.stdout.write(`    ${t.name}\n`);
    process.stdout.write(`    ${t.description}\n`);
    process.stdout.write(
      `    Exercises: ${t.exercises.join(', ')}\n`,
    );
    process.stdout.write('\n');
  }
}

/**
 * Execute the "task" command: output the full prompt for a specific template.
 *
 * @param templateId - Task template identifier
 * @param exitWithError - Error handler that terminates the process
 */
export function handleTask(
  templateId: string,
  exitWithError: (msg: string) => never,
): void {
  const template = findTaskTemplate(templateId);

  if (!template) {
    const available = listTaskTemplates()
      .map((t) => t.id)
      .join(', ');
    exitWithError(
      `Unknown task template: "${templateId}"\n` +
      `Available templates: ${available}`,
    );
  }

  const prompt = loadTaskPrompt(templateId);

  if (prompt === null) {
    process.stdout.write(
      `Task template "${templateId}" is registered but the prompt file ` +
      'is not yet available.\n',
    );
    process.stdout.write(`\nTemplate info:\n`);
    process.stdout.write(`  Name: ${template.name}\n`);
    process.stdout.write(`  Description: ${template.description}\n`);
    process.stdout.write(
      `  Exercises: ${template.exercises.join(', ')}\n`,
    );
    return;
  }

  process.stdout.write(prompt);
}
