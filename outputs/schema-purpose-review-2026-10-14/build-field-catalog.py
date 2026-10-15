"""Read catalog/source metadata only. Lexical matches are not semantic sign-off."""
from pathlib import Path
from collections import defaultdict, Counter
import csv, hashlib, json, re

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
snapshot = json.loads((OUT / 'local-schema.json').read_text())['snapshots'][0]
evidence = json.loads((OUT / 'source-evidence.json').read_text())
plan = json.loads((ROOT / 'plans/sow-completion/backend-schema-plan.json').read_text())
relations = {f"{r['schema']}.{r['table']}": r for r in snapshot['relations'] if not r['is_partition'] and r['schema'] != 'public'}
columns = [c for c in snapshot['columns'] if f"{c['schema']}.{c['table']}" in relations]
refs = defaultdict(list)
for ref in evidence['references']:
    refs[(ref['table'], ref['column'])].append(ref)
types = {(t['table'], t['column']): t for t in evidence['types']}
ddl = defaultdict(list)
table_ddl = defaultdict(list)
spec = defaultdict(list)
proposals = defaultdict(list)

def uncomment(text):
    # Preserve offsets/line numbers; migration SQL has no comment-like literals.
    return re.sub(r'/\*[\s\S]*?\*/|--[^\n]*', lambda m: ''.join('\n' if c == '\n' else ' ' for c in m[0]), text)

