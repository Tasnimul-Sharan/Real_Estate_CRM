const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { validateEnvironment } = require('../dist/config/environment');
const dbUrl = new URL(process.env.DATABASE_URL);
if (dbUrl.pathname !== '/realestate_crm_test') throw new Error('Tests must use the isolated realestate_crm_test database');
const prisma = new PrismaClient();
const base = process.env.TEST_API_URL || 'http://localhost:4100/api';
const roles = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'ACCOUNTS', 'VIEWER'];
const sales = roles.slice(0, 4), managers = roles.slice(0, 3), accounts = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'ACCOUNTS'];
const tokens = {}, users = {};
let sequence = 0, project, customer, lead, sharedBooking;
const unique = () => `test-${++sequence}`;
async function request(method, route, role, body) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function ok(method, route, role, body, status = method === 'POST' ? 201 : 200) {
  const result = await request(method, route, role, body);
  assert.equal(result.status, status, `${method} ${route} as ${role}: ${JSON.stringify(result.body)}`);
  return result.body;
}
async function plot() { return ok('POST', '/plots', 'SUPER_ADMIN', { projectId: project.id, plotNo: unique(), sizeKatha: 5, pricePerKatha: 1000 }); }
async function booking(p) { return ok('POST', '/bookings', 'SUPER_ADMIN', { plotId: (p || await plot()).id, customerId: customer.id, bookingAmount: 1000 }); }
before(async () => {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) }); if (r.status === 201) { const x = await r.json(); tokens.SUPER_ADMIN = x.accessToken; users.SUPER_ADMIN = x.user; ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Test API did not become ready');
  for (const role of roles.slice(1)) {
    users[role] = await ok('POST', '/users', 'SUPER_ADMIN', { name: role, email: `role-${role.toLowerCase()}@crm.test`, password: 'RoleTestPassword-2026!', role });
    tokens[role] = (await ok('POST', '/auth/login', null, { email: users[role].email, password: 'RoleTestPassword-2026!' })).accessToken;
  }
  project = await ok('POST', '/projects', 'SUPER_ADMIN', { name: 'Workflow township', code: unique(), location: 'Test location' });
  customer = await ok('POST', '/customers', 'SUPER_ADMIN', { name: 'Workflow customer', phone: unique() });
  lead = await ok('POST', '/leads', 'SUPER_ADMIN', { name: 'Workflow lead', phone: unique() });
  sharedBooking = await booking();
});
after(async () => { await prisma.$disconnect(); });

test('authentication and all six roles: reads and mutation permission matrix', async t => {
  const reads = ['/auth/me', '/users', '/projects', '/plots', '/customers', '/leads', '/activities?leadId=' + lead.id, '/bookings', '/payments', '/dashboard/summary'];
  for (const route of reads) await t.test(`anonymous denied ${route}`, () => ok('GET', route, null, undefined, 401));
  for (const role of roles) {
    for (const route of reads) await t.test(`${role} reads ${route}`, () => ok('GET', route, role));
    const mutations = [
      ['POST', '/leads', { name: unique(), phone: unique() }, sales],
      ['PATCH', '/leads/' + lead.id, { status: 'CONTACTED' }, sales],
      ['POST', '/customers', { name: unique(), phone: unique() }, sales],
      ['PATCH', '/customers/' + customer.id, { notes: role }, sales],
      ['POST', '/activities', { leadId: lead.id, type: 'NOTE', note: role }, sales],
      ['POST', '/projects', { name: unique(), code: unique(), location: 'Test' }, managers],
      ['PATCH', '/projects/' + project.id, { description: role }, managers],
      ['POST', '/projects/' + project.id + '/blocks', { name: unique() }, managers],
      ['POST', '/plots', { projectId: project.id, plotNo: unique(), sizeKatha: 5, pricePerKatha: 1000 }, managers],
      ['PATCH', '/plots/' + (await plot()).id, { notes: role }, managers],
      ['POST', '/bookings', { plotId: (await plot()).id, customerId: customer.id, bookingAmount: 100 }, sales],
      ['PATCH', '/bookings/' + sharedBooking.id, { notes: role }, sales],
      ['POST', '/payments', { bookingId: sharedBooking.id, amount: 10, method: 'CASH' }, accounts],
      ['POST', '/users', { name: unique(), email: `${unique()}@crm.test`, password: 'NewUserPassword-2026!', role: 'VIEWER' }, roles.slice(0, 2)],
      ['PATCH', '/users/' + users.VIEWER.id, { name: 'Viewer' }, roles.slice(0, 2)],
    ];
    for (const [method, route, body, allowed] of mutations) await t.test(`${role} ${method} ${route}`, () => ok(method, route, role, body, allowed.includes(role) ? (method === 'POST' ? 201 : 200) : 403));
  }
});

