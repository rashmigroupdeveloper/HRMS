import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createPolicyInput, updatePolicyInput } from './policies.schema.js'
import * as policiesService from './policies.service.js'

// attendance.policies.* (2026-11-22) - read: any logged-in employee (retired ones: Attendance setup: View); set up: Attendance:
// Edit for all companies (checked in the service).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const policiesRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => policiesService.listPolicies(context.user, input?.includeInactive)),
  create: editProcedure.input(createPolicyInput).handler(({ input, context }) => policiesService.createPolicy(input, context.user)),
  update: editProcedure.input(updatePolicyInput).handler(({ input, context }) => policiesService.updatePolicy(input, context.user)),
}