def definitions(text):
    clean = uncomment(text)
    for match in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)\s*\(', clean, re.I):
        start = match.end()
        depth = 1
        quote = False
        end = start
        while end < len(clean) and depth:
            char = clean[end]
            if char == "'": quote = not quote
            if not quote:
                if char == '(': depth += 1
                if char == ')': depth -= 1
            end += 1
        yield match[1], start, clean[start:end-1]

sql_types = r'(?:BIGINT|BIGSERIAL|SERIAL|INTEGER|INT|SMALLINT|TEXT|CITEXT|VARCHAR|CHAR|NUMERIC|DECIMAL|BOOLEAN|BOOL|DATE|TIMESTAMPTZ|TIMESTAMP|TIME|JSONB|JSON|INET|BYTEA|UUID|REAL|DOUBLE|[a-z_]+\.[a-z_]+)\b'
for table, base in plan['baseline_tables'].items():
    for _, start, block in definitions(base['sql']):
        for match in re.finditer(r'\b([a-z_][a-z_0-9]*)\s+' + sql_types, block, re.I):
            col = match[1]
            line = base['spec_line'] + base['sql'][:start+match.start()].count('\n')
            spec[(table, col)].append(f"{base['spec_file']}:{line}")

for path in sorted((ROOT / 'backend/migrations').glob('*.ts')):
    text = path.read_text().split('export function down')[0]
    clean = uncomment(text)
    file = str(path.relative_to(ROOT))
    for table, start, block in definitions(text):
        table_ddl[table].append(f'{file}:{text[:start].count(chr(10))+1}')
        for match in re.finditer(r'\b([a-z_][a-z_0-9]*)\s+' + sql_types, block, re.I):
            ddl[(table, match[1])].append(f'{file}:{text[:start+match.start()].count(chr(10))+1}')
    for match in re.finditer(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)([^;]*);', clean, re.I):
        table = match[1]
        for col in re.finditer(r'ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)', match[2], re.I):
            line = text[:match.start(2)+col.start()].count('\n') + 1
            ddl[(table, col[1])].append(f'{file}:{line}')
        for col in re.finditer(r'RENAME\s+COLUMN\s+([a-z_][a-z_0-9]*)\s+TO\s+([a-z_][a-z_0-9]*)', match[2], re.I):
            ddl[(table, col[2])].append(f'{file}:{text[:match.start(2)+col.start()].count(chr(10))+1}')

for model in plan['proposed_models'] + plan['existing_or_baseline_changes']:
    for field in model.get('fields', model.get('proposed_fields', [])):
        name = field['definition'].split()[0]
        proposals[(model['table'], name)].append({'purpose': field['purpose'], 'requirements': model.get('requirements', []), 'cards': model.get('cards', [])})

rows = []
for col in columns:
    table = f"{col['schema']}.{col['table']}"
    key = (table, col['column'])
    all_refs = refs[key]
    runtime = [r for r in all_refs if r['file'].startswith('backend/src/')]
    explicit = [r for r in runtime if not r['evidence'].startswith('selectAll')]
    incidental = [r for r in runtime if r['evidence'].startswith('selectAll')]
    aux = [r for r in all_refs if r['file'].startswith(('backend/tests/', 'backend/scripts/'))]
    constraints = []
    for c in snapshot['constraints']:
        if f"{c['schema']}.{c['table']}" != table: continue
        definition = c['definition'].split('REFERENCES')[0] if c['type'] == 'f' else c['definition']
        if re.search(r'\b'+re.escape(col['column'])+r'\b', definition): constraints.append(c)
    if spec[key]: purpose = 'Explicit baseline field in docs/03; business correctness still requires flow verification.'
    elif col['column'] in ['id', 'created_at', 'updated_at']: purpose = 'Operational identity/timestamp convention (docs/03 introduction); not an extra business feature.'
    elif proposals[key]: purpose = 'Named in prior amendment/proposal pack; applied implementation and approval must be reconciled.'
    else: purpose = 'Module/migration extension; field-level justification needs manual evidence. Not automatically unsupported.'
    use = 'Explicit runtime candidate' if explicit else 'Incidental selectAll only' if incidental else 'No runtime candidate found'
    rows.append({'table': table, 'column': col['column'], 'data_type': col['data_type'], 'udt_name': col['udt_name'], 'nullable': col['is_nullable'], 'default': col['column_default'], 'identity': col['is_identity'], 'purpose_classification': purpose, 'baseline_spec': spec[key], 'prior_plan_proposals': proposals[key], 'ddl_references': sorted(set(ddl[key])), 'table_creation_references': table_ddl[table], 'runtime_use_classification': use, 'explicit_runtime_candidates': explicit, 'incidental_runtime_candidates': incidental, 'test_script_candidates': aux, 'constraints': constraints, 'table_triggers': [t for t in snapshot['triggers'] if f"{t['schema']}.{t['table']}" == table], 'kysely_type': types.get(key)})

summary = {'prepared': '2026-10-14', 'business_relations': len(relations), 'business_columns': len(rows), 'partition_relations': len([r for r in snapshot['relations'] if r['is_partition']]), 'applied_migrations': len(snapshot['migrations']), 'source_migrations': len(list((ROOT / 'backend/migrations').glob('*.ts'))), 'purpose_classes': dict(Counter(r['purpose_classification'] for r in rows)), 'usage_classes': dict(Counter(r['runtime_use_classification'] for r in rows)), 'fields_without_parsed_ddl': [f"{r['table']}.{r['column']}" for r in rows if not r['ddl_references']], 'untyped_fields': [f"{r['table']}.{r['column']}" for r in rows if not r['kysely_type']], 'limits': ['Catalog excludes partition duplicates, public migration bookkeeping and pg-boss internals.', 'AST candidate references are lexical and can include unrelated aliases or incidental selectAll. They do not prove a working feature.', 'No runtime candidate is not proof a field is unnecessary: triggers, SQL views, exports, import scripts and approved deferred modules may justify it.', 'Baseline/proposal classification is provenance, not human approval or release certification.', 'No database row values, credentials or statutory IDs were read/exported.']}
(OUT / 'field-catalog.json').write_text(json.dumps({'summary': summary, 'fields': rows}, indent=2)+'\n')
with (OUT / 'field-catalog.csv').open('w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['Table', 'Field', 'DB type', 'Nullable', 'Default', 'Purpose evidence', 'Baseline source', 'DDL evidence', 'Runtime evidence class', 'Explicit runtime candidate locations', 'Incidental selectAll candidate locations', 'Constraint definitions', 'Kysely SELECT types'])
    for row in rows:
        locations = lambda entries: '; '.join(sorted(set(f"{e['file']}:{e['lines'][0]}" for e in entries)))
        writer.writerow([row['table'], row['column'], row['udt_name'], row['nullable'], row['default'], row['purpose_classification'], '; '.join(row['baseline_spec']), '; '.join(row['ddl_references']), row['runtime_use_classification'], locations(row['explicit_runtime_candidates']), locations(row['incidental_runtime_candidates']), '; '.join(c['definition'] for c in row['constraints']), ' | '.join(row['kysely_type']['selected_types']) if row['kysely_type'] else 'MISSING'])
(OUT / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary, indent=2))
