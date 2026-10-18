-- Undo the payroll tester's workarounds and the artefacts of fixed bugs, so the
-- fixed engine recomputes the same June 2026 cohort as originally intended.
BEGIN;
DELETE FROM pay.salary_holds WHERE id = 3 AND reason LIKE 'Negative net pay%';       -- workaround for P-14
UPDATE att.overtime_entries SET status = 'approved' WHERE id = 2;                   -- workaround for P-06 (rejected by SQL)
DELETE FROM pay.fnf_settlements WHERE id IN (2, 3);                                  -- P-02 corrupted F&F (x100, negative, paid)
UPDATE core.employees SET contract_type = 'apprentice' WHERE ecode = 'RML033907';   -- P-18: now representable
UPDATE core.separations SET status = 'approved' WHERE id IN (6, 7) AND status = 'completed';  -- reached only via the corrupted F&F pay
UPDATE core.separations SET shortfall_days = 0 WHERE id IN (6, 7);  -- P-22 artefact: LWD before the (later) resignation date gave 210/215 bogus shortfall days
COMMIT;
