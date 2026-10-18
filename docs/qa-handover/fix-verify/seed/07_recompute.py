"""Create the missing June day records (absences, week-offs, days after LWD) through the recompute API (from s2_recompute.py)."""
from collections import Counter
from qa_api import call, psql
q = """select e.id, d::date::text from core.employees e cross join generate_series('2026-06-01'::date,'2026-06-30'::date,'1 day') d
 left join core.separations s on s.employee_id=e.id and s.status in ('approved','completed')
 where e.company_id in (1,2) and e.status in ('active','on_notice','exited') and e.doj<='2026-06-30' and (e.dol is null or e.dol>='2026-06-01')
 and d::date>=e.doj and d::date<=coalesce(e.dol, s.approved_lwd, '2026-06-30')
 and not exists (select 1 from att.day_records r where r.employee_id=e.id and r.work_date=d::date) order by 1,2"""
rows = psql(q)
print('missing day records:', len(rows))
c = Counter()
for eid, d in rows:
    j = call('it_admin', 'POST', '/attendance/recompute', {'employeeId': int(eid), 'date': d})
    c[str(j)[:60]] += 1
print(c.most_common(5))
print(psql("select status, count(*) from att.day_records where work_date between '2026-06-01' and '2026-06-30' group by 1 order by 1"))
