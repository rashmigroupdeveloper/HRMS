/** ATT-01: native Recognition Logs have separate Date/Time and real direction labels. */
import { LAYOUT_ERROR, type AlternateLayout } from '../../../core/bulk/index.js';
import { str } from '../helpers.js';

export const kentRecognitionLayout: AlternateLayout = {
  name: 'KENT Recognition Logs',
  detect: headers => ['employeeid', 'date', 'time', 'devicename', 'attendancetype', 'createdon'].every(h => headers.includes(h)),
  map: row => {
    const direction = str(row['attendancetype']).trim().toLowerCase();
    const device = str(row['devicename']).trim();
    const errors: string[] = [];
    if (!device) errors.push('Recognition Logs: Device Name is missing; resolve the source device before importing');
    if (direction && direction !== 'in' && direction !== 'out') errors.push('Recognition Logs: Attendance Type must be in, out or blank');
    return [{
      ecode: row['employeeid'] ?? null, name: row['employeename'] ?? null,
      swipe_at: `${str(row['date'])} ${str(row['time'])}`,
      door: device || null, status: direction || null, swipe_type: 'KENT_RECOGNITION',
      received_on: row['createdon'] ?? null,
      remarks: JSON.stringify({ accountId: row['accountid'] ?? null, source: row['source'] ?? null,
        company: row['company'] ?? null, department: row['department'] ?? null, location: row['location'] ?? null,
        receivedTimeBasis: 'KENT Created on' }),
      ...(errors.length ? { [LAYOUT_ERROR]: errors.join('; ') } : {}),
    }];
  },
};
