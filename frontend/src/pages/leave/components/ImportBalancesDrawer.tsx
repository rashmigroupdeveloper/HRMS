import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { cn, downloadFile } from '@/lib/utils'

// Opening balances from Excel (2026-11-22, the old HRMS's importer): download the template, fill in each employee's balance
// per leave type, upload it - every row is checked first and shown; it is saved only when no row is wrong (all rows or
// none). The difference from today's balance becomes an adjustment with the row's note.
export function ImportBalancesDrawer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const check = useMutation(orpc.leave.balances.importBalances.mutationOptions())
  const save = useMutation(
    orpc.leave.balances.importBalances.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
        setDone(true)
      },
    }),
  )
  const r = check.data
  const ready = !!file && !!r && r.problems === 0 && r.changes > 0
  return (
    <FormDrawer
      onClose={onClose}
      closed={done}
      dirty={!!file && !done}
      width={720}
      title="Import opening balances"
      description="One row per employee and leave type: the balance to set as of today. Every row is checked first; nothing is saved while a row is wrong."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={!ready || save.isPending} onClick={() => file && save.mutate({ file, save: true })}>
            {save.isPending ? 'Saving…' : r && ready ? `Save ${r.changes} ${r.changes === 1 ? 'balance' : 'balances'}` : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setTemplateError(null)
            void downloadFile(() => client.leave.balances.importTemplate(), setTemplateError)
          }}
        >
          <Download /> Template
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <Upload className="size-4" />
          {file ? file.name : 'Choose the filled-in file (.xlsx)'}
          <input
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null
              setFile(picked)
              save.reset()
              if (picked) check.mutate({ file: picked, save: false })
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {templateError && <p className="text-xs text-negative-ink">{templateError}</p>}
      <FormError error={check.error ?? save.error} />
      {check.isPending && <p className="text-sm text-muted-foreground">Checking the rows…</p>}
      {r && !check.isPending && (
        <>
          <p className={cn('rounded-xl px-3 py-2 text-sm', r.problems ? 'bg-warning/15 text-warning-ink' : 'bg-positive/10 text-positive-ink')}>
            {r.rows.length} rows: {r.problems ? `${r.problems} wrong - fix them in the file and choose it again.` : `all right - ${r.changes} change a balance, ${r.rows.length - r.changes} already have it.`}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave</TableHead>
                  <TableHead className="text-right">Now</TableHead>
                  <TableHead className="text-right">Set to</TableHead>
                  <TableHead>Note / problem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* the wrong rows first */}
                {[...r.rows].sort((a, b) => Number(!!b.problem) - Number(!!a.problem)).map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="text-muted-foreground tabular-nums">{row.rowNumber}</TableCell>
                    <TableCell>
                      <span className="block">{row.name ?? '—'}</span>
                      <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{row.leaveType ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.current ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.balance ?? '—'}
                      {!!row.change && <span className={cn('block text-xs', row.change > 0 ? 'text-positive-ink' : 'text-negative-ink')}>{row.change > 0 ? `+${row.change}` : row.change}</span>}
                    </TableCell>
                    <TableCell className={cn('text-xs', row.problem ? 'text-negative-ink' : 'text-muted-foreground')}>{row.problem ?? row.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </FormDrawer>
  )
}
