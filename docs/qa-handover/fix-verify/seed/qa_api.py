"""Tiny API client for the seed/recon builders. BASE (default http://localhost:5103/api), DB (default hrms_recon)."""
import json, os, subprocess, time, datetime, requests
BASE = os.environ.get('BASE', 'http://localhost:5103/api')
DB = os.environ.get('DB', 'hrms_recon')
PW = 'Rashmi#Test2026'
ALIAS = {'employee': 'employee@rashmi.test', 'employee2': 'employee2@rashmi.test', 'manager': 'manager@rashmi.test',
         'srmanager': 'srmanager@rashmi.test', 'hr_ops': 'hrops@rashmi.test', 'hr_head': 'hrhead@rashmi.test',
         'payroll': 'payroll@rashmi.test', 'plant_head': 'planthead@rashmi.test', 'ceo': 'ceo@rashmi.test',
         'it_admin': 'itadmin@rashmi.test', 'super_admin': 'admin@rashmi.test', 'rgh': 'rgh.employee@rashmi.test'}
LOGF = os.environ.get('API_LOG', '/tmp/seed-api-calls.jsonl')
_tok = {}
_log = open(LOGF, 'a')
def E(ec): return ec.lower() + '@qa-payroll.rashmi.test'
def tok(who, fresh=False):
    if fresh or who not in _tok or time.time() - _tok[who][1] > 600:
        r = requests.post(BASE + '/auth/login', json={'identifier': ALIAS.get(who, who), 'password': PW})
        if r.status_code != 200: raise RuntimeError(f'login {who}: {r.status_code} {r.text[:200]}')
        j = r.json(); _tok[who] = (j.get('accessToken') or j.get('data', {}).get('accessToken'), time.time())
    return _tok[who][0]
def call(who, method, path, body=None, params=None, ok=(200, 201), tag=''):
    h = {'Authorization': 'Bearer ' + tok(who)}
    r = requests.request(method, BASE + path, json=body, params=params, headers=h)
    if r.status_code == 401:
        h = {'Authorization': 'Bearer ' + tok(who, True)}; r = requests.request(method, BASE + path, json=body, params=params, headers=h)
    try: j = r.json()
    except Exception: j = r.text[:800]
    _log.write(json.dumps({'ts': datetime.datetime.now().isoformat(), 'who': who, 'm': method, 'p': path, 'body': body, 'status': r.status_code, 'resp': str(j)[:2000], 'tag': tag}) + '\n'); _log.flush()
    if ok and r.status_code not in ok:
        raise RuntimeError(f'{who} {method} {path} {body} -> {r.status_code} {str(j)[:600]}')
    if isinstance(j, dict) and 'data' in j and 'success' in j: j = j['data']
    return j
def psql(sql):
    env = dict(os.environ, PGPASSWORD='hrms_local_dev')
    out = subprocess.run(['psql', '-h', 'localhost', '-U', 'hrms', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-AtX', '-F', '\t', '-c', sql], capture_output=True, text=True, env=env)
    if out.returncode != 0: raise RuntimeError(out.stderr.strip() + '\nSQL: ' + sql[:400])
    return [l.split('\t') for l in out.stdout.splitlines() if l != '']
