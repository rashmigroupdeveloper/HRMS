"""CORE-08: evidence index for every live column. References are candidates, not liveness proof."""
from pathlib import Path
import collections
from functools import lru_cache
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/schema-relevance-2026-10-19'
metadata = json.loads((OUT / 'database-metadata.json').read_text())
types = json.loads((OUT / 'type-symbols.json').read_text())
table_purposes = json.loads((OUT / 'type-table-purposes.json').read_text())
paths = subprocess.check_output(['rg', '--files', 'backend/src', 'backend/migrations', 'docs'], cwd=ROOT, text=True).splitlines()
paths = [p for p in paths if p.endswith(('.ts', '.md'))]
source = {p: (ROOT / p).read_text() for p in paths}
source_lines = {p: text.splitlines() for p, text in source.items()}
source_hashes = {p: hashlib.sha256(text.encode()).hexdigest() for p, text in source.items()}
tables = {t['table_name']: t for t in metadata['tables']}
manual_file = OUT / 'field-purposes-reviewed.json'
manual = {(r['table'], r['field']): r for r in json.loads(manual_file.read_text())} if manual_file.exists() else {}


@lru_cache(maxsize=None)
def mentions(table, prefix):
    # Deliberately lexical: builders may use aliases, selectAll, SQL, or dynamic fields.
    # Never use absence from this index as authority to DROP a field.
    pattern = re.compile(r'(?<![\w.])' + re.escape(table) + r'(?![\w])')
    return [p for p, text in source.items() if p.startswith(prefix) and pattern.search(text)]


result = []
for col in metadata['columns']:
    table, field = col['table_name'], col['column_name']
    typed = types.get(table, {}).get(field)
    prod = mentions(table, 'backend/src/')
    prod = [p for p in prod if '/core/db/types' not in p]
    docs = mentions(table, 'docs/')
    migrations = mentions(table, 'backend/migrations/')
    candidates = []
    token = re.compile(r'\b' + re.escape(field) + r'\b')
    for p in prod:
        for line, text in enumerate(source_lines[p], 1):
            if token.search(text):
                candidates.append(f'{p}:{line}')
                break
    constraint_purposes = [c['definition'] for c in col['constraints'] if c['kind'] in ('f', 'p', 'u')]
    comment = col['comment'] or (typed or {}).get('purpose_comment') or None
    if table == 'public.pgmigrations':
        status = 'migration_infrastructure'
    elif table == 'public.undefined':
        status = 'unexpected_migration_metadata_table_review'
    elif table.startswith('sec.mfa_'):
        status = 'sponsor_excluded_mfa_retained_for_compatibility_review'
    elif not typed:
        status = 'missing_application_type_review'
    elif candidates:
        status = 'typed_with_candidate_code_references'
    elif prod:
        status = 'typed_table_consumed_field_usage_unproven'
    else:
        status = 'typed_without_current_direct_table_consumer_review'
    reviewed = manual.get((table, field))
    purpose_basis = 'manual_review_trace' if reviewed else 'explicit_comment' if comment else 'relationship_or_identity_constraint' if constraint_purposes else 'not_yet_semantically_documented'
    result.append({**col, 'review_status': status, 'purpose_basis': purpose_basis,
        'explicit_purpose': comment, 'manual_purpose_review': reviewed, 'table_purpose_comment': table_purposes.get(table),
        'relationship_identity_evidence': constraint_purposes,
        'type_declaration': typed,
        'candidate_production_references': candidates[:8],
        'table_consumer_files': prod,
        'spec_files_mentioning_table': docs,
        'migrations_mentioning_table': migrations,
        'table_triggers': tables[table]['triggers'],
        'decision': 'KEEP_PENDING_SEMANTIC_REVIEW' if not comment else 'KEEP_REVIEW_USAGE_AND_INVARIANTS',
    })

live = {(r['table_name'], r['column_name']) for r in result}
report = {'captured_at': metadata['captured_at'], 'read_only': metadata['read_only'],
    'limits': ['No business rows read. No field dropped or migration applied.',
        'Code/spec references are lexical candidates, not proof of a particular read/write, correctness, authorization or necessity.',
        'selectAll, JSON, computed SQL, triggers and future approved scope may justify a field without an explicit application mention.',
        'Relationship constraints prove a link, not the full business purpose. Every unresolved purpose still needs semantic review.',
        'Application field count excludes migration bookkeeping and physical child partitions. Repository and DB snapshots are not one atomic snapshot.'],
    'manually_reviewed_field_purposes': len(manual),
    'application_tables': len([t for t in tables if t in types]),
    'application_columns': sum(r['table_name'] in types for r in result),
    'counts_by_status': dict(collections.Counter(r['review_status'] for r in result)),
    'counts_by_purpose_basis': dict(collections.Counter(r['purpose_basis'] for r in result)),
    'typed_fields_missing_from_live_schema': [f'{t}.{f}' for t, fs in types.items() for f in fs if (t, f) not in live],
    'columns': result}
(OUT / 'field-register.json').write_text(json.dumps(report, indent=2) + '\n')
(OUT / 'source-fingerprints.json').write_text(json.dumps(source_hashes, indent=2) + '\n')
summary = {k:v for k,v in report.items() if k != 'columns'}
(OUT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
