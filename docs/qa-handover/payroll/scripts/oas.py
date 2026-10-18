import json,sys
d=json.load(open('/workspace/hrms-test/openapi.json'))
def res(s,depth=0):
    if isinstance(s,dict) and '$ref' in s:
        name=s['$ref'].split('/')[-1]; return res(d['components']['schemas'][name],depth)
    return s
for p in sys.argv[1:]:
    for path,ops in d['paths'].items():
        if path==p:
            for m,op in ops.items():
                body=op.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema')
                print(m.upper(),path, json.dumps(res(body) if body else op.get('parameters'),separators=(',',':'))[:3000])
