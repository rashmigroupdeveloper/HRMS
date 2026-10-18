-- Cohort users get the base 'employee' role (the EMS importer grants none; the tester did this via the RBAC API).
INSERT INTO core.user_roles (user_id, role_id, scope_org_unit_id)
SELECT u.id, r.id, NULL FROM core.users u JOIN core.employees e ON e.id = u.employee_id, core.roles r
 WHERE r.code = 'employee' AND u.email LIKE '%@qa-payroll.rashmi.test'
ON CONFLICT DO NOTHING;
