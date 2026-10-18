-- E2E-only personas that the QA seed lacks (test DB hrms_e2e only).
BEGIN;
-- HOD / department head of Dept 4 (functional manager for RML000008/09): hod@rashmi.test
INSERT INTO core.employees (ecode, company_id, first_name, last_name, gender, status, doj, org_unit_id, department_id, location_id, reporting_manager_id, work_email)
SELECT 'RML000090', 1, 'Hemant', 'DeptHead', 'Male', 'active', DATE '2020-01-01', 1, 4, (SELECT location_id FROM core.employees WHERE id=8), 1, 'hod@rashmi.test'
WHERE NOT EXISTS (SELECT 1 FROM core.employees WHERE ecode='RML000090');
-- RGH-scoped HR ops: hrops.rgh@rashmi.test
INSERT INTO core.employees (ecode, company_id, first_name, last_name, gender, status, doj, org_unit_id, department_id, location_id, work_email)
SELECT 'RGH000090', 2, 'Sweta', 'RGH-HROps', 'Female', 'active', DATE '2021-01-01', 2, 2, (SELECT location_id FROM core.employees WHERE id=11), 'hrops.rgh@rashmi.test'
WHERE NOT EXISTS (SELECT 1 FROM core.employees WHERE ecode='RGH000090');
INSERT INTO core.users (employee_id, email, password_hash)
SELECT e.id, e.work_email, (SELECT password_hash FROM core.users WHERE email='employee@rashmi.test')
FROM core.employees e WHERE e.ecode IN ('RML000090','RGH000090')
ON CONFLICT (email) DO NOTHING;
INSERT INTO core.user_roles (user_id, role_id, scope_org_unit_id)
SELECT u.id, r.id, NULL FROM core.users u, core.roles r WHERE u.email IN ('hod@rashmi.test','hrops.rgh@rashmi.test') AND r.code='employee'
ON CONFLICT DO NOTHING;
INSERT INTO core.user_roles (user_id, role_id, scope_org_unit_id)
SELECT u.id, r.id, 2 FROM core.users u, core.roles r WHERE u.email='hrops.rgh@rashmi.test' AND r.code='hr_ops'
ON CONFLICT DO NOTHING;
UPDATE core.employees SET functional_manager_id=(SELECT id FROM core.employees WHERE ecode='RML000090'),
       hod_employee_id=(SELECT id FROM core.employees WHERE ecode='RML000090')
 WHERE ecode IN ('RML000008','RML000009');
-- Clear lockouts / forced changes left in the snapshot.
UPDATE core.users SET failed_attempts=0, locked_until=NULL, must_change_password=false;
COMMIT;
-- Disposable logins for destructive auth tests (lockout, password change/reset).
BEGIN;
INSERT INTO core.users (email, password_hash)
SELECT x, (SELECT password_hash FROM core.users WHERE email='employee@rashmi.test')
FROM unnest(ARRAY['lockout@rashmi.test','pwchange@rashmi.test','pwreset@rashmi.test','apipw@rashmi.test','apilock@rashmi.test']) AS x
ON CONFLICT (email) DO NOTHING;
INSERT INTO core.user_roles (user_id, role_id)
SELECT u.id, r.id FROM core.users u, core.roles r WHERE u.email IN ('lockout@rashmi.test','pwchange@rashmi.test','pwreset@rashmi.test','apipw@rashmi.test','apilock@rashmi.test') AND r.code='employee'
ON CONFLICT DO NOTHING;
COMMIT;
-- Earlier testers left manager→delegate rules (7→6, 7→9) active this week; the suite tests the default chains.
DELETE FROM wf.delegations;
