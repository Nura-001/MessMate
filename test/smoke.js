// Run with: npm test  — starts the server on a temp database and checks the main flows.
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const assert = require('assert');

const DB_FILE = path.join(os.tmpdir(), `messmate-test-${Date.now()}.json`);
const PORT = 3999, BASE = `http://localhost:${PORT}`;
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DB_FILE }, stdio: 'ignore' });

async function call(method, url, body, cookie) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie');
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text(), cookie: sc ? sc.split(';')[0] : undefined };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(800);
  let passed = 0; const ok = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

  const adm = await call('POST', '/api/auth/login', { email: 'manager@messmate.com', password: 'admin123' });
  ok('manager can log in', () => assert.equal(adm.status, 200));
  const A = adm.cookie;
  const kar = await call('POST', '/api/auth/login', { email: 'karim@messmate.com', password: 'member123' });
  const K = kar.cookie;
  ok('wrong password rejected', () => {});
  assert.equal((await call('POST', '/api/auth/login', { email: 'karim@messmate.com', password: 'nope' })).status, 401);

  ok('unauthenticated request blocked', () => {});
  assert.equal((await call('GET', '/api/report')).status, 401);

  const reg = await call('POST', '/api/auth/register', { name: 'New Student', email: 'new@x.com', password: 'secret1' });
  ok('registration creates a member', () => { assert.equal(reg.status, 201); assert.equal(reg.data.user.role, 'member'); });
  assert.equal((await call('POST', '/api/auth/register', { name: 'Dup', email: 'new@x.com', password: 'secret1' })).status, 409);

  const rep = await call('GET', '/api/report', null, K);
  ok('report has members and a meal rate', () => { assert.ok(rep.data.members.length >= 4); assert.ok(rep.data.mealRate > 0); });
  const sumBal = rep.data.members.reduce((s, m) => s + m.cost, 0);
  ok('member costs add up to total expense', () => assert.ok(Math.abs(sumBal - rep.data.totalExpense) < 1));

  const forbid = await call('POST', '/api/deposits', { userId: 2, amount: 100, date: '2025-01-01' }, K);
  ok('member cannot add deposits (403)', () => assert.equal(forbid.status, 403));

  const past = await call('POST', '/api/meals', { date: '2020-01-01', lunch: 1 }, K);
  ok('member cannot edit past meals (403)', () => assert.equal(past.status, 403));

  const me = await call('GET', '/api/auth/me', null, K);
  const exp = await call('POST', '/api/expenses', { title: 'Test salt', amount: 50, date: me.data.today, category: 'Other' }, K);
  ok('member expense starts as pending', () => assert.equal(exp.data.expense.status, 'pending'));
  const appr = await call('PUT', `/api/expenses/${exp.data.expense.id}/status`, { status: 'approved' }, A);
  ok('manager can approve expense', () => assert.equal(appr.data.expense.status, 'approved'));

  const csv = await call('GET', '/api/report/csv', null, A);
  ok('CSV export works', () => assert.ok(csv.data.startsWith('Member,Meals')));

  const page = await call('GET', '/login.html');
  ok('static pages are served', () => assert.equal(page.status, 200));

  console.log(`\n${passed} checks passed`);
})().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; }).finally(() => { srv.kill(); fs.rmSync(DB_FILE, { force: true }); });
