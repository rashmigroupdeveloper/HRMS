/**
 * EPS membership for a pay month (REQ-003 / RQ-JF-014; EPS 1995 para 6A + GSR 609(E) of 22-Aug-2014,
 * para 43A for international workers). Pure.
 *
 * - Age: no EPS once the member is 58 on the first day of the pay month (EPS stops at 58; the month of
 *   the 58th birthday is the last contributory month unless the birthday is the 1st).
 * - HR-confirmed decision `eps_eligible` (from Form 11 / previous PF records) wins over the derivation.
 * - Member of EPF before 01-Sep-2014 (Form 11 item, or first EPF enrolment before that date) → EPS.
 * - New member (first enrolment on/after 01-Sep-2014) whose PF wages at first enrolment exceeded ₹15,000
 *   → no EPS: the whole employer 12% goes to EPF.
 * - Wages at first enrolment: Form 11 value, else — only when Form 11 says "not an earlier member" —
 *   the PF wages of our joining salary. Unknown (no Form 11) → EPS, the existing behaviour, so an
 *   employee without Form 11 data never loses EPS silently.
 * International workers follow the same membership rules; for them PF has no wage ceiling (engine).
 */
export const EPS_CUTOFF_DATE = '2014-09-01';
const EPS_WAGE_CEILING_PAISE = 1_500_000;

export interface EpsEligibilityInput {
  monthStart: string;
  dob: string | null;
  doj: string | null;
  /** HR-confirmed decision; null = derive. */
  epsEligible: boolean | null;
  memberBeforeSep2014: boolean | null;
  firstEnrolledOn: string | null;
  /** PF wages (paise) at first EPF enrolment (Form 11); null = not captured. */
  firstEnrolmentPfWagesPaise: number | null;
  /** PF wages (paise) of the joining salary here; used for a fresh member (memberBeforeSep2014 === false). */
  joiningPfWagesPaise?: number | null | undefined;
}

export type EpsReason = 'age_58' | 'hr_decision' | 'member_before_sep_2014' | 'new_member_above_ceiling' | 'new_member_within_ceiling' | 'wages_unknown';

export function epsEligibility(i: EpsEligibilityInput): { eligible: boolean; reason: EpsReason } {
  if (i.dob) {
    const [y, m, d] = i.dob.split('-').map(Number);
    const fiftyEight = `${String((y ?? 0) + 58)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (fiftyEight <= i.monthStart) return { eligible: false, reason: 'age_58' };
  }
  if (i.epsEligible !== null) return { eligible: i.epsEligible, reason: 'hr_decision' };
  const enrolled = i.firstEnrolledOn ?? i.doj;
  if (i.memberBeforeSep2014 === true || (enrolled !== null && enrolled < EPS_CUTOFF_DATE)) return { eligible: true, reason: 'member_before_sep_2014' };
  const wages = i.firstEnrolmentPfWagesPaise ?? (i.memberBeforeSep2014 === false ? (i.joiningPfWagesPaise ?? null) : null);
  if (wages === null) return { eligible: true, reason: 'wages_unknown' };
  return wages > EPS_WAGE_CEILING_PAISE
    ? { eligible: false, reason: 'new_member_above_ceiling' }
    : { eligible: true, reason: 'new_member_within_ceiling' };
}
