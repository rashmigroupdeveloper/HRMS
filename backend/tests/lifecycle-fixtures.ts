/** Typed unit fixtures only: these do not emulate PostgreSQL constraints/transactions. */
export interface FixtureRow extends Record<string, unknown> {
  id: number;
  employee_id?: number;
  prejoin_link_token?: string;
  due_date?: Date | string;
  confirmation_date?: Date | string;
  effective_from?: Date | string;
  annual_ctc?: string;
  requested_lwd?: Date;
}

export interface FixtureWhere { col: string; op?: string | undefined; val: unknown }
export interface FixtureExpressionBuilder {
  (col: string, op: string, val: unknown): FixtureWhere;
  or(arr: FixtureWhere[]): void;
}

export interface FixtureSelect {
  _where: FixtureWhere[];
  _joins?: unknown[];
  selectAll(): FixtureSelect;
  select(): FixtureSelect;
  leftJoin?: () => FixtureSelect;
  innerJoin?: () => FixtureSelect;
  orderBy(): FixtureSelect;
  where(col: string | ((eb: FixtureExpressionBuilder) => unknown), op?: string, val?: unknown): FixtureSelect;
  execute(): Promise<FixtureRow[]>;
  executeTakeFirst(): Promise<FixtureRow | null | undefined>;
  executeTakeFirstOrThrow?: () => Promise<FixtureRow>;
}

export interface FixtureInsert {
  _val: Partial<FixtureRow>;
  values(value: Partial<FixtureRow>): FixtureInsert;
  returning(): FixtureInsert;
  executeTakeFirstOrThrow(): Promise<{ id: number }>;
  executeTakeFirst(): Promise<{ id: number }>;
  execute(): Promise<void>;
}

export interface FixtureUpdate {
  _set: Partial<FixtureRow>;
  _where: FixtureWhere[];
  set(value: Partial<FixtureRow>): FixtureUpdate;
  where(col: string, op: string, val: unknown): FixtureUpdate;
  execute(): Promise<void>;
}

export function requireFixture<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Required test fixture missing');
  return value;
}

export function fixtureDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'object' && value !== null && 'toOperationNode' in value && typeof value.toOperationNode === 'function') {
    const node = (value as { toOperationNode: () => unknown }).toOperationNode();
    if (typeof node === 'object' && node !== null && 'parameters' in node && Array.isArray(node.parameters)) {
      const parameter: unknown = node.parameters[0];
      if (typeof parameter === 'object' && parameter !== null && 'value' in parameter && typeof parameter.value === 'string') return parameter.value;
    }
  }
  throw new Error('Fixture must supply a business date or SQL date literal');
}
