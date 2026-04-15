/**
 * Per-pair counting functions for preference verification.
 *
 * Extracted from preference-verifier.ts to respect the 300-line
 * file limit. Each function counts preferred vs alternative
 * instances of a specific prefer-pair in a source file.
 */

import { type SourceFile, SyntaxKind } from 'ts-morph';
import { extname } from 'node:path';
import type { PreferPair } from './prefer-pairs.js';

/** Counts of preferred and alternative occurrences. */
export interface PatternCounts {
  preferred: number;
  alternative: number;
}

/**
 * Count preferred vs alternative occurrences for a specific pair in a source file.
 *
 * @param pair - The prefer-pair definition
 * @param sourceFile - The source file to analyze
 * @returns Counts of preferred and alternative occurrences
 */
export function countInFile(pair: PreferPair, sourceFile: SourceFile): PatternCounts {
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

/** Count const vs let declarations. */
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

/** Count named vs default exports. */
function countNamedVsDefaultExports(sf: SourceFile): PatternCounts {
  const exportSymbols = sf.getExportSymbols();
  let named = 0;
  let defaultExports = 0;
  for (const sym of exportSymbols) {
    if (sym.getName() === 'default') {
      defaultExports++;
    } else {
      named++;
    }
  }
  return { preferred: named, alternative: defaultExports };
}

/** Count interfaces vs type aliases. */
function countInterfaceVsType(sf: SourceFile): PatternCounts {
  const interfaces = sf.getInterfaces().length;
  const typeAliases = sf.getTypeAliases().length;
  return { preferred: interfaces, alternative: typeAliases };
}

/** Count async/await expressions vs .then() chain calls. */
function countAsyncAwaitVsThen(sf: SourceFile): PatternCounts {
  let awaitCount = 0;
  let thenCount = 0;
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.AwaitExpression) {
      awaitCount++;
    }
    if (node.getKind() === SyntaxKind.CallExpression) {
      const text = node.getText();
      if (/\.then\s*\(/.test(text) && !text.includes('await')) {
        thenCount++;
      }
    }
  });
  return { preferred: awaitCount, alternative: thenCount };
}

/** Count arrow functions vs function declarations. */
function countArrowVsFunctionDecl(sf: SourceFile): PatternCounts {
  const arrowFunctions = sf.getDescendantsOfKind(SyntaxKind.ArrowFunction).length;
  const functionDecls = sf.getFunctions().length;
  return { preferred: arrowFunctions, alternative: functionDecls };
}

/** Count template literals vs string concatenation. */
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
      if (text.includes('+') && (/['"]/.test(text) || /`/.test(text))) {
        concats++;
      }
    }
  });
  return { preferred: templates, alternative: concats };
}

/** Count optional chaining vs nested ternaries. */
function countOptionalChainingVsNested(sf: SourceFile): PatternCounts {
  let optionalChaining = 0;
  let nestedConditionals = 0;
  sf.forEachDescendant((node) => {
    if (node.getText().includes('?.')) {
      if (node.getKind() === SyntaxKind.PropertyAccessExpression ||
          node.getKind() === SyntaxKind.ElementAccessExpression ||
          node.getKind() === SyntaxKind.CallExpression) {
        if (node.getText().startsWith('?.') || node.getText().includes('?.')) {
          optionalChaining++;
        }
      }
    }
    if (node.getKind() === SyntaxKind.ConditionalExpression) {
      const parent = node.getParent();
      if (parent?.getKind() === SyntaxKind.ConditionalExpression) {
        nestedConditionals++;
      }
    }
  });
  return { preferred: optionalChaining, alternative: nestedConditionals };
}

/** Count functional vs class-based React components. */
function countFunctionalVsClassComponents(sf: SourceFile): PatternCounts {
  let functional = 0;
  let classBased = 0;

  for (const cls of sf.getClasses()) {
    const heritage = cls.getHeritageClauses();
    for (const clause of heritage) {
      const text = clause.getText();
      if (/extends\s+(?:React\.)?(?:Component|PureComponent)/.test(text)) {
        classBased++;
      }
    }
  }

  const fileExt = extname(sf.getFilePath());
  if (fileExt === '.tsx' || fileExt === '.jsx') {
    for (const func of sf.getFunctions()) {
      if (func.getReturnType()?.getText()?.includes('JSX') ||
          func.getText().includes('return (') ||
          func.getText().includes('return <')) {
        functional++;
      }
    }
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
