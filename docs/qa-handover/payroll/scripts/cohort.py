"""Cohort definition for the Jun-2026 payroll QA run. All names are fictional except the sample row (RML033625) supplied by the user."""
import json
MONTH='2026-06-01'
def std(gross, basic=None, edu=200, med=1250, bonus=True):
    """RML STAFF_STANDARD: BASIC, HRA=50% BASIC, EDU, MED, BONUS=round(8.33% BASIC), SPECIAL balancing."""
    b = basic if basic is not None else round(gross*0.5)
    hra = round(b*0.5); bon = round(b*0.0833) if bonus else 0
    sp = gross - b - hra - edu - med - bon
    assert sp >= 0, (gross,b,sp)
    d={'BASIC':b,'HRA':hra,'EDUCATION_ALLOW':edu,'MEDICAL_ALLOW':med,'STATUTORY_BONUS':bon,'SPECIAL_ALLOW':sp}
    return {k:v for k,v in d.items() if v}
def low(gross):
    """Low-wage (ESIC) template: BASIC 50%, HRA 25%, SPECIAL rest."""
    b=round(gross*0.5); h=round(gross*0.25); return {'BASIC':b,'HRA':h,'SPECIAL_ALLOW':gross-b-h}
def scale(c,pct): return {k:round(v*pct/100) for k,v in c.items()}

# fields: ecode,name,gender,company,doj,dol,loc(KGP/KGP_RGH/BBS),category,contract,esic,tax_regime,monthly components (full, confirmed),
#   probation_pct, case, att (attendance plan), inputs [(code,amount,note)], hold, extras
C=[]
def add(**k): C.append(k)
SAMPLE={'BASIC':32286,'HRA':16143,'EDUCATION_ALLOW':200,'MEDICAL_ALLOW':1250,'STATUTORY_BONUS':2689,'SPECIAL_ALLOW':12005}
add(ecode='RML033625',name='Prateek Kumar Singh',gender='Male',co='RML',doj='2024-09-20',dol=None,loc='KGP',cat='white_collar',contract='permanent',esic=False,regime='new',
    comp=SAMPLE,case='SAMPLE row (Report 4) - must net 59124',att={},inputs=[('CANTEEN',1375,'Canteen recovery Jun-26')],
    uan='102325126388',bank=('HDFC Bank','50100491237371','HDFC0009686'),pan='DPKPS4417M',dept='ERP-CELL',desig='Junior Graduate Engineer',grade='Junior Grade',cc='ERP-CELL')
