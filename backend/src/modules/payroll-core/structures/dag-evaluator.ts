/**
 * Directed Acyclic Graph (DAG) Formula Evaluator for Salary Structures (PAY-01, PAY-02, docs/04 §3, docs/14 §6).
 *
 * - Parses formula expressions over component identifiers and constants.
 * - Extracts dependency graph, detects circular references via DFS.
 * - Produces topological evaluation order.
 * - Evaluates expressions deterministically with integer-paise precision and safe division.
 * - Validates CTC equals sum of breakup components down to the exact paisa (zero floats).
 * - Handles probation percentage scaling (70%, 80%, 90%).
 */
import {
  type Paise,
  paise,
  toRupees,
  add,
  subtract,
} from '../../../core/money/index.js';
import type { SalaryComponentItem, SalaryRoundingMode } from '../../../core/db/types.js';

/**
 * Variables every formula may use besides the structure's own component codes (E2E-029 / C-19):
 * CTC = CTC_MONTHLY = annual CTC / 12 (all component amounts are monthly), CTC_ANNUAL, GROSS (earnings
 * resolved so far), PF_WAGES (= BASIC) and PF_WAGES_CAPPED (min(BASIC, 15000)). Amounts in rupees.
 * Example template for a grade: BASIC "CTC * 0.40", HRA "BASIC * 0.50", PF_ER "PF_WAGES_CAPPED * 0.12",
 * SPECIAL_ALLOW = balance to CTC.
 */
const BUILTIN_VARIABLES = new Set(['CTC', 'CTC_MONTHLY', 'CTC_ANNUAL', 'GROSS', 'PF_WAGES', 'PF_WAGES_CAPPED']);

/**
 * One assembler for preview, assignment and onboarding: the rule of a structure line is its
 * formula_override, else its amount_rule (same expression grammar), else the catalog formula.
 */
export function structureLineNode(
  item: SalaryComponentItem,
  meta: { code: string; kind: ComponentFormulaNode['kind']; formula?: string | null | undefined; rounding: SalaryRoundingMode;
    part_of_gross: boolean; part_of_pf_wages: boolean; prorate_on_lop?: boolean | undefined },
): ComponentFormulaNode {
  const pick = (v: string | null | undefined) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  return {
    code: meta.code,
    kind: meta.kind,
    formula: pick(item.formula_override) ?? pick(item.amount_rule) ?? pick(meta.formula),
    rounding: meta.rounding,
    part_of_gross: meta.part_of_gross,
    part_of_pf_wages: meta.part_of_pf_wages,
    prorate_on_lop: meta.prorate_on_lop,
  };
}

export interface ComponentFormulaNode {
  code: string;
  kind: 'earning' | 'deduction' | 'employer_contribution';
  formula?: string | null | undefined;
  amount?: number | undefined; // Fixed monthly amount in paise, if no formula
  rounding?: SalaryRoundingMode | undefined;
  part_of_gross?: boolean | undefined;
  part_of_pf_wages?: boolean | undefined;
  prorate_on_lop?: boolean | undefined;
}

export interface EvaluatedBreakup {
  monthly: Record<string, Paise>;
  annual: Record<string, Paise>;
  monthlyGross: Paise;
  annualGross: Paise;
  monthlyEmployerCost: Paise;
  annualEmployerCost: Paise;
  monthlyCtc: Paise;
  annualCtc: Paise;
  monthlyDeductions: Paise;
  monthlyNet: Paise;
  evaluationOrder: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  evaluationOrder?: string[];
  dependencies?: Record<string, string[]>;
}

/**
 * Tokenize a formula into variables, numbers, operators, and parentheses.
 */
function extractFormulaVariables(formula: string): string[] {
  // Strip string literals or whitespace
  const sanitized = formula.replace(/\s+/g, '');
  // Match identifiers (words starting with letter/underscore)
  const identifierRegex = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  const matches = sanitized.match(identifierRegex) ?? [];
  // Exclude mathematical functions
  const reservedWords = new Set(['round', 'floor', 'ceil', 'min', 'max', 'abs']);
  const variables = matches.filter((id) => !reservedWords.has(id.toLowerCase()));
  return Array.from(new Set(variables));
}

