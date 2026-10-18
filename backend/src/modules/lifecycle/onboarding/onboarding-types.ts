/** LC-01: conversion contract shared without a service/validator dependency cycle. */
export interface ConvertCandidateInput {
  joiningConfirmed: boolean;
  candidateId: number;
  companyId: number;
  designationId: number;
  departmentId: number;
  locationId: number;
  orgUnitId: number;
  gradeId?: number | null | undefined;
  reportingManagerId?: number | null | undefined;
  workEmail?: string | null | undefined;
  doj: string;
  salaryStructureId?: number | null | undefined;
}

