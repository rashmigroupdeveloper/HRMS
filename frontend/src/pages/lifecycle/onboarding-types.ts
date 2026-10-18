/** LC-01/02: frontend HTTP views and form state. */
export interface CandidateItem {
  id: number;
  atsCandidateId?: number | null;
  loiReference?: string | null;
  fullName: string;
  personalEmail: string;
  mobile: string;
  positionTitle: string;
  department?: string | null;
  companyId?: number | null;
  offeredCtc: string;
  proposedDoj: string;
  status: 'awaiting_prejoin' | 'link_sent' | 'prejoin_done' | 'converted' | 'no_show';
  prejoinCompletedAt?: string | null;
  employeeId?: number | null;
  hasPrejoinData?: boolean;
}

export interface StakeholderTaskItem {
  ecode: string;
  employeeName: string;
  id: number;
  employeeId: number;
  taskCode: string;
  taskName: string;
  department: 'IT' | 'Admin' | 'HR' | 'Payroll';
  ownerRole: string;
  dueDate: string;
  slaHours: number;
  status: 'open' | 'completed' | 'escalated';
  doneAt?: string | null;
}

export interface ReferenceCatalog {
  companies: { id: number; name: string; ecodePrefix: string }[];
  departments: SelectOptionSource[];
  designations: SelectOptionSource[];
  orgUnits: SelectOptionSource[];
  locations: SelectOptionSource[];
  salaryStructures: SelectOptionSource[];
}
export interface SelectOptionSource {
  id: number;
  name: string;
}

export interface IngestForm {
  fullName: string;
  personalEmail: string;
  mobile: string;
  positionTitle: string;
  department: string;
  companyId: string;
  offeredCtc: string;
  proposedDoj: string;
  offerDate: string;
  totalExperienceYears: string;
  previousCompany: string;
}
export interface JoiningForm {
  orgUnitId: string;
  companyId: string;
  departmentId: string;
  designationId: string;
  locationId: string;
  workEmail: string;
  doj: string;
  salaryStructureId: string;
}
