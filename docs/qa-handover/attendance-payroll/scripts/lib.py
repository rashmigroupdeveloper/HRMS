"""Shared helpers for the ATTX attendance->payroll audit (box-only test DB hrms_attx, backend :5300)."""
import json, os, subprocess, time, datetime, requests

ROOT = '/workspace/hrms-test/attendance-payroll'
BASE = os.environ.get('ATTX_BASE', 'http://localhost:5300/api')
DB = os.environ.get('ATTX_DB', 'hrms_attx')
PW = 'Rashmi#Test2026'
ALIAS = {'employee': 'employee@rashmi.test', 'manager': 'manager@rashmi.test', 'hr_ops': 'hrops@rashmi.test',
         'hr_head': 'hrhead@rashmi.test', 'payroll': 'payroll@rashmi.test', 'it_admin': 'itadmin@rashmi.test',
         'super_admin': 'admin@rashmi.test', 'ceo': 'ceo@rashmi.test', 'planthead': 'planthead@rashmi.test'}
_tok = {}
LOG = open(f'{ROOT}/logs/api-calls.jsonl', 'a')


def tok(who, fresh=False):
    if fresh or who not in _tok or time.time() - _tok[who][1] > 600:
        r = requests.post(BASE + '/auth/login', json={'identifier': ALIAS.get(who, who), 'password': PW})
        if r.status_code != 200:
            raise RuntimeError(f'login {who}: {r.status_code} {r.text[:200]}')
        j = r.json()
        _tok[who] = (j.get('accessToken') or j.get('data', {}).get('accessToken'), time.time())
    return _tok[who][0]


def call(who, method, path, body=None, params=None, tag=''):
    h = {'Authorization': 'Bearer ' + tok(who)} if who else {}
    r = requests.request(method, BASE + path, json=body, params=params, headers=h)
    if r.status_code == 401 and who:
        h = {'Authorization': 'Bearer ' + tok(who, True)}
        r = requests.request(method, BASE + path, json=body, params=params, headers=h)
    try:
        j = r.json()
    except Exception:
        j = r.text[:800]
    s = json.dumps(j, default=str)
    LOG.write(json.dumps({'ts': datetime.datetime.now().isoformat(), 'who': who, 'm': method, 'p': path, 'body': body,
                          'params': params, 'status': r.status_code, 'resp': j if len(s) < 4000 else s[:4000], 'tag': tag},
                         default=str) + '\n')
    LOG.flush()
    return r.status_code, j


def psql(sql, fmt='rows'):
    env = dict(os.environ, PGPASSWORD='hrms_local_dev')
    out = subprocess.run(['psql', '-h', 'localhost', '-U', 'hrms', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-AtX', '-F', '\t', '-c', sql],
                         capture_output=True, text=True, env=env)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() + '\nSQL: ' + sql[:500])
    if fmt == 'raw':
        return out.stdout
    return [l.split('\t') for l in out.stdout.splitlines() if l != '']


def pjson(sql):
    """Run a query returning one json column per row."""
    return [json.loads(r[0]) for r in psql(f"select row_to_json(t) from ({sql}) t")]


def daterange(a, b):
    d = datetime.date.fromisoformat(a)
    e = datetime.date.fromisoformat(b)
    while d <= e:
        yield d.isoformat()
        d += datetime.timedelta(days=1)
