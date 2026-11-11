"""CORE-08/NFR-04: build documentation from metadata, never employee records."""
import csv, hashlib, json, re
from pathlib import Path
from plain_language import TABLES, SCHEMAS, explain
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/data-dictionary'
load = lambda p: json.loads((ROOT / p).read_text())
meta = load('docs/data-dictionary/sources/database-metadata.json')
types = load('docs/data-dictionary/sources/type-symbols.json')
purposes = load('docs/data-dictionary/sources/type-table-purposes.json')
meanings = {}; table = ''
for line in (ROOT/'outputs/schema-relevance-2026-10-19/semantic/field-meanings.txt').read_text().splitlines():
    if line.startswith('['): table = line[1:-1]
    elif '=' in line and not line.startswith('#'):
        key, val = line.split('=',1); meanings[table+'.'+key.strip()] = (val.strip(), 'reviewer-authored field meaning (19 Oct 2026)')
for row in load('outputs/schema-relevance-2026-10-19/field-purposes-reviewed.json'):
    meanings[row['table']+'.'+row['field']] = (row['meaning'], 'reviewed field purpose (19 Oct 2026)')
# Current, explicit declaration comments take precedence over the historical review.
for table, fields in types.items():
    for name, info in fields.items():
        if info['purpose_comment']: meanings[table+'.'+name] = (info['purpose_comment'], info['reference'])
for line in (OUT/'tools/definitions.txt').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key,val=line.split('=',1)
        if '.' in key: meanings[key]=(val,'dictionary supplement; grounded in docs/03, docs/04 and current declaration')
        else:
            for col in meta['columns']:
                full=col['table_name']+'.'+col['column_name']
                if col['column_name']==key and full not in meanings:
                    meanings[full]=(val,'dictionary supplement; docs/03, docs/04 and current catalog')
common = {
'id':'Internal unique identity of this record; distinct from display codes and external identifiers.',
'created_at':'Instant this record was created.', 'updated_at':'Instant this record was last updated; not a complete change history.',
'company_id':'Legal entity that owns or scopes this record.', 'employee_id':'Employee to whom this record belongs; references the permanent employee master.',
'created_by':'User who created this record.', 'updated_by':'User who last updated this record.',
'is_active':'Whether this catalog or account record is currently available for use; historical references remain.',
'name':'Human-readable display name of this catalog record.', 'code':'Stable machine-readable business code identifying this catalog entry.',
'description':'Human-readable description of this record.',
}
def definition(c):
    key = c['table_name']+'.'+c['column_name']; n=c['column_name']
    if key in meanings: return meanings[key]
    if c['comment']: return c['comment'],'database column comment'
    if n in common: return common[n], 'catalog relationship / shared record convention'
    fk = [x['definition'] for x in c['constraints'] if x['kind']=='f']
    if fk: return ('Reference linking this record’s '+n.replace('_',' ')+' to '+ '; '.join(fk)+'.', 'database foreign key')
    if n.endswith('_at'): return ('Instant of '+n[:-3].replace('_',' ')+' for this record.', 'timestamp field convention')
    return None, None
missing=[]
for c in meta['columns']:
 if not definition(c)[0]: missing.append(c['table_name']+'.'+c['column_name'])

