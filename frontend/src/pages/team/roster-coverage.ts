/** Pure coverage / hours-meter helpers so the roster strip is testable (SHF-03/06). */

export interface RosterMeter {
  employeeId: number;
  weekHours: number;
  weekCap: number;
  quarterHours: number;
  quarterCap: number;
}

export interface CoverageCell {
  date: string;
  shiftCode: string;
  sanctioned: number;
  rostered: number;
  onLeave: number;
  remaining: number;
  shortfall: number;
}

export function meterOverCap(meter: RosterMeter): boolean {
  return meter.weekHours > meter.weekCap || meter.quarterHours > meter.quarterCap;
}

export function shortfallCells(cells: CoverageCell[]): CoverageCell[] {
  return cells.filter((cell) => cell.shortfall > 0);
}

export function parseCycleLine(line: string): { shiftCode: string | null; weekOff: boolean }[] {
  return line
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0)
    .map((token) =>
      token === 'WO' || token === 'OFF'
        ? { shiftCode: null, weekOff: true }
        : { shiftCode: token, weekOff: false },
    );
}
