import { useAccess } from '@/hooks/useAccess'
import { ApprovalChains } from './components/ApprovalChains'

// Approval chains (/approval-chains - the user, 2026-11-20: its own page and access area, apart from Roles & access): the
// steps each kind of request goes through. "Approval chains" View sees them; Edit sets them (the shared chains with Edit
// for all companies, a company's own chain with Edit for that whole company) and repairs held requests (Approvals page).
export function ApprovalChainsPage() {
  const { can } = useAccess()
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Administration</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Approval rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
          Who approves each kind of request, step by step.
        </p>
      </div>
      <ApprovalChains canChange={can('APPROVAL_CHAINS', 'WRITE')} />
    </div>
  )
}
