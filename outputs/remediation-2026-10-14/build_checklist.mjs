import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const dir = new URL('./', import.meta.url).pathname;
const data = JSON.parse(await fs.readFile(`${dir}sow-issue-mapping.json`, 'utf8'));
const findingEnd = 6 + data.findings.length;
const wb = Workbook.create();
const sow = wb.worksheets.add('SOW checklist');
const findings = wb.worksheets.add('Findings');
const sowRows = data.sow_rows.map(r => [r.id, r.source_row, r.original_item, r.current_status,
  r.reviewed_findings.map(f => f.id).join(', '),
  r.baseline_implemented_evidence, r.baseline_remaining_scope,
  r.requirement_shorthand, r.completion_tasks.join(', '), r.schema_tables.join(', '),
  r.baseline_code_paths.join(', ')]);
const headers = ['SOW ID', 'Original row', 'Original SOW wording', 'Current status', 'Linked findings',
  'Historical code evidence', 'Remaining scope', 'Requirement IDs', 'Execution cards', 'Database connections', 'Code evidence paths'];
sow.getRange('A12:K12').values = [headers];
sow.getRange('A13:K188').values = sowRows;
sow.getRange('A2').values = [['HRMS SOW review — 14 Oct 2026']];
sow.getRange('A4:A8').values = [['SOW rows'], ['Code defects'], ['To verify'], ['Manual duties'], ['Scope decisions']];
sow.getRange('B4:B8').formulas = [
  ['=COUNTA(A13:A188)'], ['=COUNTIFS(D13:D188,"Blocked by reviewed defects")'],
  ['=COUNTIFS(D13:D188,"Requires current end-to-end verification")'],
  ['=COUNTIFS(D13:D188,"Manual/service evidence pending")'], ['=COUNTIFS(D13:D188,"Scope decision pending")']];
sow.getRange('C4:D6').values = [['Review findings', null], ['Closed findings', null], ['Payroll tests passed', 107]];
sow.getRange('D4:D5').formulas = [[`=COUNTA(Findings!A7:A${findingEnd})`], [`=COUNTIFS(Findings!B7:B${findingEnd},"verified-fixed")`]];
sow.getRange('C8').values = [['Historical evidence is retained. Payroll review, signed policies and full backend verify remain open.']];
sow.getRange('A10').values = [['Source: original SOW Tracker .xlsx. IDs are physical spreadsheet rows. Current findings use code review and dated repair evidence.']];
const fheaders = ['Finding', 'Repair status', 'Issue', 'Original SOW rows', 'Requirement IDs', 'Code location at review', 'Observed problem', 'Remaining repair', 'Repair evidence'];
findings.getRange('A6:I6').values = [fheaders];
findings.getRange(`A7:I${findingEnd}`).values = data.findings.map(f => [f.id, f.repair.status, f.title,
  f.sow_rows.join(', '), f.requirements.join(', '), `${f.file}:${f.line}`,
  f.problem + (f.correction_2026_10_14 ? `\nCorrection: ${f.correction_2026_10_14}` : ''),
  f.repair.remaining ?? f.required_repair, (f.repair.evidence ?? [f.evidence]).join('\n')]);
findings.getRange('A2').values = [['Code and schema findings — 14 Oct 2026']];
findings.getRange('A4').values = [['Source: 13 Oct review plus current code, regression tests, PostgreSQL 16 replay and disposable upgrade rehearsal.']];
for (const [sheet, end, widths, headerRow, matrix] of [
  [sow, 188, [18, 12, 90, 40, 44, 90, 105, 38, 25, 95, 105], 12, sowRows],
  [findings, findingEnd, [14, 32, 65, 65, 35, 90, 110, 115, 95], 6, findings.getRange(`A7:I${findingEnd}`).values],
]) {
  const last = String.fromCharCode(64 + widths.length);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${last}${end}`).format.font = { name: 'Arial', size: 10, color: '#292524' };
  sheet.getRange(`A${headerRow}:${last}${end}`).format.wrapText = true;
  sheet.getRange(`A${headerRow + 1}:${last}${end}`).format.verticalAlignment = 'top';
  sheet.getRange(`A${headerRow}:${last}${headerRow}`).format = {
    fill: '#40352C', font: { name: 'Arial', size: 10, color: '#FFFFFF', bold: true },
    wrapText: true, rowHeight: 32, horizontalAlignment: 'center', verticalAlignment: 'center',
  };
  widths.forEach((width, i) => { sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${end}`).format.columnWidth = width; });
  matrix.forEach((values, index) => {
    const lines = Math.max(...values.map((v, i) => String(v ?? '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (widths[i] * 0.88))), 0)));
    sheet.getRange(`A${headerRow+1+index}:${last}${headerRow+1+index}`).format.rowHeight = Math.max(48, Math.min(409, lines * 13 + 12));
  });
  sheet.getRange('A2').format.font = { name: 'Arial', size: 14, bold: true, color: '#292524' };
  const table = sheet.tables.add(`A${headerRow}:${last}${end}`, true, sheet === sow ? 'SOWChecklist' : 'RepairFindings');
  table.style = 'TableStyleLight1';
  table.showFilterButton = true;
  sheet.freezePanes.freezeRows(headerRow);
  sheet.freezePanes.freezeColumns(sheet === sow ? 2 : 1);
}
sow.getRange('D13:D188').conditionalFormats.add('containsText', { text: 'Blocked', format: { fill: '#FBE9E7', font: { color: '#8C3027' } } });
sow.getRange('D13:D188').conditionalFormats.add('containsText', { text: 'pending', format: { fill: '#FFF2D4', font: { color: '#6E4D17' } } });
const originalStatus = sow.getRange('D13').values[0][0];
sow.getRange('D13').values = [['Requires current end-to-end verification']];
if (sow.getRange('B5').values[0][0] !== 108 || sow.getRange('B6').values[0][0] !== 33) throw new Error('Summary does not react to status updates');
sow.getRange('D13').values = [[originalStatus]];
wb.recalculate();
const summary = sow.getRange('B4:B8').values.flat();
if (JSON.stringify(summary) !== JSON.stringify([176,109,32,29,6])) throw new Error(`Incorrect summary ${summary}`);
for (const [sheetName, range, name] of [
  ['SOW checklist', 'A1:D14', 'sow-preview.png'], ['Findings', 'A1:C8', 'findings-preview.png'],
  ['SOW checklist', 'E12:H14', 'remaining-preview.png'],
]) {
  const render = await wb.render({ sheetName, range, scale: 1.5, format: 'png' });
  await fs.writeFile(`${dir}${name}`, new Uint8Array(await render.arrayBuffer()));
}
const inspection = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!', options: { useRegex: true, maxResults: 30 }, maxChars: 2000 });
await fs.writeFile(`${dir}workbook-inspection.txt`, inspection.ndjson);
const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(`${dir}SOW-Current-Issues-and-Remaining.xlsx`);
console.log(JSON.stringify({ sowRows: 176, findings: data.findings.length, summary, exported: true }));
