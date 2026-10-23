/** ATT-01/18: map the actual supplied native headers without confusing clock/date/direction. */
import { describe, expect, it } from 'vitest';
import { mapUpload } from '../src/core/bulk/index.js';
import { punchesImporter } from '../src/modules/bulk/importers/punches.js';

const headers = ['S.No', 'Employee ID', 'Employee Name', 'Department', 'Company', 'Device Name', 'Source', 'Location', 'Date', 'Time', 'Account ID', 'Attendance Type', 'Created on'];
const row = [1, 'RML1', 'Test Employee', 'Office', 'Company', 'Gate', 'Device', 'Office', '05/10/2026', '09:00', '2205100200', 'in', '05-10-2026 09:00'];
const map = (data: (string | number | null)[][]) => mapUpload([{ name: 'Recognition Logs', rows: [headers, ...data] }], punchesImporter.columns, punchesImporter.layouts);

describe('native KENT Recognition Logs layout', () => {
  it('combines actual Date/Time and separately retains the later Created on timestamp', () => {
    const out = [...row]; out[9] = '03:30'; out[8] = '06/10/2026'; out[11] = 'out'; out[12] = '08-10-2026 04:00';
    const result = map([row, out]);
    expect(result.layout).toBe('KENT Recognition Logs');
    expect(result.rows.map(r => r.issues)).toEqual([[], []]);
    expect(result.rows[1]?.values).toMatchObject({ ecode: 'RML1', swipe_at: '2026-10-06 03:30:00',
      received_on: '2026-10-08 04:00:00', status: 'out', door: 'Gate', swipe_type: 'KENT_RECOGNITION' });
  });
  it('keeps a blank direction available for FILO, while blocking a missing native device', () => {
    const blank = [...row]; blank[11] = ''; blank[5] = '';
    const result = map([blank]);
    expect(result.rows[0]?.values['status']).toBeNull();
    expect(result.rows[0]?.issues.some(issue => issue.severity === 'error' && issue.message.includes('Device Name'))).toBe(true);
  });
  it('refuses daily P/A status masquerading as a punch direction', () => {
    const bad = [...row]; bad[11] = 'P';
    expect(map([bad]).rows[0]?.issues.some(issue => issue.severity === 'error' && issue.message.includes('Attendance Type'))).toBe(true);
  });
});