add(ecode='RML033901',name='Ananya Ghosh',gender='Female',co='RML',doj='2023-07-10',loc='KGP',esic=True,comp=low(18500),case='ESI eligible (gross 18,500)',att={},inputs=[('CANTEEN',650,'Canteen recovery')])
add(ecode='RML033902',name='Rakesh Mahato',gender='Male',co='RML',doj='2022-01-03',loc='KGP',esic=True,comp=low(21000),case='ESI boundary 21,000 + 2 LOP days (absent)',att={'absent':['2026-06-09','2026-06-10']},inputs=[])
add(ecode='RML033903',name='Soumen Bera',gender='Male',co='RML',doj='2021-11-15',loc='KGP',esic=False,comp=low(21001),case='ESI ineligible (gross 21,001)',att={},inputs=[])
add(ecode='RML033904',name='Arpita Mondal',gender='Female',co='RML',doj='2020-03-02',loc='KGP',comp=std(45000),case='Maternity leave from 08-Jun (female)',att={'leave':[('ML','2026-06-08','2026-06-30')]},inputs=[])
add(ecode='RML033905',name='Vikram Jha',gender='Male',co='RML',doj='2019-08-19',loc='KGP',comp=std(52000,basic=22000),case='PF wage > 15,000 (Basic 22,000; ACTUAL vs restricted)',att={},inputs=[])
add(ecode='RML033906',name='Sneha Kumari',gender='Female',co='RML',doj='2024-02-12',loc='KGP',comp=std(30000,basic=14000),case='PF wage < 15,000 (Basic 14,000)',att={},inputs=[])
add(ecode='RML033907',name='Rohit Das',gender='Male',co='RML',doj='2025-12-01',loc='KGP',cat='trainee',contract='apprentice',comp={'STIPEND':15000},case='Apprentice on stipend - no PF/ESI/Bonus',att={},inputs=[])
add(ecode='RML033908',name='Mohit Agarwal',gender='Male',co='RML',doj='2026-06-16',loc='KGP',comp=std(40000),case='Mid-month joiner (16-Jun) pro-rata',att={},inputs=[])
add(ecode='RML033909',name='Priyanka Dutta',gender='Female',co='RML',doj='2023-05-08',dol='2026-06-20',loc='KGP',comp=std(42000),case='Mid-month leaver (LWD 20-Jun) + notice recovery + F&F',att={},inputs=[('NOTICE_RECOVERY',7000,'Notice shortfall 10 days x Basic/30')],sep=True)
add(ecode='RML033910',name='Sanjay Paul',gender='Male',co='RML',doj='2022-09-05',loc='KGP',comp=std(36000),case='Partial LOP: 3 absent days',att={'absent':['2026-06-17','2026-06-18','2026-06-19']},inputs=[])
add(ecode='RML033911',name='Abhijit Sen',gender='Male',co='RML',doj='2021-04-12',loc='KGP',comp=std(33000),case='Full-month LOP (no attendance at all)',att={'absent':'ALL'},inputs=[])
add(ecode='RML033912',name='Tanmoy Sarkar',gender='Male',co='RML',doj='2026-03-02',loc='KGP',comp=std(30000),prob=80,case='Probation 80%',att={},inputs=[])
add(ecode='RML033913',name='Rina Halder',gender='Female',co='RML',doj='2026-02-02',loc='KGP',comp=std(25000),prob=70,esic=True,case='Probation 70% (probation gross 17,500 -> ESI)',att={},inputs=[])
add(ecode='RML033914',name='Debashis Pal',gender='Male',co='RML',doj='2026-01-05',loc='KGP',comp=std(50000),prob=90,case='Probation 90%',att={},inputs=[])
add(ecode='RML033915',name='Kunal Chatterjee',gender='Male',co='RML',doj='2018-06-11',loc='KGP',comp=std(60000),case='Incentive + arrears + other earnings',att={},inputs=[('INCENTIVE',5000,'Q1 incentive'),('ARREARS',2000,'Apr-May revision arrears'),('OTHER_EARNINGS',1000,'Shift allowance')])
add(ecode='RML033916',name='Nilanjan Bose',gender='Male',co='RML',doj='2020-10-01',loc='KGP',comp=std(48000),case='Salary on payment HOLD',att={},inputs=[],hold='payment')
add(ecode='RML033917',name='Amitava Roy',gender='Male',co='RML',doj='2019-02-18',loc='KGP',comp=std(55000),case='Loan EMI (app loan) + guest house',att={},inputs=[('GUEST_HOUSE',2500,'Guest house Jun-26')],loan=dict(loanType='emi_no_interest',principalRupees=60000,tenureMonths=12,startMonth='2026-06-01'))
add(ecode='RML033918',name='Suresh Yadav',gender='Male',co='RML',doj='2017-12-04',loc='KGP',comp=std(38000),case='Travel advance + misc recovery',att={},inputs=[('TRAVEL_ADV_RECOVERY',3000,'Travel advance TA-118'),('MISC_RECOVERY',500,'ID card replacement')])
add(ecode='RML033919',name='Ritika Jain',gender='Female',co='RML',doj='2016-07-25',loc='KGP',comp=std(120000),regime='old',case='TDS old regime (80C 1.5L declared)',att={},inputs=[],decl80c=150000)
add(ecode='RML033920',name='Arnab Mukherjee',gender='Male',co='RML',doj='2018-01-08',loc='KGP',comp=std(110000),regime='new',case='TDS new regime',att={},inputs=[])
add(ecode='RML033921',name='Rajiv Bhattacharya',gender='Male',co='RML',doj='2015-04-01',loc='KGP',comp=std(450000),regime='new',case='High earner (surcharge band)',att={},inputs=[])
add(ecode='RML033922',name='Kaushik Dey',gender='Male',co='RML',doj='2024-08-19',loc='KGP',esic=True,comp=low(12000),case='Negative net: 20 LOP days + recoveries',att={'absent':['2026-06-%02d'%d for d in (1,2,3,4,5,6,8,9,10,11,12,13,15,16,17,18,19,20,22,23)]},inputs=[('CANTEEN',1375,'Canteen'),('LOAN_EMI',6000,'Legacy salary advance recovery')])
add(ecode='RML033923',name='Pooja Singh',gender='Female',co='RML',doj='2023-10-16',loc='BBS',comp=std(35000),case='Other-state PT (Odisha, Bhubaneswar office)',att={},inputs=[])
add(ecode='RML033924',name='Sayan Majumdar',gender='Male',co='RML',doj='2022-06-13',loc='KGP',comp=std(34000),case='Paid leave CL2+SL1 and 1 day LWP',att={'leave':[('CL','2026-06-02','2026-06-03'),('SL','2026-06-11','2026-06-11'),('LWP','2026-06-25','2026-06-25')]},inputs=[])
# RGH
add(ecode='RGH033901',name='Bikash Behera',gender='Male',co='RGH',doj='2024-05-06',loc='KGP_RGH',comp=std(55000),case='Overtime 4h approved (Sat 13-Jun)',att={'ot':'2026-06-13'},inputs=[])
add(ecode='RGH033902',name='Mamata Nayak',gender='Female',co='RGH',doj='2024-07-01',loc='KGP_RGH',esic=True,comp=low(16000),case='ESI eligible RGH',att={},inputs=[])
add(ecode='RGH033903',name='Pradeep Sahu',gender='Male',co='RGH',doj='2026-06-10',loc='KGP_RGH',comp=std(45000),case='Mid-month joiner (10-Jun)',att={},inputs=[])
add(ecode='RGH033904',name='Lipika Das',gender='Female',co='RGH',doj='2023-03-13',loc='KGP_RGH',comp=std(32000),case='5 LOP days',att={'absent':['2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26']},inputs=[])
add(ecode='RGH033905',name='Satyajit Mohanty',gender='Male',co='RGH',doj='2021-09-20',loc='KGP_RGH',comp=std(75000,basic=30000),case='PF ACTUAL on Basic 30,000 + TDS new',att={},inputs=[])
add(ecode='RGH033906',name='Jyoti Prakash Rout',gender='Male',co='RGH',doj='2020-01-06',dol='2026-06-15',loc='KGP_RGH',comp=std(50000),case='Leaver LWD 15-Jun + F&F (gratuity eligible 6y5m)',att={},inputs=[],sep=True)
add(ecode='RGH033907',name='Smita Panda',gender='Female',co='RGH',doj='2025-01-20',loc='KGP_RGH',comp=std(28000),case='Canteen + guest house recoveries',att={},inputs=[('CANTEEN',1375,'Canteen'),('GUEST_HOUSE',2500,'Guest house')])
add(ecode='RGH033908',name='Ashok Pradhan',gender='Male',co='RGH',doj='2022-11-07',loc='KGP_RGH',comp=std(40000),case='Salary PROCESS hold',att={},inputs=[],hold='process')

