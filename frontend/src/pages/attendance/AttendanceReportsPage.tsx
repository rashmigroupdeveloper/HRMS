import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import { AttendanceReportView } from './components/AttendanceReportView'

export function AttendanceReportsPage() {
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const { to } = usePortal()
  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><h1 className="mt-1 text-2xl font-light sm:text-3xl tracking-tight">Attendance reports</h1></div>
      <Link className="flex min-h-10 items-center text-sm underline underline-offset-4" to={to('/team-attendance')}><span className="sm:hidden">Team</span><span className="hidden sm:inline">Team attendance</span></Link>
    </header>
    <FormError error={overview.error} />
    <AttendanceReportView overview={overview.data} overviewFailed={overview.isError} />
  </div>
}
