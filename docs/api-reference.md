# Programmatic API

RuleProbe exports core pipeline functions, project analysis, configuration, and LLM extraction.

## Core Pipeline

| Function | Purpose |
|----------|---------|
| `parseInstructionFile(path)` | Parse an instruction file into a `RuleSet` |
| `parseInstructionContent(markdown, filename)` | Parse raw markdown content into a `RuleSet` |
| `extractRules(markdown, fileType)` | Extract `Rule[]` from raw markdown content |
| `verifyOutput(ruleSet, dir, options?)` | Run rules against a code directory (returns `Promise<RuleResult[]>`) |
| `generateReport(run, ruleSet, results)` | Build an `AdherenceReport` with summary stats |
| `formatReport(report, format)` | Render as text, JSON, markdown, rdjson, summary, detailed, or ci |

## Project Analysis

| Function | Purpose |
|----------|---------|
| `analyzeProject(projectDir)` | Discover all instruction files, parse, detect conflicts and redundancies |
| `discoverInstructionFiles(projectDir)` | Find instruction files in a project directory |

## Configuration

| Function | Purpose |
|----------|---------|
| `defineConfig(config)` | Type-safe config helper for `ruleprobe.config.ts` |
| `loadConfig(path?, searchDir?)` | Load and validate a config file |
| `applyConfig(ruleSet, config)` | Merge custom rules, overrides, and exclusions into a `RuleSet` |

## LLM Extraction (opt-in)

| Function | Purpose |
|----------|---------|
| `extractWithLlm(ruleSet, options)` | Run LLM extraction on unparseable lines |
| `createOpenAiProvider(config?)` | Create an OpenAI-compatible LLM provider |

## Agent Invocation

| Function | Purpose |
|----------|---------|
| `buildAgentConfig(options)` | Build an agent invocation configuration |
| `invokeAgent(config)` | Invoke an AI agent via SDK |
| `isAgentSdkAvailable()` | Check if the Claude Agent SDK is installed |
| `hasAgentOutput(dir)` | Check if a directory contains agent output |
| `watchForCompletion(options)` | Watch a directory for agent output |
| `countCodeFiles(dir)` | Count code files in a directory |

---

## Usage Examples

### Basic: parse, verify, report

```typescript
import { parseInstructionFile, verifyOutput, generateReport, formatReport } from 'ruleprobe';

const ruleSet = parseInstructionFile('CLAUDE.md');
const results = await verifyOutput(ruleSet, './agent-output');
const report = generateReport(
  {
    agent: 'claude-code',
    model: 'opus-4',
    taskTemplateId: 'rest-endpoint',
    outputDir: './agent-output',
    timestamp: new Date().toISOString(),
    durationSeconds: null,
  },
  ruleSet,
  results,
);
console.log(formatReport(report, 'summary'));
```

### Project-level analysis

```typescript
import { analyzeProject } from 'ruleprobe';

const analysis = analyzeProject('./my-project');
console.log(`${analysis.files.length} instruction files found`);
console.log(`${analysis.conflicts.length} cross-file conflicts`);
console.log(`${analysis.redundancies.length} redundancies`);
```

### LLM-assisted extraction

```typescript
import { parseInstructionFile, extractWithLlm, createOpenAiProvider } from 'ruleprobe';

const ruleSet = parseInstructionFile('CLAUDE.md');
const provider = createOpenAiProvider({ model: 'gpt-4o-mini' });
const enhanced = await extractWithLlm(ruleSet, { provider });
// enhanced.rules now includes LLM-extracted rules with extractionMethod: 'llm'
```

### Custom configuration

```typescript
import { defineConfig } from 'ruleprobe';

export default defineConfig({
  rules: [
    {
      id: 'custom-no-lodash',
      category: 'import-pattern',
      description: 'Ban lodash imports',
      verifier: 'regex',
      pattern: { type: 'banned-import', target: '*.ts', expected: 'lodash', scope: 'file' },
    },
  ],
  overrides: [
    { ruleId: 'naming-camelcase', severity: 'warning' },
    { ruleId: 'structure-max-file-length', expected: '500' },
  ],
  exclude: ['forbidden-no-console-log'],
});
```

---

## Key Types

```typescript
interface Rule {
  id: string;
  category: RuleCategory;
  source: string;
  description: string;
  severity: 'error' | 'warning';
  verifier: VerifierType;
  pattern: VerificationPattern;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: 'static' | 'llm';
  section?: string;
  qualifier: QualifierType;
}

interface RuleSet {
  sourceFile: string;
  sourceType: InstructionFileType;
  rules: Rule[];
  unparseable: string[];
}

interface RuleResult {
  rule: Rule;
  passed: boolean;
  compliance: number; // 0 to 1
  evidence: Evidence[];
}

interface AdherenceReport {
  run: AgentRun;
  ruleset: RuleSet;
  results: RuleResult[];
  summary: ReportSummary;
}

interface ProjectAnalysis {
  projectDir: string;
  files: FileAnalysis[];
  conflicts: CrossFileConflict[];
  redundancies: CrossFileRedundancy[];
  coverageMap: Record<string, string[]>;
  summary: { totalFiles: number; totalRules: number; totalConflicts: number; totalRedundancies: number };
}

type RuleCategory =
  | 'naming' | 'forbidden-pattern' | 'structure' | 'test-requirement'
  | 'import-pattern' | 'error-handling' | 'type-safety' | 'code-style'
  | 'dependency' | 'preference' | 'file-structure' | 'tooling'
  | 'testing' | 'workflow' | 'agent-behavior';

type VerifierType =
  | 'ast' | 'regex' | 'filesystem' | 'treesitter'
  | 'preference' | 'tooling' | 'config-file' | 'git-history';

type QualifierType =
  | 'always' | 'prefer' | 'when-possible'
  | 'avoid-unless' | 'try-to' | 'never';

type InstructionFileType =
  | 'claude.md' | 'agents.md' | 'cursorrules' | 'copilot-instructions'
  | 'gemini.md' | 'windsurfrules' | 'rules' | 'generic-markdown' | 'unknown';
```
