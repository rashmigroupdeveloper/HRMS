-- C-02: seeded HOD for the fix instance. RML033904 (login rml033904@qa-payroll.rashmi.test,
-- the QA-seed password) becomes head of Production for RML; the hod role is derived
-- from this designation. (Every Production employee already has a login, and
-- users.employee_id is unique, so a separate hod@ account would need a fake employee.)
-- Idempotent.
INSERT INTO core.department_heads (department_id, company_id, employee_id)
SELECT d.id, c.id, e.id FROM core.employees e, core.departments d, core.companies c
 WHERE e.ecode = 'RML033904' AND d.name = 'Production' AND c.code = 'RML'
ON CONFLICT ON CONSTRAINT department_heads_uq DO NOTHING;
