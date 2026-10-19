import type { AttendanceMonthRow } from './attendance-types';
/** SHF-01: separate rule findings; never replace either half's attendance glyph. */
export function AttendancePenalties({ row }: { row: AttendanceMonthRow }) {
  const findings = row.penaltyEvaluation;
  if (!findings?.length && !row.penaltyFlag) return null;
  return <section aria-label="Attendance penalties" className="mt-4 border-t border-hero-muted/30 pt-4 text-sm">
    <p className="font-semibold">Penalty findings</p>
    {findings?.length ? <ul className="mt-2 space-y-2">
      {findings.map(finding => <li key={finding.cause}>
        <span className="font-medium">{finding.cause === 'late_arrival' ? 'Late arrival' : 'Early exit'}</span>
        {' · '}<span className="tabular-nums">{finding.minutes} min</span>
        {' · '}{finding.rule.effect === 'half_day' ? 'Half-day penalty' : 'Late/early flag'}
        <p className="text-xs text-hero-muted tabular-nums">
          Rule: {finding.rule.fromMin}{finding.rule.toMin === null ? '+ min' : `–${String(finding.rule.toMin)} min`} after grace
        </p>
      </li>)}
    </ul> : <p className="mt-2 text-hero-muted">A historical penalty was recorded; its rule details are unavailable.</p>}
    <p className="mt-2 text-xs text-hero-muted">Attendance halves are unchanged. These findings do not apply a payroll deduction.</p>
  </section>;
}
