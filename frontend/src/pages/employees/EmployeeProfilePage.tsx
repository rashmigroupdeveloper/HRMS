import { Navigate, useLocation, useParams } from 'react-router'
import { useAccess } from '@/hooks/useAccess'
import { EmployeeProfile } from './components/EmployeeProfile'

// HR's view of an employee's profile (/employees/:code). One's own code goes to /me (the employee's own profile) -
// checked first, so an old link to one's own code works without access; any other code needs Employees: View.
export function EmployeeProfilePage() {
  const { employeeCode = '' } = useParams()
  const { me, ready, can } = useAccess()
  const { search } = useLocation()
  if (me && me.employeeCode === employeeCode.toUpperCase()) return <Navigate to={`/ess/me${search}`} replace />
  // (until accounts.me answers the profile shows its skeleton - its own query is refused without access anyway)
  if (ready && !can('EMPLOYEES')) return <Navigate to="/" replace />
  return <EmployeeProfile key={employeeCode} employeeCode={employeeCode} self={false} />
}
