import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, History } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { client, orpc } from '@/lib/orpc'
import { cn, downloadFile, formatDoneBy } from '@/lib/utils'

// Excel import of employees (Employees: Edit): download the template, fill one row per employee, check the file (every
// row with its problems - and whether it adds a new employee or updates one already here), then save it - all rows or
// none. A row whose code is already used updates that employee; its empty cells keep what is saved (2026-11-16). New
// employees keep their codes and get no login (give logins on the Roles & access page). The history lists the files
// imported and the ones with problems - their rows to fix can be downloaded as an Excel file.

export function ImportEmployeesDrawer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const history = useQuery(orpc.employees.imports.history.queryOptions())
  const refreshHistory = () => void queryClient.invalidateQueries({ queryKey: orpc.employees.imports.history.key() })
  const check = useMutation(orpc.employees.imports.upload.mutationOptions({ onSuccess: refreshHistory }))
  const save = useMutation(
    orpc.employees.imports.upload.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.employees.key() }) }),
  )
  const report = (id: number) => {
    setReportError(null)
    void downloadFile(() => client.employees.imports.errorReport({ id }), setReportError)
  }
  const result = save.data ?? check.data
  const saved = save.data?.saved === true
  // problems first, then the rest in file order
  const rows = [...(result?.rows ?? [])].sort((a, b) => Number(b.errors.length > 0) - Number(a.errors.length > 0) || a.rowNumber - b.rowNumber)

  const choose = (picked: File | null) => {
    setFile(picked)
    check.reset()
    save.reset()
    if (picked) check.mutate({ file: picked })
  }

  return (
    <FormDrawer
      onClose={onClose}
      // a file chosen and not imported yet
      dirty={!!file && !saved}
      width={760}
      title="Import employees from Excel"
      description="Add the employees who are already working here, or update many at once. Every row is checked first; nothing is saved until every row is correct."
      footer={
        <>
          <DrawerCancel>{saved ? 'Close' : 'Cancel'}</DrawerCancel>
          {!saved && (
            <Button
              variant="gold"
              disabled={!file || !result || result.withErrors > 0 || save.isPending || check.isPending}
              onClick={() => file && save.mutate({ file, save: true })}
            >
              {save.isPending ? 'Saving…' : result && result.withErrors === 0 ? `Save ${result.total} row${result.total === 1 ? '' : 's'}` : 'Save'}
            </Button>
          )}
        </>
      }
    >
      <ol className="space-y-4">
        <li className="flex items-start gap-3">
          <Step n={1} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Download the template and fill one row per employee</p>
            <p className="text-xs text-muted-foreground">
              Dropdowns list the companies, locations, departments, designations and grades. A new employee: their code, or empty for the next code of the
              company&apos;s series. An employee already here: their code, and only the cells to change - empty cells keep what is saved.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void downloadFile(() => client.employees.imports.template(), setTemplateError)}>
              <Download /> Download the template
            </Button>
            {templateError && <p className="text-xs text-negative-ink">{templateError}</p>}
          </div>
        </li>
        <li className="flex items-start gap-3">
          <Step n={2} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Choose the filled-in file - it is checked straight away</p>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/50 px-4 py-3 text-sm hover:border-foreground/30">
              <FileSpreadsheet className="size-5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Choose an .xlsx file'}</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={save.isPending}
                onChange={(e) => {
                  choose(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </li>
      </ol>

      {check.isPending && <p className="text-sm text-muted-foreground">Checking every row…</p>}
      <FormError error={check.error ?? save.error} />

      {result && (
        <section className="space-y-3">
          <p
            className={cn(
              'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
              result.withErrors ? 'bg-destructive/10 text-negative-ink' : 'bg-positive/10 text-positive-ink',
            )}
          >
            {result.withErrors ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
            <span className="flex-1">
              {saved
                ? `Saved: ${result.toAdd} employee${result.toAdd === 1 ? '' : 's'} added, ${result.toUpdate} updated.${result.toAdd ? ' Give the new ones logins on the Roles & access page.' : ''}`
                : result.withErrors
                  ? `${result.withErrors} of ${result.total} rows have problems. Fix them in the file and choose it again - nothing was saved.`
                  : `All ${result.total} rows are correct: ${result.toAdd} to add, ${result.toUpdate} to update. Save them with the button below.`}
            </span>
            {result.withErrors > 0 && result.importId && (
              <Button variant="secondary" size="sm" className="shrink-0" onClick={() => report(result.importId!)}>
                <Download /> Rows to fix (Excel)
              </Button>
            )}
          </p>
          {reportError && <p className="text-xs text-negative-ink">{reportError}</p>}
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-14 px-3 py-2 font-medium">Row</th>
                  <th className="w-32 px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="w-24 px-3 py-2 font-medium">Does</th>
                  <th className="px-3 py-2 font-medium">{saved ? '' : 'Problems'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rowNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{row.employeeCode ?? <span className="text-muted-foreground">next code</span>}</td>
                    <td className="px-3 py-2">{row.name || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={cn('rounded-full px-2 py-0.5', row.action === 'ADD' ? 'bg-positive/10 text-positive-ink' : 'bg-surface-2')}>
                        {row.action === 'ADD' ? 'Adds' : 'Updates'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.errors.length ? (
                        <ul className="space-y-0.5 text-xs text-negative-ink">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-positive-ink">{saved ? 'Saved' : 'OK'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* the files imported and the ones with problems (newest first) */}
      {!!history.data?.length && (
        <section className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4" /> Earlier imports
          </p>
          <ul className="divide-y divide-border/70 rounded-2xl border border-border text-sm">
            {history.data.slice(0, 10).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDoneBy(h.createdAt, h.by)} ·{' '}
                    {h.status === 'DONE' ? `${h.createdCount} added, ${h.updatedCount} updated` : `not saved - ${h.rowCount} rows checked, problems found`}
                  </span>
                </span>
                {h.status === 'FAILED' && (
                  <Button variant="ghost" size="sm" onClick={() => report(h.id)}>
                    <Download /> Rows to fix
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </FormDrawer>
  )
}

function Step({ n }: { n: number }) {
  return <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold">{n}</span>
}