test('lead -> follow-up -> customer association -> booking -> payment -> completed sale', async () => {
  const p = await plot();
  const l = await ok('POST', '/leads', 'SALES_EXECUTIVE', { name: 'Full workflow', phone: unique(), assignedToId: users.SALES_EXECUTIVE.id, preferredProjectId: project.id });
  const followUp = new Date(Date.now() + 86400000).toISOString();
  await ok('POST', '/activities', 'SALES_EXECUTIVE', { leadId: l.id, type: 'FOLLOW_UP', note: 'Discuss site visit', nextFollowUpAt: followUp });
  const c = await ok('POST', '/leads/' + l.id + '/convert', 'SALES_EXECUTIVE', {});
  assert.equal((await ok('POST', '/leads/' + l.id + '/convert', 'SALES_EXECUTIVE', {})).id, c.id);
  await ok('PATCH', '/leads/' + l.id, 'SALES_EXECUTIVE', { customerId: c.id, status: 'QUALIFIED' });
  const b = await ok('POST', '/bookings', 'SALES_EXECUTIVE', { plotId: p.id, customerId: c.id, bookingAmount: 2500 });
  await ok('PATCH', '/leads/' + l.id, 'SALES_EXECUTIVE', { status: 'BOOKED' });
  await ok('POST', '/payments', 'ACCOUNTS', { bookingId: b.id, amount: 1000.25, method: 'BANK_TRANSFER', referenceNo: unique() });
  await ok('POST', '/payments', 'ACCOUNTS', { bookingId: b.id, amount: 1499.75, method: 'CASH' });
  const saved = await ok('GET', '/bookings/' + b.id, 'VIEWER');
  assert.equal(saved.payments.reduce((sum, x) => sum + Number(x.amount), 0), 2500);
  const detail = await ok('GET', '/leads/' + l.id, 'VIEWER');
  assert.equal(detail.customer.id, c.id); assert.equal(detail.activities.length, 1); assert.equal(detail.nextFollowUpAt, followUp);
  await ok('PATCH', '/bookings/' + b.id, 'SALES_MANAGER', { status: 'COMPLETED' });
  await ok('PATCH', '/leads/' + l.id, 'SALES_EXECUTIVE', { status: 'WON' });
  assert.equal((await ok('GET', '/plots/' + p.id, 'VIEWER')).status, 'SOLD');
  const summary = await ok('GET', '/dashboard/summary', 'VIEWER');
  assert.ok(Number(summary.totalPayments) >= 2500);
});

test('eight simultaneous bookings produce exactly one owner', async () => {
  const p = await plot();
  const results = await Promise.all(Array.from({ length: 8 }, () => request('POST', '/bookings', 'SALES_EXECUTIVE', { plotId: p.id, customerId: customer.id, bookingAmount: 500 })));
  assert.equal(results.filter(x => x.status === 201).length, 1);
  assert.equal(results.filter(x => x.status === 409).length, 7);
  assert.equal(await prisma.booking.count({ where: { plotId: p.id, status: { not: 'CANCELLED' } } }), 1);
  const winner = results.find(x => x.status === 201).body;
  await assert.rejects(prisma.booking.create({ data: { plotId: p.id, customerId: customer.id, salesUserId: users.SUPER_ADMIN.id, bookingAmount: 500 } }), { code: 'P2002' });
  await ok('PATCH', '/plots/' + p.id, 'SUPER_ADMIN', { status: 'AVAILABLE' }, 409);
  await ok('PATCH', '/plots/' + p.id, 'SUPER_ADMIN', { pricePerKatha: 2000 }, 409);
  assert.equal((await ok('GET', '/bookings/' + winner.id, 'VIEWER')).status, 'CONFIRMED');
});

