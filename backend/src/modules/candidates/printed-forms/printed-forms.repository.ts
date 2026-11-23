import { prisma, type DbClient } from '#core/db/prisma'

// Data access for the printed joining forms: what the forms print about the candidate's offer and the employer
// (the joining form itself comes from the joining-form draft).

export function findForPrint(candidateId: number, db: DbClient = prisma) {
  return db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      status: true,
      salutation: true,
      firstName: true,
      middleName: true,
      lastName: true,
      mobile: true,
      personalEmail: true,
      joiningType: true,
      employmentType: true,
      proposedJoiningDate: true,
      // the establishment / employer on Form F and ESIC Form 1
      company: {
        select: { name: true, address: true, postalCode: true, region: true, countryCode: true, esicEmployerCode: true, pfEstablishmentCode: true },
      },
      workLocation: { select: { name: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      grade: { select: { name: true } },
    },
  })
}
