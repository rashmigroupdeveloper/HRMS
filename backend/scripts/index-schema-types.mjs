/** Read-only TypeScript symbol index; no application imports or DB connections. */
import ts from 'typescript';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve('..');
const file = resolve('src/core/db/types.ts');
const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true, strict: true });
const checker = program.getTypeChecker();
const source = program.getSourceFile(file);
const declaration = source?.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'Database');
if (!declaration) throw new Error('Database interface not found');
const result = {};
const purposes = {};
for (const table of checker.getTypeAtLocation(declaration).getProperties()) {
  const tableDeclaration = table.valueDeclaration ?? table.declarations?.[0];
  if (!tableDeclaration) throw new Error(`No declaration for ${table.name}`);
  const tableType = checker.getTypeOfSymbolAtLocation(table, tableDeclaration);
  purposes[table.name] = ts.displayPartsToString(tableType.getSymbol()?.getDocumentationComment(checker) ?? []);
  const fields = {};
  for (const field of checker.getTypeOfSymbolAtLocation(table, tableDeclaration).getProperties()) {
    const fieldDeclaration = field.valueDeclaration ?? field.declarations?.[0];
    if (!fieldDeclaration) throw new Error(`No declaration for ${table.name}.${field.name}`);
    const sourceFile = fieldDeclaration.getSourceFile();
    fields[field.name] = {
      purpose_comment: ts.displayPartsToString(field.getDocumentationComment(checker)),
      declaration: fieldDeclaration.getText(sourceFile),
      reference: `${relative(root, sourceFile.fileName)}:${sourceFile.getLineAndCharacterOfPosition(fieldDeclaration.getStart(sourceFile)).line + 1}`,
    };
  }
  result[table.name] = fields;
}
const output = resolve('../outputs/schema-relevance-2026-10-19');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'type-symbols.json'), JSON.stringify(result, null, 2) + '\n');
await writeFile(resolve(output, 'type-table-purposes.json'), JSON.stringify(purposes, null, 2) + '\n');