test('cancel/reconfirm preserves the current owner and completed sales are terminal', async () => {
  const p = await plot(), a = await booking(p);
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'CANCELLED' });
  assert.equal((await ok('GET', '/plots/' + p.id, 'VIEWER')).status, 'AVAILABLE');
  const b = await booking(p);
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'CANCELLED' });
  assert.equal((await ok('GET', '/plots/' + p.id, 'VIEWER')).status, 'BOOKED');
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'CONFIRMED' }, 409);
  await ok('POST', '/payments', 'ACCOUNTS', { bookingId: a.id, amount: 100, method: 'CASH' }, 409);
  await ok('PATCH', '/bookings/' + b.id, 'ADMIN', { status: 'CANCELLED' });
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'PENDING' });
  await ok('POST', '/payments', 'ACCOUNTS', { bookingId: a.id, amount: 100, method: 'CASH' }, 409);
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'COMPLETED' }, 400);
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'CONFIRMED' });
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'COMPLETED' });
  await ok('PATCH', '/bookings/' + a.id, 'ADMIN', { status: 'CANCELLED' }, 400);
  assert.equal((await ok('GET', '/plots/' + p.id, 'VIEWER')).status, 'SOLD');
});

test('payment vs cancellation races keep paid bookings active', async () => {
  for (let i = 0; i < 5; i++) {
    const b = await booking();
    const [pay, cancel] = await Promise.all([
      request('POST', '/payments', 'ACCOUNTS', { bookingId: b.id, amount: 100, method: 'CASH' }),
      request('PATCH', '/bookings/' + b.id, 'ADMIN', { status: 'CANCELLED' }),
    ]);
    assert.ok((pay.status === 201 && cancel.status === 409) || (pay.status === 409 && cancel.status === 200));
    const saved = await ok('GET', '/bookings/' + b.id, 'VIEWER');
    assert.equal(saved.payments.length > 0, saved.status === 'CONFIRMED');
    assert.equal(saved.plot.status, saved.status === 'CANCELLED' ? 'AVAILABLE' : 'BOOKED');
  }
});

test('invalid money, missing references and wrong-project blocks are rejected', async () => {
  for (const amount of [0, -1, 1.001]) {
    await ok('POST', '/payments', 'ACCOUNTS', { bookingId: sharedBooking.id, amount, method: 'CASH' }, 400);
    await ok('POST', '/bookings', 'ADMIN', { plotId: (await plot()).id, customerId: customer.id, bookingAmount: amount }, 400);
  }
  await ok('POST', '/payments', 'ACCOUNTS', { bookingId: 'missing', amount: 100, method: 'CASH' }, 404);
  const p = await plot();
  await ok('POST', '/bookings', 'ADMIN', { plotId: p.id, customerId: 'missing', bookingAmount: 100 }, 400);
  assert.equal((await ok('GET', '/plots/' + p.id, 'VIEWER')).status, 'AVAILABLE');
  const other = await ok('POST', '/projects', 'ADMIN', { name: unique(), code: unique(), location: 'Other' });
  const block = await ok('POST', '/projects/' + other.id + '/blocks', 'ADMIN', { name: 'Other block' });
  await ok('PATCH', '/plots/' + p.id, 'ADMIN', { blockId: block.id }, 400);
  await ok('POST', '/plots', 'ADMIN', { projectId: project.id, plotNo: unique(), sizeKatha: -5, pricePerKatha: 100 }, 400);
  await assert.rejects(prisma.payment.create({ data: { bookingId: sharedBooking.id, amount: -1, method: 'CASH' } }));
});

