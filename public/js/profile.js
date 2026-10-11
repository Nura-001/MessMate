(async () => {
  const me = await initPage();
  $('#name').value = me.user.name; $('#email').value = me.user.email; $('#phone').value = me.user.phone || '';
  $('#meta').textContent = `${me.user.role === 'admin' ? 'Manager' : 'Member'} · joined ${new Date(me.user.createdAt).toLocaleDateString('en-GB')}`;
  $('#saveP').onclick = async () => {
    try { await api('/profile', { method: 'PUT', body: { name: $('#name').value, phone: $('#phone').value } }); toast('Profile updated'); } catch (x) { fail(x); }
  };
  $('#savePw').onclick = async () => {
    try { await api('/profile/password', { method: 'PUT', body: { current: $('#cur').value, next: $('#nw').value } }); toast('Password changed'); $('#cur').value = $('#nw').value = ''; } catch (x) { fail(x); }
  };
})();