GLOSSARY = {
'P':'Present', 'A':'Absent', 'HD':'Half day', 'WO':'Weekly off', 'H':'Holiday', 'L':'Leave', 'OD':'On duty', 'O':'Off session', 'CO':'Compensatory off', 'UAB':'Unauthorized absence',
'AR':'Attendance regularization', 'PERMISSION':'Short time-bounded attendance permission',
'ACTUAL':'PF calculation on actual configured eligible wages', 'CEILING_15000':'PF wage basis capped at the configured ceiling; code retains the legacy 15000 label',
'awaiting_prejoin':'Accepted-offer candidate awaiting pre-joining completion; no permanent employee created',
'prejoin_done':'Pre-joining information completed; joining confirmation still required',
'converted':'Candidate converted to an employee after joining confirmation',
'no_show':'Candidate did not join', 'hold_process':'Hold salary processing', 'hold_payment':'Compute salary but hold payment',
'computed':'Calculation results exist; final approval/payment still separate', 'inputs_locked':'Payroll input collection is frozen',
'finalized':'Payroll approved and frozen; payment remains a separate step', 'prepared':'Payment batch prepared with frozen payment contents',
'paid':'Payment recorded as completed', 'pending':'Awaiting the required decision or next action', 'draft':'Editable draft before submission/preparation',
'approved':'Authorized by the applicable approval process', 'rejected':'Request refused by an authorized reviewer',
'sent_back':'Returned to requester for correction and resubmission', 'cancelled':'Request cancelled', 'withdrawn':'Record/request withdrawn',
'lapsed':'Validity or decision window elapsed', 'dead':'Delivery retries exhausted', 'queued':'Waiting for background processing or delivery',
'sent':'Message dispatched by the delivery process', 'failed':'Operation/delivery attempt failed',
'converted_comp_off':'Overtime converted to compensatory-off credit instead of cash',
'comp_off_earn':'Compensatory-off credit earned', 'accrual':'Periodic leave entitlement credit', 'encash':'Leave converted to cash',
'credit':'Credit movement; sign and amount are governed by the ledger rules', 'debit':'Debit movement; sign and amount are governed by the ledger rules',
'full_day':'Both configured attendance halves on each covered date', 'first_half':'First configured attendance half', 'second_half':'Second configured attendance half',
'old':'Old income-tax regime', 'new':'New income-tax regime',
'ceil':'Round upward', 'floor':'Round downward', 'round':'Round to nearest configured unit', 'nearest_10':'Round to nearest ten-unit boundary',
'emi_no_interest':'Instalments without interest', 'loan_flat':'Loan using flat interest', 'loan_diminishing':'Loan using diminishing-balance interest',
'clra_licence':'Contract Labour Regulation and Abolition licence', 'pf':'Provident fund', 'eps':'Employees Pension Scheme', 'esic':'Employees State Insurance', 'pt':'Professional tax', 'lwf':'Labour welfare fund',
'gmc':'Group medical cover', 'gpa':'Group personal accident cover', 'gtli':'Group term life insurance', 'fnf':'Full and final settlement',
'bgv':'Background verification', 'cgpa':'Cumulative grade point average', 'bsr':'Basic Statistical Return bank branch code',
'sap_legacy':'Imported legacy SAP-origin record', 'hrms':'Native HRMS-origin record', 'payroll_posted':'Posted into the payroll process',
'wallet_carry_forward':'Retain settlement balance in travel wallet', 'direct_refund':'Employee refunds excess advance directly',
'payroll_deduction':'Recover through authorized payroll deduction', 'subtree':'Organization node plus its descendants', 'own':'Current user’s own population', 'all':'All records within the enclosing permission scope',
}
def value_meaning(v, name):
    if v in GLOSSARY: return GLOSSARY[v]
    label=v.replace('_',' ').strip()
    if name in ('status','settlement_status','visa_status','payment_status','stage','outcome'):
        return 'Record is '+label+' in this lifecycle.'
    if name.endswith('kind') or name in ('type','category','channel','travel_type','source','action','movement'):
        return label.capitalize()+' classification for '+name.replace('_',' ')+'.'
    return label.capitalize()+'.'

def domains(c, info):
    n=c['column_name']; result=[]
    for k in c['constraints']:
        if k['kind']!='c': continue
        # Only extract the array directly applied to this field; other literals belong to coupled predicates.
        pattern=r'\b'+re.escape(n)+r'\s*=\s*ANY\s*\(ARRAY\[(.*?)\]'
        for match in re.finditer(pattern,k['definition']):
            for value in re.findall(r"'((?:[^']|'')*)'",match[1]):
                result.append({'value':value.replace("''", "'"),'meaning':value_meaning(value,n),'basis':'DB CHECK: '+k['name']})
    # Preserve code-declared domains separately: they do not establish DB enforcement.
    decl=info.get('declaration','')
    for value in (re.findall(r"'([^']+)'",decl) if c['data_type'] in ('text','character varying') else []):
        if value not in [r['value'] for r in result]:
            result.append({'value':value,'meaning':value_meaning(value,n),'basis':'TypeScript declaration only'})
    if c['data_type']=='boolean':
        result.extend([{'value':'true','meaning':'The condition described by this field is enabled/true.','basis':'SQL boolean'}, {'value':'false','meaning':'The condition described by this field is disabled/false.','basis':'SQL boolean'}])
    return result

