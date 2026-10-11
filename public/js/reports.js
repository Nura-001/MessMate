(async () => {
  const me = await initPage();
  let month = monthPicker($('#month'), (m) => { month = m; load(); });
  async function load() {
    const r = await api('/report?month=' + month);
    $('#sub').textContent = `${monthLabel(month)} · ${me.settings.messName}`;
    $('#csv').href = '/api/report/csv?month=' + month;
    $('#stats').innerHTML = [['Total bazar', money(r.totalExpense), 'gold'], ['Total meals', r.totalMeals, ''], ['Meal rate', money(r.mealRate), 'gold'], ['Total deposits', money(r.totalDeposit), '']]
      .map((c) => `<div class="stat ${c[2]}"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join('');
    $('#rows').innerHTML = r.members.map((m) => `<tr${m.id === me.user.id ? ' style="background:var(--wash)"' : ''}><td>${esc(m.name)}</td><td class="right">${m.meals}</td><td class="right">${money(m.cost)}</td><td class="right">${money(m.deposit)}</td>
      <td class="right ${signCls(m.balance)}"><b>${m.balance < 0 ? '−' : '+'}${money(Math.abs(m.balance))}</b></td></tr>`).join('');
    $('#foot').innerHTML = `<tr><td>Total</td><td class="right">${r.totalMeals}</td><td class="right">${money(r.totalExpense)}</td><td class="right">${money(r.totalDeposit)}</td><td></td></tr>`;
    const cats = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]);
    $('#cats').innerHTML = cats.map(([c, v]) => `<div style="margin-bottom:.8rem"><div style="display:flex;justify-content:space-between"><span>${esc(c)}</span><b>${money(v)} <span class="muted small">(${Math.round((v / r.totalExpense) * 100)}%)</span></b></div>
      <div class="bar"><i style="width:${(v / r.totalExpense) * 100}%"></i></div></div>`).join('') || '<p class="muted">No approved expenses this month.</p>';
  }
  load().catch(fail);
})();
