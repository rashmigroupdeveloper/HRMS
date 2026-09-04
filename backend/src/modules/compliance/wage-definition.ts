/**
 * CMP-01 wage-definition check — Labour Codes ≥50% Basic+DA of CTC.
 * Default 50 is the documented Code floor until P0-T06 signs a different value.
 * Never persist a structure without calling this (property test in Phase 2.1).
 */
export interface WageComponent {
  code: string;
  amountPaise: number;
  countsAsBasicDa: boolean;
}

export interface WageViolation {
  actualPct: number;
  requiredPct: number;
  basicDaPaise: number;
  ctcPaise: number;
}

export function assertWageDefinition(
  components: readonly WageComponent[],
  requiredPct: number,
): WageViolation | null {
  const ctcPaise = components.reduce((sum, row) => sum + row.amountPaise, 0);
  if (ctcPaise <= 0) {
    return { actualPct: 0, requiredPct, basicDaPaise: 0, ctcPaise: 0 };
  }
  const basicDaPaise = components
    .filter((row) => row.countsAsBasicDa)
    .reduce((sum, row) => sum + row.amountPaise, 0);
  const actualPct = (basicDaPaise * 100) / ctcPaise;
  if (actualPct + 1e-9 >= requiredPct) return null;
  return { actualPct, requiredPct, basicDaPaise, ctcPaise };
}
