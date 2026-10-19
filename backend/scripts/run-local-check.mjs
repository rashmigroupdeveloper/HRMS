/** Sponsor-authorized local TEST DB only; never use this runner for production. */
import process from 'node:process';
import { URL } from 'node:url';
import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const backend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
config({path:resolve(backend,'.env')});
const raw=process.env.DATABASE_URL;
if(!raw) throw new Error('An explicitly configured local test database is required');
const db=new URL(raw);
if(!['localhost','127.0.0.1','[::1]'].includes(db.hostname) || db.pathname!=='/hrms') throw new Error('This runner only permits the authorized loopback hrms TEST database');
const args=process.argv.slice(2);
if(!args.length) throw new Error('Specify the Node check command');
const child=spawn(process.execPath,args,{cwd:backend,env:{...process.env,PATH:`${dirname(process.execPath)}:${process.env.PATH??''}`,NODE_ENV:'test',TEST_DATABASE_URL:raw,LOCAL_TEST_DATABASE_NAME:'hrms'},stdio:'inherit'});
child.on('error',()=>{process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
