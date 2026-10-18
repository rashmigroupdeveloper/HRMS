from qa import *
R={}
def t(name,*a,**k):
    st,j=call(*a,tag='mod-'+name,**k); R[name]=(st,j); print(name,st,short(j,400)); return st,j
E=lambda ec: ec.lower()+'@qa-payroll.rashmi.test'
st,j=t('od-for-selfact',E('RML033906'),'POST','/attendance/requests',{'kind':'OD','fromDate':'2026-10-16','toDate':'2026-10-16','reason':'Plant visit - QA self act'})
if st==200:
    rid=j['workflowRequestId']; t('self-act-pending',E('RML033906'),'POST',f'/workflows/requests/{rid}/act',{'requestId':rid,'action':'approve'})
    t('peer-act-pending',E('RML033901'),'POST',f'/workflows/requests/{rid}/act',{'requestId':rid,'action':'approve'})
    t('rgh-mgr-act-rml',  'rgh','POST',f'/workflows/requests/{rid}/act',{'requestId':rid,'action':'approve'})
# Loans
t('loan-ledger-colon','payroll','GET','/api/api/loans/4/ledger')
t('loans-all','payroll','GET','/api/api/loans/all')
t('loan-my',E('RML033917'),'GET','/api/api/loans/my')
# Claims
t('claim-ent',E('RML033918'),'GET','/api/claims/my-entitlements')
t('claim-submit-foreign-doc',E('RML033918'),'POST','/api/claims/submit',{'claimTypeCode':'MEDICAL','periodFrom':'2026-09-01','periodTo':'2026-09-30','bills':[{'documentId':4,'billNo':'B1','billDate':'2026-09-10','amountRupees':1200}]})
t('claim-pending','payroll','GET','/api/claims/pending')
# Travel
st,j=t('trip-create',E('RML033918'),'POST','/travel/trips',{'tripName':'QA Kolkata vendor audit','travelType':'domestic','purpose':'Vendor audit at Kolkata','destinationCity':'Kolkata','startDate':'2026-10-20','endDate':'2026-10-22'})
tid=j.get('id') if st==200 and isinstance(j,dict) else None
st,j=t('trip-create-inverted',E('RML033918'),'POST','/travel/trips',{'tripName':'QA inverted trip','travelType':'domestic','purpose':'Inverted dates test','destinationCity':'Puri','startDate':'2026-10-25','endDate':'2026-10-21'})
if tid:
    t('trip-get',E('RML033918'),'GET',f'/travel/trips/{tid}')
    st,j=t('adv-create',E('RML033918'),'POST','/travel/advances',{'tripId':tid,'amountPaise':500000,'purpose':'Hotel and DA advance'})
    aid=j.get('id') if st==200 and isinstance(j,dict) else None
    if aid:
        t('adv-self-approve',E('RML033918'),'POST',f'/travel/advances/{aid}/approve',{'advanceId':aid})
        t('adv-mgr-approve','srmanager','POST',f'/travel/advances/{aid}/approve',{'advanceId':aid})
        t('adv-approve-again','srmanager','POST',f'/travel/advances/{aid}/approve',{'advanceId':aid})
    st,j=t('tclaim-create',E('RML033918'),'POST','/travel/claims',{'tripId':tid})
    cid=j.get('id') if st==200 and isinstance(j,dict) else None
    if cid:
        t('tclaim-item-hotel',E('RML033918'),'POST',f'/travel/claims/{cid}/items',{'claimId':cid,'category':'hotel','itemDate':'2026-10-20','amountPaise':350000,'description':'Hotel 2 nights'})
        t('tclaim-item-da',E('RML033918'),'POST',f'/travel/claims/{cid}/items',{'claimId':cid,'category':'daily_allowance','itemDate':'2026-10-21','amountPaise':80000})
        t('tclaim-item-outside-trip',E('RML033918'),'POST',f'/travel/claims/{cid}/items',{'claimId':cid,'category':'food','itemDate':'2026-12-25','amountPaise':10000})
        t('tclaim-self-settle',E('RML033918'),'POST',f'/travel/claims/{cid}/settle',{'claimId':cid,'settlementMode':'AUTO','recoveryChannel':'payroll_deduction'})
        t('tclaim-settle','payroll','POST',f'/travel/claims/{cid}/settle',{'claimId':cid,'settlementMode':'AUTO','recoveryChannel':'payroll_deduction'})
        t('tclaim-settle-again','payroll','POST',f'/travel/claims/{cid}/settle',{'claimId':cid,'settlementMode':'AUTO','recoveryChannel':'payroll_deduction'})
    t('wallet',E('RML033918'),'GET','/travel/wallet')
json.dump(R,open('../logs/mod2.json','w'),indent=1,default=str)
