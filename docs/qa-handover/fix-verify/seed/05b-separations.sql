-- Backdated resignations for the June-2026 leavers. The app (correctly) refuses a past LWD, so this history is
-- seeded directly, in the state the approval leaves it: separation approved, employee on_notice, dol = approved LWD.
INSERT INTO core.separations (employee_id, initiated_by, reason, resignation_date, notice_period_days, requested_lwd, approved_lwd, shortfall_days, status)
SELECT e.id, 'employee', v.reason, v.resigned::date, 30, v.lwd::date, v.lwd::date, v.shortfall, 'approved'
  FROM (VALUES ('RML033909', 'Relocating to Bengaluru (QA seed)', '2026-06-01', '2026-06-20', 10.0),
               ('RGH033906', 'Higher studies (QA seed)', '2026-05-16', '2026-06-15', 0.0)) v(ecode, reason, resigned, lwd, shortfall)
  JOIN core.employees e ON e.ecode = v.ecode;
UPDATE core.employees e SET status = 'on_notice', dol = s.approved_lwd FROM core.separations s
 WHERE s.employee_id = e.id AND s.status = 'approved' AND e.ecode IN ('RML033909', 'RGH033906');
-- Biometric enrolment for the QA population (no app path: Kent enrolment is external; tester did the same).
UPDATE core.employees SET biometric_registered = true WHERE company_id IN (1, 2);
-- Kent door → location mapping (no device-admin API yet; the tester mapped the auto-created devices by SQL).
INSERT INTO att.devices (source, door_code, location_id, is_active)
SELECT 'kent', v.door, l.id, true FROM (VALUES ('KGP-GATE1', 'Kharagpur'), ('RGH-GATE1', 'Kharagpur RGH'), ('BBS-GATE1', 'Bhubaneswar Office')) v(door, loc)
  JOIN core.locations l ON l.name = v.loc
ON CONFLICT DO NOTHING;
