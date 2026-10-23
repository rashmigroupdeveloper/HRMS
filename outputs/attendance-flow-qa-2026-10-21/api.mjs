import {readFile,appendFile,writeFile,mkdir} from 'node:fs/promises';
const f=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const [role,method,path,raw]=process.argv.slice(2);
const cacheDir=new URL('../../backend/var/qa21/',import.meta.url);await mkdir(cacheDir,{recursive:true});
const cache=new URL(role+'.json',cacheDir);let session;
try{const saved=JSON.parse(await readFile(cache,'utf8'));if(saved.at>Date.now()-600000)session=saved;}catch{}
if(!session){
 const login=await fetch('http://localhost:5100/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:f.users[role].email,password:'Synthetic-QA-Flow-2026!'})});
 session=await login.json();if(!session.accessToken)throw Error('QA login failed '+login.status);
 session.at=Date.now();await writeFile(cache,JSON.stringify(session),{mode:0o600});
}
const response=await fetch('http://localhost:5100'+path,{method,headers:{'content-type':'application/json',authorization:'Bearer '+session.accessToken},...(raw?{body:raw}:{})});
const body=await response.text();let result;try{result=JSON.parse(body)}catch{result=body.slice(0,300)}
const evidence={at:new Date().toISOString(),role,method,path,input:raw?JSON.parse(raw):null,status:response.status,result};
await appendFile(new URL('./api-evidence.jsonl',import.meta.url),JSON.stringify(evidence)+'\n');console.log(JSON.stringify(evidence));
