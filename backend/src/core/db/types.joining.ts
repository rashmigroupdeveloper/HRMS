/**
 * Joining-form master (RML/HR/02/01 pack C) — REQ-002..008, REQ-015.
 * Kept in its own file so the employee table extension merges cleanly.
 */
import type { ColumnType, Generated } from 'kysely';

type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type DateCol = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type Num = ColumnType<string | null, string | number | null | undefined, string | number | null>;

export type GenderCode = 'Male' | 'Female' | 'Transgender';
export type NominationScheme = 'pf' | 'eps' | 'gratuity' | 'esic' | 'gpa' | 'gmc' | 'gtli';

/** Columns added to core.employees by 1752900000100 (and the shared EPS five). */
export interface EmployeesJoiningColumns {
  father_name: string | null;
  spouse_name: string | null;
  form11_relative: Generated<'father' | 'spouse'>;
  marriage_date: DateCol;
  nationality: string | null;
  country_of_origin: string | null;
  religion: string | null;
  caste: string | null;
  height_cm: Num;
  weight_kg: Num;
  is_pwd: Generated<boolean>;
  disability_type: string | null;
  disability_pct: Num;
  identification_mark: string | null;
  passport_no: string | null;
  passport_valid_until: DateCol;
  driving_licence_no: string | null;
  driving_licence_valid_until: DateCol;
  name_as_per_aadhaar: string | null;
  aadhaar_linked_mobile: boolean | null;
  emergency_contact_relation: string | null;
  emergency_contact_alt_phone: string | null;
  emergency_contact_address: string | null;
  bank_branch: string | null;
  bank_account_holder: string | null;
  bank_account_type: 'savings' | 'current' | null;
  joining_form_date: DateCol;
  bgv_status: 'not_started' | 'initiated' | 'cleared' | 'failed' | 'not_applicable' | null;
  induction_date: DateCol;
  joining_signed_off_by: number | null;
  joining_signed_off_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface FamilyJoiningColumns {
  gender: GenderCode | null;
  address: string | null;
  residing_with_employee: boolean | null;
  residing_town: string | null;
  residing_state_code: string | null;
  occupation: string | null;
  is_dependent: Generated<boolean>;
}

export interface DocumentsJoiningColumns {
  candidate_id: number | null;
  doc_type: string | null;
  verification_status: 'pending' | 'verified' | 'rejected' | null;
  verified_by: number | null;
  verified_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  rejection_reason: string | null;
  sha256: string | null;
  document_number: string | null;
}

export interface CandidateJoiningColumns {
  prejoin_draft_data: unknown;
  gender: GenderCode | null;
}

export interface EmployeeAddressesTable {
  id: Generated<number>;
  employee_id: number;
  kind: 'present' | 'permanent';
  house: string;
  locality: string | null;
  city: string;
  post_office: string | null;
  police_station: string | null;
  sub_division: string | null;
  district: string;
  state_code: string;
  country_code: Generated<string>;
  pin: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeEducationTable {
  id: Generated<number>;
  employee_id: number;
  qualification: string;
  institute: string;
  year_of_passing: number | null;
  specialization: string | null;
  score: Num;
  score_type: 'percent' | 'cgpa' | null;
  sort_order: Generated<number>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeCertificationsTable {
  id: Generated<number>;
  employee_id: number;
  name: string;
  issuer: string;
  issued_on: DateCol;
  expires_on: DateCol;
  specialization: string | null;
  grade: string | null;
  sort_order: Generated<number>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeExperienceTable {
  id: Generated<number>;
  employee_id: number;
  employer: string;
  designation: string | null;
  from_date: ColumnType<Date, Date | string, Date | string>;
  to_date: DateCol;
  reason_for_leaving: string | null;
  last_ctc: Num;
  sort_order: Generated<number>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeStatutoryProfileTable {
  employee_id: number;
  epf_prev_member: boolean | null;
  eps_prev_member: boolean | null;
  prev_pf_number: string | null;
  prev_exit_date: DateCol;
  scheme_certificate_no: string | null;
  ppo_no: string | null;
  epf_withdrawn: boolean | null;
  eps_withdrawn: boolean | null;
  eps_withdrawn_after_sep2014: boolean | null;
  kyc_status: 'not_uploaded' | 'uploaded_pending' | 'approved' | 'rejected' | null;
  transfer_request_status: 'not_needed' | 'pending' | 'submitted' | 'completed' | null;
  esic_prev_ip_number: string | null;
  esic_prev_employer_code: string | null;
  esic_prev_employer_name: string | null;
  esic_prev_employer_address: string | null;
  esic_branch_office: string | null;
  esic_dispensary: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeNominationsTable {
  id: Generated<number>;
  employee_id: number;
  scheme: NominationScheme;
  version: number;
  status: Generated<'active' | 'superseded'>;
  family_member_id: number | null;
  nominee_name: string;
  relation: string;
  dob: DateCol;
  gender: GenderCode | null;
  address: string;
  share_pct: ColumnType<string, string | number, string | number>;
  guardian_name: string | null;
  guardian_relation: string | null;
  guardian_address: string | null;
  created_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface NominationDeclarationsTable {
  id: Generated<number>;
  employee_id: number;
  scheme: NominationScheme;
  version: number;
  status: Generated<'active' | 'superseded'>;
  statements: ColumnType<Record<string, unknown>, string | undefined, string>;
  witness1_name: string | null;
  witness1_address: string | null;
  witness2_name: string | null;
  witness2_address: string | null;
  declared_at: DefaultedTimestamp;
  declared_by: number | null;
  employer_verified_by: number | null;
  employer_verified_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  employer_reference_no: string | null;
  employer_signatory_designation: string | null;
  employee_acknowledged_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PrvDeclarationTextsTable {
  id: Generated<number>;
  kind: string;
  version: number;
  title: string;
  body: string;
  sha256: string;
  is_current: Generated<boolean>;
  created_at: DefaultedTimestamp;
}

export interface PrvDeclarationsTable {
  id: Generated<number>;
  text_id: number;
  kind: string;
  text_version: number;
  text_sha256: string;
  candidate_id: number | null;
  employee_id: number | null;
  actor_user_id: number | null;
  accepted: boolean;
  signature_kind: 'typed' | 'drawn';
  signed_name: string;
  signature_document_id: number | null;
  ip: string | null;
  user_agent: string | null;
  accepted_at: DefaultedTimestamp;
}

export interface MedQuestionnairesTable {
  id: Generated<number>;
  employee_id: number | null;
  candidate_id: number | null;
  consent_declaration_id: number;
  answers: ColumnType<Record<string, unknown>, string, string>;
  height_cm: Num;
  weight_kg: Num;
  bmi: ColumnType<string | null, never, never>;
  retention_class: Generated<string>;
  status: Generated<'active' | 'withdrawn'>;
  withdrawn_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  submitted_by_user_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface MedAccessLogTable {
  id: Generated<number>;
  questionnaire_id: number | null;
  employee_id: number | null;
  actor_user_id: number | null;
  action: 'read' | 'write' | 'withdraw' | 'denied';
  reason: string | null;
  ip: string | null;
  occurred_at: DefaultedTimestamp;
}
