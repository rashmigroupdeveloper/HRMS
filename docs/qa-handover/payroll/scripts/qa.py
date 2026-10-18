import requests, json, time, os, datetime
BASE='http://localhost:5100/api'
PW='Rashmi#Test2026'
ALIAS={'employee':'employee@rashmi.test','employee2':'employee2@rashmi.test','manager':'manager@rashmi.test','srmanager':'srmanager@rashmi.test',
'hr_ops':'hrops@rashmi.test','hr_head':'hrhead@rashmi.test','payroll':'payroll@rashmi.test','plant_head':'planthead@rashmi.test',
'ceo':'ceo@rashmi.test','it_admin':'itadmin@rashmi.test','super_admin':'admin@rashmi.test','rgh':'rgh.employee@rashmi.test'}
_tok={}
LOG=open('/workspace/hrms-test/payroll/logs/api-calls.jsonl','a')
def tok(who, fresh=False):
    if fresh or who not in _tok or time.time()-_tok[who][1]>600:
        r=requests.post(BASE+'/auth/login',json={'identifier':ALIAS.get(who,who),'password':PW})
        if r.status_code!=200: raise RuntimeError(f'login {who}: {r.status_code} {r.text[:200]}')
        j=r.json(); t=j.get('accessToken') or j.get('data',{}).get('accessToken')
        _tok[who]=(t,time.time())
    return _tok[who][0]
def call(who, method, path, body=None, params=None, raw=False, tag=''):
    h={'Authorization':'Bearer '+tok(who)} if who else {}
    r=requests.request(method, BASE+path, json=body, params=params, headers=h)
    if r.status_code==401 and who:
        h={'Authorization':'Bearer '+tok(who,True)}; r=requests.request(method, BASE+path, json=body, params=params, headers=h)
    try: j=r.json()
    except Exception: j=r.text[:500]
    LOG.write(json.dumps({'ts':datetime.datetime.now().isoformat(),'who':who,'m':method,'p':path,'body':body,'params':params,'status':r.status_code,'resp':(j if len(json.dumps(j,default=str))<3000 else str(j)[:3000]),'tag':tag},default=str)+'\n'); LOG.flush()
    if raw: return r
    return r.status_code, j
def short(x,n=300):
    s=json.dumps(x,default=str) if not isinstance(x,str) else x
    return s[:n]
