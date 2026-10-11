(async () => {
  const me = await initPage(true);
  $('#mess').value = me.settings.messName; $('#bw').value = me.settings.breakfastWeight;
  $('#saveS').onclick = async () => {
    try { await api('/settings', { method: 'PUT', body: { messName: $('#mess').value, breakfastWeight: $('#bw').value } }); toast('Settings saved'); } catch (x) { fail(x); }
  };
  async function load() {
    const { users } = await api('/users');
    $('#rows').innerHTML = users.map((u) => {
      const self = u.id === me.user.id;
      return `<tr><td>${esc(u.name)}${self ? ' <span class="muted small">(you)</span>' : ''}</td><td>${esc(u.email)}</td><td>${esc(u.phone || '-')}</td>
      <td><select data-role="${u.id}" aria-label="Role for ${esc(u.name)}"><option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Manager</option></select></td>
      <td><span class="tag ${u.active ? 'approved' : 'rejected'}">${u.active ? 'active' : 'inactive'}</span></td>
      <td><div class="actions"><button class="btn alt sm" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Deactivate' : 'Activate'}</button>
      ${self ? '' : `<button class="btn danger sm" data-del="${u.id}">Delete</button>`}</div></td></tr>`;
    }).join('');
  }
  $('#rows').onchange = async (e) => {
    if (!e.target.dataset.role) return;
    try { await api('/users/' + e.target.dataset.role, { method: 'PUT', body: { role: e.target.value } }); toast('Role updated'); } catch (x) { fail(x); load(); }
  };
  $('#rows').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.toggle) await api('/users/' + b.dataset.toggle, { method: 'PUT', body: { active: b.dataset.active !== 'true' } });
      else if (confirm('Delete this member and all their meals and deposits?')) await api('/users/' + b.dataset.del, { method: 'DELETE' });
      load();
    } catch (x) { fail(x); }
  };
  load().catch(fail);
})();
