// Demo data so the app looks alive the first time it runs.
const db = require('./db');
const { hashPassword } = require('./auth');

function seed() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const ym = today.slice(0, 7), day = Number(today.slice(8));
  const d = (n) => `${ym}-${String(n).padStart(2, '0')}`;
  const mk = (name, email, role, phone, pw) => {
    const { salt, hash } = hashPassword(pw);
    return db.insert('users', { name, email, phone, salt, hash, role, active: true, createdAt: new Date().toISOString() });
  };
  const admin = mk('Rahim Uddin (Manager)', 'manager@messmate.com', 'admin', '01711000001', 'admin123');
  const members = [
    mk('Karim Hossain', 'karim@messmate.com', 'member', '01711000002', 'member123'),
    mk('Sumon Das', 'sumon@messmate.com', 'member', '01711000003', 'member123'),
    mk('Tanvir Ahmed', 'tanvir@messmate.com', 'member', '01711000004', 'member123')
  ];
  const all = [admin, ...members];
  // deterministic pseudo-random meals
  let seedVal = 7; const rnd = () => (seedVal = (seedVal * 9301 + 49297) % 233280) / 233280;
  for (let i = 1; i <= day; i++) {
    all.forEach((u) => db.insert('meals', { userId: u.id, date: d(i), breakfast: rnd() > 0.45 ? 1 : 0, lunch: rnd() > 0.15 ? 1 : 0, dinner: rnd() > 0.1 ? 1 : 0 }));
  }
  const items = [['Miniket rice 25kg', 'Rice & Grains', 1850], ['Rui fish 3kg', 'Fish & Meat', 960], ['Broiler chicken 4kg', 'Fish & Meat', 880],
    ['Mixed vegetables', 'Vegetables', 420], ['Soybean oil 5L', 'Spices & Oil', 910], ['Gas cylinder', 'Gas & Utilities', 1450], ['Lentils & spices', 'Spices & Oil', 560], ['Potato & onion', 'Vegetables', 380]];
  for (let i = 0; i < Math.min(items.length, Math.max(day, 3)); i++) {
    const it = items[i];
    db.insert('expenses', { title: it[0], category: it[1], amount: it[2], date: d(Math.min(day, i * 2 + 1)), note: '', addedBy: i % 2 ? members[0].id : admin.id, status: 'approved' });
  }
  db.insert('expenses', { title: 'Eggs (3 dozen)', category: 'Other', amount: 480, date: d(day), note: 'Needed for breakfast', addedBy: members[1].id, status: 'pending' });
  all.forEach((u) => db.insert('deposits', { userId: u.id, amount: 3000, date: d(1), note: 'Opening deposit' }));
  db.insert('notices', { title: 'Welcome to MessMate', body: 'Set your meals for tomorrow before 9 PM. Bazar duty list is on the notice board.', authorId: admin.id, createdAt: new Date().toISOString() });
  db.insert('notices', { title: 'Gas bill reminder', body: 'Please clear your share of the gas bill by the 10th of the month.', authorId: admin.id, createdAt: new Date().toISOString() });
}
module.exports = { seed };
