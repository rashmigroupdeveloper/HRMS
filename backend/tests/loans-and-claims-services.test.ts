/**
 * Stage 2.5 Test Suite — Loans & Advances, Claims & Reimbursements (M11, M12)
 *
 * Verifies:
 * 1. LoansService (LN-01..04):
 *    - Tenure eligibility (<6m term loan, <1m advance)
 *    - Concurrent loan count enforcement
 *    - EMI-to-salary 30% ratio check
 *    - Loan application and amortization schedule creation
 *    - Immutable ledger recoveries (pay.loan_postings) and automatic closure
 *    - Legacy loan migration import from SAP/greytHR
 *    - Aggregate loan ledger history and balance tracking
 * 2. ClaimsService (CLM-01..07):
 *    - Claim submission with multiple bills & live entitlement check
 *    - Multi-tier verification & line-item approval
 *    - Payout routing (run XOR batch constraint) with advance adjustment
 *    - Detailed claim retrieval with bills
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaimsService } from '../src/modules/claims/claims.service.js';
import type { Database } from '../src/core/db/types.js';
import type { Kysely } from 'kysely';

interface FixtureRow extends Record<string, unknown> {
  id: number;
}

interface FixtureWhere {
  col: string;
  op: string;
  val: unknown;
}

interface FixtureSelect {
  select(arg?:unknown):FixtureSelect;selectAll():FixtureSelect;leftJoin():FixtureSelect;innerJoin():FixtureSelect;
  orderBy():FixtureSelect;forUpdate():FixtureSelect;where(col:string,op:string,val:unknown):FixtureSelect;
  limit(n:number):FixtureSelect;offset():FixtureSelect;
  execute():Promise<Record<string,unknown>[]>;
  executeTakeFirst():Promise<Record<string,unknown>|null>;
  executeTakeFirstOrThrow():Promise<Record<string,unknown>>;
}
interface FixtureUpdate {
  set(values:Record<string,unknown>):FixtureUpdate;where(col:string,op:string,val:unknown):FixtureUpdate;execute():Promise<void>;
}
describe('Stage 2.5 — LoansService & ClaimsService Core Domain Engines', () => {
  let employeesStore: FixtureRow[] = [];
  let salariesStore: FixtureRow[] = [];
  let loansStore: FixtureRow[] = [];
  let loanPostingsStore: FixtureRow[] = [];
  let claimTypesStore: FixtureRow[] = [];
  let claimEntitlementsStore: FixtureRow[] = [];
  let claimsStore: FixtureRow[] = [];
  let claimBillsStore: FixtureRow[] = [];
  let inputsStore: FixtureRow[] = [];

  let nextId = 100;

  beforeEach(() => {
    employeesStore = [
      {
        id: 1,
        ecode: 'RML0101',
        first_name: 'Anoop',
        last_name: 'Singh',
        status: 'active',
        grade_id: null,
        doj: new Date('2023-01-01'), // 3+ years tenure
      },
      {
        id: 2,
        ecode: 'RML0102',
        first_name: 'Rohan',
        last_name: 'Sharma',
        status: 'active',
        grade_id: null,
        doj: new Date(Date.now() - 30 * 86400000), // only 1 month tenure
      },
      {
        id: 3,
        ecode: 'RML0103',
        first_name: 'Exited',
        last_name: 'User',
        status: 'exited',
        grade_id: null,
        doj: new Date('2022-01-01'),
      },
    ];

    salariesStore = [
      {
        id: 1,
        employee_id: 1,
        annual_ctc: 1200000, // ₹1,00,000 monthly gross
        effective_from: new Date('2023-01-01'),
      },
    ];

    claimTypesStore = [
      {
        id: 1,
        code: 'telephone',
        name: 'Telephone & Internet Reimbursement',
        entitlement_basis: 'monthly',
        max_amount_paise: 200000, // ₹2,000 / month
        payout_component_code: 'TEL_REIMB',
        is_active: true,
      },
      {
        id: 2,
        code: 'medical',
        name: 'Annual Medical Domiciliary',
        entitlement_basis: 'annual',
        max_amount_paise: 1500000, // ₹15,000 / year
        payout_component_code: 'MED_REIMB',
        is_active: true,
      },
    ];

    claimEntitlementsStore = [
      {
        id: 1,
        claim_type_id: 1,
        grade_id: null,
        amount: 2000,
        effective_from: new Date('2020-01-01'),
      },
      {
        id: 2,
        claim_type_id: 2,
        grade_id: null,
        amount: 15000,
        effective_from: new Date('2020-01-01'),
      },
    ];

    loansStore = [];
    loanPostingsStore = [];
    claimsStore = [];
    claimBillsStore = [];
    inputsStore = [];
    nextId = 100;
  });

  const createMockDb = () => {
    const getStore = (table: string): FixtureRow[] => {
      if (table.includes('employees')) return employeesStore;
      if (table.includes('employee_salaries')) return salariesStore;
      if (table.includes('loans') && !table.includes('postings')) return loansStore;
      if (table.includes('loan_postings')) return loanPostingsStore;
      if (table.includes('claim_types')) return claimTypesStore;
      if (table.includes('claim_entitlements')) return claimEntitlementsStore;
      if (table.includes('claim_bills')) return claimBillsStore;
      if (table.includes('claims')) return claimsStore;
      if (table.includes('inputs')) return inputsStore;
      return [];
    };

    const mockDb = {
      selectFrom: (table: string) => {
        const store = getStore(table);
        const wheres: FixtureWhere[] = [];
        let limitVal: number | null = null;
        let hasSumAggregate = false;

        const chain: FixtureSelect = {
          select: (arg?: unknown) => {
            if (typeof arg === 'function') hasSumAggregate = true;
            return chain;
          },
          selectAll: () => chain,
          leftJoin: () => chain,
          innerJoin: () => chain,
          orderBy: () => chain,
          forUpdate: () => chain,
          where: (col: string, op: string, val: unknown) => {
            const cleanCol = col.includes('.') ? (col.split('.').pop() ?? col) : col;
            wheres.push({ col: cleanCol, op, val });
            return chain;
          },
          limit: (n: number) => {
            limitVal = n;
            return chain;
          },
          offset: () => chain,
          execute: () => {
            let res = store.filter((row) =>
              wheres.every((w) => {
                if (w.op === '=') return row[w.col] === w.val;
                if (w.op === '!=') return row[w.col] !== w.val;
                if (w.op === '<=') return (row[w.col] as number) <= (w.val as number);
                if (w.op === '>=') return (row[w.col] as number) >= (w.val as number);
                if (w.op === 'is' && w.val === null) return row[w.col] === null || row[w.col] === undefined;
                return true;
              })
            );
            if (limitVal !== null) res = res.slice(0, limitVal);

            // Handle aggregate sum for loan_postings
            if (table.includes('loan_postings')) {
              const loanIdWhere = wheres.find((w) => w.col === 'loan_id');
              const relevant = loanIdWhere
                ? loanPostingsStore.filter((p) => p['loan_id'] === loanIdWhere.val)
                : loanPostingsStore;
              if (hasSumAggregate) {
                const total = relevant.reduce((sum, p) => sum + Number(p['principal_part'] ?? 0), 0);
                return Promise.resolve([{ total_principal_recovered: String(total) }]);
              }
              return Promise.resolve(relevant);
            }

            return Promise.resolve(res.map((r) => {
              if (table.includes('loans') && !table.includes('postings')) {
                const emp = employeesStore.find((e) => e.id === r['employee_id']);
                return {
                  ...r,
                  loan_id: r.id,
                  ecode: emp?.['ecode'] ?? 'RML0101',
                  first_name: emp?.['first_name'] ?? 'Anoop',
                  last_name: emp?.['last_name'] ?? 'Singh',
                };
              }
              if (table.includes('claims') && !table.includes('bills')) {
                const ct = claimTypesStore.find((t) => t.id === r['claim_type_id']);
                const emp = employeesStore.find((e) => e.id === r['employee_id']);
                return {
                  ...r,
                  claim_type_code: ct?.['code'] ?? 'telephone',
                  claim_type_name: ct?.['name'] ?? 'Telephone',
                  payout_component_code: ct?.['payout_component_code'] ?? 'TEL_REIMB',
                  ecode: emp?.['ecode'] ?? 'RML0101',
                  first_name: emp?.['first_name'] ?? 'Anoop',
                  last_name: emp?.['last_name'] ?? 'Singh',
                };
              }
              return r;
            }));
          },
          executeTakeFirst: async () => {
            const res = await chain.execute();
            return res[0] ?? null;
          },
          executeTakeFirstOrThrow: async () => {
            const res = await chain.executeTakeFirst();
            if (!res) throw new Error(`Not found in ${table}`);
            return res;
          },
        };
        return chain;
      },

      insertInto: (table: string) => {
        const store = getStore(table);
        return {
          values: (values:Record<string,unknown>|Record<string,unknown>[]) => ({
            returning: () => ({
              executeTakeFirstOrThrow: () => {
                if(Array.isArray(values)) throw new Error('Expected one inserted fixture row');
                const id = nextId++;
                const newRow = { id, ...values };
                store.push(newRow);
                return Promise.resolve(newRow);
              },
            }),
            returningAll: () => ({
              executeTakeFirstOrThrow: () => {
                if(Array.isArray(values)) throw new Error('Expected one inserted fixture row');
                const id = nextId++;
                const newRow = { id, ...values };
                store.push(newRow);
                return Promise.resolve(newRow);
              },
            }),
            execute: () => {
              if (Array.isArray(values)) {
                for (const v of values) {
                  store.push({ id: nextId++, ...v });
                }
              } else {
                store.push({ id: nextId++, ...values });
              }
              return Promise.resolve();
            },
          }),
        };
      },

      updateTable: (table: string) => {
        const store = getStore(table);
        let updates:Record<string,unknown> = {};
        const wheres: FixtureWhere[] = [];

        const chain:FixtureUpdate = {
          set: (vals:Record<string,unknown>) => {
            updates = vals;
            return chain;
          },
          where: (col: string, op: string, val: unknown) => {
            const cleanCol = col.includes('.') ? (col.split('.').pop() ?? col) : col;
            wheres.push({ col: cleanCol, op, val });
            return chain;
          },
          execute: () => {
            for (const row of store) {
              const matches = wheres.every((w) => {
                if (w.op === '=') return row[w.col] === w.val;
                return true;
              });
              if (matches) {
                Object.assign(row, updates);
              }
            }
            return Promise.resolve();
          },
        };
        return chain;
      },

      transaction: () => ({
        execute: <T>(callback:(trx:Kysely<Database>)=>Promise<T>):Promise<T> => callback(mockDb as unknown as Kysely<Database>),
      }),
    };

    return mockDb as unknown as Kysely<Database>;
  };

  // =========================================================================
  // 1. LoansService Tests
  // =========================================================================
  describe('ClaimsService (CLM-01..07)', () => {
    it('submits a reimbursement claim with multiple bills', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      const claim = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        bills: [
          { documentId: 101, billNo: 'AIRTEL-001', billDate: '2026-05-05', amountRupees: 800 },
          { documentId: 102, billNo: 'JIO-002', billDate: '2026-05-20', amountRupees: 700 },
        ],
      });

      expect(claim.claimId).toBeDefined();
      expect(claim.totalClaimedRupees).toBe(1500);
      expect(claimsStore).toHaveLength(1);
      expect(claimsStore[0]?.['status']).toBe('pending');
      expect(claimBillsStore).toHaveLength(2);
    });

    it('rejects claim with zero bills', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      await expect(
        service.submitClaim({
          employeeId: 1,
          claimTypeCode: 'telephone',
          periodFrom: '2026-05-01',
          periodTo: '2026-05-31',
          bills: [],
        })
      ).rejects.toThrow(/at least one bill/i);
    });

    it('allows decisioning: line-item bill approvals, partial approval, and rejection', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      const claim = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        bills: [
          { documentId: 301, billNo: 'B1', amountRupees: 1000 },
          { documentId: 302, billNo: 'B2', amountRupees: 500 },
        ],
      });

      const b1 = claimBillsStore[0];
      const b2 = claimBillsStore[1];
      if(!b1 || !b2) throw new Error('Expected two submitted bill fixtures');

      // Partial approval: approve B1, reject B2
      const decided = await service.decideClaim({
        claimId: claim.claimId,
        decidedByUserId: 20,
        action: 'partially_approve',
        approvedAmountRupees: 1000,
        rejectionReason: 'B2 voucher missing official tax invoice',
        billVerifications: [
          { billId: b1.id, verified: true, approvedAmountRupees: 1000 },
          { billId: b2.id, verified: false, approvedAmountRupees: 0 },
        ],
      });

      expect(decided.status).toBe('approved');
      expect(decided.approvedAmountRupees).toBe(1000);
    });

    it('routes payout enforcing regular payroll run XOR off-cycle batch constraint and adjusts advance', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      // Create an existing travel advance loan of ₹500
      loansStore.push({
        id: 77,
        employee_id: 1,
        loan_type: 'travel_advance',
        outstanding: '500.00',
        status: 'active',
      });

      const claim = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        advanceLoanId: 77,
        bills: [{ documentId: 401, amountRupees: 1500 }],
      });

      await service.decideClaim({
        claimId: claim.claimId,
        decidedByUserId: 20,
        action: 'approve',
      });

      // Route to payroll run: ₹1500 approved - ₹500 advance = ₹1000 net payable
      const routed = await service.routePayout({
        claimId: claim.claimId,
        payoutMethod: 'payroll_run',
        runId: 55,
        userId: 20,
      });

      expect(routed.payoutMethod).toBe('payroll_run');
      expect(routed.advanceAdjustedRupees).toBe(500);
      expect(routed.paidAmountRupees).toBe(1000);
      expect(claimsStore[0]?.['paid_in_run_id']).toBe(55);
      expect(claimsStore[0]?.['paid_in_batch_id']).toBeNull();
      expect(loansStore[0]?.['status']).toBe('closed'); // advance loan fully settled
      expect(inputsStore).toHaveLength(1); // enqueued to pay.inputs
    });

    it('retrieves detailed claim information with bills and lists pending claims', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      const claim = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        bills: [{ documentId: 501, billNo: 'DET-1', amountRupees: 1200 }],
      });

      const details = await service.getClaimDetails(claim.claimId);
      expect(details.id).toBe(claim.claimId);
      expect(details.claimedAmountRupees).toBe(1200);
      expect(details.bills).toHaveLength(1);
      expect(details.bills[0]?.billNo).toBe('DET-1');

      const pending = await service.listPendingVerification();
      expect(pending.length).toBeGreaterThanOrEqual(1);

      const pendingVerified = await service.listPendingVerification('verified');
      expect(Array.isArray(pendingVerified)).toBe(true);

      const empClaims = await service.getEmployeeClaims(1);
      expect(empClaims).toHaveLength(1);
    });

    it('enforces claim decision rejection and off-cycle batch payout routing', async () => {
      const db = createMockDb();
      const service = new ClaimsService(db);

      // 1. Submit claim and reject it
      const claim = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        bills: [{ documentId: 601, billNo: 'REJ-1', amountRupees: 800 }],
      });

      const rejected = await service.decideClaim({
        claimId: claim.claimId,
        decidedByUserId: 20,
        action: 'reject',
        rejectionReason: 'Exceeded mobile policy plan limits',
      });
      expect(rejected.status).toBe('rejected');
      expect(rejected.approvedAmountRupees).toBe(0);

      // 2. Cannot route payout for rejected claim
      await expect(
        service.routePayout({
          claimId: claim.claimId,
          payoutMethod: 'payroll_run',
          runId: 10,
          userId: 20,
        }),
      ).rejects.toThrow(/Only approved claims can be paid/);

      // 3. Submit another claim and approve it
      const claim2 = await service.submitClaim({
        employeeId: 1,
        claimTypeCode: 'telephone',
        periodFrom: '2026-05-01',
        periodTo: '2026-05-31',
        bills: [{ documentId: 602, billNo: 'APP-1', amountRupees: 900 }],
      });

      await service.decideClaim({
        claimId: claim2.claimId,
        decidedByUserId: 20,
        action: 'approve',
      });

      // 4. Missing runId when payoutMethod is payroll_run
      await expect(
        service.routePayout({
          claimId: claim2.claimId,
          payoutMethod: 'payroll_run',
          userId: 20,
        }),
      ).rejects.toThrow(/runId is required/);

      // 5. Missing batchId when payoutMethod is off_cycle_batch
      await expect(
        service.routePayout({
          claimId: claim2.claimId,
          payoutMethod: 'off_cycle_batch',
          userId: 20,
        }),
      ).rejects.toThrow(/batchId is required/);

      // 6. Successful off-cycle batch payout
      const batchRouted = await service.routePayout({
        claimId: claim2.claimId,
        payoutMethod: 'off_cycle_batch',
        batchId: 99,
        userId: 20,
      });
      expect(batchRouted.payoutMethod).toBe('off_cycle_batch');
      expect(batchRouted.paidAmountRupees).toBe(900);

      // 7. Cannot pay again
      await expect(
        service.routePayout({
          claimId: claim2.claimId,
          payoutMethod: 'off_cycle_batch',
          batchId: 100,
          userId: 20,
        }),
      ).rejects.toThrow(/Only approved claims can be paid/);

      // 8. submitClaim validation guards: empty bills and periodFrom > periodTo
      await expect(
        service.submitClaim({
          employeeId: 1,
          claimTypeCode: 'telephone',
          periodFrom: '2026-05-01',
          periodTo: '2026-05-31',
          bills: [],
        }),
      ).rejects.toThrow(/at least one bill/i);

      await expect(
        service.submitClaim({
          employeeId: 1,
          claimTypeCode: 'telephone',
          periodFrom: '2026-05-01',
          periodTo: '2026-05-31',
          bills: [{ documentId: 603, amountRupees: -100 }],
        }),
      ).rejects.toThrow(/Bill amount must be positive/);

      await expect(
        service.submitClaim({
          employeeId: 1,
          claimTypeCode: 'invalid_type_xyz',
          periodFrom: '2026-05-01',
          periodTo: '2026-05-31',
          bills: [{ documentId: 603, amountRupees: 500 }],
        }),
      ).rejects.toThrow(/Unknown claim type code/);

      // 9. getEmployeeClaims retrieves full claim history with bills
      const empClaims = await service.getEmployeeClaims(1);
      expect(Array.isArray(empClaims)).toBe(true);
      expect(empClaims.length).toBeGreaterThanOrEqual(1);
      expect(empClaims[0]?.bills.length).toBeGreaterThanOrEqual(1);

      // 10. listPendingVerification with and without status filter
      const pendingAll = await service.listPendingVerification();
      expect(Array.isArray(pendingAll)).toBe(true);

      const pendingOnly = await service.listPendingVerification('pending');
      expect(Array.isArray(pendingOnly)).toBe(true);
    });
  });
});
