require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

// Per-user Basic Auth middleware.
// Decodes Authorization: Basic base64(username:password), looks up the user
// in the users table, verifies bcrypt hash, and sets req.user for downstream routes.
function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const [username, ...rest] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
  const password = rest.join(':'); // passwords may contain colons

  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = getDb()
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.user = { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
  next();
}

// Middleware that requires admin role (use after basicAuth).
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { basicAuth, requireAdmin };
