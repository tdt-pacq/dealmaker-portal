require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

// GET /api/proposals/t/:token is the only unauthenticated API: sellers/spouse/CPA
// open an unguessable share URL. All other /api routes stay behind Basic Auth.
const PUBLIC_PROPOSAL_SHARE_RE = /^\/(?:api\/)?proposals\/t\/[A-Za-z0-9_-]+\/?$/;

function isPublicProposalShare(req) {
  return req.method === 'GET' && PUBLIC_PROPOSAL_SHARE_RE.test(req.path || '');
}

function parseBasicCreds(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  const [username, ...rest] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
  const password = rest.join(':');
  if (!username || !password) return null;
  return { username, password };
}

function lookupUser(username, password) {
  const user = getDb()
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
}

// Per-user Basic Auth middleware.
// Decodes Authorization: Basic base64(username:password), looks up the user
// in the users table, verifies bcrypt hash, and sets req.user for downstream routes.
// Public proposal share GET never 401s: missing/invalid credentials still proceed
// as an anonymous viewer. Valid broker credentials attach req.user so the same
// endpoint can return the editable packet.
function basicAuth(req, res, next) {
  if (isPublicProposalShare(req)) {
    const creds = parseBasicCreds(req.headers['authorization']);
    if (creds) {
      const user = lookupUser(creds.username, creds.password);
      if (user) req.user = user;
    }
    return next();
  }

  const creds = parseBasicCreds(req.headers['authorization']);
  if (!creds) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = lookupUser(creds.username, creds.password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.user = user;
  next();
}

// Middleware that requires admin role (use after basicAuth).
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { basicAuth, requireAdmin, isPublicProposalShare };
