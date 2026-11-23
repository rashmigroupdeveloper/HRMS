import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Search, Upload } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { RegisterSkeleton } from '@/components/skeletons/leave/RegisterSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { cn, downloadFile } from '@/lib/utils'
import { useAccess } from '@/hooks/useAccess'
import { ImportBalancesDrawer } from './ImportBalancesDrawer'
import type { Register } from './labels'

// The leave register (the old HRMS's): everyone in the view with the balance of each leave type (and what waits for
// approval), the Excel file, and - with Leave Edit covering them - HR's adjustment of a balance (opening balances, days
// given, a mistake put right), always with a reason.
type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
type Row = Register['rows'][number]

export function LeaveRegister({ scope }: { scope: Scope }) {
  const [search, setSearch] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<Row | null>(null)
  const [importing, setImporting] = useState(false)
  // the opening balances import: Leave Edit (each row's employee is checked by the backend)
  const canImport = useAccess().can('LEAVE', 'WRITE')
  const input = { scope, search: search.trim() || undefined }
  const register = useQuery({ ...orpc.leave.balances.register.queryOptions({ input }), placeholderData: keepPreviousData })
  const r = register.data
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search by name or code" placeholder="Name or code" className="h-9 rounded-xl pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
              <Upload /> Import
            </Button>
          )}
        <Button
          variant="secondary"
          size="sm"
          disabled={!r?.rows.length}
          onClick={() => {
            setExportError(null)
            void downloadFile(() => client.leave.balances.export(input), setExportError)
          }}
        >
          <Download /> Excel
        </Button>
        </div>
      </div>
      {exportError && <p className="text-xs text-negative-ink">{exportError}</p>}
      <FormError error={register.error} />
      {register.isPending && <RegisterSkeleton label="Loading the leave balances" />}
      {r?.rows.length === 0 && <EmptyState className="py-6" title="Nobody to show" hint="Nobody matches the search." />}
      {!!r?.rows.length && (
        <div className={cn('overflow-x-auto', register.isFetching && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
                {r.types.map((t) => (
                  <TableHead key={t.id} className="text-right" title={t.name}>
                    {t.code}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.rows.map((row) => (
                <TableRow key={row.employeeCode}>
                  {/* sticky and narrow on a phone, so the balances scroll beside the name */}
                  <TableCell className="sticky left-0 z-10 max-w-36 bg-card sm:max-w-none">
                    <span className="block truncate font-medium">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.employeeCode}
                      <span className="max-sm:hidden">
                        {' '}
                        · {row.company}
                        {row.department && ` · ${row.department}`}
                      </span>
                    </span>
                  </TableCell>
                  {r.types.map((t) => {
                    const b = row.balances[t.id]
                    return (
                      <TableCell key={t.id} className="text-right tabular-nums">
                        {!b ? <span className="text-muted-foreground">—</span> : b.balance === null ? <span className="text-muted-foreground">{b.taken} taken</span> : b.balance}
                        {!!b?.pending && <span className="block text-xs text-warning-ink">{b.pending} waiting</span>}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right">
                    {row.canAdjust && (
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(row)}>
                        Adjust
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {importing && <ImportBalancesDrawer onClose={() => setImporting(false)} />}
      {adjusting && r && <AdjustDialog row={adjusting} types={r.types.filter((t) => t.isPaid)} onClose={() => setAdjusting(null)} />}
    </section>
  )
}

function AdjustDialog({ row, types, onClose }: { row: Row; types: Register['types']; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [typeId, setTypeId] = useState(types[0] ? String(types[0].id) : '')
  const [days, setDays] = useState('')
  const [note, setNote] = useState('')
  const adjust = useMutation(
    orpc.leave.balances.adjust.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
        onClose()
      },
    }),
  )
  const value = Number(days)
  const current = row.balances[Number(typeId)]?.balance ?? 0
  const ready = !!typeId && days.trim() !== '' && Number.isFinite(value) && value !== 0 && note.trim().length >= 5
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!days || !!note.trim()} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Adjust {row.name}&apos;s balance</DialogTitle>
        <DialogDescription>Add days (e.g. 5) or take them away (e.g. -2) - an opening balance, days given, a mistake put right. The reason is kept with it.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-type" className="text-xs text-muted-foreground">
              Leave
            </Label>
            <NativeSelect id="adj-type" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((t) => (
                <NativeSelectOption key={t.id} value={String(t.id)}>
                  {t.name} ({t.code}) - {row.balances[t.id]?.balance ?? 0} now
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-days" className="text-xs text-muted-foreground">
              Days (+ / -)
            </Label>
            <Input id="adj-days" type="number" step="0.5" className="h-10 rounded-xl" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        {ready && (
          <p className="text-sm text-muted-foreground">
            {current} → <strong className="text-foreground">{Math.round((current + value) * 100) / 100}</strong>
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="adj-note" className="text-xs text-muted-foreground">
            Why
          </Label>
          <Textarea id="adj-note" className="rounded-xl" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. opening balance from the old system" />
        </div>
      </div>
      <FormError error={adjust.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={!ready || adjust.isPending} onClick={() => adjust.mutate({ employeeCode: row.employeeCode, leaveTypeId: Number(typeId), days: value, note })}>
          {adjust.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
