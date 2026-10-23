/** LC-01: joining forms RML/HR/02/01 — regular, consultant/intern, overseas. */
export type JoiningFormKind = 'regular' | 'consultant' | 'overseas';

interface GridRow { qualification: string; institute: string; year: string }
interface FamilyGridRow { name: string; relation: string; gender: string }
interface NominationGridRow { scheme: string; name: string; relation: string; share: string; address: string }

export const EMPTY_PREJOIN_FORM = {
  formKind: 'regular' as JoiningFormKind,
  fatherName: '',
  gender: '',
  maritalStatus: '',
  nationality: '',
  passportNo: '',
  presentAddress: '',
  permanentAddress: '',
  presentHouse: '',
  presentCity: '',
  presentDistrict: '',
  presentState: '',
  presentPin: '',
  permanentHouse: '',
  permanentCity: '',
  permanentDistrict: '',
  permanentState: '',
  permanentPin: '',
  sameAsPresent: false,
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  nomineeName: '',
  nomineeRelation: '',
  education: '',
  previousEmployment: '',
  family: '',
  educationRows: [{ qualification: '', institute: '', year: '' }] as GridRow[],
  familyRows: [{ name: '', relation: '', gender: '' }] as FamilyGridRow[],
  nominations: [{ scheme: 'gratuity', name: '', relation: '', share: '100', address: '' }] as NominationGridRow[],
  medicalNotes: '',
  declarationAccepted: false,
  bloodGroup: '',
  pan: '',
  aadhaar: '',
  uan: '',
  esicNo: '',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
};

export type PrejoinForm = typeof EMPTY_PREJOIN_FORM;

function pinOk(pin: string): boolean {
  return pin.trim() === '' || /^[1-9]\d{5}$/.test(pin.trim());
}

/** Step 0 you and address, 1 statutory and bank, 2 grids, 3 declaration. */
export function stepError(form: PrejoinForm, step: number): string | null {
  if (step === 0) {
    if (!pinOk(form.presentPin) || !pinOk(form.permanentPin)) return 'PIN is 6 digits and does not start with 0.';
    if (form.presentAddress.trim().length < 5 || form.permanentAddress.trim().length < 5)
      return 'Enter complete present and permanent addresses.';
    if (
      form.emergencyContactName.trim().length < 2 ||
      form.emergencyContactPhone.trim().length < 10 ||
      form.emergencyContactRelation.trim().length < 2
    )
      return 'Enter the emergency contact name, phone and relationship.';
    if (form.formKind === 'overseas' && form.passportNo.trim().length < 6)
      return 'Overseas joining needs a passport number of at least 6 characters.';
  }
  if (step === 1 && form.formKind !== 'overseas') {
    if (form.pan.trim().length !== 10) return 'PAN must contain exactly 10 characters.';
    if (form.aadhaar.trim().length !== 12) return 'Aadhaar must contain exactly 12 digits.';
    if (form.bankName.trim().length < 2 || form.bankAccount.trim().length < 8 || form.bankIfsc.trim().length !== 11)
      return 'Enter the bank name, account number and 11-character IFSC.';
  }
  if (step === 1 && form.formKind === 'overseas') {
    if (form.bankName.trim().length < 2 || form.bankAccount.trim().length < 8 || form.bankIfsc.trim().length !== 11)
      return 'Enter the bank name, account number and 11-character IFSC.';
  }
  if (step === 2) {
    for (const row of form.educationRows) {
      if ((row.qualification.trim() || row.institute.trim()) && (!row.qualification.trim() || !row.institute.trim()))
        return 'Each education row needs both the qualification and the institute.';
    }
    for (const row of form.familyRows) {
      if ((row.name.trim() || row.relation.trim()) && (!row.name.trim() || !row.relation.trim()))
        return 'Each family row needs both the name and the relationship.';
    }
    const totals = new Map<string, number>();
    for (const row of form.nominations) {
      if (!row.name.trim()) continue;
      if (!row.relation.trim() || row.address.trim().length < 5) return 'Each nominee needs a relationship and an address.';
      totals.set(row.scheme, (totals.get(row.scheme) ?? 0) + Number(row.share));
    }
    for (const [scheme, total] of totals) {
      if (Math.abs(total - 100) > 0.01) return `${scheme} nominations must total 100%.`;
    }
  }
  if (step === 3 && !form.declarationAccepted) return 'Accept the declaration before sending the form.';
  return null;
}

export function structured(house: string, city: string, district: string, state: string, pin: string) {
  if (!house.trim() || !city.trim() || !district.trim() || state.trim().length !== 2 || !/^[1-9]\d{5}$/.test(pin.trim())) return undefined;
  return { house: house.trim(), city: city.trim(), district: district.trim(), stateCode: state.trim().toUpperCase(), pin: pin.trim() };
}

export function educationRows(form: PrejoinForm) {
  return form.educationRows
    .filter((row) => row.qualification.trim() && row.institute.trim())
    .map((row) => ({
      qualification: row.qualification.trim(),
      institute: row.institute.trim(),
      ...(row.year.trim() ? { yearOfPassing: Number(row.year) } : {}),
    }));
}

export function familyRows(form: PrejoinForm) {
  return form.familyRows
    .filter((row) => row.name.trim() && row.relation.trim())
    .map((row) => ({
      name: row.name.trim(),
      relation: row.relation.trim(),
      ...(row.gender === 'Male' || row.gender === 'Female' || row.gender === 'Transgender' ? { gender: row.gender } : {}),
    }));
}

export function nominationRows(form: PrejoinForm) {
  const rows = form.nominations.filter((row) => row.name.trim());
  return rows.map((row) => ({
    scheme: row.scheme as 'pf' | 'eps' | 'gratuity' | 'esic' | 'gpa',
    nomineeName: row.name.trim(),
    relation: row.relation.trim(),
    sharePct: Number(row.share),
    address: row.address.trim(),
  }));
}

export function validatePrejoinForm(form: PrejoinForm): string | null {
  for (let step = 0; step < 4; step += 1) {
    const error = stepError(form, step);
    if (error) return error;
  }
  return null;
}
