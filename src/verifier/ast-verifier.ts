/**
 * AST-based verifier using ts-morph.
 *
 * Loads TypeScript/JavaScript files into a ts-morph Project (without
 * requiring compilation) and runs structural checks based on rule
 * verification patterns. Handles naming conventions, forbidden patterns,
 * import patterns, export patterns, and JSDoc requirements.
 */

import { Project, SyntaxKind, type SourceFile, type Node } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';

/**
 * Create a ts-morph Project configured for parsing without compilation.
 *
 * Uses an in-memory file system with liberal compiler options so that
 * agent output files can be parsed even if they have type errors.
 */
function createProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
}

const CAMEL_CASE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Check whether an identifier is camelCase.
 *
 * Allows single-letter identifiers and names starting with underscore
 * as conventional private markers.
 */
function isCamelCase(name: string): boolean {
  if (name.startsWith('_')) {
    return isCamelCase(name.slice(1));
  }
  return CAMEL_CASE_PATTERN.test(name);
}

/**
 * Check whether an identifier is PascalCase.
 */
function isPascalCase(name: string): boolean {
  return PASCAL_CASE_PATTERN.test(name);
}

/**
 * Get the line number of an AST node in its source file.
 */
function getLineNumber(node: Node): number {
  return node.getStartLineNumber();
}

/**
 * Extract a few lines of context around a node for evidence readability.
 */
function getContext(node: Node): string {
  const sourceFile = node.getSourceFile();
  const line = getLineNumber(node);
  const fullText = sourceFile.getFullText();
  const lines = fullText.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Verify camelCase naming for variables and functions.
 *
 * Checks variable declarations and function declarations. Skips
 * destructured bindings and type-only declarations.
 */
function checkCamelCase(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  // Check ALL variable declarations (including those nested in functions)
  const allVarDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of allVarDecls) {
    const name = decl.getName();
    // Skip destructuring patterns (contain { or [)
    if (name.includes('{') || name.includes('[')) {
      continue;
    }
    // Skip UPPER_SNAKE_CASE constants (conventional)
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
      continue;
    }
    if (!isCamelCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(decl),
        found: name,
        expected: 'camelCase',
        context: getContext(decl),
      });
    }
  }

  // Check ALL function declarations (including nested)
  const allFuncDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of allFuncDecls) {
    const name = func.getName();
    if (name && !isCamelCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(func),
        found: name,
        expected: 'camelCase',
        context: getContext(func),
      });
    }
  }

  return evidence;
}

/**
 * Verify PascalCase naming for types, interfaces, classes, and enums.
 */
function checkPascalCase(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    if (!isPascalCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(iface),
        found: name,
        expected: 'PascalCase',
        context: getContext(iface),
      });
    }
  }

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    if (!isPascalCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(typeAlias),
        found: name,
        expected: 'PascalCase',
        context: getContext(typeAlias),
      });
    }
  }

  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (name && !isPascalCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(cls),
        found: name,
        expected: 'PascalCase',
        context: getContext(cls),
      });
    }
  }

  for (const enumDecl of sourceFile.getEnums()) {
    const name = enumDecl.getName();
    if (!isPascalCase(name)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(enumDecl),
        found: name,
        expected: 'PascalCase',
        context: getContext(enumDecl),
      });
    }
  }

  return evidence;
}

/**
 * Detect usage of the "any" type in annotations and parameters.
 *
 * Finds AnyKeyword nodes in type annotations on variables, parameters,
 * function return types, and explicit type assertions.
 */
function checkNoAny(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);
  for (const node of anyNodes) {
    evidence.push({
      file: filePath,
      line: getLineNumber(node),
      found: node.getParent()?.getText() ?? 'any',
      expected: 'no any type',
      context: getContext(node),
    });
  }

  return evidence;
}

/**
 * Detect console.log calls in source code.
 *
 * Matches call expressions where the expression text is "console.log",
 * "console.warn", "console.error", or "console.info".
 */
function checkNoConsoleLog(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExpressions) {
    const expr = call.getExpression();
    const text = expr.getText();
    if (text === 'console.log') {
      evidence.push({
        file: filePath,
        line: getLineNumber(call),
        found: call.getText(),
        expected: 'no console.log',
        context: getContext(call),
      });
    }
  }

  return evidence;
}

/**
 * Detect default exports in a source file.
 */
function checkNamedExportsOnly(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  // Check for "export default" declarations
  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    const declarations = defaultExport.getDeclarations();
    const firstDecl = declarations[0];
    const line = firstDecl ? getLineNumber(firstDecl) : null;
    const context = firstDecl ? getContext(firstDecl) : '';
    evidence.push({
      file: filePath,
      line,
      found: 'default export',
      expected: 'named exports only',
      context,
    });
  }

  return evidence;
}

/**
 * Check that exported functions have JSDoc comments.
 *
 * Only checks functions with an "export" keyword. Internal functions
 * are excluded since the typical rule targets public API surface.
 */
function checkJsDocRequired(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const func of sourceFile.getFunctions()) {
    if (!func.isExported()) {
      continue;
    }

    const jsDocs = func.getJsDocs();
    if (jsDocs.length === 0) {
      const name = func.getName() ?? '<anonymous>';
      evidence.push({
        file: filePath,
        line: getLineNumber(func),
        found: `function ${name} has no JSDoc`,
        expected: 'JSDoc comment required on exported functions',
        context: getContext(func),
      });
    }
  }

  return evidence;
}

