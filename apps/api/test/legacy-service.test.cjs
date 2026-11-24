const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { LegacyService } = require('../dist/legacy/legacy.service');
const { LegacyQuery } = require('../dist/legacy/legacy.dto');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const snapshot = { id:'test-snapshot',snapshotAt:'2026-10-18 05:30:01' };
const source = [
  {tableName:'company',data:{id:1,name:'Company A'}},
  {tableName:'company',data:{id:2,name:'Company B'}},
  {tableName:'sale_daily',data:{company_id:1,date:'2026-10-01',amount:'9007199254740993.123456789',due:'20',od:'1',cod_od:'2'}},
  {tableName:'sale_daily',data:{company_id:1,date:'2026-10-02',amount:'0.000000001',due:'20',od:'1',cod_od:'2'}},
  {tableName:'target_daily',data:{company_id:1,date:'2026-10-02',amount:'11'}},
  {tableName:'target_daily',data:{company_id:2,date:'2026-10-02',amount:'2'}},
  {tableName:'target_daily',data:{company_id:null,date:'2026-10-02',amount:'3'}},
  {tableName:'sale_monthly',data:{company_id:1,year:2026,month:10,amount:'50',due:'9',od:'0',cod_od:'0'}},
  {tableName:'target_monthly',data:{company_id:1,year:2026,month:10,amount:'60'}},
  {tableName:'target_yearly',data:{company_id:1,year:'2026-2027',amount:'1000'}},
];
function service(empty=false){return new LegacyService({
  legacyImport:{findFirst:async()=>empty?null:snapshot,findUnique:async({where})=>where.id===snapshot.id?snapshot:null},
  legacyRecord:{findMany:async({where})=>source.filter(r=>where.tableName.in.includes(r.tableName))},
});}
test('daily values retain precision and pagination does not change totals',async()=>{
  const first=await service().summary({period:'daily',page:1,pageSize:1});
  const second=await service().summary({period:'daily',page:2,pageSize:1});
  assert.equal(first.totals.salesAmount,'9007199254740993.12345679');
  assert.equal(first.totals.targetAmount,'16');
  assert.equal(first.rows.length,1); assert.equal(first.pagination.total,4);
  assert.deepEqual(first.totals,second.totals);
  assert.deepEqual(first.coverage,{from:'2026-10-01',to:'2026-10-02'});
  assert.ok(!('due' in first.totals));
});
test('monthly source totals are separate; yearly target does not invent sales',async()=>{
  const monthly=await service().summary({period:'monthly'});
  assert.equal(monthly.totals.salesAmount,'50');assert.equal(monthly.totals.targetAmount,'60');
  const yearly=await service().summary({period:'yearly'});
  assert.equal(yearly.rows[0].period,'2026-2027');assert.equal(yearly.totals.salesAmount,null);
  assert.equal(yearly.totals.targetAmount,'1000');
});
test('company and unassigned filters; invalid company and import rejected',async()=>{
  const filtered=await service().summary({period:'daily',companyId:'2'});
  assert.equal(filtered.totals.salesAmount,null);assert.equal(filtered.totals.targetAmount,'2');
  assert.equal((await service().summary({period:'daily',companyId:'none'})).totals.targetAmount,'3');
  await assert.rejects(service().summary({companyId:'999'}),/Company was not found/);
  await assert.rejects(service().summary({importId:'missing'}),/snapshot was not found/);
});
test('no snapshots returns explicit empty state',async()=>{
  const result=await service(true).summary({});
  assert.equal(result.snapshot,null);assert.equal(result.totals.salesAmount,null);
  assert.deepEqual(result.rows,[]);assert.equal(result.pagination.total,0);
});
test('query validation bounds and enum prevent unbounded and malformed requests',async()=>{
  for(const query of [{page:'0'},{page:'1.1'},{pageSize:'101'},{period:'quarter'},{companyId:'1 OR 1=1'},{importId:''}]) {
    assert.ok((await validate(plainToInstance(LegacyQuery,query))).length>0);
  }
  assert.equal((await validate(plainToInstance(LegacyQuery,{period:'daily',page:'2',pageSize:'50',companyId:'none'}))).length,0);
});
