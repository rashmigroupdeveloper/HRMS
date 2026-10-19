import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { AttendancePenalties } from './AttendancePenalties';
import { renderRouted, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';
import type { AttendanceMonthRow } from './attendance-types';
const row: AttendanceMonthRow = {
  date: '2026-10-19', status: 'P', firstIn: null, lastOut: null, lateMinutes: 40, otMinutes: 0,
  sessionStatuses: [{ session: 1, status: 'P' }, { session: 2, status: 'P' }], penaltyFlag: true,
  penaltyEvaluation: [
    { cause: 'late_arrival', minutes: 40, rule: { fromMin: 31, toMin: null, effect: 'half_day' } },
    { cause: 'early_exit', minutes: 16, rule: { fromMin: 16, toMin: 30, effect: 'late' } },
  ],
};
describe('SHF-01 separate attendance penalty display', () => {
  it.each(THEMES)('explains both causes without changing attendance or summing pay in %s', async theme => {
    const { container } = renderRouted(<AttendancePenalties row={row} />, theme);
    expect(screen.getByRole('region', { name: 'Attendance penalties' })).toHaveTextContent('Late arrival · 40 min · Half-day penalty');
    expect(screen.getByText('Early exit')).toBeInTheDocument();
    expect(screen.getByText('Rule: 31+ min after grace')).toBeInTheDocument();
    expect(screen.getByText(/do not apply a payroll deduction/)).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
  it('does not invent rule details for a legacy boolean penalty', () => {
    renderRouted(<AttendancePenalties row={{ ...row, penaltyEvaluation: null }} />);
    expect(screen.getByText(/rule details are unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('Half-day penalty')).not.toBeInTheDocument();
  });
  it('omits the penalty section for a clean evaluated day', () => {
    renderRouted(<AttendancePenalties row={{ ...row, penaltyFlag: false, penaltyEvaluation: [] }} />);
    expect(screen.queryByRole('region', { name: 'Attendance penalties' })).not.toBeInTheDocument();
  });
});
