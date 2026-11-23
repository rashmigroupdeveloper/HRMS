import { prisma } from '#core/db/prisma'
import { env } from '#core/config/env'
import { accountsService } from '#modules/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'

// A new joiner's login e-mail (found in the 2026-11-23 review): with no mail server the e-mail is only saved in the outbox
// folder - it was still reported as e-mailed, so HR was never shown the temporary password and the employee never got it.
describe('the new login e-mail', () => {
  let employeeCode: string

  beforeAll(async () => {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    employeeCode = employee.employeeCode
    // test data: the personal e-mail the login goes to
    await prisma.employee.update({ where: { id: employee.id }, data: { personalEmail: `login.${employeeCode.toLowerCase()}@example.com` } })
  })
  afterAll(() => prisma.$disconnect())

  it('runs with no mail server - the tests never send real e-mail', () => {
    expect(env.SMTP_HOST).toBeUndefined()
  })

  it('is not "e-mailed" when it was only saved in the outbox - HR passes the password on', async () => {
    expect((await accountsService.emailNewLogin(employeeCode, 'Temp-Pass-123')).emailedTo).toBeNull()
  })
})
