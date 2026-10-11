(async () => {
  const me = await initPage();
  const isAdmin = me.user.role === 'admin';
  $('#date').value = me.today;
  let month = monthPicker($('#month'), (m) => { month = m; load(); });
  if (isAdmin) {
    $('#formCard').hidden = false;
    const { users } = await api('/users');
    $('#who').innerHTML = users.filter((u) => u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  }
  async function load() {
    const { deposits } = await api('/deposits?month=' + month);
    $('#rows').innerHTML = deposits.map((d) => `<tr><td>${fmtDate(d.date)}</td><td>${esc(d.userName)}</td><td>${esc(d.note)}</td><td class="right">${money(d.amount)}</td>
      <td class="right">${isAdmin ? `<button class="btn danger sm" data-del="${d.id}">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No deposits this month.</td></tr>';
    $('#total').textContent = money(deposits.reduce((s, d) => s + d.amount, 0));
  }
  $('#rows').onclick = async (e) => {
    const id = e.target.dataset.del; if (!id || !confirm('Delete this deposit?')) return;
    try { await api('/deposits/' + id, { method: 'DELETE' }); load(); } catch (x) { fail(x); }
  };
  $('#add').onclick = async () => {
    try {
      await api('/deposits', { method: 'POST', body: { userId: $('#who').value, amount: $('#amount').value, date: $('#date').value, note: $('#note').value } });
      toast('Deposit recorded'); $('#amount').value = ''; $('#note').value = ''; load();
    } catch (x) { fail(x); }
  };
  load().catch(fail);
})();
