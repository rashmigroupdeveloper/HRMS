/** Evidence extraction only. AST operations are not semantic approval or a full data-flow proof. */
import ts from '/Users/anooppratapsingh/Documents/HRMS/backend/node_modules/typescript/lib/typescript.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root='/Users/anooppratapsingh/Documents/HRMS';
const out=`${root}/outputs/schema-relevance-2026-10-19/semantic`;
const files=execFileSync('rg',['--files','backend/src'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.ts'));
const evidence=[], filesRead={};
const literal=n=>n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
function chain(n) {const parts=[];while(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){parts.unshift({name:n.expression.name.text,args:n.arguments,node:n});n=n.expression.expression;}return parts;}
for(const path of files){
 const body=readFileSync(`${root}/${path}`,'utf8');filesRead[path]=createHash('sha256').update(body).digest('hex');
 const source=ts.createSourceFile(path,body,ts.ScriptTarget.Latest,true);
 const declarations=[];const collect=n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)declarations.push(n);ts.forEachChild(n,collect);};collect(source);
 function keys(n,seen=new Set()){
  if(!n)return {fields:[],indirect:true};
  if(ts.isObjectLiteralExpression(n)){let fields=[],indirect=false;for(const p of n.properties){if(ts.isSpreadAssignment(p)){const next=keys(p.expression,seen);fields.push(...next.fields);indirect||=next.indirect;}else if(p.name){const key=literal(p.name)??(ts.isIdentifier(p.name)?p.name.text:null);if(key)fields.push(key);else indirect=true;}}return {fields:[...new Set(fields)],indirect};}
  if(ts.isArrayLiteralExpression(n)){let fields=[],indirect=false;for(const el of n.elements){const k=keys(el,new Set(seen));fields.push(...k.fields);indirect||=k.indirect;}return{fields:[...new Set(fields)],indirect};}
  if(ts.isIdentifier(n)&&!seen.has(n.text)){seen.add(n.text);const decl=declarations.filter(d=>d.name.text===n.text&&d.pos<n.pos).at(-1);return keys(decl?.initializer,seen);}
  if(ts.isConditionalExpression(n)){const a=keys(n.whenTrue,new Set(seen)),b=keys(n.whenFalse,new Set(seen));return{fields:[...new Set([...a.fields,...b.fields])],indirect:true};}
  // .map(()=>({...})) row builders, including parenthesized object returns.
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='map'){
   const callback=n.arguments[0];if(callback&&ts.isArrowFunction(callback))return keys(ts.isParenthesizedExpression(callback.body)?callback.body.expression:callback.body,seen);
  }
  return{fields:[],indirect:true};
 }
 function ancestor(n){while(n){if(ts.isFunctionDeclaration(n))return n.name?.text??'<anonymous>';if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))return n.name.text;n=n.parent;}return'<module>';}
 function strings(n){if(!n)return[];const direct=literal(n);if(direct!==null)return[direct];if(ts.isArrayLiteralExpression(n))return n.elements.flatMap(strings);return[];}
 function visit(n){
  if(ts.isCallExpression(n)){
   const parent=n.parent;const outer=ts.isPropertyAccessExpression(parent)&&ts.isCallExpression(parent.parent);
   if(!outer){const methods=chain(n),origin=methods.find(p=>['selectFrom','insertInto','updateTable','deleteFrom'].includes(p.name));
    if(origin){const line=source.getLineAndCharacterOfPosition(origin.node.getStart()).line+1;const tables=[];
     for(const p of methods.filter(p=>['selectFrom','insertInto','updateTable','deleteFrom','innerJoin','leftJoin','rightJoin','fullJoin'].includes(p.name))){const table=literal(p.args[0]);if(table&&/^[a-z]+\.[a-z_]+(?: as [a-z_]+)?$/.test(table))tables.push({table:table.split(' as ')[0],alias:table.split(' as ')[1]??table.split('.')[1],operation:p.name});}
     evidence.push({file:path,line,context:ancestor(n),operation:origin.name,tables,unknown_table:literal(origin.args[0])===null,
      write_fields:methods.filter(p=>['values','set','doUpdateSet'].includes(p.name)).flatMap(p=>keys(p.args[0]).fields),
      indirect_writes:methods.filter(p=>['values','set','doUpdateSet'].includes(p.name)).some(p=>keys(p.args[0]).indirect),
      select_all:methods.filter(p=>p.name==='selectAll'||p.name==='returningAll').map(p=>({operation:p.name,alias:literal(p.args[0])})),
      selected:methods.filter(p=>p.name==='select'||p.name==='returning').flatMap(p=>strings(p.args[0])),
      predicates:methods.filter(p=>p.name==='where'||p.name==='whereRef').flatMap(p=>strings(p.args[0])),
      locking:methods.filter(p=>['forUpdate','forShare','skipLocked'].includes(p.name)).map(p=>p.name)});
    }
   }
  }
  if(ts.isTaggedTemplateExpression(n)&&n.tag.getText(source).startsWith('sql')){
   const template=n.template.getText(source);const tables=[...new Set((template.match(/\b(?:core|att|lv|wf|pay|te|sec|prv|med|cmp|ird|ast|eng|hd|reporting)\.[a-z_]+\b/g)??[]))];
   if(tables.length)evidence.push({file:path,line:source.getLineAndCharacterOfPosition(n.getStart()).line+1,context:ancestor(n),operation:'raw_sql_requires_manual_review',tables:tables.map(table=>({table})),write_fields:[],selected:[],select_all:[],indirect_writes:true});
  }
  ts.forEachChild(n,visit);
 }
 visit(source);
}
writeFileSync(`${out}/operation-evidence.json`,JSON.stringify({warning:'AST syntax evidence only. Conditional/indirect/dynamic queries, selectAll, SQL functions and runtime authorization need manual review; not execution or correctness proof.',operations:evidence},null,2)+'\n');
writeFileSync(`${out}/source-baseline.json`,JSON.stringify(filesRead,null,2)+'\n');
process.stdout.write(JSON.stringify({files:files.length,operations:evidence.length})+'\n');