test('admin cannot escalate privileges; existing sessions respect role and status changes', async () => {
  await ok('POST', '/users', 'ADMIN', { name: 'Escalation', email: 'escalation@crm.test', password: 'EscalationPassword!', role: 'SUPER_ADMIN' }, 403);
  await ok('PATCH', '/users/' + users.ADMIN.id, 'ADMIN', { role: 'SUPER_ADMIN' }, 403);
  await ok('PATCH', '/users/' + users.SUPER_ADMIN.id, 'ADMIN', { status: 'INACTIVE' }, 403);
  await ok('PATCH', '/users/' + users.SUPER_ADMIN.id, 'SUPER_ADMIN', { status: 'INACTIVE' }, 409);
  await ok('PATCH', '/users/' + users.SALES_EXECUTIVE.id, 'SUPER_ADMIN', { role: 'VIEWER' });
  await ok('POST', '/leads', 'SALES_EXECUTIVE', { name: 'Denied', phone: unique() }, 403);
  await ok('PATCH', '/users/' + users.SALES_EXECUTIVE.id, 'SUPER_ADMIN', { status: 'INACTIVE' });
  await ok('GET', '/leads', 'SALES_EXECUTIVE', undefined, 401);
  await ok('POST', '/auth/login', null, { email: users.SALES_EXECUTIVE.email, password: 'RoleTestPassword-2026!' }, 401);
});

test('configuration fails closed for weak secrets and wildcard origins', () => {
  const env = { DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: 'a'.repeat(64), CORS_ORIGIN: 'http://localhost:3000' };
  assert.doesNotThrow(() => validateEnvironment(env));
  assert.throws(() => validateEnvironment({ ...env, JWT_SECRET: 'change-this-in-production' }));
  assert.throws(() => validateEnvironment({ ...env, CORS_ORIGIN: '*' }));
});

