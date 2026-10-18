from qa import *
R={}
def t(name,*a,**k):
    st,j=call(*a,tag='mod-'+name,**k); R[name]=(st,j); print(name,st,short(j,450)); return st,j
ids=json.load(open('../ids.json'))
# Transfers
st,j=t('xfer-location','hr_ops','POST','/lifecycle/transfers',{'employeeId':ids['RML033906'],'transferType':'location','effectiveDate':'2026-11-01','targetLocationId':3,'reason':'QA: move to Bhubaneswar office'})
x1=j.get('id') or (j.get('transfer') or {}).get('id') if st==200 else None
st,j=t('xfer-inter-entity','hr_ops','POST','/lifecycle/transfers',{'employeeId':ids['RML033905'],'transferType':'inter_entity','effectiveDate':'2026-10-01','targetCompanyId':2,'targetLocationId':2,'leaveTreatment':'transfer','reason':'QA: deputation to RGH'})
x2=j.get('id') or (j.get('transfer') or {}).get('id') if st==200 else None
t('xfer-bad-location-company','hr_ops','POST','/lifecycle/transfers',{'employeeId':ids['RML033910'],'transferType':'location','effectiveDate':'2026-11-01','targetLocationId':2,'reason':'QA: RML emp to RGH location without entity change'})
t('xfer-exited-emp','hr_ops','POST','/lifecycle/transfers',{'employeeId':ids['RML033909'],'transferType':'location','effectiveDate':'2026-11-01','targetLocationId':3,'reason':'QA: transfer an exited employee'})
for x in (x1,x2):
    if x:
        t(f'xfer-self-approve-{x}','hr_ops','POST',f'/lifecycle/transfers/{x}/approve',{'id':x})
        t(f'xfer-approve-{x}','hr_head','POST',f'/lifecycle/transfers/{x}/approve',{'id':x})
t('xfer-history','hr_ops','GET',f"/lifecycle/transfers/history/{ids['RML033905']}",params={'employeeId':ids['RML033905']})
# Probation
st,j=t('prob-reviews','hr_ops','GET','/lifecycle/probation/reviews')
t('prob-alerts','hr_ops','GET','/lifecycle/probation/alerts')
# Onboarding
st,j=t('cand-ingest','hr_ops','POST','/lifecycle/candidates/ingest',{'fullName':'Ishita Banerjee','personalEmail':'ishita.qa@qa-payroll.rashmi.test','mobile':'9830012345','positionTitle':'Graduate Engineer Trainee','companyId':1,'category':'white_collar','offeredCtc':480000,'probationMonths':6,'probationSalaryPct':80,'proposedDoj':'2026-11-02','offerDate':'2026-10-10','dob':'2002-04-11','department':'ERP-CELL'})
t('cand-ingest-dup','hr_ops','POST','/lifecycle/candidates/ingest',{'fullName':'Ishita Banerjee','personalEmail':'ishita.qa@qa-payroll.rashmi.test','mobile':'9830012345','positionTitle':'Graduate Engineer Trainee','companyId':1,'offeredCtc':480000,'proposedDoj':'2026-11-02','offerDate':'2026-10-10'})
t('cand-ingest-minor','hr_ops','POST','/lifecycle/candidates/ingest',{'fullName':'Too Young','personalEmail':'young.qa@qa-payroll.rashmi.test','mobile':'9830099999','positionTitle':'Helper','companyId':1,'offeredCtc':100000,'proposedDoj':'2026-11-02','offerDate':'2026-12-10','dob':'2015-01-01'})
json.dump(R,open('../logs/mod3.json','w'),indent=1,default=str)