import random
random.seed(33625)
FN='ABCDEFGHJKLMNPQRSTUVWXYZ'
for i,e in enumerate(C):
    e.setdefault('dol',None); e.setdefault('cat','white_collar'); e.setdefault('contract','permanent'); e.setdefault('esic',False); e.setdefault('regime','new'); e.setdefault('prob',None); e.setdefault('hold',None); e.setdefault('sep',False)
    e['email']=e['ecode'].lower()+'@qa-payroll.rashmi.test'
    if 'pan' not in e:
        surname=e['name'].split()[-1][0].upper()
        e['pan']='%s%sP%s%04d%s'%(random.choice(FN)+random.choice(FN),random.choice(FN),surname,1000+i*37,random.choice(FN))
    if 'uan' not in e: e['uan']=str(101800000000+i*7919+13)
    if 'bank' not in e: e['bank']=random.choice([('State Bank of India','3%010d'%(4500000000+i*7331),'SBIN0001867'),('HDFC Bank','5010%010d'%(491200000+i*1913),'HDFC0009686'),('Axis Bank','9%014d'%(20100000000+i*313),'UTIB0000245')])
    e['gross']=sum(e['comp'].values())
    if e['esic'] and not e.get('esi_no'): e['esi_no']='%010d'%(6612345000+i*11)
if __name__=='__main__':
    json.dump(C,open('/workspace/hrms-test/payroll/cohort.json','w'),indent=1)
    for e in C: print(e['ecode'],e['name'],e['co'],e['gross'],e['case'])
    print(len(C))
