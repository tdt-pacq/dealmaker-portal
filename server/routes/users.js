/**
 * users.js — Advisor account management
 *
 * GET    /api/users            → admin: list all users
 * POST   /api/users            → admin: create user
 * PATCH  /api/users/:id        → admin: update display_name, role, active
 * PATCH  /api/users/:id/password → self or admin: change password
 * DELETE /api/users/:id        → admin: permanently remove user
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { requireAdmin } = require('../auth');

const router = express.Router();

// All /api/users routes already pass through basicAuth in index.js.
// Admin-only endpoints also go through requireAdmin.

// GET /api/users/me — current user info (any authenticated user)
// MUST be before /:id route to avoid "me" being treated as an id
router.get('/me', (req, res) => {
  const user = getDb()
    .prepare('SELECT id, username, display_name, role, active FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(user);
});

// GET /api/users — list all users (admin only)
router.get('/', requireAdmin, (req, res) => {
  const users = getDb()
    .prepare('SELECT id, username, display_name, role, active, created_at FROM users ORDER BY created_at ASC')
    .all();
  res.json(users);
});

// POST /api/users — create a new advisor (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { username, display_name, password, role = 'advisor' } = req.body;
  if (!username || !display_name || !password) {
    return res.status(400).json({ error: 'username, display_name, and password are required' });
  }
  if (!['admin', 'advisor'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or advisor' });
  }

  const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO users (id, username, display_name, password_hash, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, username.toLowerCase(), display_name, hash, role, now);

  const user = getDb().prepare('SELECT id, username, display_name, role, active, created_at FROM users WHERE id = ?').get(id);
  res.status(201).json(user);
});

// PATCH /api/users/:id — update display_name, role, or active (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const allowed = ['display_name', 'role', 'active'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (key in req.body) {
      if (key === 'role' && !['admin', 'advisor'].includes(req.body[key])) {
        return res.status(400).json({ error: 'role must be admin or advisor' });
      }
      updates.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  getDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = getDb().prepare('SELECT id, username, display_name, role, active, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/users/:id/password — change password (self or admin)
router.patch('/:id/password', (req, res) => {
  const isSelf = req.user.id === req.params.id;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'You can only change your own password' });
  }

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(password, 10);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

// DELETE /api/users/:id — remove user (admin only; can't delete yourself)
router.delete('/:id', requireAdmin, (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
