// Tiny JSON-file database: collections are arrays, every write is flushed
// atomically (write temp file -> rename) so the file never gets corrupted.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
let data = null;

function load() {
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = null; }
  return data !== null;
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function init() {
  if (load()) return false; // existing database
  data = {
    meta: {
      secret: crypto.randomBytes(32).toString('hex'),
      counters: {},
      settings: { messName: 'Green Nest Mess', breakfastWeight: 0.5 }
    },
    users: [], meals: [], deposits: [], expenses: [], notices: []
  };
  save();
  return true; // freshly created -> caller may seed
}

const all = (c) => data[c];
const get = (c, id) => data[c].find((r) => r.id === Number(id));
const where = (c, fn) => data[c].filter(fn);

function insert(c, row) {
  const n = (data.meta.counters[c] || 0) + 1;
  data.meta.counters[c] = n;
  const rec = { id: n, ...row };
  data[c].push(rec);
  save();
  return rec;
}
function update(c, id, patch) {
  const rec = get(c, id);
  if (!rec) return null;
  Object.assign(rec, patch);
  save();
  return rec;
}
function remove(c, id) {
  const i = data[c].findIndex((r) => r.id === Number(id));
  if (i < 0) return false;
  data[c].splice(i, 1);
  save();
  return true;
}
const settings = () => data.meta.settings;
const secret = () => data.meta.secret;

module.exports = { init, save, all, get, where, insert, update, remove, settings, secret };
