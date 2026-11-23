import { CircleAlert, Factory } from 'lucide-react'
import { Pill } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { COUNTRY_OPTIONS } from '@/lib/choices'
import { type Company, missingOf, nextCodeOf } from './company-facts'

// The Companies tab's right side (2026-11-21): one company - its employee code series, registrations and address in
// three blocks, with what is still missing marked (the employer details printed on EPF Form 11, ESIC Form 1 and Gratuity
// Form F - required to save it since 2026-11-19), and its plants (each opens the plant's departments).

type Plant = Awaited<ReturnType<typeof client.organization.plants.list>>[number]

// The company's code in a small tile (the list and the detail)
export function CompanyTile({ code, inverted, size = 'sm' }: { code: string; inverted?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-xl px-1 text-xs font-semibold tracking-tight',
        size === 'sm' ? 'h-8 w-14' : 'h-10 min-w-14',
        inverted ? 'bg-hero-foreground/10 text-hero-foreground' : 'bg-surface-2 text-foreground',
      )}
    >
      {code}
    </span>
  )
}

export function CompanyDetail({
  company: c,
  plants,
  actions,
  onOpenPlant,
}: {
  company: Company
  plants: Plant[]
  actions: React.ReactNode
  onOpenPlant: (plant: Plant) => void
}) {
  const missing = missingOf(c)
  const country = COUNTRY_OPTIONS.find((o) => o.value === c.countryCode)?.label.replace(/ \(\w+\)$/, '') ?? c.countryCode
  const own = plants.filter((p) => p.company.id === c.id)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CompanyTile code={c.code} size="md" />
        <div className="min-w-52 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-medium">{c.name}</span>
            {!c.isActive && <Pill tone="neutral">Retired</Pill>}
            <Pill tone={c.isIndiaPayroll ? 'info' : 'gold'}>{c.isIndiaPayroll ? 'India payroll' : 'Overseas'}</Pill>
          </p>
          <p className="text-xs text-muted-foreground">
            {[c.sapCompanyCode && `SAP ${c.sapCompanyCode}`, country, `${own.length} ${own.length === 1 ? 'plant' : 'plants'}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {actions}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Block title="Employee codes">
          <Fact label="E-code prefix" value={c.ecodePrefix} />
          <Fact
            label="Next employee code"
            value={nextCodeOf(c)}
            missing={missing.nextEmployeeNumber}
            missingText="Not set - employees cannot be added"
          />
        </Block>
        <Block title="Address" note="Printed on Gratuity Form F and ESIC Form 1">
          <Fact label="Street" value={c.address} missing={missing.address} wide />
          <Fact label="State / region" value={c.region} missing={missing.region} />
          <Fact label="PIN / postal code" value={c.postalCode} missing={missing.postalCode} />
        </Block>
        <Block title="Registrations" wide>
          <Fact label="PAN" value={c.pan} />
          <Fact label="TAN" value={c.tan} />
          <Fact label="GSTIN" value={c.gstin} />
          <Fact label="PF establishment code" value={c.pfEstablishmentCode} missing={missing.pfEstablishmentCode} missingText="Missing - printed on EPF Form 11" />
          <Fact label="ESIC employer code" value={c.esicEmployerCode} missing={missing.esicEmployerCode} missingText="Missing - printed on ESIC Form 1" />
          <Fact label="PT registration" value={c.ptRegistrationNo} />
        </Block>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70">
        <header className="flex items-center gap-2 bg-surface-2/40 px-3 py-1.5 text-xs">
          <Factory className="size-3.5 text-muted-foreground" />
          <span className="font-semibold">Plants</span>
          <span className="text-muted-foreground tabular-nums">{own.length}</span>
        </header>
        {own.length === 0 ? (
          <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">None yet - add one on the Plants tab.</p>
        ) : (
          <ul className="grid border-t border-border/60 sm:grid-cols-2">
            {own.map((p) => (
              <li key={p.id} className="border-border/60 max-sm:border-b sm:odd:border-r sm:[&:nth-child(n+3)]:border-t">
                <button
                  type="button"
                  title="See the departments that run at this plant"
                  onClick={() => onOpenPlant(p)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-2/60', !p.isActive && 'text-muted-foreground')}
                >
                  <span className="text-muted-foreground tabular-nums">{p.plantCode}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  {!p.isActive && <span className="text-muted-foreground">retired</span>}
                  <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-muted-foreground tabular-nums">
                    {p._count.departments} {p._count.departments === 1 ? 'dept' : 'depts'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// `wide`: the whole width (three facts a row on a wide screen)
function Block({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-border/70 px-3 py-2', wide && 'md:col-span-2')}>
      <h3 className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold">
        {title}
        {note && <span className="truncate font-normal text-muted-foreground max-sm:hidden">{note}</span>}
      </h3>
      <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-1.5', wide && 'sm:grid-cols-3')}>{children}</dl>
    </section>
  )
}

function Fact({ label, value, missing, missingText = 'Missing', wide }: { label: string; value: React.ReactNode; missing?: boolean; missingText?: string; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-full')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">
        {missing ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-ink">
            <CircleAlert className="size-3.5 shrink-0" />
            {missingText}
          </span>
        ) : (
          (value ?? <span className="text-muted-foreground">—</span>)
        )}
      </dd>
    </div>
  )
}
