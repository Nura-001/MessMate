(async () => {
  const me = await initPage();
  const isAdmin = me.user.role === 'admin';
  const CATS = ['Rice & Grains', 'Fish & Meat', 'Vegetables', 'Spices & Oil', 'Gas & Utilities', 'Other'];
  $('#cat').innerHTML = CATS.map((c) => `<option>${c}</option>`).join('');
  $('#fcat').innerHTML += CATS.map((c) => `<option>${c}</option>`).join('');
  $('#date').value = me.today;
  let month = monthPicker($('#month'), (m) => { month = m; load(); });

  async function load() {
    const qs = new URLSearchParams({ month, q: $('#q').value, category: $('#fcat').value, status: $('#fstat').value });
    const { expenses } = await api('/expenses?' + qs);
    $('#rows').innerHTML = expenses.map((e) => {
      const acts = [];
      if (isAdmin && e.status !== 'approved') acts.push(`<button class="btn green sm" data-st="approved" data-id="${e.id}">Approve</button>`);
      if (isAdmin && e.status === 'pending') acts.push(`<button class="btn alt sm" data-st="rejected" data-id="${e.id}">Reject</button>`);
      if (isAdmin || (e.addedBy === me.user.id && e.status === 'pending')) acts.push(`<button class="btn danger sm" data-del="${e.id}">Delete</button>`);
      return `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.title)}${e.note ? `<br><span class="small muted">${esc(e.note)}</span>` : ''}</td><td>${esc(e.category)}</td><td>${esc(e.addedByName)}</td>
      <td class="right">${money(e.amount)}</td><td><span class="tag ${e.status}">${e.status}</span></td><td><div class="actions">${acts.join('')}</div></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No expenses match.</td></tr>';
    $('#total').textContent = money(expenses.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0));
  }
  $('#rows').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.del) await api('/expenses/' + b.dataset.del, { method: 'DELETE' });
      else await api(`/expenses/${b.dataset.id}/status`, { method: 'PUT', body: { status: b.dataset.st } });
      load();
    } catch (x) { fail(x); }
  };
  $('#add').onclick = async () => {
    try {
      const r = await api('/expenses', { method: 'POST', body: { title: $('#title').value, category: $('#cat').value, amount: $('#amount').value, date: $('#date').value, note: $('#note').value } });
      toast(r.expense.status === 'pending' ? 'Sent to manager for approval' : 'Expense added');
      ['#title', '#amount', '#note'].forEach((s) => ($(s).value = '')); load();
    } catch (x) { fail(x); }
  };
  ['#q', '#fcat', '#fstat'].forEach((s) => $(s).addEventListener('input', () => load().catch(fail)));
  load().catch(fail);
})();
