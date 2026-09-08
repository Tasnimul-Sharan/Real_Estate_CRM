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
