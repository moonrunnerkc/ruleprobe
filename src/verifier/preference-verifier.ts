/**
 * Preference verifier.
 *
 * Counts occurrences of preferred vs alternative patterns in code
 * files using ts-morph AST analysis. Returns compliance as a ratio
 * of preferred / (preferred + alternative).
 */

import { Project, type SourceFile, SyntaxKind } from 'ts-morph';
import { extname } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import type { PreferPair } from './prefer-pairs.js';
import { PREFER_PAIRS } from './prefer-pairs.js';

/** Counts of preferred and alternative occurrences. */
interface PatternCounts {
  preferred: number;
  alternative: number;
}

/**
 * Count preferred vs alternative occurrences for a specific pair in a source file.
 */
function countInFile(pair: PreferPair, sourceFile: SourceFile): PatternCounts {
  switch (pair.id) {
    case 'const-vs-let':
      return countConstVsLet(sourceFile);
    case 'named-vs-default-exports':
      return countNamedVsDefaultExports(sourceFile);
    case 'interface-vs-type':
      return countInterfaceVsType(sourceFile);
    case 'async-await-vs-then':
      return countAsyncAwaitVsThen(sourceFile);
    case 'arrow-vs-function-declarations':
      return countArrowVsFunctionDecl(sourceFile);
    case 'template-literals-vs-concatenation':
      return countTemplateLiteralsVsConcat(sourceFile);
    case 'optional-chaining-vs-nested-conditionals':
      return countOptionalChainingVsNested(sourceFile);
    case 'functional-vs-class-components':
      return countFunctionalVsClassComponents(sourceFile);
    default:
      return { preferred: 0, alternative: 0 };
  }
}

function countConstVsLet(sf: SourceFile): PatternCounts {
  let constCount = 0;
  let letCount = 0;
  for (const decl of sf.getVariableStatements()) {
    const kind = decl.getDeclarationKind();
    if (kind === 'const') constCount++;
    else if (kind === 'let') letCount++;
  }
  return { preferred: constCount, alternative: letCount };
}

function countNamedVsDefaultExports(sf: SourceFile): PatternCounts {
  let named = 0;
  let defaultExports = 0;
  for (const exp of sf.getExportDeclarations()) {
    named++;
  }
  for (const sym of sf.getExportSymbols()) {
    if (sym.getName() === 'default') {
      defaultExports++;
    } else {
      named++;
    }
  }
  // Deduplicate: count unique export symbols only
  const exportSymbols = sf.getExportSymbols();
  named = 0;
  defaultExports = 0;
  for (const sym of exportSymbols) {
    if (sym.getName() === 'default') {
      defaultExports++;
    } else {
      named++;
    }
  }
  return { preferred: named, alternative: defaultExports };
}

function countInterfaceVsType(sf: SourceFile): PatternCounts {
  const interfaces = sf.getInterfaces().length;
  const typeAliases = sf.getTypeAliases().length;
  return { preferred: interfaces, alternative: typeAliases };
}

function countAsyncAwaitVsThen(sf: SourceFile): PatternCounts {
  let awaitCount = 0;
  let thenCount = 0;

  // Count await expressions
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.AwaitExpression) {
      awaitCount++;
    }
    // Count .then() calls
    if (node.getKind() === SyntaxKind.CallExpression) {
      const text = node.getText();
      if (/\.then\s*\(/.test(text) && !text.includes('await')) {
        thenCount++;
      }
    }
  });

  return { preferred: awaitCount, alternative: thenCount };
}

function countArrowVsFunctionDecl(sf: SourceFile): PatternCounts {
  const arrowFunctions = sf.getDescendantsOfKind(SyntaxKind.ArrowFunction).length;
  const functionDecls = sf.getFunctions().length;
  return { preferred: arrowFunctions, alternative: functionDecls };
}

function countTemplateLiteralsVsConcat(sf: SourceFile): PatternCounts {
  let templates = 0;
  let concats = 0;

  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.TemplateExpression ||
        node.getKind() === SyntaxKind.TaggedTemplateExpression) {
      templates++;
    }
    if (node.getKind() === SyntaxKind.BinaryExpression) {
      const text = node.getText();
      // String concatenation: binary + with a string literal on either side
      if (text.includes('+') && (/['"]/.test(text) || /`/.test(text))) {
        concats++;
      }
    }
  });

  return { preferred: templates, alternative: concats };
}

