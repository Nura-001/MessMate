// All REST API endpoints. Every handler receives ctx = { user, params, query, body, res }.
const db = require('./db');
const { hashPassword, verifyPassword, sign } = require('./auth');
const { HttpError, Router } = require('./http');

const router = new Router();
const r = (m, p, h) => router.add(m, p, h);

/* ---------- helpers ---------- */
const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const monthNow = () => todayDhaka().slice(0, 7);
const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d));
const round = (n) => Math.round(n * 100) / 100;
const clean = (s, max = 120) => String(s ?? '').trim().slice(0, max);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, createdAt: u.createdAt });
const monthOf = (q) => (isMonth(q.month) ? q.month : monthNow());

const needAuth = (ctx) => { if (!ctx.user) throw new HttpError(401, 'Please log in first'); };
const needAdmin = (ctx) => { needAuth(ctx); if (ctx.user.role !== 'admin') throw new HttpError(403, 'Manager access only'); };
const adminCount = () => db.all('users').filter((u) => u.role === 'admin' && u.active).length;

const COOKIE = (token, maxAge) => `mm_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;

/* ---------- auth ---------- */
r('POST', '/api/auth/register', (ctx) => {
  const name = clean(ctx.body.name, 60), email = clean(ctx.body.email, 100).toLowerCase();
  const phone = clean(ctx.body.phone, 20), password = String(ctx.body.password || '');
  if (name.length < 2) throw new HttpError(400, 'Please enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (db.all('users').some((u) => u.email === email)) throw new HttpError(409, 'This email is already registered');
  const { salt, hash } = hashPassword(password);
  const first = db.all('users').length === 0;
  const u = db.insert('users', { name, email, phone, salt, hash, role: first ? 'admin' : 'member', active: true, createdAt: new Date().toISOString() });
  const token = sign({ uid: u.id, exp: Date.now() + 7 * 864e5 }, db.secret());
  return { status: 201, headers: { 'Set-Cookie': COOKIE(token, 604800) }, body: { user: publicUser(u) } };
});

r('POST', '/api/auth/login', (ctx) => {
  const email = clean(ctx.body.email, 100).toLowerCase();
  const u = db.all('users').find((x) => x.email === email);
  if (!u || !verifyPassword(String(ctx.body.password || ''), u.salt, u.hash)) throw new HttpError(401, 'Wrong email or password');
  if (!u.active) throw new HttpError(403, 'Your account is deactivated. Contact the manager.');
  const token = sign({ uid: u.id, exp: Date.now() + 7 * 864e5 }, db.secret());
  return { headers: { 'Set-Cookie': COOKIE(token, 604800) }, body: { user: publicUser(u) } };
});

r('POST', '/api/auth/logout', () => ({ headers: { 'Set-Cookie': COOKIE('', 0) }, body: { ok: true } }));

r('GET', '/api/auth/me', (ctx) => {
  needAuth(ctx);
  return { user: publicUser(ctx.user), settings: db.settings(), today: todayDhaka() };
});

/* ---------- profile ---------- */
r('PUT', '/api/profile', (ctx) => {
  needAuth(ctx);
  const name = clean(ctx.body.name, 60);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name');
  return { user: publicUser(db.update('users', ctx.user.id, { name, phone: clean(ctx.body.phone, 20) })) };
});

r('PUT', '/api/profile/password', (ctx) => {
  needAuth(ctx);
  if (!verifyPassword(String(ctx.body.current || ''), ctx.user.salt, ctx.user.hash)) throw new HttpError(400, 'Current password is incorrect');
  const np = String(ctx.body.next || '');
  if (np.length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
  const { salt, hash } = hashPassword(np);
  db.update('users', ctx.user.id, { salt, hash });
  return { ok: true };
});

/* ---------- users (manager) ---------- */
r('GET', '/api/users', (ctx) => {
  needAuth(ctx);
  const list = db.all('users').filter((u) => ctx.user.role === 'admin' || u.active);
  return { users: list.map(ctx.user.role === 'admin' ? publicUser : (u) => ({ id: u.id, name: u.name })) };
});

r('PUT', '/api/users/:id', (ctx) => {
  needAdmin(ctx);
  const u = db.get('users', ctx.params.id);
  if (!u) throw new HttpError(404, 'User not found');
  const patch = {};
  if (['admin', 'member'].includes(ctx.body.role)) patch.role = ctx.body.role;
  if (typeof ctx.body.active === 'boolean') patch.active = ctx.body.active;
  const demoting = u.role === 'admin' && (patch.role === 'member' || patch.active === false);
  if (demoting && adminCount() <= 1) throw new HttpError(400, 'At least one active manager is required');
  return { user: publicUser(db.update('users', u.id, patch)) };
});

r('DELETE', '/api/users/:id', (ctx) => {
  needAdmin(ctx);
  const u = db.get('users', ctx.params.id);
  if (!u) throw new HttpError(404, 'User not found');
  if (u.id === ctx.user.id) throw new HttpError(400, 'You cannot delete your own account');
  db.remove('users', u.id);
  ['meals', 'deposits'].forEach((c) => db.where(c, (x) => x.userId === u.id).forEach((x) => db.remove(c, x.id)));
  return { ok: true };
});

/* ---------- settings ---------- */
r('PUT', '/api/settings', (ctx) => {
  needAdmin(ctx);
  const w = Number(ctx.body.breakfastWeight);
  if (!(w >= 0 && w <= 1)) throw new HttpError(400, 'Breakfast weight must be between 0 and 1');
  Object.assign(db.settings(), { messName: clean(ctx.body.messName, 60) || 'My Mess', breakfastWeight: w });
  db.save();
  return { settings: db.settings() };
});

/* ---------- meals ---------- */
r('GET', '/api/meals', (ctx) => {
  needAuth(ctx);
  const month = monthOf(ctx.query);
  let rows = db.where('meals', (m) => m.date.startsWith(month));
  if (ctx.user.role !== 'admin') rows = rows.filter((m) => m.userId === ctx.user.id);
  else if (ctx.query.userId) rows = rows.filter((m) => m.userId === Number(ctx.query.userId));
  const names = Object.fromEntries(db.all('users').map((u) => [u.id, u.name]));
  rows = rows.sort((a, b) => b.date.localeCompare(a.date) || a.userId - b.userId).map((m) => ({ ...m, userName: names[m.userId] || 'Deleted user' }));
  return { meals: rows };
});

r('POST', '/api/meals', (ctx) => {
  needAuth(ctx);
  const admin = ctx.user.role === 'admin';
  const userId = admin && ctx.body.userId ? Number(ctx.body.userId) : ctx.user.id;
  const target = db.get('users', userId);
  if (!target) throw new HttpError(404, 'Member not found');
  if (!isDate(ctx.body.date)) throw new HttpError(400, 'Choose a valid date');
  if (!admin && ctx.body.date < todayDhaka()) throw new HttpError(403, 'Members can only set meals for today or later. Ask the manager to change past dates.');
  const n = (v) => { const x = Number(v); if (!Number.isInteger(x) || x < 0 || x > 5) throw new HttpError(400, 'Meal counts must be whole numbers from 0 to 5'); return x; };
  const vals = { breakfast: n(ctx.body.breakfast || 0), lunch: n(ctx.body.lunch || 0), dinner: n(ctx.body.dinner || 0) };
  const existing = db.all('meals').find((m) => m.userId === userId && m.date === ctx.body.date);
  const rec = existing ? db.update('meals', existing.id, vals) : db.insert('meals', { userId, date: ctx.body.date, ...vals });
  return { status: existing ? 200 : 201, body: { meal: rec } };
});

r('DELETE', '/api/meals/:id', (ctx) => {
  needAuth(ctx);
  const m = db.get('meals', ctx.params.id);
  if (!m) throw new HttpError(404, 'Entry not found');
  const admin = ctx.user.role === 'admin';
  if (!admin && (m.userId !== ctx.user.id || m.date < todayDhaka())) throw new HttpError(403, 'You cannot remove this entry');
  db.remove('meals', m.id);
  return { ok: true };
});

/* ---------- expenses (bazar) ---------- */
r('GET', '/api/expenses', (ctx) => {
  needAuth(ctx);
  const month = monthOf(ctx.query), q = clean(ctx.query.q, 60).toLowerCase();
  const names = Object.fromEntries(db.all('users').map((u) => [u.id, u.name]));
  let rows = db.where('expenses', (e) => e.date.startsWith(month));
  if (ctx.query.status) rows = rows.filter((e) => e.status === ctx.query.status);
  if (ctx.query.category) rows = rows.filter((e) => e.category === ctx.query.category);
  if (q) rows = rows.filter((e) => (e.title + ' ' + e.note).toLowerCase().includes(q));
  rows = rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map((e) => ({ ...e, addedByName: names[e.addedBy] || 'Deleted user' }));
  return { expenses: rows };
});

const CATEGORIES = ['Rice & Grains', 'Fish & Meat', 'Vegetables', 'Spices & Oil', 'Gas & Utilities', 'Other'];
r('POST', '/api/expenses', (ctx) => {
  needAuth(ctx);
  const title = clean(ctx.body.title, 80), amount = Number(ctx.body.amount);
  if (title.length < 2) throw new HttpError(400, 'Enter what was bought');
  if (!(amount > 0 && amount <= 1e6)) throw new HttpError(400, 'Enter a valid amount');
  if (!isDate(ctx.body.date)) throw new HttpError(400, 'Choose a valid date');
  const category = CATEGORIES.includes(ctx.body.category) ? ctx.body.category : 'Other';
  const admin = ctx.user.role === 'admin';
  const e = db.insert('expenses', { title, category, amount: round(amount), date: ctx.body.date, note: clean(ctx.body.note, 200), addedBy: ctx.user.id, status: admin ? 'approved' : 'pending' });
  return { status: 201, body: { expense: e } };
});

r('PUT', '/api/expenses/:id/status', (ctx) => {
  needAdmin(ctx);
  if (!['approved', 'rejected', 'pending'].includes(ctx.body.status)) throw new HttpError(400, 'Invalid status');
  const e = db.update('expenses', ctx.params.id, { status: ctx.body.status });
  if (!e) throw new HttpError(404, 'Expense not found');
  return { expense: e };
});

r('DELETE', '/api/expenses/:id', (ctx) => {
  needAuth(ctx);
  const e = db.get('expenses', ctx.params.id);
  if (!e) throw new HttpError(404, 'Expense not found');
  if (ctx.user.role !== 'admin' && !(e.addedBy === ctx.user.id && e.status === 'pending')) throw new HttpError(403, 'You cannot delete this expense');
  db.remove('expenses', e.id);
  return { ok: true };
});

/* ---------- deposits ---------- */
r('GET', '/api/deposits', (ctx) => {
  needAuth(ctx);
  const month = monthOf(ctx.query);
  let rows = db.where('deposits', (d) => d.date.startsWith(month));
  if (ctx.user.role !== 'admin') rows = rows.filter((d) => d.userId === ctx.user.id);
  const names = Object.fromEntries(db.all('users').map((u) => [u.id, u.name]));
  return { deposits: rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map((d) => ({ ...d, userName: names[d.userId] || 'Deleted user' })) };
});

r('POST', '/api/deposits', (ctx) => {
  needAdmin(ctx);
  const u = db.get('users', ctx.body.userId), amount = Number(ctx.body.amount);
  if (!u) throw new HttpError(400, 'Choose a member');
  if (!(amount > 0 && amount <= 1e6)) throw new HttpError(400, 'Enter a valid amount');
  if (!isDate(ctx.body.date)) throw new HttpError(400, 'Choose a valid date');
  return { status: 201, body: { deposit: db.insert('deposits', { userId: u.id, amount: round(amount), date: ctx.body.date, note: clean(ctx.body.note, 120) }) } };
});

r('DELETE', '/api/deposits/:id', (ctx) => {
  needAdmin(ctx);
  if (!db.remove('deposits', ctx.params.id)) throw new HttpError(404, 'Deposit not found');
  return { ok: true };
});

/* ---------- notices ---------- */
r('GET', '/api/notices', (ctx) => {
  needAuth(ctx);
  const names = Object.fromEntries(db.all('users').map((u) => [u.id, u.name]));
  return { notices: [...db.all('notices')].reverse().map((n) => ({ ...n, authorName: names[n.authorId] || 'Manager' })) };
});
r('POST', '/api/notices', (ctx) => {
  needAdmin(ctx);
  const title = clean(ctx.body.title, 80), text = clean(ctx.body.body, 600);
  if (title.length < 2 || text.length < 2) throw new HttpError(400, 'Title and message are required');
  return { status: 201, body: { notice: db.insert('notices', { title, body: text, authorId: ctx.user.id, createdAt: new Date().toISOString() }) } };
});
r('DELETE', '/api/notices/:id', (ctx) => {
  needAdmin(ctx);
  if (!db.remove('notices', ctx.params.id)) throw new HttpError(404, 'Notice not found');
  return { ok: true };
});

/* ---------- monthly report ---------- */
function buildReport(month) {
  const bw = db.settings().breakfastWeight;
  const meals = db.where('meals', (m) => m.date.startsWith(month));
  const expenses = db.where('expenses', (e) => e.date.startsWith(month) && e.status === 'approved');
  const deposits = db.where('deposits', (d) => d.date.startsWith(month));
  const weight = (m) => m.breakfast * bw + m.lunch + m.dinner;
  const totalMeals = meals.reduce((s, m) => s + weight(m), 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const rate = totalMeals ? totalExpense / totalMeals : 0;
  const members = db.all('users')
    .filter((u) => u.active || meals.some((m) => m.userId === u.id) || deposits.some((d) => d.userId === u.id))
    .map((u) => {
      const mm = meals.filter((m) => m.userId === u.id).reduce((s, m) => s + weight(m), 0);
      const dep = deposits.filter((d) => d.userId === u.id).reduce((s, d) => s + d.amount, 0);
      const cost = mm * rate;
      return { id: u.id, name: u.name, meals: round(mm), deposit: round(dep), cost: round(cost), balance: round(dep - cost) };
    });
  const byCategory = {};
  expenses.forEach((e) => (byCategory[e.category] = round((byCategory[e.category] || 0) + e.amount)));
  const daily = {};
  expenses.forEach((e) => (daily[e.date] = round((daily[e.date] || 0) + e.amount)));
  return {
    month, mealRate: round(rate), totalMeals: round(totalMeals), totalExpense: round(totalExpense),
    totalDeposit: round(deposits.reduce((s, d) => s + d.amount, 0)),
    pendingExpenses: db.where('expenses', (e) => e.date.startsWith(month) && e.status === 'pending').length,
    members, byCategory, daily
  };
}
r('GET', '/api/report', (ctx) => { needAuth(ctx); return buildReport(monthOf(ctx.query)); });

r('GET', '/api/report/csv', (ctx) => {
  needAuth(ctx);
  const rep = buildReport(monthOf(ctx.query));
  const lines = ['Member,Meals,Meal Rate,Cost,Deposit,Balance'];
  rep.members.forEach((m) => lines.push(`"${m.name.replace(/"/g, '""')}",${m.meals},${rep.mealRate},${m.cost},${m.deposit},${m.balance}`));
  lines.push(`TOTAL,${rep.totalMeals},${rep.mealRate},${rep.totalExpense},${rep.totalDeposit},`);
  return { raw: lines.join('\n'), type: 'text/csv', headers: { 'Content-Disposition': `attachment; filename="messmate-${rep.month}.csv"` } };
});

module.exports = { router, todayDhaka, CATEGORIES };
