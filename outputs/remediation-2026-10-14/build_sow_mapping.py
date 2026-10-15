"""Regenerate current repair evidence against all original SOW rows, without changing the SOW."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = json.loads((ROOT / 'plans/sow-completion/backend-schema-plan.json').read_text())
REVIEW = json.loads((ROOT / 'outputs/code-review-2026-10-13/findings.json').read_text())
PROGRESS = json.loads((OUT / 'progress.json').read_text())
CURRENT = {item['id']: item for item in PROGRESS['findings']}
ADDITIONAL = json.loads((OUT / 'additional-findings.json').read_text()) if (OUT / 'additional-findings.json').exists() else []
FINDINGS = REVIEW['findings'] + ADDITIONAL
for finding in FINDINGS:
    if finding['id'] == 'R35':
        finding['correction_2026_10_14'] = 'JSON.stringify alone does not prove JSONB double encoding; read-only bound-parameter probe returned object. Raw token persistence and single-use race remain valid.'
KNOWN = {item['id'] for item in BASE['requirements']}


def requirement_ids(text):
    """Expand literal documented shorthand, never infer requirements from descriptions."""
    result = set()
    for match in re.finditer(r'\b([A-Z]+)-(\d{2}(?:\.\.\d{2})?(?:/\d{2}(?:\.\.\d{2})?)*)', text):
        prefix, numbers = match.groups()
        for part in numbers.split('/'):
            bounds = part.split('..')
            start = int(bounds[0])
            end = int(bounds[-1])
            for number in range(start, end + 1):
                key = f'{prefix}-{number:02d}'
                if key in KNOWN:
                    result.add(key)
    return sorted(result)


rows = []
for row in BASE['sow_rows']:
    requirements = requirement_ids(row['requirements'])
    links = []
    for finding in FINDINGS:
        shared = sorted(set(requirements).intersection(finding['requirements']))
        if shared:
            links.append({
                'id': finding['id'], 'title': finding['title'],
                'shared_requirements': shared,
                'mapping_basis': 'Exact requirement intersection after expanding original shorthand',
                'repair_status': CURRENT.get(finding['id'], {}).get('status', 'open'),
                'repair_evidence': CURRENT.get(finding['id'], {}).get('evidence', []),
                'required_repair': finding['required_repair'],
                'source': {'file': finding['file'], 'line_at_review': finding['line']},
            })
    open_links = [link for link in links if link['repair_status'] != 'verified-fixed']
    state = 'Blocked by reviewed defects' if open_links else 'Requires current end-to-end verification'
    if 'manual' in row['status'].lower() or 'service' in row['status'].lower():
        state = 'Manual/service evidence pending'
    elif 'scope' in row['status'].lower():
        state = 'Scope decision pending'
    rows.append({
        'id': row['id'], 'source_row': row['source_row'], 'module': row['module'],
        'section': row['section'], 'original_item': row['item'],
        'baseline_status': row['status'], 'current_status': state,
        'requirement_shorthand': row['requirements'], 'requirements': requirements,
        'baseline_implemented_evidence': row['done'],
        'baseline_remaining_scope': row['left'],
        'completion_tasks': row['completion_tasks'],
        'schema_tables': row.get('schema_tables', []),
        'baseline_code_paths': row.get('evidence_paths', []), 'reviewed_findings': links,
        'caution': 'No direct finding link is not proof of completion. Baseline evidence predates current repairs.',
    })

inverse = []
for finding in FINDINGS:
    matched = [row['id'] for row in rows if any(link['id'] == finding['id'] for link in row['reviewed_findings'])]
    inverse.append({**finding, 'sow_rows': matched,
                    'repair': CURRENT.get(finding['id'], {'status': 'open'}),
                    'mapping_note': 'Cross-cutting or requirement absent from original crosswalk' if not matched else 'Direct documented requirement links'})

assert len(rows) == 176 and len({row['id'] for row in rows}) == 176
result = {
    'prepared': '2026-10-14',
    'scope': 'Every original SOW row retained; current defect/repair mapping, not release certification',
    'original_sow_sha256': '44d5192848744881f034cb6efdfdeed5602d37e46858a3a4eb7ffdca69be180a',
    'basis': '10 Oct baseline SOW/requirement crosswalk + 13 Oct code review + current repair evidence',
    'summary': {'sow_rows': len(rows), 'findings': len(FINDINGS),
                'statuses': dict(Counter(row['current_status'] for row in rows))},
    'sow_rows': rows, 'findings': inverse,
}
(OUT / 'sow-issue-mapping.json').write_text(json.dumps(result, indent=2) + '\n')
lines = [
    '# Current SOW issues and remaining work — 14 Oct 2026', '',
    'All 176 original rows are retained. This report matches reviewed defects to exact requirement IDs; it does not certify delivery. Source wording is preserved. Original workbook is unchanged.', '',
    'Baseline implemented descriptions come from the 10 Oct crosswalk. Current repairs and tests are listed separately. An absent finding means that current end-to-end verification remains necessary.', '',
    f"Current status counts: {dict(Counter(row['current_status'] for row in rows))}.", '',
    '**Evidence correction:** the earlier R35 JSONB representation concern does not establish double encoding. A read-only driver probe returned an object. Raw prejoin tokens and the concurrent single-use race remain open. See jsonb-probe-correction.json.', '',
    '## Reviewed defects and SOW links', '',
    '| Finding | Repair status | Direct SOW rows | Issue |', '|---|---|---|---|',
]
for finding in inverse:
    lines.append(f"| {finding['id']} | {finding['repair']['status']} | {', '.join(finding['sow_rows']) or 'Cross-cutting; see requirements'} | {finding['title']} |")
lines.extend(['', '## Every SOW point', ''])
for row in rows:
    lines.extend([f"### {row['id']} — original spreadsheet row {row['source_row']}", '',
                  f"**{row['module']} / {row['section']}**", '', row['original_item'], '',
                  f"**Current:** {row['current_status']}. **Historical baseline:** {row['baseline_status']}.", '',
                  f"**Requirement references:** {row['requirement_shorthand']}", '',
                  f"**Historical implementation evidence:** {row['baseline_implemented_evidence']}", '',
                  f"**Remaining scope from full crosswalk:** {row['baseline_remaining_scope']}", '',
                  f"**Execution cards:** {', '.join(row['completion_tasks'])}", '',
                  f"**Database connections:** {', '.join(row['schema_tables']) or 'See completion cards; no new schema inferred'}", '',
                  '**Current reviewed issues:**', ''])
    for link in row['reviewed_findings']:
        lines.append(f"- {link['id']} ({link['repair_status']}; {', '.join(link['shared_requirements'])}): {link['title']}. Remaining repair: {link['required_repair']}")
    if not row['reviewed_findings']:
        lines.append('- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.')
    lines.append('')
(OUT / 'SOW-ISSUES-AND-REMAINING.md').write_text('\n'.join(lines))
print(json.dumps(result['summary']))