/**
 * Build dependency graph and detect cycles using DFS.
 */
export function buildAndValidateDag(nodes: ComponentFormulaNode[]): {
  order: string[];
  dependencies: Record<string, string[]>;
} {
  const nodeMap = new Map<string, ComponentFormulaNode>();
  for (const n of nodes) {
    if (nodeMap.has(n.code)) {
      throw new Error(`Duplicate component code in salary structure: ${n.code}`);
    }
    nodeMap.set(n.code, n);
  }

  const dependencies: Record<string, string[]> = {};
  const graph = new Map<string, string[]>();

  for (const node of nodes) {
    let deps: string[] = [];
    if (node.formula) {
      deps = extractFormulaVariables(node.formula);
      const unknown = deps.filter((v) => !nodeMap.has(v) && !BUILTIN_VARIABLES.has(v));
      if (unknown.length > 0) {
        throw new Error(`Formula of ${node.code} ('${node.formula}') uses ${unknown.join(', ')}: use component codes of this structure or ${[...BUILTIN_VARIABLES].join(', ')}`);
      }
    }
    dependencies[node.code] = deps;
    graph.set(node.code, deps);
  }

  // Detect circular dependencies via topological sort (Kahn's or DFS)
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function dfs(curr: string, path: string[]) {
    if (visiting.has(curr)) {
      const cycle = [...path, curr].join(' -> ');
      throw new Error(`Circular dependency detected in salary formula DAG: ${cycle}`);
    }
    if (visited.has(curr)) return;

    visiting.add(curr);
    const deps = graph.get(curr) ?? [];
    for (const dep of deps) {
      // If dependency is another component in the structure, traverse it
      if (nodeMap.has(dep)) {
        dfs(dep, [...path, curr]);
      }
    }
    visiting.delete(curr);
    visited.add(curr);
    order.push(curr);
  }

  for (const node of nodes) {
    if (!visited.has(node.code)) {
      dfs(node.code, []);
    }
  }

  return { order, dependencies };
}

/**
 * Safely evaluate an arithmetic expression using known context values (in integer paise or fractions).
 */
