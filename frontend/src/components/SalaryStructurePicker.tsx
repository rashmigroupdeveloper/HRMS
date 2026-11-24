import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { StructureBreakup, StructureChoice } from '@/hooks/useStructureBreakup'
import { errorMessage } from '@/lib/utils'

// Which salary structure fills a breakup in (2026-11-24 - the offer form and the salary revision): automatic (by the
// employee type), one HR picks, or none; "Recalculate from CTC" after a hand change. `Status` says what happened.
export function SalaryStructurePicker({ s }: { s: StructureBreakup }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="salary-structure" className="flex items-center gap-2 text-xs text-muted-foreground">
        Salary structure
        <NativeSelect id="salary-structure" className="[&_select]:h-8 [&_select]:rounded-full" value={s.choice} onChange={(e) => s.choose(e.target.value as StructureChoice)}>
          <NativeSelectOption value="auto">{s.choice === 'auto' && s.result?.structure ? `Automatic - ${s.result.structure.name}` : 'Automatic (by the employee type)'}</NativeSelectOption>
          {s.structures.map((structure) => (
            <NativeSelectOption key={structure.id} value={String(structure.id)}>
              {structure.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="none">None - type the breakup</NativeSelectOption>
        </NativeSelect>
      </label>
      {s.result?.structure && !s.following && (
        <Button type="button" size="sm" variant="secondary" onClick={s.recalculate}>
          <RefreshCw className="size-3.5" />
          Recalculate from CTC
        </Button>
      )}
    </div>
  )
}

// What the breakup is now, under the picker
export function SalaryStructureStatus({ s, needs }: { s: StructureBreakup; needs: string }) {
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {s.choice === 'none'
        ? 'No salary structure chosen - type the breakup.'
        : !s.canCalculate
          ? s.chosenId === undefined
            ? `${needs} - the breakup fills in from the salary structure they match.`
            : 'Type the CTC - the breakup fills in from the chosen salary structure.'
          : s.calculated.isPending
            ? 'Working out the breakup…'
            : s.calculated.error
              ? errorMessage(s.calculated.error)
              : s.result?.structure
                ? s.following
                  ? `Filled in from the salary structure "${s.result.structure.name}". Change any line - the balance line keeps the total at the CTC.`
                  : `Not following the CTC (changed by hand, or the saved breakup). "Recalculate from CTC" fills it in from "${s.result.structure.name}".`
                : 'No salary structure for this kind of employee - pick one above, or type the breakup.'}
    </p>
  )
}
