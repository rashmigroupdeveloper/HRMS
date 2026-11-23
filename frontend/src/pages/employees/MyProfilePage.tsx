import { useAccess } from '@/hooks/useAccess'
import { EmployeeProfile } from './components/EmployeeProfile'

// The employee's own profile (/me, any logged-in employee): what the employee sees of their record - read-only
// (changes are made by HR for now).
export function MyProfilePage() {
  const { me } = useAccess()
  // before accounts.me answers (a hard refresh) the code is not known yet: the profile shows its skeleton meanwhile
  return <EmployeeProfile employeeCode={me?.employeeCode ?? ''} self />
}
