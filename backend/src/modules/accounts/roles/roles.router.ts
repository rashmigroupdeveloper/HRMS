import { accessProcedure } from '#core/rpc/procedures'
import { createRoleInput, roleIdInput, updateRoleInput } from './roles.schema.js'
import * as accountsService from '../accounts.service.js'
import * as rolesService from './roles.service.js'

// accounts.roles.* - routes + controller layer. Viewing: ACCESS READ; changing: ACCESS WRITE.
const viewProcedure = accessProcedure('ACCESS', 'READ')
const changeProcedure = accessProcedure('ACCESS', 'WRITE')

export const rolesRouter = {
  list: viewProcedure.handler(() => rolesService.listRoles()),
  // Roles x access and who has which role, as an Excel file
  export: viewProcedure.handler(({ context }) => accountsService.exportAccess(context.user)),
  create: changeProcedure.input(createRoleInput).handler(({ input, context }) => rolesService.createRole(input, context.user)),
  update: changeProcedure.input(updateRoleInput).handler(({ input, context }) => rolesService.updateRole(input, context.user)),
  delete: changeProcedure.input(roleIdInput).handler(({ input, context }) => rolesService.deleteRole(input.id, context.user)),
}
