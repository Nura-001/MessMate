// Shared front-end helpers: API wrapper, page shell (sidebar), formatting, toasts.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const monthLabel = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

async function api(url, opt = {}) {
  const o = { method: opt.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opt.body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
  const res = await fetch('/api' + url, o);
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error((data && data.error) || 'Request failed'); e.status = res.status; throw e; }
  return data;
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
const fail = (e) => toast(e.message || 'Something went wrong', true);

const NAV = [
  ['dashboard.html', 'Dashboard'], ['meals.html', 'Meals'], ['expenses.html', 'Bazar Expenses'],
  ['deposits.html', 'Deposits'], ['reports.html', 'Monthly Report'], ['notices.html', 'Notice Board'],
  ['profile.html', 'My Profile'], ['admin.html', 'Manager Panel', true]
];

// Call at the start of every private page. Redirects to login if there is no session.
async function initPage(adminOnly = false) {
  let me;
  try { me = await api('/auth/me'); } catch { location.href = 'login.html'; return new Promise(() => {}); }
  if (adminOnly && me.user.role !== 'admin') { location.href = 'dashboard.html'; return new Promise(() => {}); }
  const here = location.pathname.split('/').pop() || 'index.html';
  const links = NAV.filter((n) => !n[2] || me.user.role === 'admin')
    .map((n) => `<a href="${n[0]}" class="${n[0] === here ? 'on' : ''}">${n[1]}</a>`).join('');
  $('#side').innerHTML = `
    <a class="brand" href="dashboard.html">Mess<i>Mate</i></a>
    <div class="mess">${esc(me.settings.messName)}</div>
    <nav aria-label="Main">${links}</nav>
    <div class="who"><b>${esc(me.user.name)}</b><span class="tag ${me.user.role}">${me.user.role === 'admin' ? 'Manager' : 'Member'}</span>
      <p><button class="btn alt sm" id="logout" style="color:#fff;border-color:#9fb0c6">Log out</button></p></div>`;
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = 'login.html'; };
  const mb = $('#menuBtn'); if (mb) mb.onclick = () => $('#side').classList.toggle('open');
  return me;
}

// Fills a <input type="month"> and calls cb when it changes.
function monthPicker(el, cb) {
  el.value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7);
  el.onchange = () => { if (el.value) cb(el.value); };
  return el.value;
}
const signCls = (n) => (n < 0 ? 'neg' : 'pos');

// Minimal canvas bar chart (no libraries). labels: string[], values: number[]
function drawBars(canvas, labels, values) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  g.font = '12px system-ui,sans-serif';
  if (!values.length) { g.fillStyle = '#4a5a70'; g.fillText('No approved expenses this month yet', 12, h / 2); return; }
  const max = Math.max(...values) * 1.1, pad = { l: 44, r: 8, t: 10, b: 24 }, bw = (w - pad.l - pad.r) / values.length;
  g.strokeStyle = '#d9e0d3'; g.fillStyle = '#4a5a70';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * (1 - i / 4);
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
    g.fillText(Math.round((max * i) / 4), 4, y + 4);
  }
  values.forEach((v, i) => {
    const bh = (h - pad.t - pad.b) * (v / max), x = pad.l + i * bw + bw * 0.15;
    g.fillStyle = '#e8a317'; g.fillRect(x, h - pad.b - bh, bw * 0.7, bh);
    g.fillStyle = '#4a5a70'; if (values.length < 16 || i % 2 === 0) g.fillText(labels[i], x, h - 7);
  });
}
