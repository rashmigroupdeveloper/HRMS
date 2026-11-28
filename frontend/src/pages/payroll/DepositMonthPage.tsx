import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Download } from 'lucide-react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { DepositMonthSkeleton } from '@/components/skeletons/payroll/DepositMonthSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, downloadFile, formatDate, formatMoney } from '@/lib/utils'
import { standingDetail } from './components/deposit-standing'
import { DepositPeople, PEOPLE_PAGE_SIZE } from './components/DepositPeople'
import { DepositRecords, type Line } from './components/DepositRecords'
import { DEPOSIT_STATE, MONTH_LABEL, MONTH_TILE_LABELS, ROLE_LABEL, ROLES_OF, SCHEME, days, schemeName, type Scheme } from './components/deposits-labels'

const inr = (amount: number) => formatMoney(amount, 'INR')
const keyOf = (l: { scheme: string; stateCode: string | null }) => (l.stateCode ? `${l.scheme}-${l.stateCode}` : l.scheme)

// One company's pay month of Statutory deposits (/manage/statutory-deposits/:company/:yyyy-mm - payroll stage 6 slice 3):
// a tab per scheme (professional tax and LWF per State) with what is due - per piece, worked out from the approved run -
// what is deposited, the due date and where it stands; its returns and challans; for PF and ESIC the people and who is left
// out of the return. The figures sheet (each person's figures, Excel) needs Salary View over the whole company too. The
// "Statutory deposits" area over the whole company; the scheme lives in the address (?scheme=PF / PROFESSIONAL_TAX-WB).
export function DepositMonthPage() {
  const params = useParams()
  const companyId = Number(params.companyId)
  const match = /^(\d{4})-(\d{2})$/.exec(params.month ?? '')
  const payMonth = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null
  const valid = Number.isSafeInteger(companyId) && companyId > 0 && !!payMonth && Number(match![2]) >= 1 && Number(match![2]) <= 12
  const [search, setSearch] = useSearchParams()
  const { ready, can } = useAccess()
  const asked = search.get('scheme') ?? 'PF'
  const query = useQuery({ ...orpc.payroll.deposits.month.queryOptions({ input: { companyId, payMonth: payMonth ?? new Date(0) } }), enabled: valid })
  const askedScheme = asked.split('-')[0] as Scheme
  const followed = askedScheme === 'PF' || askedScheme === 'ESIC'
  // the people of the PF / ESIC asked for load beside the month (the same first page the people list asks for) - one
  // skeleton for the page, never two in a row
  useQuery({
    ...orpc.payroll.deposits.people.queryOptions({ input: { companyId, payMonth: payMonth ?? new Date(0), scheme: followed ? askedScheme : 'PF', show: 'ALL', page: 1, pageSize: PEOPLE_PAGE_SIZE } }),
    enabled: valid && followed,
  })
  const [figuresError, setFiguresError] = useState<string | null>(null)
  const m = query.data
  const line = m?.lines.find((l) => keyOf(l) === asked) ?? m?.lines[0]
  return (
    <div className="space-y-4">
      <Link to="/manage/statutory-deposits" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Statutory deposits
      </Link>
      {!valid && <p role="alert" className="text-sm text-negative-ink">This is not a statutory deposits address.</p>}
      <FormError error={query.error} />
      {valid && query.isPending && <DepositMonthSkeleton month={MONTH_LABEL(payMonth!)} people={followed ? askedScheme : null} canRecord={ready && can('STATUTORY_DEPOSITS', 'WRITE')} pieces={ROLES_OF[askedScheme]?.length ?? 4} label="Loading the month" />}
      {m && payMonth && (
        <>
          <header className="space-y-1">
            <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-light tracking-tight">{m.company.code} · {MONTH_LABEL(payMonth)}</h1>
              {m.seesAmounts && (
                <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" title="Each person’s PF, ESIC, professional tax and LWF - a plain sheet for preparing and checking the returns, not the upload file" onClick={() => void downloadFile(() => client.payroll.deposits.figures({ companyId, payMonth }), setFiguresError)}>
                  <Download className="size-4" aria-hidden />Figures
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{m.company.name} · approved pay run{m.runs.some((r) => !r.payslipsReleased) ? ' · payslips not released yet' : ''}</p>
            {figuresError && <p role="alert" className="text-xs text-negative-ink">{figuresError}</p>}
          </header>
          {m.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">The approved run deducted nothing for PF, ESIC, professional tax or LWF.</p>
          ) : (
            <>
              <Tabs value={line ? keyOf(line) : ''} onValueChange={(value) => setSearch(String(value) === 'PF' ? {} : { scheme: String(value) }, { replace: true })}>
                <PillTabsList aria-label="Schemes">
                  {m.lines.map((l) => <PillTabsTrigger key={keyOf(l)} value={keyOf(l)}>{schemeName(l.scheme, l.stateCode)}</PillTabsTrigger>)}
                </PillTabsList>
              </Tabs>
              {line && <LineView key={keyOf(line)} line={line} payMonth={payMonth} canRecord={m.canRecord} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

// One scheme's month: the tiles, where it stands, the pieces of what is due, the returns and challans, and the people
function LineView({ line, payMonth, canRecord }: { line: Line; payMonth: Date; canRecord: boolean }) {
  const roles = ROLES_OF[line.scheme].filter((r) => line.roles[r])
  const tiles = [
    [inr(line.due), `${line.people} ${line.people === 1 ? 'person' : 'people'}`],
    [inr(line.deposited), line.otherCharges ? `+ ${inr(line.otherCharges)} other charges` : line.lastPaidOn ? `last paid ${formatDate(line.lastPaidOn)}` : 'nothing paid yet'],
    [inr(line.filedUnpaid), line.deposits.filter((d) => !d.paidOn).length ? 'waiting for payment' : ' '],
    [String(line.leftOut.count), line.leftOut.count ? inr(line.leftOut.amount) : line.takenIn ? `${line.takenIn} taken in later` : ' '],
    [line.dueOn ? formatDate(line.dueOn) : 'Not set', line.daysOverdue ? `overdue ${days(line.daysOverdue)}` : line.daysLate ? `paid ${days(line.daysLate)} late` : line.dueOn ? ' ' : 'Statutory settings › Due dates'],
  ] as const
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MONTH_TILE_LABELS.map((label, i) => (
          <div key={label} className={cn('min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card', i === 0 && 'col-span-2 sm:col-span-1')}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('truncate text-lg font-medium leading-7 tabular-nums', i === 3 && line.leftOut.count > 0 && 'text-warning-ink', i === 4 && !line.dueOn && 'text-warning-ink', i === 4 && line.daysOverdue > 0 && 'text-negative-ink')}>{tiles[i][0]}</p>
            <p className="truncate text-xs leading-4 text-muted-foreground tabular-nums">{tiles[i][1]}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Pill tone={DEPOSIT_STATE[line.state][1]}>{DEPOSIT_STATE[line.state][0]}</Pill>
        <span className={cn('text-sm', line.daysOverdue ? 'text-negative-ink' : 'text-muted-foreground')}>{standingDetail(line)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {roles.map((r) => {
          const piece = line.roles[r]!
          return (
            <div key={r} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{ROLE_LABEL[r]}</dt>
              <dd className="tabular-nums">{inr(piece.amount)}{piece.base ? <span className="text-xs text-muted-foreground"> on {inr(piece.base)}</span> : null}</dd>
            </div>
          )
        })}
      </dl>
      <DepositRecords line={line} payMonth={payMonth} canRecord={canRecord} />
      {(line.scheme === 'PF' || line.scheme === 'ESIC') && <DepositPeople line={line} payMonth={payMonth} />}
      {line.scheme !== 'PF' && line.scheme !== 'ESIC' && <p className="text-xs text-muted-foreground">{SCHEME[line.scheme]} is deposited for {line.stateCode} as one amount - nobody is followed person by person.</p>}
    </>
  )
}
