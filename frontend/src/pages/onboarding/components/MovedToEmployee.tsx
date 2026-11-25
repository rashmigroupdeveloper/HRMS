import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// Shown in a candidate tab once the candidate has joined: that data now lives in the employee record.
export function MovedToEmployee({ what, employeeCode }: { what: string; employeeCode: string }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-5 shadow-card">
      <p className="text-sm text-muted-foreground">
        The candidate joined as <strong className="text-foreground">{employeeCode}</strong> - the {what} moved to the employee record.
      </p>
      <Button variant="secondary" nativeButton={false} render={<Link to={`/manage/employees/${employeeCode}`} />}>
        Open employee profile <ArrowRight />
      </Button>
    </section>
  )
}
