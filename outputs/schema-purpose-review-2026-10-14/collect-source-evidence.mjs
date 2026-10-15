// Read-only source evidence. Candidate references are not proof of a complete flow.
import ts from '../../backend/node_modules/typescript/lib/typescript.js';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const target = resolve(import.meta.dirname);
const snapshot = JSON.parse(readFileSync(`${target}/local-schema.json`, 'utf8')).snapshots[0];
const tableNames = new Set(snapshot.relations.filter(r => !r.is_partition && r.schema !== 'public').map(r => `${r.schema}.${r.table}`));
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|mjs|js)$/.test(entry.name)) files.push(path);
  }
}
for (const dir of ['backend/src', 'backend/scripts', 'backend/tests', 'backend/migrations']) walk(`${root}/${dir}`);
const references = [];
for (const path of files) {
  if (relative(root, path).startsWith('backend/src/core/db/types')) continue;
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const contexts = new Map();
  function visit(node, context = source) {
    if (ts.isFunctionLike(node)) context = node;
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      const text = node.text;
      const record = contexts.get(context) ?? { tables: new Set(), names: new Map(), selectsAll: false };
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      for (const match of text.matchAll(/\b([a-z_]+\.[a-z_]+)\b/g)) if (tableNames.has(match[1])) record.tables.add(match[1]);
      if (text === 'selectAll') record.selectsAll = true;
      for (const word of text.matchAll(/\b[a-z_][a-z_0-9]*\b/g)) {
        const lines = record.names.get(word[0]) ?? new Set();
        lines.add(line);
        record.names.set(word[0], lines);
      }
      contexts.set(context, record);
    }
    ts.forEachChild(node, child => visit(child, context));
  }
  visit(source);
  for (const [context, record] of contexts) {
    for (const table of record.tables) {
      const [schema, relation] = table.split('.');
      for (const col of snapshot.columns.filter(c => c.schema === schema && c.table === relation)) {
        const lines = record.names.get(col.column);
        if (lines) references.push({ table, column: col.column, file: relative(root, path), lines: [...lines], evidence: 'Table and field names appear in the same function/SQL literal; manually verify aliases and meaning.' });
        else if (record.selectsAll) references.push({ table, column: col.column, file: relative(root, path), lines: [source.getLineAndCharacterOfPosition(context.getStart(source)).line + 1], evidence: 'selectAll in table context; field may be returned incidentally. No explicit business use established.' });
      }
    }
  }
}
const configFile = ts.readConfigFile(`${root}/backend/tsconfig.json`, ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, `${root}/backend`);
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();
const source = program.getSourceFile(`${root}/backend/src/core/db/types.ts`);
const database = source.statements.find(s => ts.isInterfaceDeclaration(s) && s.name.text === 'Database');
function project(type) {
  if (type.isUnion()) return type.types.flatMap(project);
  const select = type.getProperty('__select__');
  return select ? project(checker.getTypeOfSymbolAtLocation(select, database)) : [type];
}
const types = [];
for (const table of checker.getPropertiesOfType(checker.getTypeAtLocation(database))) {
  for (const field of checker.getPropertiesOfType(checker.getTypeOfSymbolAtLocation(table, database))) {
    const raw = checker.getTypeOfSymbolAtLocation(field, database);
    types.push({ table: table.name, column: field.name, declared_type: checker.typeToString(raw), selected_types: project(raw).map(t => checker.typeToString(t)), string_literals: project(raw).filter(t => t.flags & ts.TypeFlags.StringLiteral).map(t => t.value) });
  }
}
writeFileSync(`${target}/source-evidence.json`, `${JSON.stringify({ method: 'TypeScript AST excludes comments and type declarations. Function-context lexical references are candidate evidence, not a proof of semantic usage. selectAll is identified separately.', files_scanned: files.length, references, types }, null, 2)}\n`);
console.info(JSON.stringify({ files_scanned: files.length, candidate_references: references.length, typed_fields: types.length }));