def esc(s): return str(s).replace('|','\\|').replace('\n','<br>')
def link(path):
    path=re.sub(r':\d+$','',path)
    return '['+path+'](../../'+path+')'

def build():
    fingerprint = load('docs/data-dictionary/sources/type-index-fingerprint.json')
    current_sources = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                       for p in sorted((ROOT/'backend/src/core/db').glob('types*.ts'))}
    assert fingerprint['source_hashes'] == current_sources, 'Type declarations changed; regenerate index-types.mjs before building the dictionary'
    for filename, expected in fingerprint['index_hashes'].items():
        assert hashlib.sha256((OUT/'sources'/filename).read_bytes()).hexdigest() == expected, 'Type index changed; regenerate index-types.mjs'
    assert not missing, missing
    rows=[]; keys=set(); tables={t['table_name']:t for t in meta['tables']}
    for c in meta['columns']:
        table=c['table_name']; name=c['column_name']; key=table+'.'+name
        assert key not in keys,key
        keys.add(key); info=types.get(table,{}).get(name,{})
        meaning,basis=definition(c)
        review='Defined; documentation does not certify end-to-end implementation'
        if table.startswith('sec.mfa_'):review='Retained compatibility schema; MFA excluded from current sponsor scope'
        if table=='public.pgmigrations':review='Migration infrastructure; excluded from application-field count'
        money=''
        if re.search(r'(?:^|_)days(?:_|$)', name) and 'numeric' in c['data_type']: money='Days; fractional values represent part of a day'
        elif name.endswith('_paise'):money='Integer paise; 100 paise = INR 1'
        elif 'numeric' in c['data_type'] and re.search(r'amount|salary|wages|ctc|payable|deduction|gross|net_pay|principal|emi|allowance|cost|encash',name):money='Rupees unless an explicit currency field/definition says otherwise'
        rows.append({
            'field':key,'schema':table.split('.')[0],'table':table,'column':name,
            'definition':meaning,'definition_basis':basis,'data_type':c['data_type'],
            **explain(c, meaning, domains(c,info)),
            'required':'Yes' if c['not_null'] else 'No (NULL allowed; NULL is distinct from zero/false/empty)',
            'default':c['default_expression'] or ('GENERATED ALWAYS AS IDENTITY' if c['identity_kind']=='a' else 'GENERATED BY DEFAULT AS IDENTITY' if c['identity_kind']=='d' else 'No database default'),
            'units':money,'allowed_values':domains(c,info),
            'constraints':c['constraints'],'type_declaration':info.get('declaration','Not part of application Database interface'),
            'type_source':info.get('reference','Migration infrastructure'), 'scope':review,
        })
    typed={t+'.'+n for t,fs in types.items() for n in fs}
    report={'captured_at':meta['captured_at'],'generated_on':'2026-11-11','read_only':meta['read_only'],
        'logical_tables_and_views':len(tables),'total_fields':len(rows),
        'application_fields':sum(r['table']!='public.pgmigrations' for r in rows),
        'application_tables_and_views':sum(t!='public.pgmigrations' for t in tables),
        'type_index_provenance_verified':True,
        'plain_explanations':sum(bool(r['plain_explanation'].strip() and r['why_it_matters'].strip() and r['example'].strip()) for r in rows),
        'defined_fields':sum(bool(r['definition'].strip()) for r in rows),'duplicate_fields':len(rows)-len(keys),
        'typed_fields_missing_from_database':sorted(typed-keys),
        'database_fields_without_application_type':sorted(keys-typed),
        'source_hashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'backend/src/core/db').glob('types*.ts'))},
    }
    assert not report['typed_fields_missing_from_database'], report
    assert report['plain_explanations'] == len(rows), 'Every field must have an explanation, reason and example'
    (OUT/'coverage.json').write_text(json.dumps(report,indent=2)+'\n')
    (OUT/'all-fields.json').write_text(json.dumps(rows,indent=2)+'\n')
    csv_keys=['field','friendly_name','plain_explanation','why_it_matters','example','definition','data_type','required','default','units','allowed_values','constraints','definition_basis','type_source','type_declaration','scope']
    with (OUT/'all-fields.csv').open('w',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=csv_keys,lineterminator='\n');writer.writeheader()
        for row in rows:
            entry={k:row[k] for k in csv_keys}
            entry['allowed_values']='; '.join(x['value']+' = '+x['meaning']+' ['+x['basis']+']' for x in row['allowed_values']) or 'No finite domain extracted; see type, relationships and full constraints.'
            entry['constraints']='; '.join(x['name']+': '+x['definition'] for x in row['constraints'])
            writer.writerow(entry)
    schemas=sorted({r['schema'] for r in rows}); index=[]
    reader=OUT/'plain-language'; reader.mkdir(exist_ok=True)
    for schema in schemas:
        lines=['# '+SCHEMAS[schema]+' — everyday-language guide','','[Start here](README.md). Examples are made up to explain the meaning; they are not employee data or policy instructions.','']
        for table in sorted({r['table'] for r in rows if r['schema']==schema}):
            lines += ['## '+table,'',TABLES[table],'','| Field | What it means | Why it is kept | Simple example | Choices, where listed |','|---|---|---|---|---|']
            for r in rows:
                if r['table']==table:
                    lines.append('| `'+r['column']+'` | '+esc(r['plain_explanation'])+' | '+esc(r['why_it_matters'])+' | '+esc(r['example'])+' | '+esc('; '.join(v['value']+': '+v['meaning'] for v in r['allowed_values']) or 'Read the saved detail using its explanation; there is no fixed choice list shown here.')+' |')
            lines += ['']
        (reader/(schema+'.md')).write_text('\n'.join(lines)+'\n')
    (reader/'README.md').write_text('''# HRMS explained for everyone

A record is one saved item, such as one employee, one leave request or one payslip result. A field is one detail in that item, such as a joining date or approved amount. Each page explains what every field means, why the detail is kept and how to read it in practice.

There are '''+format(len(rows), ',')+''' field explanations. Examples are invented illustrations. They are not real employee information, promised features, approved rates or instructions to change policy. The guide explains the documented purpose; it does not certify that every process is fully implemented.

'''+ '\n'.join('- ['+SCHEMAS[schema]+']('+schema+'.md)' for schema in schemas)+'''

## Words you may see

| Word | Everyday meaning |
|---|---|
| Employee ID | The internal number connecting a person’s employment records. It can differ from the employee code printed on reports. |
| Candidate | Someone preparing to join. Accepting an offer alone does not make them a permanent employee in HRMS. |
| Company | The legal business employing or owning the record, rather than the entire group treated as one employer. |
| Required | The system must have a value before it can save the record. The value may be supplied automatically. |
| Default | A starting value the system supplies if another value is not provided. |
| NULL | No value has been recorded. It does not mean zero, No or an empty answer. |
| Status | The stage the record has reached, such as awaiting approval or paid. Approval and payment are different events. |
| Payroll period | The period for which salary is being calculated. Its attendance dates can depend on company configuration. |
| Gross pay | Earnings before employee deductions. |
| Net pay | The amount remaining after deductions; a payment hold may still affect release. |
| CTC | Cost to company. This is not the same as monthly take-home salary. |
| Loss of pay | Time that does not qualify for salary under the applicable rules. |
| Arrears | An adjustment relating to an earlier salary period. |
| Reimbursement | Repayment of an approved business expense, handled separately from salary payments. |
| Paise | One hundred paise equals one rupee; 10,050 paise means ₹100.50. |
| Ledger | A history of individual additions and deductions from which a balance can be checked. |
| Snapshot | A copy saved at a particular time, so later changes do not replace the historical explanation. |
| Hash / digital fingerprint | A value the system compares to check matching information without showing the original secret. |
| JSON / structured details | Several related answers stored together, like the contents of a small form. |
| Audit history | A record of important actions, including who performed them and when. |
| Retention rule | A rule about how long information should be kept. |

For types, exact database rules and references, see the [technical dictionary](../README.md). For filtering in Excel, use [all fields with everyday-language columns](../all-fields.csv).
''')
    for schema in schemas:
        subset=[r for r in rows if r['schema']==schema]
        lines=[f'# {schema} — field dictionary','',f'{len(subset)} fields. Catalog captured {meta["captured_at"]}. [Dictionary guide](README.md).','']
        for table in sorted({r['table'] for r in subset}):
            tr=[r for r in subset if r['table']==table]; tm=tables[table]
            comment=next((c['table_comment'] for c in meta['columns'] if c['table_name']==table),None)
            purpose=comment or purposes.get(table) or table.split('.')[1].replace('_',' ').capitalize()+' records; consult the field definitions and governing module specification.'
            lines += ['## '+table,'',TABLES[table],'',purpose,'',f'Relation kind: '+{'r':'table','p':'partitioned parent table','m':'materialized report view','v':'view'}.get(tm['kind'],tm['kind'])+'.','']
            for r in tr:
                lines += ['### '+r['column'],'', '**In everyday language:** '+r['plain_explanation'],'','**Why it is kept:** '+r['why_it_matters'],'','**Example:** '+r['example'],'','Technical definition: '+r['definition'],'', '| Property | Definition |','|---|---|',
                    '| SQL type | `'+esc(r['data_type'])+'` |','| Required | '+r['required']+' |',
                    '| Default | '+esc(r['default'])+' |','| Definition basis | '+esc(r['definition_basis'])+' |',
                    '| Code declaration | `'+esc(r['type_declaration'])+'` |',
                    '| Code source | '+(link(r['type_source']) if r['type_source']!='Migration infrastructure' else 'Migration runner')+' |',
                    '| Scope | '+r['scope']+' |','']
                if r['units']:lines+=['Units: '+r['units']+'.','']
                if r['allowed_values']:
                    lines += ['Allowed entries (source distinguishes database enforcement from code declarations):','', '| Entry | Meaning | Source |','|---|---|---|']
                    lines += ['| `'+esc(v['value'])+'` | '+esc(v['meaning'])+' | '+esc(v['basis'])+' |' for v in r['allowed_values']]
                    lines += ['']
                else:lines+=['Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.','']
                if r['constraints']:
                    lines+=['Database rules (including conditions shared with other fields):','']
                    lines+=['- `'+esc(k['name'])+'`: `'+k['definition']+'`'+(' **NOT VALIDATED**' if not k['validated'] else '') for k in r['constraints']]
                    lines+=['']
                else:lines+=['Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.','']
            lines+=['Table indexes and lifecycle triggers:','']
            lines+=['- Index `'+x['name']+'`: `'+x['definition']+'`' for x in tm['indexes']]
            lines+=['- Trigger `'+x['name']+'` → `'+x['function']+'` (enabled flag `'+x['enabled']+'`).' for x in tm['triggers']]
            if not tm['indexes'] and not tm['triggers']:lines+=['None in this catalog snapshot.']
            lines+=['']
        (OUT/(schema+'.md')).write_text('\n'.join(lines)+'\n')
        index.append(f'| [{schema}]({schema}.md) | {len(set(r["table"] for r in subset))} | {len(subset)} |')
    (OUT/'README.md').write_text('''# HRMS data dictionary

Prepared 11 Nov 2026 · CORE-08 / NFR-04 · Phase 0, Stage 0.2 documentation deliverable.

Every observed database field has a definition: **'''+str(len(rows))+''' fields across '''+str(len(tables))+''' logical tables and views**. This includes '''+str(report['application_fields'])+''' application fields and three migration-bookkeeping fields. All current application type fields match the captured database. Physical child partitions inherit the parent definitions and are not repeated; PostgreSQL catalogs and the pg-boss vendor schema are excluded.

For nontechnical readers, start with [HRMS explained for everyone](plain-language/README.md). Every field includes an everyday explanation, why it is kept and an illustrative example. The same columns appear first in the CSV.

Start with the module files below, or open [all fields as CSV](all-fields.csv) in Excel and filter by field name. [Structured JSON](all-fields.json) preserves constraints and allowed-value sources; [coverage evidence](coverage.json) records counts and source hashes.

| Database schema | Tables/views | Defined fields |
|---|---|---|
'''+ '\n'.join(index)+'''

## Reading an entry

Each field defines its business meaning, SQL type, whether NULL is permitted, database default, code declaration/source, available value meanings, full column-linked constraints and applicable units. Each table also lists indexes and triggers. A foreign key identifies the referenced authority; it does not prove that application access is authorized. NULL is distinct from zero, false, blank text and an empty JSON collection. Database required status does not necessarily mean an end user types the value: generated IDs and defaults are filled by the system.

Database CHECK value lists and TypeScript literal unions are labelled separately. Code declarations alone do not prove a database restriction. Other conditional CHECK literals are retained verbatim rather than misrepresented as unconditional allowed entries. Dynamic catalog IDs, configurable codes, free text and JSON maps do not have fabricated exhaustive lists. JSON declaration shapes are retained verbatim; event-specific payload schemas and runtime validators remain in their owning modules. This dictionary covers persisted database columns, not every HTTP DTO or arbitrary nested JSON key.

## Units, identity and sensitive values

- Monetary NUMERIC amounts use exact decimals. Fields ending `_paise` store integer paise; 100 paise equals INR 1. Rates, percentages, counts and durations are not money just because their SQL type is numeric. Scheme/parameter values require their named policy's units.
- DATE is a calendar date; timestamps with time zone represent instants and are presented in IST. A month field represents a payroll/report period rather than an arbitrary event date. Attendance cycle boundaries depend on configured policy.
- Employee `id`, display `ecode`, candidate ID, external ATS offer ID and login user ID are separate identities. Candidates remain separate until actual joining is confirmed. Relationships are documented without conflating those identities.
- This export reads catalog metadata only. It contains no employee records, bank details, statutory identifiers, health answers, secret values or credentials. Those field definitions do not authorize unrestricted viewing/export; role permissions and population scope still apply.

## Authority and lifecycle decisions

[Database specification](../03-DATABASE-SCHEMA.md) and [module specification](../04-MODULE-SPECS.md) govern intended behavior. Current catalog metadata governs the captured physical types/defaults/constraints. Definition bases distinguish explicit current comments from prior authored semantic explanations and the dictionary supplement. Historical semantic explanations were carried forward as documentation sources, not as proof that an old implementation gap still exists.

- Reimbursements are independent of salary payment. `pay.claims.reimbursement_batch_id` and reimbursement batch/items are current payment destinations; older payroll/bank links and `pay.inputs.claim_id` are retained for historical reconciliation. Do not infer repayment/backfill from old links.
- Leave, wallet and financial ledger balances must reconcile to immutable movements. A stored balance/cache is not independent proof of the ledger total.
- Attendance sessions preserve actual presence/absence. Separate penalty findings do not invent payable-day reductions. An empty evaluation array and NULL historical evaluation have different meanings.
- MFA tables are documented because they exist, but MFA remains outside current approved scope. Presence in this dictionary does not enable the feature.
- Statutory parameters describe stored configuration, not independently verified current legal rates. This documentation changes no policy value or payroll calculation.

## Snapshot and maintenance

The schema was read from the configured local HRMS database in a repeatable-read, read-only transaction at **'''+meta['captured_at']+'''**. No migrations or business writes were executed. This does not certify production parity, UAT acceptance or implementation completion.

To regenerate from the repository root:

```sh
cd backend
node scripts/run-local-check.mjs --import tsx scripts/export-data-dictionary-catalog.ts
node ../docs/data-dictionary/tools/index-types.mjs
cd ..
python3 docs/data-dictionary/tools/build.py
```

The existing local runner rejects non-loopback/non-HRMS targets. Regeneration fails when a new field lacks a definition or a typed field is missing in the database. Edit the scoped definitions in `tools/definitions.txt` when a meaning changes. Re-check new enum codes and structured payloads against the owning specification/service before publication. The generator verifies the type index against its source and output fingerprints before publishing; regenerate the index after changing declarations. The source hashes in coverage.json record the verified declaration snapshot.
''')
    print(json.dumps({k:v for k,v in report.items() if k!='source_hashes'},indent=2))
if __name__=='__main__': build()
