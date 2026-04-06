/**
 * Helpers module with deep relative imports.
 */

import { something } from '../../../deeply/nested/module.js';
import { other } from '../../../../even/deeper/module.js';
import { aliased } from '@/utils/helpers.js';
import { alsoAliased } from '@utils/other.js';

/**
 * Format a date string.
 *
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}
