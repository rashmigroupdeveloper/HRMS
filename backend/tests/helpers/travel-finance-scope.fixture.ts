/** TE-07/09: salary authority cannot fund or settle expenses. */
import {expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {ControlledTransaction} from 'kysely';
import type {Database} from '../../src/core/db/types.js';
import type {createApp} from '../../src/app.js';
import {httpRequest} from '../http-client.js';
export async function verifyTravelFinanceScope(tx:ControlledTransaction<Database>,app:ReturnType<typeof createApp>,employeeId:number,companyId:number,finance:string,salary:string){
 const tag=randomUUID();const c=await httpRequest(app);
 const trip=await tx.insertInto('te.trips').values({reference_no:tag,employee_id:employeeId,company_id:companyId,trip_name:'Synthetic finance scope',travel_type:'domestic',purpose:'Scope regression',destination_city:'Test city',start_date:'2097-01-01',end_date:'2097-01-02'}).returning('id').executeTakeFirstOrThrow();
 const advance=await tx.insertInto('te.advances').values({trip_id:trip.id,employee_id:employeeId,amount_paise:1000,purpose:'Synthetic advance'}).returning('id').executeTakeFirstOrThrow();
 const claim=await tx.insertInto('te.claims').values({reference_no:tag,trip_id:trip.id,employee_id:employeeId}).returning('id').executeTakeFirstOrThrow();
 const paths=[{path:`/api/travel/advances/${String(advance.id)}/approve`,body:{advanceId:advance.id}},{path:`/api/travel/claims/${String(claim.id)}/settle`,body:{claimId:claim.id}}];
 for(const request of paths){
  expect((await c.post(request.path).set('Authorization',salary).send(request.body)).status).toBe(403);
  // In-scope finance is authorized but the domain state is not approved yet.
  expect((await c.post(request.path).set('Authorization',finance).send(request.body)).status).toBe(409);
 }
 const employee=await tx.selectFrom('core.employees').select('org_unit_id').where('id','=',employeeId).executeTakeFirstOrThrow();
 await tx.updateTable('core.employees').set({org_unit_id:null}).where('id','=',employeeId).execute();
 for(const request of paths)expect((await c.post(request.path).set('Authorization',finance).send(request.body)).status).toBe(403);
 await tx.updateTable('core.employees').set({org_unit_id:employee.org_unit_id}).where('id','=',employeeId).execute();
}