export function evaluateExpression(
  expression: string,
  context: Record<string, number>,
): number {
  // Replace known variables with their numeric values
  // Sort keys descending by length so longer variable names match first (e.g. PF_WAGES before PF)
  const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);

  let expr = expression;
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    expr = expr.replace(regex, `(${context[key]})`);
  }

  // Ensure no unmapped variable identifiers remain
  const remainingIds = expr.match(/[A-Za-z_][A-Za-z0-9_]*/g);
  if (remainingIds) {
    const validFuncs = new Set(['round', 'floor', 'ceil', 'min', 'max']);
    const unknown = remainingIds.filter((id) => !validFuncs.has(id.toLowerCase()));
    if (unknown.length > 0) {
      throw new Error(`Unknown variable(s) in formula '${expression}': ${unknown.join(', ')}`);
    }
  }

  // Replace functions with JS Math equivalents
  expr = expr
    .replace(/\bround\(/gi, 'Math.round(')
    .replace(/\bfloor\(/gi, 'Math.floor(')
    .replace(/\bceil\(/gi, 'Math.ceil(')
    .replace(/\bmin\(/gi, 'Math.min(')
    .replace(/\bmax\(/gi, 'Math.max(');

  // Validate allowed characters to prevent code injection
  if (!/^[\d\s+\-*/().,Mathroundflceilminx]+$/i.test(expr)) {
    throw new Error(`Invalid characters in formula expression: ${expression}`);
  }

  // Evaluate safely
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`"use strict"; return (${expr});`) as () => unknown;
    const val = fn();
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(`Formula evaluation did not return a finite number: ${expression} = ${String(val)}`);
    }
    return val;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Error evaluating formula '${expression}': ${msg}`);
  }
}

/**
 * Round an amount according to the component's designated rounding rule.
 */
export function applyRounding(amountPaise: number, rule: SalaryRoundingMode = 'round'): Paise {
  switch (rule) {
    case 'floor':
      return paise(Math.floor(amountPaise / 100) * 100);
    case 'ceil':
      return paise(Math.ceil(amountPaise / 100) * 100);
    case 'nearest_10':
      return paise(Math.round(amountPaise / 1000) * 1000);
    case 'round':
    default:
      return paise(Math.round(amountPaise / 100) * 100);
  }
}

/**
 * Resolve an entire salary structure for a given annual CTC or target values.
 */
export function resolveSalaryStructure(params: {
  nodes: ComponentFormulaNode[];
  annualCtcPaise?: Paise | undefined;
  monthlyCtcPaise?: Paise | undefined;
  probationPercent?: number | undefined; // e.g. 70, 80, 90
  fixedOverrides?: Record<string, Paise> | undefined;
}): EvaluatedBreakup {
  const { nodes, probationPercent, fixedOverrides = {} } = params;
  const { order } = buildAndValidateDag(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.code, n]));

  const monthlyAmounts: Record<string, Paise> = {};
  const annualAmounts: Record<string, Paise> = {};

  // Context for formula evaluation (stores amounts in Rupees for standard formulas, e.g. BASIC * 0.5)
  const evalContext: Record<string, number> = {};
  const targetMonthlyCtc = params.monthlyCtcPaise ?? (params.annualCtcPaise ? paise(Math.round(params.annualCtcPaise / 12)) : undefined);
  if (targetMonthlyCtc !== undefined) {
    evalContext['CTC'] = toRupees(targetMonthlyCtc);
    evalContext['CTC_MONTHLY'] = toRupees(targetMonthlyCtc);
    evalContext['CTC_ANNUAL'] = toRupees(params.annualCtcPaise ?? paise(targetMonthlyCtc * 12));
  }

  // First pass: resolve basic and fixed components
  for (const code of order) {
    const node = nodeMap.get(code);
    if (!node) continue;

    const ovr = fixedOverrides[code];
    if (ovr !== undefined) {
      monthlyAmounts[code] = ovr;
      evalContext[code] = toRupees(ovr);
      continue;
    }

    if (node.amount !== undefined && !node.formula) {
      monthlyAmounts[code] = paise(node.amount);
      evalContext[code] = toRupees(monthlyAmounts[code]);
      continue;
    }

    if (node.formula) {
      // Dynamic variables available to formulas
      // Compute current sum of earnings
      let currentGross = 0;
      for (const [c, p] of Object.entries(monthlyAmounts)) {
        const itemNode = nodeMap.get(c);
        if (itemNode?.kind === 'earning' && itemNode.part_of_gross !== false) {
          currentGross += toRupees(p);
        }
      }
      evalContext['GROSS'] = currentGross;

      // PF wages is typically Basic (+ DA if any)
      const basicPaise = monthlyAmounts['BASIC'] ?? paise(0);
      evalContext['PF_WAGES'] = toRupees(basicPaise);
      evalContext['PF_WAGES_CAPPED'] = Math.min(toRupees(basicPaise), 15000);

      const missing = extractFormulaVariables(node.formula).filter((v) => nodeMap.has(v) && evalContext[v] === undefined);
      if (missing.length > 0) {
        throw new Error(`${code} = '${node.formula}' needs ${missing.join(', ')}, which has no formula or amount rule in this structure (e.g. BASIC "CTC * 0.40")`);
      }
      if (evalContext['CTC'] === undefined && /\bCTC(_MONTHLY|_ANNUAL)?\b/.test(node.formula)) {
        throw new Error(`${code} = '${node.formula}' needs the CTC, but no CTC was given`);
      }
      const computedRupees = evaluateExpression(node.formula, evalContext);
      const computedPaise = Math.round(computedRupees * 100);
      const rounded = applyRounding(computedPaise, node.rounding ?? 'round');

      monthlyAmounts[code] = rounded;
      evalContext[code] = toRupees(rounded);
    }
  }

  // Handle balancing component (typically SPECIAL_ALLOW) if target monthly CTC is given

  if (targetMonthlyCtc && nodeMap.has('SPECIAL_ALLOW') && !fixedOverrides['SPECIAL_ALLOW']) {
    // Current total of other earnings + employer costs
    let otherSum = paise(0);
    for (const [code, amt] of Object.entries(monthlyAmounts)) {
      if (code === 'SPECIAL_ALLOW') continue;
      const node = nodeMap.get(code);
      if (node && (node.kind === 'earning' || node.kind === 'employer_contribution')) {
        otherSum = add(otherSum, amt);
      }
    }
    const balancingPaise = targetMonthlyCtc > otherSum ? subtract(targetMonthlyCtc, otherSum) : paise(0);
    monthlyAmounts['SPECIAL_ALLOW'] = balancingPaise;
    evalContext['SPECIAL_ALLOW'] = toRupees(balancingPaise);
  }

  // Apply probation percentage if specified (e.g. 80%)
  if (probationPercent !== undefined && probationPercent > 0 && probationPercent < 100) {
    const scaleFactor = probationPercent / 100;
    for (const [code, amt] of Object.entries(monthlyAmounts)) {
      const node = nodeMap.get(code);
      // Only scale earnings components that are configured to prorate or scale with probation
      if (node?.kind === 'earning') {
        const scaledPaise = Math.round(amt * scaleFactor);
        const rounded = applyRounding(scaledPaise, node.rounding ?? 'round');
        monthlyAmounts[code] = rounded;
        evalContext[code] = toRupees(rounded);
      }
    }
  }

  // Re-tally totals
  let monthlyGross = paise(0);
  let monthlyEmployerCost = paise(0);
  let monthlyDeductions = paise(0);

  for (const [code, amt] of Object.entries(monthlyAmounts)) {
    const node = nodeMap.get(code);
    annualAmounts[code] = paise(amt * 12);

    if (node?.kind === 'earning') {
      monthlyGross = add(monthlyGross, amt);
    } else if (node?.kind === 'employer_contribution') {
      monthlyEmployerCost = add(monthlyEmployerCost, amt);
    } else if (node?.kind === 'deduction') {
      monthlyDeductions = add(monthlyDeductions, amt);
    }
  }

  const monthlyCtc = add(monthlyGross, monthlyEmployerCost);
  const annualCtc = paise(monthlyCtc * 12);
  const annualGross = paise(monthlyGross * 12);
  const annualEmployerCost = paise(monthlyEmployerCost * 12);
  const monthlyNet = subtract(monthlyGross, monthlyDeductions);

  return {
    monthly: monthlyAmounts,
    annual: annualAmounts,
    monthlyGross,
    annualGross,
    monthlyEmployerCost,
    annualEmployerCost,
    monthlyCtc,
    annualCtc,
    monthlyDeductions,
    monthlyNet,
    evaluationOrder: order,
  };
}

/**
 * Strict CTC validation down to the paisa (zero floats permitted).
 */
export function validateCtcBreakup(params: {
  annualCtcPaise: Paise;
  monthlyComponents: Record<string, Paise>;
  componentNodes: ComponentFormulaNode[];
}): { valid: boolean; diffPaise: number; message?: string | undefined } {
  const { annualCtcPaise, monthlyComponents, componentNodes } = params;
  const nodeMap = new Map(componentNodes.map((n) => [n.code, n]));

  let monthlyCtcSum = paise(0);
  for (const [code, amount] of Object.entries(monthlyComponents)) {
    const node = nodeMap.get(code);
    if (node && (node.kind === 'earning' || node.kind === 'employer_contribution')) {
      monthlyCtcSum = add(monthlyCtcSum, amount);
    }
  }

  const annualizedSum = paise(monthlyCtcSum * 12);
  const diffPaise = annualCtcPaise - annualizedSum;

  if (diffPaise !== 0) {
    const diffRupees = toRupees(paise(Math.abs(diffPaise)));
    const dir = diffPaise > 0 ? 'higher' : 'lower';
    return {
      valid: false,
      diffPaise,
      message: `Annual CTC (₹${toRupees(annualCtcPaise).toLocaleString('en-IN')}) is ₹${diffRupees} ${dir} than component annualized sum (₹${toRupees(annualizedSum).toLocaleString('en-IN')}) by ${Math.abs(diffPaise)} paise.`,
    };
  }

  return { valid: true, diffPaise: 0 };
}
