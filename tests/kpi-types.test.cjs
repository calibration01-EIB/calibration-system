const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function app(){const c=vm.createContext({console,Date}); const p='js/31-kpi-types.js';if(fs.existsSync(p))vm.runInContext(fs.readFileSync(p,'utf8'),c);return c;}
test('planned cohort separates completion, late, overdue, future and skipped without losing repeated cycles',()=>{
 const c=app();const batches=[{id:'b',status:'completed',instrument_type:'Temperature'},{id:'d',status:'draft'},{id:'x',status:'cancelled'}];
 const base={batch_id:'b',instrument_id:1,planned_date:'2026-09-01',is_active:true,result_status:'in_progress'};
 const items=[{...base,result_status:'completed',calibration_date:'2026-08-31'},{...base,result_status:'completed',calibration_date:'2027-01-01'},{...base},{...base,planned_date:'2026-09-30'},{...base,result_status:'skipped'},{...base,batch_id:'d'},{...base,batch_id:'x'},{...base,is_active:false},{...base,planned_date:'2025-09-01'}];
 const r=c.kptAggregate(batches,items,{year:2026,month:8,today:'2026-09-14'})[0];
 assert.equal(r.plan,5);assert.equal(r.done,2);assert.equal(r.onTime,1);assert.equal(r.late,1);assert.equal(r.overdue,1);assert.equal(r.pending,1);assert.equal(r.skipped,1);assert.equal(r.completion,40);assert.equal(r.timeliness,50);
});
test('invalid dates excluded and completion without date cannot inflate on-time rate',()=>{
 const c=app();const rows=c.kptAggregate([{id:1,status:'awaiting_calibration',instrument_type:'Pressure'}],[{batch_id:1,planned_date:'2026-02-30'},{batch_id:1,planned_date:'2026-02-02',result_status:'completed'}],{year:2026,month:-1,today:'2026-09-14'});
 assert.equal(rows[0].plan,1);assert.equal(rows[0].done,1);assert.equal(rows[0].unknown,1);assert.equal(rows[0].timeliness,null);
});
test('reader paginates and propagates failures',async()=>{
 const c=app();let calls=0;const client={from(){return {select(){return this},order(){return this},gt(){return this},async limit(){calls++;return calls===1?{data:Array.from({length:200},(_,i)=>({id:i+1}))}:{data:[{id:201}]}}}}};
 assert.equal((await c.kptRead(client,'items','id')).length,201);assert.equal(calls,2);
 await assert.rejects(c.kptRead({from(){return{select(){return this},order(){return this},limit(){return {error:{message:'denied'}}}}}},'items','id'),/denied/);
});

