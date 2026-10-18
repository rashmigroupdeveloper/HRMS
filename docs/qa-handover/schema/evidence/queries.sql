-- Read-only evidence queries used for SCHEMA_AUDIT.md (run with PGOPTIONS='-c default_transaction_read_only=on')
-- S-01 statutory config
SELECT count(*) FROM pay.statutory_rates;                                   -- 0
SELECT code, formula FROM pay.salary_components WHERE formula ~ '\d\.\d';  -- literal rates in formulas
-- S-02 claims insert vs CHECK
SELECT column_name, is_nullable, column_default FROM information_schema.columns
 WHERE table_schema='pay' AND table_name='claims' AND column_name IN ('funding_kind','budget_id');
SELECT (('budget'::text <> 'budget'::text) OR (NULL::bigint IS NOT NULL)) AS claims_budget_present_result; -- false
-- S-03 identifiers
SELECT ecode, pan FROM core.employees WHERE pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$';
-- S-04 mandatory nulls
SELECT count(*) FILTER (WHERE contract_type IS NULL), count(*) FILTER (WHERE cost_center_id IS NULL), count(*) FILTER (WHERE gender IS NULL) FROM core.employees;
-- S-05 salary structure company mismatch
SELECT es.id, e.ecode, e.company_id, s.company_id FROM pay.employee_salaries es JOIN core.employees e ON e.id=es.employee_id JOIN pay.salary_structures s ON s.id=es.structure_id WHERE e.company_id<>s.company_id;
-- S-06 te.advances owner mismatch
SELECT a.id, a.employee_id, t.employee_id FROM te.advances a JOIN te.trips t ON t.id=a.trip_id WHERE a.employee_id<>t.employee_id;
-- S-07 separations
SELECT id, employee_id, status, workflow_request_id FROM core.separations ORDER BY id;
-- S-08 loans
SELECT id, employee_id, loan_type, principal, interest_rate, emi, status, workflow_request_id FROM pay.loans;
SELECT count(*) FROM core.audit_log WHERE entity IN ('pay.loans','core.separations','lv.applications');
-- S-09 gender vocabulary
SELECT t.code, t.applicable_gender, count(e.id) FILTER (WHERE e.gender=t.applicable_gender), count(e.id) FILTER (WHERE e.gender ILIKE 'f%') FROM lv.leave_types t CROSS JOIN core.employees e WHERE t.applicable_gender IS NOT NULL GROUP BY 1,2;
-- S-10 future attendance
SELECT employee_id, work_date, status, source FROM att.day_records WHERE work_date > (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY 2;
-- S-11 claim types
SELECT code, bill_required, requires_bill, taxable_if_unsubstantiated, is_taxable, payout_component_code FROM pay.claim_types;
SELECT count(*) FROM pay.salary_components WHERE code='REIMB'; -- 0
-- S-16 updated_at not maintained
SELECT id, status, created_at, updated_at FROM core.separations;
-- S-19 partitions
SELECT c.relname, pg_get_expr(c.relpartbound,c.oid) FROM pg_class c WHERE c.relispartition AND c.relkind='r';
-- S-20 roles
SELECT rolname, rolsuper FROM pg_roles WHERE rolname IN ('hrms','hrms_app','hrms_ro');
