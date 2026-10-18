import { describe, expect, it } from 'vitest';
import { formHints, type EmployeeFormValues } from './EmployeeFormDrawer';

const base: EmployeeFormValues = {
  companyCode: 'RML', firstName: 'Ananya', lastName: '', gender: '', dob: '', doj: '2026-11-02', orgUnit: 'RML Kharagpur',
  location: '', department: '', designation: '', grade: '', category: '', contractType: '', managerEcode: '', hodEcode: '',
  workEmail: '', mobile: '', pan: '', aadhaar: '', uan: '', esicNo: '', bankName: '', bankAccount: '', bankIfsc: '',
};

describe('employee form hints', () => {
  it('requires the create essentials', () => {
    expect(Object.keys(formHints({ ...base, firstName: '', doj: '', orgUnit: '', companyCode: '' }, true)).sort()).toEqual(['companyCode', 'doj', 'firstName', 'orgUnit']);
    expect(formHints({ ...base, firstName: '' }, false).firstName).toBeUndefined();
  });
  it('refuses minors and DOB after DOJ', () => {
    expect(formHints({ ...base, dob: '2010-01-01' }, true).dob).toMatch(/minors/);
    expect(formHints({ ...base, dob: '2027-01-01' }, true).dob).toMatch(/before/);
    expect(formHints({ ...base, dob: '1998-07-14' }, true).dob).toBeUndefined();
  });
  it('checks identity formats', () => {
    const h = formHints({ ...base, pan: 'ABCDE1234F', uan: '123', esicNo: '12', bankIfsc: 'HDFC1234567', bankAccount: '12', mobile: '12345', workEmail: 'x' }, true);
    expect(Object.keys(h).sort()).toEqual(['bankAccount', 'bankIfsc', 'esicNo', 'mobile', 'pan', 'uan', 'workEmail']);
    expect(formHints({ ...base, pan: 'ABCPG1234K', aadhaar: '234123412346', uan: '100200300400', esicNo: '1234567890', bankIfsc: 'HDFC0009686', bankAccount: '50100491230000', mobile: '+91 98765 43210' }, true)).toEqual({});
  });
});
