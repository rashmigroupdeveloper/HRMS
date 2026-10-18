/** LC-01: no invented personal/medical defaults; align required fields with the application contract. */
export const EMPTY_PREJOIN_FORM = {
  presentAddress: '',
  permanentAddress: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  bloodGroup: '',
  pan: '',
  aadhaar: '',
  uan: '',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
};
export function validatePrejoinForm(form: typeof EMPTY_PREJOIN_FORM): string | null {
  if (form.presentAddress.trim().length < 5 || form.permanentAddress.trim().length < 5)
    return 'Enter complete present and permanent addresses.';
  if (
    form.emergencyContactName.trim().length < 2 ||
    form.emergencyContactPhone.trim().length < 10 ||
    form.emergencyContactRelation.trim().length < 2
  )
    return 'Enter the emergency contact name, phone and relationship.';
  if (form.pan.trim().length !== 10) return 'PAN must contain exactly 10 characters.';
  if (form.aadhaar.trim().length !== 12) return 'Aadhaar must contain exactly 12 digits.';
  if (
    form.bankName.trim().length < 2 ||
    form.bankAccount.trim().length < 8 ||
    form.bankIfsc.trim().length !== 11
  )
    return 'Enter the bank name, account number and 11-character IFSC.';
  return null;
}
