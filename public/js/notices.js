(async () => {
  const me = await initPage();
  const isAdmin = me.user.role === 'admin';
  if (isAdmin) $('#formCard').hidden = false;
  async function load() {
    const { notices } = await api('/notices');
    $('#list').innerHTML = notices.map((n) => `<div class="notice"><h3>${esc(n.title)}</h3><p style="margin:.2rem 0">${esc(n.body)}</p>
      <p class="small muted" style="margin:0">${esc(n.authorName)} · ${new Date(n.createdAt).toLocaleDateString('en-GB')}
      ${isAdmin ? ` · <a href="#" data-del="${n.id}">delete</a>` : ''}</p></div>`).join('') || '<p class="empty">No notices yet.</p>';
  }
  $('#list').onclick = async (e) => {
    const id = e.target.dataset.del; if (!id) return; e.preventDefault();
    try { await api('/notices/' + id, { method: 'DELETE' }); load(); } catch (x) { fail(x); }
  };
  $('#post').onclick = async () => {
    try { await api('/notices', { method: 'POST', body: { title: $('#title').value, body: $('#body').value } }); $('#title').value = $('#body').value = ''; toast('Notice posted'); load(); } catch (x) { fail(x); }
  };
  load().catch(fail);
})();
