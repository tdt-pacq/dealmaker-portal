const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/deals
router.get('/', (req, res) => {
  const { status, advisor } = req.query;
  let query = 'SELECT id, deal_name, status, created_at, updated_at, advisor_name FROM deals';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (advisor) { conditions.push('advisor_name = ?'); params.push(advisor); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY updated_at DESC';
  const deals = getDb().prepare(query).all(...params);
  res.json(deals);
});

// POST /api/deals
router.post('/', (req, res) => {
  const { deal_name, advisor_name, status = 'draft', listing_platform_notes } = req.body;
  if (!deal_name) return res.status(400).json({ error: 'deal_name required' });
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name,
      interview_data, listing_platform_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, deal_name, status, now, now, advisor_name || '', '{}', listing_platform_notes || '');
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(id);
  res.status(201).json(deal);
});

// GET /api/deals/:id
router.get('/:id', (req, res) => {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json(deal);
});

// PATCH /api/deals/:id
router.patch('/:id', (req, res) => {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const allowed = ['deal_name', 'status', 'advisor_name', 'interview_data',
    'blind_ad_text', 'flyer_html', 'cbr_html', 'listing_platform_notes'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      params.push(typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  getDb().prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/deals/:id
router.delete('/:id', (req, res) => {
  const deal = getDb().prepare('SELECT id FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  getDb().prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  // Clean up output files
  const outputDir = path.join(__dirname, '..', '..', 'output', req.params.id);
  if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true });
  res.json({ success: true });
});

// GET /api/deals/:id/download/:type  (flyer | cbr)
router.get('/:id/download/:type', (req, res) => {
  const { id, type } = req.params;
  if (!['flyer', 'cbr'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const filePath = path.join(__dirname, '..', '..', 'output', id, `${type}.pdf`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF not yet generated' });
  const deal = getDb().prepare('SELECT deal_name FROM deals WHERE id = ?').get(id);
  const filename = `${(deal?.deal_name || id).replace(/[^a-z0-9]/gi, '_')}_${type}.pdf`;
  res.download(filePath, filename);
});

module.exports = router;
