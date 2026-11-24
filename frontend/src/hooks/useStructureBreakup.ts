import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSettled } from '@/hooks/useSettled'
import type { BreakupValues } from '@/lib/form-values'
import { type client, orpc } from '@/lib/orpc'
import { sumMoney } from '@/lib/utils'

// A salary breakup worked out from the CTC by a salary structure (2026-11-24) - the offer form and the salary revision.
// The structure is the one the employee type matches ('auto'), one HR picked, or none (HR types the breakup). While the
// breakup "follows" the CTC it is the calculated one; HR changing a line stops that (the balance line takes the
// difference, so the total stays the CTC) until "Recalculate", a new structure choice, or `followIfUntouched`.

type Calculate = Parameters<typeof client.organization.salaryStructures.calculate>[0]
export type StructureChoice = 'auto' | 'none' | `${number}`

// the calculated lines as the form holds them - a line that comes to 0 is left out (not shown, not saved)
const breakupFrom = (lines: { salaryComponentId: number; monthlyAmount: number }[]): BreakupValues =>
  Object.fromEntries(lines.filter((l) => l.monthlyAmount > 0).map((l) => [l.salaryComponentId, String(l.monthlyAmount)]))

export function useStructureBreakup({
  annualCtc,
  joiningType,
  employmentType,
  workforceCategory,
  start,
  startFollowing,
  disabled = false,
}: {
  annualCtc: number
  joiningType: Calculate['joiningType'] | ''
  employmentType: Calculate['employmentType'] | ''
  workforceCategory: Calculate['workforceCategory'] | ''
  // the breakup it opens with (a saved offer's, the salary in force)
  start: BreakupValues
  // true: fill in from the structure at once (a new offer); false: keep `start` until asked
  startFollowing: boolean
  disabled?: boolean
}) {
  const [typed, setTyped] = useState(start)
  const [following, setFollowing] = useState(startFollowing)
  // HR changed a line by hand (a new CTC then does not overwrite it - "Recalculate" does)
  const [edited, setEdited] = useState(false)
  const [choice, setChoice] = useState<StructureChoice>('auto')
  const structures = useQuery({ ...orpc.organization.salaryStructures.list.queryOptions(), enabled: !disabled })

  // settled as text when HR stops typing, so it changes only when a value does (an object would be new on every render)
  const kind = JSON.parse(useSettled(JSON.stringify({ annualCtc, joiningType, employmentType, workforceCategory }))) as {
    annualCtc: number
    joiningType: Calculate['joiningType'] | ''
    employmentType: Calculate['employmentType'] | ''
    workforceCategory: Calculate['workforceCategory'] | ''
  }
  const chosenId = choice === 'auto' || choice === 'none' ? undefined : Number(choice)
  const canCalculate =
    !disabled && choice !== 'none' && kind.annualCtc > 0 && (chosenId !== undefined || (!!kind.joiningType && !!kind.employmentType && !!kind.workforceCategory))
  const calculated = useQuery({
    ...orpc.organization.salaryStructures.calculate.queryOptions({
      input: {
        annualCtc: kind.annualCtc,
        joiningType: kind.joiningType || undefined,
        employmentType: kind.employmentType || undefined,
        workforceCategory: kind.workforceCategory || undefined,
        structureId: chosenId,
      },
    }),
    enabled: canCalculate,
    retry: false,
  })
  const result = canCalculate ? calculated.data : undefined
  const breakup = following && result?.structure ? breakupFrom(result.lines) : typed

  const change = (next: BreakupValues) => {
    setFollowing(false)
    setEdited(true)
    const balance = result?.balanceComponentId
    const changed = Object.keys(next).find((id) => next[Number(id)] !== breakup[Number(id)])
    if (!balance || !result || changed === undefined || Number(changed) === balance) return setTyped(next)
    const others = sumMoney(Object.entries(next).filter(([id]) => Number(id) !== balance).map(([, v]) => Number(v) || 0))
    setTyped({ ...next, [balance]: String(Math.max(sumMoney([result.monthlyCtc, -others]), 0)) })
  }
  const recalculate = () => {
    setFollowing(true)
    setEdited(false)
  }
  return {
    breakup,
    change,
    recalculate,
    // e.g. a new CTC typed on a salary revision: fill in from the structure unless HR changed lines by hand
    followIfUntouched: () => !edited && setFollowing(true),
    following,
    choice,
    choose: (next: StructureChoice) => {
      setChoice(next)
      recalculate()
    },
    structures: structures.data ?? [],
    result,
    calculated,
    canCalculate,
    chosenId,
  }
}

export type StructureBreakup = ReturnType<typeof useStructureBreakup>
