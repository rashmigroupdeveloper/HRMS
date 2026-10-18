const API='http://localhost:5130', PW='Rashmi#Test2026';
const users={employee:'employee@rashmi.test',manager:'manager@rashmi.test',senior_manager:'srmanager@rashmi.test',hod:'hod@rashmi.test',hr_ops_rml:'hrops@rashmi.test',hr_ops_rgh:'hrops.rgh@rashmi.test',hr_head:'hrhead@rashmi.test',payroll_admin:'payroll@rashmi.test',plant_head:'planthead@rashmi.test',ceo_cell:'ceo@rashmi.test',it_admin:'itadmin@rashmi.test',super_admin:'admin@rashmi.test'};
const eps=process.argv.slice(2).map(s=>{const [m,p,b]=s.split(' ');return {m,p,b}});
const rows=[];
for (const [k,e] of Object.entries(users)){
  const r=await fetch(API+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:e,password:PW})});
  const {accessToken}=await r.json();
  const st=[];
  for (const ep of eps){ const res=await fetch(API+'/api'+ep.p,{method:ep.m,headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},body:ep.m==='GET'?undefined:(ep.b??'{}')}); st.push(res.status); }
  rows.push(k.padEnd(15)+st.join('  '));
}
eps.forEach((e,i)=>console.log(i, e.m, e.p));
console.log(rows.join('\n'));
