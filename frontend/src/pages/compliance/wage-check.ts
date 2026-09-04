/**
 * CMP-01 calculator payload — rupees → paise components for POST /compliance/wage-check.
 * Balance of CTC that is neither Basic nor DA is labelled OTHER (not Basic+DA).
 */
interface WageCheckComponent {
  code: string;
  amountPaise: number;
  countsAsBasicDa: boolean;
}

type WageCheckBuildResult =
  | { ok: true; components: WageCheckComponent[] }
  | { ok: false; error: string };

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Build the component list the wage-check API expects from the three calculator fields. */
export function buildWageCheckComponents(
  basicRupees: number,
  daRupees: number,
  ctcRupees: number,
): WageCheckBuildResult {
  if (![basicRupees, daRupees, ctcRupees].every((n) => Number.isFinite(n))) {
    return { ok: false, error: 'Enter numbers only for Basic, DA and CTC.' };
  }
  if (basicRupees < 0 || daRupees < 0 || ctcRupees <= 0) {
    return { ok: false, error: 'CTC must be positive; Basic and DA cannot be negative.' };
  }
  if (basicRupees + daRupees > ctcRupees + 1e-9) {
    return { ok: false, error: 'Basic + DA cannot exceed CTC.' };
  }

  const components: WageCheckComponent[] = [
    { code: 'BASIC', amountPaise: toPaise(basicRupees), countsAsBasicDa: true },
  ];
  if (daRupees > 0) {
    components.push({ code: 'DA', amountPaise: toPaise(daRupees), countsAsBasicDa: true });
  }
  const otherRupees = ctcRupees - basicRupees - daRupees;
  if (otherRupees > 1e-9) {
    components.push({
      code: 'OTHER',
      amountPaise: toPaise(otherRupees),
      countsAsBasicDa: false,
    });
  }
  return { ok: true, components };
}
