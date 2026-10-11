(async () => {
  const me = await initPage();
  const isAdmin = me.user.role === 'admin';
  let month = monthPicker($('#month'), (m) => { month = m; load(); });
  $('#date').value = me.today;
  if (isAdmin) {
    $('#whoBox').hidden = false;
    const { users } = await api('/users');
    $('#who').innerHTML = users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${u.id === me.user.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  }
  async function load() {
    const { meals } = await api('/meals?month=' + month);
    $('#rows').innerHTML = meals.map((m) => {
      const canDel = isAdmin || (m.userId === me.user.id && m.date >= me.today);
      return `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.userName)}</td><td class="right">${m.breakfast}</td><td class="right">${m.lunch}</td><td class="right">${m.dinner}</td>
      <td class="right">${m.breakfast * me.settings.breakfastWeight + m.lunch + m.dinner}</td>
      <td class="right">${canDel ? `<button class="btn danger sm" data-del="${m.id}">Remove</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No meals recorded for this month.</td></tr>';
  }
  $('#rows').onclick = async (e) => {
    const id = e.target.dataset.del; if (!id) return;
    try { await api('/meals/' + id, { method: 'DELETE' }); toast('Entry removed'); load(); } catch (x) { fail(x); }
  };
  $('#save').onclick = async () => {
    try {
      await api('/meals', { method: 'POST', body: { userId: isAdmin ? $('#who').value : undefined, date: $('#date').value, breakfast: $('#mb').value, lunch: $('#ml').value, dinner: $('#md').value } });
      toast('Meals saved'); load();
    } catch (x) { fail(x); }
  };
  load().catch(fail);
})();