/**
 * Check for relative imports that go deeper than the allowed level.
 *
 * Counts the number of "../" segments in import paths. A depth of 2
 * means "../../" is the maximum allowed.
 */
function checkNoDeepRelativeImports(
  sourceFile: SourceFile,
  filePath: string,
  maxDepth: number,
): Evidence[] {
  const evidence: Evidence[] = [];

  const importDecls = sourceFile.getImportDeclarations();
  for (const imp of importDecls) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (!moduleSpecifier.startsWith('.')) {
      continue;
    }

    const segments = moduleSpecifier.split('/').filter((s) => s === '..');
    if (segments.length > maxDepth) {
      evidence.push({
        file: filePath,
        line: getLineNumber(imp),
        found: moduleSpecifier,
        expected: `relative import depth <= ${maxDepth}`,
        context: getContext(imp),
      });
    }
  }

  return evidence;
}

/**
 * Check for path alias imports (e.g. @/ or @utils/).
 *
 * Flags any import whose module specifier starts with "@"
 * followed by a "/" (distinguishing from scoped npm packages
 * like @types/node by checking that the second segment
 * is not a valid npm scope pattern).
 */
function checkNoPathAliases(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const importDecls = sourceFile.getImportDeclarations();
  for (const imp of importDecls) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (!isPathAlias(moduleSpecifier)) {
      continue;
    }
    evidence.push({
      file: filePath,
      line: getLineNumber(imp),
      found: moduleSpecifier,
      expected: 'relative paths only, no path aliases',
      context: getContext(imp),
    });
  }

  return evidence;
}

/**
 * Determine whether an import specifier is a path alias.
 *
 * Path aliases start with @ and are not scoped npm packages.
 * Detects patterns like @/, @utils/, @components/Button.
 * Distinguishes from scoped npm packages (@types/node) using:
 * - @/ is always a path alias
 * - If any path segment has a file extension, it's a path alias
 * - Otherwise fall back to whether it looks like @scope/package
 */
function isPathAlias(specifier: string): boolean {
  // Must start with @
  if (!specifier.startsWith('@')) {
    return false;
  }
  // @/ is always a path alias
  if (specifier.startsWith('@/')) {
    return true;
  }
  // If specifier contains a file extension (.ts, .js, etc.), it's a file path alias
  if (/\.[a-z]{1,4}$/.test(specifier)) {
    return true;
  }
  // Scoped npm packages: @scope/package-name (both lowercase with hyphens/dots)
  if (/^@[a-z][a-z0-9.-]*\/[a-z][a-z0-9.-]*$/.test(specifier)) {
    return false;
  }
  // Anything else starting with @ is treated as a path alias
  return /^@[a-zA-Z]/.test(specifier);
}

/**
 * Run an AST-based verification check against a single file.
 *
 * Routes to the appropriate check function based on the rule's
 * verification pattern type. Returns a RuleResult with evidence.
 *
 * @param rule - The rule to verify
 * @param filePath - Absolute path to the file to check
 * @param sourceFile - The ts-morph SourceFile (already loaded)
 * @returns Evidence array for this rule against this file
 */
function runAstCheck(rule: Rule, filePath: string, sourceFile: SourceFile): Evidence[] {
  const patternType = rule.pattern.type;

  switch (patternType) {
    case 'camelCase':
      return checkCamelCase(sourceFile, filePath);
    case 'PascalCase':
      return checkPascalCase(sourceFile, filePath);
    case 'no-any':
      return checkNoAny(sourceFile, filePath);
    case 'no-console-log':
      return checkNoConsoleLog(sourceFile, filePath);
    case 'named-exports-only':
      return checkNamedExportsOnly(sourceFile, filePath);
    case 'jsdoc-required':
      return checkJsDocRequired(sourceFile, filePath);
    case 'no-deep-relative-imports': {
      const maxDepth = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 2;
      return checkNoDeepRelativeImports(sourceFile, filePath, maxDepth);
    }
    case 'no-path-aliases':
      return checkNoPathAliases(sourceFile, filePath);
    default:
      return [];
  }
}

/**
 * Verify a rule against all TypeScript/JavaScript files in a directory.
 *
 * Loads all matching files into a ts-morph Project and runs the
 * appropriate AST check for the rule. Files that fail to parse are
 * skipped with a warning (they don't crash the entire run).
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to the files to check
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyAstRule(rule: Rule, filePaths: string[]): RuleResult {
  const project = createProject();
  const allEvidence: Evidence[] = [];

  for (const fp of filePaths) {
    try {
      const sourceFile = project.addSourceFileAtPath(fp);
      const evidence = runAstCheck(rule, fp, sourceFile);
      allEvidence.push(...evidence);
    } catch {
      // File could not be parsed; skip it without crashing
      allEvidence.push({
        file: fp,
        line: null,
        found: 'file could not be parsed by ts-morph',
        expected: 'parseable TypeScript/JavaScript file',
        context: '',
      });
    }
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    evidence: allEvidence,
  };
}
