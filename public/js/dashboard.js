(async () => {
  const me = await initPage();
  const isAdmin = me.user.role === 'admin';
  $('#hello').textContent = `Hello, ${me.user.name.split(' ')[0]}`;
  $('#sub').textContent = me.settings.messName;
  let month = monthPicker($('#month'), (m) => { month = m; load(); });

  async function load() {
    const [rep, nt] = await Promise.all([api('/report?month=' + month), api('/notices')]);
    const mine = rep.members.find((m) => m.id === me.user.id) || { meals: 0, cost: 0, deposit: 0, balance: 0 };
    const cards = [
      ['Meal rate (per meal)', money(rep.mealRate), 'gold'], ['My meals', mine.meals, ''],
      ['My cost so far', money(mine.cost), ''], ['My balance', `<span class="${signCls(mine.balance)}">${mine.balance < 0 ? '−' : '+'}${money(Math.abs(mine.balance))}</span>`, mine.balance < 0 ? 'red' : '']
    ];
    if (isAdmin) cards.push(['Total bazar', money(rep.totalExpense), 'gold'], ['Pending approvals', rep.pendingExpenses, rep.pendingExpenses ? 'red' : '']);
    $('#stats').innerHTML = cards.map((c) => `<div class="stat ${c[2]}"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join('');
    $('#notices').innerHTML = nt.notices.slice(0, 3).map((n) => `<div class="notice"><h3>${esc(n.title)}</h3><p class="small muted" style="margin:.2rem 0">${esc(n.body)}</p></div>`).join('') || '<p class="muted">No notices yet.</p>';
    const days = Object.keys(rep.daily).sort();
    drawBars($('#chart'), days.map((d) => d.slice(8)), days.map((d) => rep.daily[d]));
  }

  async function loadToday() {
    $('#todayLbl').textContent = new Date(me.today + 'T00:00:00').toDateString();
    const { meals } = await api('/meals?month=' + me.today.slice(0, 7));
    const t = meals.find((m) => m.userId === me.user.id && m.date === me.today);
    $('#b').checked = !!(t && t.breakfast); $('#l').checked = !!(t && t.lunch); $('#d').checked = !!(t && t.dinner);
  }
  $('#saveToday').onclick = async () => {
    try {
      await api('/meals', { method: 'POST', body: { date: me.today, breakfast: +$('#b').checked, lunch: +$('#l').checked, dinner: +$('#d').checked } });
      toast('Today\'s meals saved'); load();
    } catch (e) { fail(e); }
  };
  window.addEventListener('resize', () => load().catch(() => {}));
  load().catch(fail); loadToday().catch(fail);
})();
