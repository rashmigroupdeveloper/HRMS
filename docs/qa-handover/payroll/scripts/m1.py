from qa import *
R={}
def t(name,*a,**k):
    st,j=call(*a,tag='mod-'+name,**k); R[name]=(st,j); print(name,st,short(j,350)); return st,j
E=lambda ec: ec.lower()+'@qa-payroll.rashmi.test'
# Regularisation in open month (Oct 2026)
t('ar-submit',E('RML033901'),'POST','/attendance/requests',{'kind':'AR','fromDate':'2026-10-15','toDate':'2026-10-15','fromTime':'09:00','toTime':'18:00','reason':'Forgot to swipe - QA'})
t('od-submit',E('RML033910'),'POST','/attendance/requests',{'kind':'OD','fromDate':'2026-10-14','toDate':'2026-10-14','reason':'Vendor visit Kolkata - QA'})
t('perm-submit',E('RML033906'),'POST','/attendance/requests',{'kind':'PERMISSION','fromDate':'2026-10-13','toDate':'2026-10-13','fromTime':'16:00','toTime':'18:00','reason':'Bank work - QA'})
t('ar-locked-month',E('RML033901'),'POST','/attendance/requests',{'kind':'AR','fromDate':'2026-06-05','toDate':'2026-06-05','reason':'Backdated into locked June - QA'})
t('ar-future',E('RML033901'),'POST','/attendance/requests',{'kind':'AR','fromDate':'2026-12-15','toDate':'2026-12-15','reason':'Future date AR - QA'})
t('ar-inverted',E('RML033901'),'POST','/attendance/requests',{'kind':'OD','fromDate':'2026-10-10','toDate':'2026-10-08','reason':'Inverted range - QA'})
t('ar-mine',E('RML033901'),'GET','/attendance/requests/mine')
t('inbox-srmanager','srmanager','GET','/workflows/inbox')
t('inbox-manager','manager','GET','/workflows/inbox')
t('ot-pending-rgh','rgh','GET','/attendance/ot/pending')
t('ot-mine-bikash',E('RGH033901'),'GET','/attendance/ot/mine')
t('ot-redecide-rejected','rgh','POST','/attendance/ot/decide',{'entryId':2,'action':'approve','approvedMinutes':240})
json.dump(R,open('../logs/mod1.json','w'),indent=1,default=str)
