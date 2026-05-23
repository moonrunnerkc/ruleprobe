/**
 * Public type surface for RuleProbe.
 *
 * Re-exports the core type primitives and the result/report types
 * from their respective modules. Existing imports `from '../types.js'`
 * keep working; new code may import from types-core.ts or
 * types-results.ts directly when only one half is needed.
 */

export type {
  RuleCategory,
  VerifierType,
  QualifierType,
  InstructionFileType,
  VerificationPattern,
  Rule,
  RuleSet,
  MarkdownSection,
  RuleMatcher,
} from './types-core.js';

export { INSTRUCTION_FILE_NAMES } from './types-core.js';

export type {
  ReportFormat,
  TaskTemplate,
  AgentRun,
  Evidence,
  RuleResult,
  CategoryScore,
  ReportSummary,
  AdherenceReport,
  CrossFileConflict,
  CrossFileRedundancy,
  FileAnalysis,
  ProjectAnalysis,
} from './types-results.js';

export { DEFAULT_COMPLIANCE_THRESHOLD } from './types-results.js';