function countOptionalChainingVsNested(sf: SourceFile): PatternCounts {
  let optionalChaining = 0;
  let nestedConditionals = 0;

  sf.forEachDescendant((node) => {
    // Count ?. usage
    if (node.getText().includes('?.')) {
      if (node.getKind() === SyntaxKind.PropertyAccessExpression ||
          node.getKind() === SyntaxKind.ElementAccessExpression ||
          node.getKind() === SyntaxKind.CallExpression) {
        if (node.getText().startsWith('?.') || node.getText().includes('?.')) {
          optionalChaining++;
        }
      }
    }
    // Count nested conditionals (ternary inside ternary)
    if (node.getKind() === SyntaxKind.ConditionalExpression) {
      const parent = node.getParent();
      if (parent?.getKind() === SyntaxKind.ConditionalExpression) {
        nestedConditionals++;
      }
    }
  });

  return { preferred: optionalChaining, alternative: nestedConditionals };
}

function countFunctionalVsClassComponents(sf: SourceFile): PatternCounts {
  let functional = 0;
  let classBased = 0;

  // Class components extend React.Component or Component
  for (const cls of sf.getClasses()) {
    const heritage = cls.getHeritageClauses();
    for (const clause of heritage) {
      const text = clause.getText();
      if (/extends\s+(?:React\.)?(?:Component|PureComponent)/.test(text)) {
        classBased++;
      }
    }
  }

  // Functional components: functions returning JSX (heuristic: function with JSX return)
  const text = sf.getText();
  if (extname(sf.getFilePath()) === '.tsx' || extname(sf.getFilePath()) === '.jsx') {
    // Count exported functions that likely return JSX
    for (const func of sf.getFunctions()) {
      if (func.getReturnType()?.getText()?.includes('JSX') ||
          func.getText().includes('return (') ||
          func.getText().includes('return <')) {
        functional++;
      }
    }
    // Arrow functions assigned to variables
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init?.getKind() === SyntaxKind.ArrowFunction) {
          const initText = init.getText();
          if (initText.includes('return <') || initText.includes('=> <') ||
              initText.includes('return (')) {
            functional++;
          }
        }
      }
    }
  }

  return { preferred: functional, alternative: classBased };
}

/**
 * Create a ts-morph Project for parsing without compilation.
 */
function createProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
      jsx: 2, // React
      noEmit: true,
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
}

/**
 * Verify a preference rule by counting preferred vs alternative occurrences.
 *
 * Scans all matching files, totals the counts, and returns compliance
 * as preferred / (preferred + alternative). If neither pattern is found,
 * compliance is 1 (no violations possible).
 *
 * @param rule - The preference rule to verify
 * @param filePaths - Paths to source files to scan
 * @param threshold - Compliance threshold for pass/fail (default: 0.8)
 * @returns RuleResult with compliance ratio
 */
export function verifyPreferenceRule(
  rule: Rule,
  filePaths: string[],
  threshold: number = 0.8,
): RuleResult {
  const pairId = rule.pattern.target;
  const pair = PREFER_PAIRS.find((p) => p.id === pairId);

  if (!pair) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: '',
        line: null,
        found: `prefer-pair "${pairId}" not yet verifiable`,
        expected: 'known prefer-pair',
        context: '',
      }],
    };
  }

  const relevantExts = new Set(pair.extensions);
  const relevantFiles = filePaths.filter((f) => relevantExts.has(extname(f)));

  if (relevantFiles.length === 0) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  const project = createProject();
  let totalPreferred = 0;
  let totalAlternative = 0;
  const evidence: Evidence[] = [];

  for (const fp of relevantFiles) {
    try {
      const sourceFile = project.addSourceFileAtPath(fp);
      const counts = countInFile(pair, sourceFile);
      totalPreferred += counts.preferred;
      totalAlternative += counts.alternative;

      if (counts.alternative > 0) {
        evidence.push({
          file: fp,
          line: null,
          found: `${counts.alternative} ${pair.alternativeLabel}, ${counts.preferred} ${pair.preferredLabel}`,
          expected: pair.preferredLabel,
          context: `${pair.preferredLabel} preferred over ${pair.alternativeLabel}`,
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  const total = totalPreferred + totalAlternative;
  const compliance = total === 0 ? 1 : totalPreferred / total;
  const passed = compliance >= threshold;

  return { rule, passed, compliance, evidence };
}
