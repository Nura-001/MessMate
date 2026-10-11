// MessMate - zero-dependency Node.js server (REST API + static front-end).
const http = require('http');
const path = require('path');
const db = require('./lib/db');
const { verify } = require('./lib/auth');
const { HttpError, parseCookies, readBody, sendJson, serveStatic } = require('./lib/http');
const { seed } = require('./lib/seed');
const { router } = require('./lib/routes');

if (db.init() && process.env.NO_SEED !== '1') { seed(); console.log('Database created with demo data.'); }

const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, PUBLIC);
  try {
    const found = router.match(req.method, url.pathname);
    if (!found) throw new HttpError(404, 'API route not found');
    const session = verify(parseCookies(req).mm_token, db.secret());
    const user = session ? db.get('users', session.uid) : null;
    const ctx = {
      user: user && user.active ? user : null,
      params: found.params,
      query: Object.fromEntries(url.searchParams),
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {}
    };
    const out = found.handler(ctx);
    if (out && out.raw !== undefined) {
      res.writeHead(200, { 'Content-Type': out.type, ...out.headers });
      return res.end(out.raw);
    }
    if (out && out.body !== undefined) return sendJson(res, out.status || 200, out.body, out.headers);
    sendJson(res, 200, out);
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    sendJson(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
  }
});

server.listen(PORT, () => console.log(`MessMate running on http://localhost:${PORT}`));
