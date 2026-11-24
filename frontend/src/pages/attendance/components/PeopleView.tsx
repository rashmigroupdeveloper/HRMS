import { ExportButton } from '@/components/ExportButton'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { DayBoardSkeleton } from '@/components/skeletons/attendance/DayBoardSkeleton'
import { MonthSkeleton } from '@/components/skeletons/attendance/MonthSkeleton'
import { MusterSkeleton } from '@/components/skeletons/attendance/MusterSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { BOARD_STATE, cycleRange, HALF_STATUSES, type HalfStatus, hours, type MonthDay, MUSTER_TOTALS, segment, SEGMENTS, STATUS, splitFill, statusOfCode } from './labels'
import { useAttendanceMonth, useCycleStartDay } from './useAttendanceMonth'
import { MonthCalendar, MonthPicker, MonthTotals } from './MonthCalendar'

type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'

// The people of a scope - the viewer's team, the employees whose HOD they are, or everyone (Attendance: View): the day's
// board or the month's muster;
// a person opens their month (HR corrects a day there).
export function PeopleView({ scope, canEdit }: { scope: Scope; canEdit: boolean }) {
  const [view, setView] = useState<'board' | 'muster'>('board')
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const companies = useQuery({ ...orpc.organization.companies.list.queryOptions(), enabled: scope === 'ALL' })
  const [person, setPerson] = useState<string | null>(null)
  const [date, setDate] = useState(toDateInput(todayDay()))
  const filter = { scope, search: search.trim() || undefined, companyIds: companyId ? [Number(companyId)] : undefined }
  const moveDay = (step: number) => setDate(toDateInput(new Date(fromDateInput(date)!.getTime() + step * 86_400_000)))

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(SEGMENTS, 'mr-auto')}>
          {(
            [
              ['board', 'Day board'],
              ['muster', 'Month muster'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={segment(view === value)}>
              {label}
            </button>
          ))}
        </div>
        {/* a phone: the search on a line of its own, the company and the day in two equal columns under it */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <div className="relative col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-full rounded-full pl-9 sm:w-56" placeholder="Name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {scope === 'ALL' && (
            <NativeSelect className="w-full sm:w-auto [&_select]:h-9 [&_select]:w-full [&_select]:rounded-full" aria-label="Company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <NativeSelectOption value="">Every company</NativeSelectOption>
              {companies.data?.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          {view === 'board' && (
            <div className={cn('flex items-center gap-0.5', scope !== 'ALL' && 'col-span-2')}>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Previous day" onClick={() => moveDay(-1)}>
                <ChevronLeft />
              </Button>
              <Input type="date" aria-label="Day" className="h-9 w-full rounded-full sm:w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Next day" onClick={() => moveDay(1)}>
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      </div>
      {view === 'board' ? <DayBoard filter={filter} date={date} onOpen={setPerson} /> : <Muster filter={filter} onOpen={setPerson} />}
      {person && <PersonMonth employeeCode={person} canEdit={canEdit} onClose={() => setPerson(null)} />}
    </section>
  )
}

type Filter = { scope: Scope; search?: string; companyIds?: number[] }

function DayBoard({ filter, date, onOpen }: { filter: Filter; date: string; onOpen: (code: string) => void }) {
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { ...filter, date: fromDateInput(date)! } }), placeholderData: keepPreviousData })
  const s = board.data?.summary
  // the day's totals as one plain line (they are not filters) - a zero is muted
  const counts: [number, string][] = s ? [[s.in, 'in'], [s.late, 'late'], ...(board.data?.isToday ? [[s.notIn, 'not in yet'] as [number, string]] : []), [s.absent, 'absent'], [s.leave, 'on leave'], [s.onDuty, 'on duty'], [s.off, 'off']] : []
  if (board.isPending) return <DayBoardSkeleton label="Loading the day board" />
  return (
    <div className="space-y-2">

      <div className="flex flex-wrap items-center justify-between gap-2">{s && (
        <p className="text-xs text-muted-foreground">
          {counts.map(([n, label], i) => (
            <span key={label}>
              {i > 0 && ' · '}
              <span className={n > 0 ? 'font-medium text-foreground' : undefined}>
                <span className="tabular-nums">{n}</span> {label}
              </span>
            </span>
          ))}
        </p>
      )}
        <ExportButton className="ml-auto" disabled={!board.data?.items.length || board.isFetching} load={() => client.attendance.days.exportBoard({ ...filter, date: fromDateInput(date)! })} />
      </div>
      <FormError error={board.error} />
      {board.data?.items.length === 0 && <EmptyState className="py-6" title="Nobody to show" hint="Nobody matches the search on this day." />}
      {!!board.data?.items.length && (
        <div className={cn('overflow-x-auto', board.isFetching && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden min-w-24 sm:table-cell">Shift</TableHead>
                <TableHead className="hidden min-w-28 text-right sm:table-cell">In</TableHead>
                <TableHead className="hidden min-w-20 text-right sm:table-cell">Out</TableHead>
                <TableHead className="hidden min-w-24 text-right sm:table-cell">Worked</TableHead>
                <TableHead className="text-right sm:min-w-40">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.data.items.map((i) => {
                const shift = i.holiday ?? i.shift?.code
                // a phone has no room for the shift / in / out / worked columns: they go on one line under the name
                const parts = [i.employeeCode, shift, i.inAt && `${i.inAt}${i.outAt ? `–${i.outAt}` : ''}${i.lateMinutes > 0 ? ` (+${i.lateMinutes}m)` : ''}`, i.workedMinutes > 0 && hours(i.workedMinutes)].filter(Boolean)
                return (
                  <TableRow key={i.employeeCode} className="cursor-pointer" onClick={() => onOpen(i.employeeCode)}>
                    <TableCell className="w-full max-w-0 sm:max-w-none">
                      <p className="truncate font-medium">{i.name}</p>
                      <p className="hidden text-xs text-muted-foreground sm:block">
                        {i.employeeCode}
                        {i.department && ` · ${i.department}`}
                      </p>
                      <p className="truncate text-xs text-foreground/70 tabular-nums sm:hidden">{parts.join(' · ')}</p>
                    </TableCell>
                    <TableCell className="hidden text-xs text-foreground/70 sm:table-cell">{shift ?? '—'}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {i.lateMinutes > 0 && <span className="mr-1.5 text-xs text-negative-ink">+{i.lateMinutes}m</span>}
                      {i.inAt ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{i.outAt ?? '—'}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{hours(i.workedMinutes)}</TableCell>
                    <TableCell className="text-right">
                      {i.correction && <span className="mr-1.5 text-xs text-muted-foreground">corrected</span>}
                      <Pill tone={BOARD_STATE[i.state].tone}>{board.data.isToday && i.punchCount === 1 ? 'At work' : BOARD_STATE[i.state].label}</Pill>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Muster({ filter, onOpen }: { filter: Filter; onOpen: (code: string) => void }) {
  const [ym, setYm] = useState(useAttendanceMonth())
  const muster = useQuery({ ...orpc.attendance.days.muster.queryOptions({ input: { ...filter, ...ym } }), placeholderData: keepPreviousData })
  // the attendance month's days before the muster answers (its skeleton's day columns)
  const range = cycleRange(ym.year, ym.month, useCycleStartDay())
  // (a code that is no status is a leave type's - CL, SL... 2026-11-22)
  const cellTone = (code: string) => Object.values(STATUS).find((s) => s.short === code)?.cell ?? (code ? STATUS.LEAVE.cell : 'text-muted-foreground')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} range={muster.data ?? range} locked={muster.data?.locked} />
        <ExportButton load={() => client.attendance.days.exportMuster({ ...filter, ...ym })} disabled={!muster.data?.rows.length} />
      </div>

      <FormError error={muster.error} />
      {muster.isPending && (
        <MusterSkeleton
          days={Array.from({ length: Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1 }, (_, i) => new Date(range.from.getTime() + i * 86_400_000))}
          label="Loading the month muster"
        />
      )}
      {muster.data?.rows.length === 0 && <EmptyState className="py-6" title="Nobody to show" hint="Nobody matches the search in this month." />}
      {!!muster.data?.rows.length && (
        <div className={cn('overflow-x-auto rounded-2xl border border-border', muster.isFetching && 'opacity-60')}>
          <table className="w-full border-collapse text-xs">
            <thead className="bg-surface-2/60 text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 min-w-32 bg-surface-2 px-2 py-1.5 text-left font-medium sm:min-w-44">Employee</th>
                {muster.data.days.map((d) => (
                  <th key={d.toISOString()} className={cn('w-7 px-0.5 py-1.5 text-center font-medium tabular-nums', [0, 6].includes(d.getUTCDay()) && 'bg-surface-2')}>
                    {d.getUTCDate()}
                  </th>
                ))}
                {MUSTER_TOTALS.map((h) => (
                  <th key={h} className="px-1.5 py-1.5 text-center font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {muster.data.rows.map((r) => (
                <tr key={r.employeeCode} className="hover:bg-surface-2/40">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1">
                    <button type="button" className="text-left hover:underline" onClick={() => onOpen(r.employeeCode)}>
                      <span className="block font-medium">{r.name}</span>
                      <span className="text-muted-foreground">{r.employeeCode}</span>
                    </button>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-0.5 py-1 text-center">
                      {c.code && (
                        <span
                          // two halves that differ (P/WO a Saturday, P/A a half day): half and half, the first half on the left
                          // (2026-11-23, as on the calendar)
                          style={c.first && c.second && c.first !== c.second ? { background: splitFill(statusOfCode(c.first), statusOfCode(c.second)) } : undefined}
                          className={cn(
                            'inline-block min-w-6 rounded-md px-0.5 py-0.5 font-semibold whitespace-nowrap',
                            c.first && c.second && c.first !== c.second ? 'text-foreground' : cellTone(c.first || c.code),
                            c.late && 'ring-1 ring-negative-ink/60',
                            c.corrected && 'underline',
                          )}
                          title={[c.late && 'late', c.corrected && 'corrected by HR'].filter(Boolean).join(', ') || undefined}
                        >
                          {c.code}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-1.5 text-center tabular-nums">{r.totals.present}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.halfDay}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.absent}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.missedPunch}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.leave}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.onDuty}</td>
                  <td className="px-1.5 text-center tabular-nums">{r.totals.late}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/70">
        {/* a half day shows as its two halves (P/A) - the muster has no HD code since 2026-11-22 */}
        {Object.values(STATUS)
          .filter((st) => st.short !== 'HD')
          .map((st) => (
            <li key={st.short} className="flex items-center gap-1.5">
              <span className={cn('min-w-6 rounded-md px-0.5 py-0.5 text-center font-semibold', st.cell)}>{st.short}</span>
              {st.label}
            </li>
          ))}
        <li className="flex items-center gap-1.5">
          <span className="rounded-md px-0.5 py-0.5 text-center font-semibold text-foreground" style={{ background: splitFill('PRESENT', 'ABSENT') }}>
            P/A
          </span>
          First half / second half
        </li>
        <li className="flex items-center gap-1.5">
          <span className="rounded-md px-0.5 py-0.5 text-center font-semibold text-foreground" style={{ background: splitFill('PRESENT', 'WEEKLY_OFF') }}>
            P/WO
          </span>
          Half day + half off
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-4 rounded-md ring-1 ring-negative-ink/60 ring-inset" />
          Late
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="font-semibold underline">P</span>
          Corrected by HR
        </li>
      </ul>
    </div>
  )
}

// One person's month in a drawer; HR (Attendance: Edit) corrects a day from its details
export function PersonMonth({ employeeCode, canEdit, onClose }: { employeeCode: string; canEdit: boolean; onClose: () => void }) {
  const now = todayDay()
  const [ym, setYm] = useState(useAttendanceMonth())
  const month = useQuery({ ...orpc.attendance.days.employeeMonth.queryOptions({ input: { employeeCode, ...ym } }), placeholderData: keepPreviousData })
  // the attendance month's days before it answers (the picker's line and the skeleton)
  const range = cycleRange(ym.year, ym.month, useCycleStartDay())
  // a day correction typed and not saved - closing asks first
  const [unsaved, setUnsaved] = useState(false)
  return (
    <FormDrawer
      onClose={onClose}
      dirty={unsaved}
      width={760}
      title={month.data ? month.data.employee.name : employeeCode}
      description={month.data ? [month.data.employee.employeeCode, month.data.employee.designation, month.data.employee.department].filter(Boolean).join(' · ') : undefined}
    >
      <div className="space-y-4">
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} range={month.data ?? range} locked={month.data?.locked} />
        <ExportButton disabled={!month.data || month.isFetching} load={() => client.attendance.days.exportMonth({employeeCode,...ym})} />
        <FormError error={month.error} />
        {month.isPending && <MonthSkeleton year={ym.year} month={ym.month} range={range} label="Loading the month" />}
        {month.data && (
          <>
            <MonthTotals totals={month.data.totals} />
            <MonthCalendar data={month.data} actions={(day) => (canEdit && month.data.canCorrect && !month.data.locked && day.date <= now ? <CorrectDay key={day.date.toISOString()} employeeCode={employeeCode} day={day} onDirty={setUnsaved} /> : null)} />
          </>
        )}
      </div>
    </FormDrawer>
  )
}

// HR sets a half or both with a reason (or removes the correction); a half left on "as the punches" keeps following them
// (2026-11-22, was one status for the day)
function CorrectDay({ employeeCode, day, onDirty }: { employeeCode: string; day: MonthDay; onDirty: (dirty: boolean) => void }) {
  const queryClient = useQueryClient()
  const saved = { first: (day.correction?.firstHalf ?? '') as HalfStatus | '', second: (day.correction?.secondHalf ?? '') as HalfStatus | '' }
  const [first, setFirst] = useState<HalfStatus | ''>(saved.first)
  const [second, setSecond] = useState<HalfStatus | ''>(saved.second)
  const [reason, setReason] = useState('')
  // a reason typed or a half changed, not yet saved (tells the drawer; cleared when this day closes)
  const dirty = !!reason.trim() || first !== saved.first || second !== saved.second
  useEffect(() => onDirty(dirty), [dirty, onDirty])
  useEffect(() => () => onDirty(false), [onDirty])
  // after a save the form matches the day again: the reason is cleared, the halves are the ones now saved
  const done = (f: HalfStatus | '', s: HalfStatus | '') => {
    setReason('')
    setFirst(f)
    setSecond(s)
    void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  }
  const correct = useMutation(orpc.attendance.days.correct.mutationOptions({ onSuccess: (_data, input) => done(input.firstHalf ?? '', input.secondHalf ?? '') }))
  const remove = useMutation(orpc.attendance.days.removeCorrection.mutationOptions({ onSuccess: () => done('', '') }))
  const halfSelect = (label: string, value: HalfStatus | '', set: (v: HalfStatus | '') => void) => (
    <NativeSelect className="[&_select]:h-9 [&_select]:rounded-xl" aria-label={label} value={value} onChange={(e) => set(e.target.value as HalfStatus | '')}>
      <NativeSelectOption value="">{label}: as the punches</NativeSelectOption>
      {HALF_STATUSES.map((s) => (
        <NativeSelectOption key={s} value={s}>
          {label}: {STATUS[s].label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
  return (
    <div className="space-y-2 rounded-2xl bg-card p-3">
      <p className="text-xs font-medium">Correct this day (HR)</p>
      <div className="flex flex-wrap items-center gap-2">
        {halfSelect('First half', first, setFirst)}
        {halfSelect('Second half', second, setSecond)}
        <Input className="h-9 min-w-48 flex-1 rounded-xl" placeholder="Reason, e.g. card not read at exit" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          size="sm"
          variant="gold"
          disabled={(!first && !second) || reason.trim().length < 3 || correct.isPending}
          // both halves as the form shows them: "as the punches" (null) clears that half's correction
          onClick={() => correct.mutate({ employeeCode, date: day.date, firstHalf: first || null, secondHalf: second || null, reason })}
        >
          Save
        </Button>
        {day.correction && (
          <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ employeeCode, date: day.date })}>
            Remove correction
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Kept in the change history with your name. {formatDate(day.date)}</p>
      <FormError error={correct.error ?? remove.error} />
    </div>
  )
}
