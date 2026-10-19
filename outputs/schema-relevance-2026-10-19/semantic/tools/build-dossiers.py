from pathlib import Path
import json, collections
root=Path(__file__).resolve().parents[4]
out=root/'outputs/schema-relevance-2026-10-19/semantic'
ops=json.loads((out/'operation-evidence.json').read_text())['operations']; by_table=collections.defaultdict(list)
for op in ops:
    for ref in op['tables']: by_table[ref['table']].append(op)
meta=json.loads((out.parent/'database-metadata.json').read_text())
types=json.loads((out.parent/'type-symbols.json').read_text()); columns=collections.defaultdict(list)
for c in meta['columns']:columns[c['table_name']].append(c)
for schema in sorted({t.split('.')[0] for t in columns}):
    lines=[]
    for table, fields in columns.items():
        if table.split('.')[0]!=schema:continue
        lines.append('\n## '+table)
        constraints={c['definition'] for f in fields for c in f['constraints']}
        for c in fields:
            tc=types.get(table,{}).get(c['column_name'],{})
            lines.append(f"{c['column_name']}: {c['data_type']} {'NOT NULL' if c['not_null'] else 'NULL'} | "+str(c.get('comment') or tc.get('purpose_comment') or ''))
        lines.append('Constraints: '+json.dumps(sorted(constraints)))
        for o in by_table.get(table,[]):
            if o['operation']=='selectFrom' and not o.get('locking'):continue
            lines.append(f"{o['file']}:{o['line']} {o['context']} {o['operation']} write={','.join(o.get('write_fields',[]))} indirect={o.get('indirect_writes')} locks={o.get('locking',[])}")
    (out/f'{schema}-dossier.txt').write_text('\n'.join(lines)+'\n')
print(json.dumps({s:sum(len(fs) for t,fs in columns.items() if t.startswith(s+'.')) for s in sorted({t.split('.')[0] for t in columns})}))
