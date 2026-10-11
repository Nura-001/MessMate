// Login + register forms (same file; the page decides which fields exist).
const err = $('#err');
const show = (m) => { err.textContent = m; err.style.display = 'block'; };
const isRegister = !!$('#name');
async function submit() {
  err.style.display = 'none';
  const body = { email: $('#email').value, password: $('#password').value };
  if (isRegister) { body.name = $('#name').value; body.phone = $('#phone').value; }
  try { await api(isRegister ? '/auth/register' : '/auth/login', { method: 'POST', body }); location.href = 'dashboard.html'; }
  catch (e) { show(e.message); }
}
$('#go').onclick = submit;
document.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
// already logged in? skip the form
api('/auth/me').then(() => (location.href = 'dashboard.html')).catch(() => {});
