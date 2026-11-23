// Gives an employee a login, or resets their password (logs them out everywhere).
//
//   npm run set-password -- <employeeCode> [--role "<role name>"] [--password <password>]
//
// Without --password a random one is generated. The password is printed ONCE - hand it over safely.
// It is temporary: the employee must change it at the next sign-in.
// --role adds that role (by name, e.g. "Super Admin" or "HR") and keeps the roles the login already has.
// This is also how the first super admin is made; after that, roles are given on the "Roles & access" page.
import { generatePassword } from '#core/auth/password'
import { accountsService } from '#modules/accounts'

const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const employeeCode = args[0]?.trim().toUpperCase()
const roleName = option('--role')

if (!employeeCode || employeeCode.startsWith('--')) {
  console.error('Usage: npm run set-password -- <employeeCode> [--role "<role name>"] [--password <password>]')
  process.exit(1)
}

const password = option('--password') ?? generatePassword()

try {
  const result = await accountsService.setPassword(employeeCode, password, roleName)
  const roles = result.roles.length ? result.roles.join(', ') : 'none (self-service only)'
  console.log(`Login set for ${result.employeeCode} (${result.name}), roles: ${roles}, status ${result.status}`)
  console.log(`Temporary password: ${password}  (must be changed at the next sign-in)`)
  if (result.status !== 'ACTIVE' && result.status !== 'ON_NOTICE') console.log('Note: this employee cannot log in (status).')
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