test('configurable role access: grants, revocation, dependencies, persistence and audit', async t => {
  const catalog = await ok('GET', '/access/roles', 'SUPER_ADMIN');
  const initial = catalog.roles.find(x => x.role === 'VIEWER');
  let version = initial.version;
  const save = async permissions => {
    const result = await ok('PUT', '/access/roles/VIEWER', 'SUPER_ADMIN', { permissions, version });
    version = result.version;
    return result;
  };
  try {
    await t.test('only super admin can read or update access configuration', async () => {
      for (const role of ['ADMIN','SALES_MANAGER','ACCOUNTS','VIEWER']) {
        await ok('GET','/access/roles',role,undefined,403);
        await ok('GET','/access/history',role,undefined,403);
        await ok('PUT','/access/roles/VIEWER',role,{permissions:[],version},403);
      }
      await ok('PUT','/access/roles/SUPER_ADMIN','SUPER_ADMIN',{permissions:[],version:0},403);
    });
    await t.test('unknown permissions and missing dependencies are rejected', async () => {
      for (const permissions of [['access.manage'],['unknown.view'],['leads.create'],['bookings.view'],['leads.view','leads.convert']]) {
        await ok('PUT','/access/roles/VIEWER','SUPER_ADMIN',{permissions,version},400);
      }
    });
    await t.test('existing token gets newly granted create permission', async () => {
      await save(['leads.view','leads.create']);
      await ok('POST','/leads','VIEWER',{name:'Configurable viewer lead',phone:unique()});
      assert.deepEqual((await ok('GET','/auth/me','VIEWER')).permissions,['leads.create','leads.view']);
      assert.deepEqual((await prisma.rolePolicy.findUnique({where:{role:'VIEWER'}})).permissions,['leads.create','leads.view']);
    });
    await t.test('revocation affects existing token and all direct routes', async () => {
      await save(['leads.view']);
      await ok('POST','/leads','VIEWER',{name:'Denied',phone:unique()},403);
      for(const route of ['/users','/projects','/plots','/customers','/bookings','/payments','/dashboard/summary','/activities?leadId='+lead.id]) await ok('GET',route,'VIEWER',undefined,403);
      const detail=await ok('GET','/leads/'+lead.id,'VIEWER');
      assert.deepEqual(detail.activities,[]);
    });
    await t.test('nested records and aggregate values respect denied module access', async () => {
      await save(['customers.view','projects.view','plots.view','bookings.view','dashboard.view']);
      const b=await ok('GET','/bookings/'+sharedBooking.id,'VIEWER');
      assert.deepEqual(b.payments,[]);
      const c=await ok('GET','/customers/'+customer.id,'VIEWER');
      assert.deepEqual(c.leads,[]);
      assert.ok(c.bookings.every(b=>b.payments.length===0));
      const summary=await ok('GET','/dashboard/summary','VIEWER');
      for(const field of ['totalPayments','leadCount','newLeads','recentLeads','followUps']) assert.equal(field in summary,false,field);
      assert.equal(typeof summary.totalBookedAmount,'number');
      await save(['customers.view','projects.view','plots.view']);
      assert.deepEqual((await ok('GET','/plots/'+sharedBooking.plotId,'VIEWER')).bookings,[]);
      assert.deepEqual((await ok('GET','/customers/'+customer.id,'VIEWER')).bookings,[]);
    });
    await t.test('limited user managers cannot grant stronger roles or manage stronger accounts', async () => {
      await save(['users.view','users.create','users.edit']);
      assert.deepEqual(await ok('GET','/access/assignable-roles','VIEWER'),['VIEWER']);
      await ok('POST','/users','VIEWER',{name:'Denied manager',email:unique()+'@crm.test',password:'ExamplePassword123!',role:'ADMIN'},403);
      await ok('PATCH','/users/'+users.ADMIN.id,'VIEWER',{status:'INACTIVE'},403);
      await ok('PATCH','/users/'+users.VIEWER.id,'VIEWER',{role:'ADMIN'},403);
    });
    await t.test('stale saves cannot overwrite a policy', async () => {
      await ok('PUT','/access/roles/VIEWER','SUPER_ADMIN',{permissions:[],version:version-1},409);
    });
    await t.test('empty permissions persist and deny all feature access', async () => {
      await save([]);
      assert.deepEqual((await ok('GET','/auth/me','VIEWER')).permissions,[]);
      await ok('GET','/leads','VIEWER',undefined,403);
      assert.deepEqual((await prisma.rolePolicy.findUnique({where:{role:'VIEWER'}})).permissions,[]);
    });
    await t.test('audit records the actor and before/after change', async () => {
      const history=await ok('GET','/access/history','SUPER_ADMIN');
      assert.equal(history[0].actorId,users.SUPER_ADMIN.id);
      assert.equal(history[0].role,'VIEWER');
      assert.deepEqual(history[0].after,[]);
      assert.ok(history[0].before.includes('users.edit'));
    });
  } finally { await save(initial.permissions); }
});

test('installments, statements, calendar and reports end-to-end', async t=>{
 const c=await ok('POST','/customers','ADMIN',{name:'Operations Customer আনন্দ',phone:unique()});
 const project2=await ok('POST','/projects','ADMIN',{name:'Operations test project',code:unique(),location:'Dhaka'});
 async function newBooking(){const p=await ok('POST','/plots','ADMIN',{projectId:project2.id,plotNo:unique(),sizeKatha:1,pricePerKatha:100});return ok('POST','/bookings','ADMIN',{plotId:p.id,customerId:c.id,bookingAmount:10})}
 const plan=(b,extra={})=>({bookingId:b.id,totalPrice:100,downPayment:20,months:2,downPaymentDate:'2024-01-01',firstInstallmentDate:'2024-02-01',...extra});
 const paidBooking=await newBooking();let receipt;
 await t.test('new features enforce role permissions and authentication',async()=>{
  for(const route of ['/installments','/statements/customers/'+c.id,'/calendar','/reports?from=2026-01-01&to=2026-01-31']){
   await ok('GET',route,null,undefined,401);await ok('GET',route,'VIEWER',undefined,403);await ok('GET',route,'ADMIN');
  }
  await ok('POST','/installments','VIEWER',plan(paidBooking),403);
  assert.deepEqual(await ok('GET','/operations/reminders','VIEWER'),{});
 });
 await t.test('month-end dates and exact rounding preserve the agreed price',async()=>{
  const b=await newBooking();const result=await ok('POST','/installments','ACCOUNTS',plan(b,{downPayment:0,months:3,firstInstallmentDate:'2028-01-31'}));
  assert.deepEqual(result.installments.map(i=>i.dueDate.slice(0,10)),['2028-01-31','2028-02-29','2028-03-31']);
  assert.deepEqual(result.installments.map(i=>Number(i.amount)),[33.33,33.33,33.34]);
 });
 await t.test('existing payments and partial payments allocate once to earliest dues',async()=>{
  receipt=await ok('POST','/payments','ACCOUNTS',{bookingId:paidBooking.id,amount:10,method:'CASH'});
  await ok('POST','/installments','ACCOUNTS',plan(paidBooking));
  let b=(await ok('GET','/installments','ACCOUNTS')).find(b=>b.id===paidBooking.id);
  assert.equal(b.ledger.overdue,'90.00');assert.equal(b.ledger.installments[0].paid,'10.00');
  await ok('POST','/payments','ACCOUNTS',{bookingId:paidBooking.id,amount:25,method:'BANK_TRANSFER',referenceNo:'Test transfer'});
  b=(await ok('GET','/installments','ACCOUNTS')).find(b=>b.id===paidBooking.id);
  assert.equal(b.ledger.paid,'35.00');assert.equal(b.ledger.outstanding,'65.00');assert.equal(b.ledger.overdue,'65.00');
  assert.deepEqual(b.ledger.installments.map(i=>i.paid),['20.00','15.00','0.00']);
 });
 await t.test('duplicate plans, invalid dates and invalid amounts are rejected',async()=>{
  await ok('POST','/installments','ADMIN',plan(paidBooking),409);
  for(const extra of [{totalPrice:-1},{downPayment:101},{months:0},{firstInstallmentDate:'2026-02-30'},{downPaymentDate:'2026-06-01',firstInstallmentDate:'2026-05-01'},{totalPrice:0.02,downPayment:0,months:3}]){
   await ok('POST','/installments','ADMIN',plan(await newBooking(),extra),400);
  }
  const b=await newBooking();await ok('POST','/payments','ACCOUNTS',{bookingId:b.id,amount:101,method:'CASH'});await ok('POST','/installments','ADMIN',plan(b),409);
 });
 await t.test('concurrent payment requests cannot exceed the plan price',async()=>{
  const b=await newBooking();await ok('POST','/installments','ADMIN',plan(b));
  const results=await Promise.all([request('POST','/payments','ACCOUNTS',{bookingId:b.id,amount:80,method:'CASH'}),request('POST','/payments','ADMIN',{bookingId:b.id,amount:80,method:'CASH'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  await ok('POST','/payments','ACCOUNTS',{bookingId:b.id,amount:20,method:'CASH'});
  await ok('POST','/payments','ACCOUNTS',{bookingId:b.id,amount:0.01,method:'CASH'},409);
 });
 await t.test('concurrent plan creation yields one schedule',async()=>{
  const b=await newBooking(),body=plan(b);const results=await Promise.all([request('POST','/installments','ADMIN',body),request('POST','/installments','ACCOUNTS',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal(await prisma.paymentPlan.count({where:{bookingId:b.id}}),1);
 });
 await t.test('cancelled bookings stop contributing dues; full down payment needs no installments',async()=>{
  const b=await newBooking();await ok('POST','/installments','ADMIN',plan(b,{downPayment:100,months:0}));
  await ok('PATCH','/bookings/'+b.id,'ADMIN',{status:'CANCELLED'});
  const saved=(await ok('GET','/installments','ADMIN')).find(x=>x.id===b.id);
  assert.equal(saved.ledger.outstanding,'0.00');assert.equal(saved.ledger.overdue,'0.00');assert.equal(saved.ledger.installments.length,1);
  await ok('POST','/installments','ADMIN',plan(b),409);
 });
 await t.test('customer statement and stable receipt agree with recorded payments',async()=>{
  const statement=await ok('GET','/statements/customers/'+c.id,'ACCOUNTS');
  const b=statement.bookings.find(b=>b.id===paidBooking.id);
  assert.equal(b.ledger.paid,'35.00');assert.ok(statement.unplanned>0);
  const r=await ok('GET','/statements/receipts/'+receipt.id,'ACCOUNTS');
  assert.equal(r.receiptNo,'AHS-'+receipt.id.toUpperCase());assert.equal(Number(r.amount),10);assert.equal(r.booking.customer.id,c.id);
  await ok('GET','/statements/receipts/missing','ADMIN',undefined,404);
 });
 await t.test('calendar schedules, detects stale changes, completes and removes reminders',async()=>{
  let l=await ok('POST','/leads','ADMIN',{name:'Calendar test lead',phone:unique(),assignedToId:users.ADMIN.id});
  const future=new Date(Date.now()+86400000).toISOString();
  const body={leadId:l.id,scheduledAt:future,type:'SITE_VISIT',note:'Visit site',expectedUpdatedAt:l.updatedAt,assignedToId:users.ADMIN.id};
  l=await ok('POST','/calendar','ADMIN',body);
  await ok('POST','/calendar','ADMIN',body,409);
  let data=await ok('GET','/calendar?month='+new Date(new Date(future).getTime()+21600000).toISOString().slice(0,7),'ADMIN');assert.ok(data.events.some(e=>e.id===l.id));
  await prisma.lead.update({where:{id:l.id},data:{nextFollowUpAt:new Date(Date.now()-86400000)}});
  data=await ok('GET','/calendar','ADMIN');l=data.overdue.find(e=>e.id===l.id);assert.ok(l);
  assert.ok((await ok('GET','/operations/reminders','ADMIN')).followUps.overdue>0);
  await ok('PATCH','/calendar/'+l.id+'/complete','ADMIN',{expectedUpdatedAt:l.updatedAt,note:'Site visit complete'});
  await ok('PATCH','/calendar/'+l.id+'/complete','ADMIN',{expectedUpdatedAt:l.updatedAt,note:'Duplicate'},409);
  assert.equal((await ok('GET','/leads/'+l.id,'ADMIN')).nextFollowUpAt,null);
  assert.ok(!(await ok('GET','/calendar','ADMIN')).overdue.some(e=>e.id===l.id));
  await ok('GET','/calendar?month=invalid','ADMIN',undefined,400);
 });
 await t.test('reports use Dhaka date boundaries, project filters and correct collection totals',async()=>{
  const rp=await ok('POST','/projects','ADMIN',{name:'Report boundary fixture',code:unique(),location:'Dhaka'});
  const p=await ok('POST','/plots','ADMIN',{projectId:rp.id,plotNo:unique(),sizeKatha:1,pricePerKatha:100});
  const b=await ok('POST','/bookings','ADMIN',{plotId:p.id,customerId:c.id,bookingAmount:15});
  await prisma.booking.update({where:{id:b.id},data:{bookedAt:new Date('2026-03-01T00:00:00+06:00')}});
  for(const [date,amount] of [['2026-03-01T00:00:00+06:00',10],['2026-03-31T23:59:59+06:00',20],['2026-04-01T00:00:00+06:00',30],['2026-02-28T23:59:59+06:00',40]]) await ok('POST','/payments','ACCOUNTS',{bookingId:b.id,amount,method:'CASH',paymentDate:date});
  const r=await ok('GET',`/reports?from=2026-03-01&to=2026-03-31&projectId=${rp.id}`,'ACCOUNTS');
  assert.equal(r.totals.bookings,1);assert.equal(r.totals.bookingAmount,'15.00');assert.equal(r.totals.collections,'30.00');assert.equal(r.collections.length,2);assert.equal(r.months[0].month,'2026-03');assert.equal(r.salespeople[0].collections,'30.00');assert.equal(r.totals.unplanned,1);
  await ok('GET','/reports?from=2026-02-30&to=2026-03-31','ADMIN',undefined,400);
  await ok('GET','/reports?from=2026-04-01&to=2026-03-31','ADMIN',undefined,400);
 });
});
