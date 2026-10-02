const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const dbFile = path.join(os.tmpdir(), `pacq-edit-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (_) { /* fresh file */ }
}
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key-not-used';

const { Messages } = require('@anthropic-ai/sdk/resources/messages');
Messages.prototype.create = async function create(body) {
  const current = String(body.messages[0].content);
  const start = current.indexOf('CURRENT DOCUMENT:\n') + 'CURRENT DOCUMENT:\n'.length;
  const end = current.indexOf('\n\nREQUESTED CHANGE:');
  const original = current.slice(start, end);
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: original.replace('Great team.', 'Great team. Growth Roadmap.').replace('$160,000', '$999,000') }],
  };
};

const { getDb } = require('./database');
const generateRouter = require('./routes/generate');
const { confirmMarketing } = require('./marketingLock');
const { guardEdit, listVersions } = require('./marketingEdit');

function app() {
  const server = express();
  server.use(express.json({ limit: '2mb' }));
  server.use((req, _res, next) => {
    req.user = { id: 'user-alisha', display_name: 'Alisha' };
    next();
  });
  server.use('/api/generate', generateRouter);
  return server;
}

async function post(server, urlPath, body) {
  const httpServer = await new Promise((resolve) => {
    const listening = server.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const { port } = httpServer.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
  }
}

test('an edit request keeps every other figure and the untouched sentences', async () => {
  const original = 'Cash Flow (SDE): $160,000\nAsking Price: $450,000\nRate: 10.5%\nGreat team.';
  const guarded = guardEdit(
    original,
    'Cash Flow (SDE): $999,000\nAsking Price: $450,000\nRate: 11%\nGreat team. Growth Roadmap.',
    'replace Upside with Growth Roadmap'
  );
  assert.equal(
    guarded,
    'Cash Flow (SDE): $160,000\nAsking Price: $450,000\nRate: 10.5%\nGreat team. Growth Roadmap.'
  );

  const id = 'deal-edit';
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name, interview_data, blind_ad_text)
    VALUES (?, 'Pinetop Coffee House', 'active', ?, ?, 'Alisha', ?, ?)
  `).run(id, now, now, JSON.stringify({
    asking_price: '450000',
    fin_year1_label: '2024',
    fin_year1_sde: '160000',
    business_type: 'Coffeehouse',
    year_founded: '1998',
    business_city_state: 'White Mountains, AZ',
    employees_count: '4 baristas',
    real_estate_situation: 'Leased',
    sba_preapproved: 'No',
  }), original);
  confirmMarketing(id, {
    sba_rate: 10.5,
    sde_basis: 'most_recent',
    summary: { asking_price: '450000', sba_preapproved: 'No' },
    sde_years: [{ year: '2024', sde: 160000 }],
  });

  const res = await post(app(), '/api/generate/revise', {
    deal_id: id,
    kind: 'blind_ad',
    request: 'replace Upside with Growth Roadmap',
  });
  assert.equal(res.status, 200, res.json.error || '');
  assert.equal(res.json.blind_ad_text, guarded);
  const saved = getDb().prepare('SELECT blind_ad_text FROM deals WHERE id = ?').get(id);
  assert.equal(saved.blind_ad_text, guarded);

  const versions = listVersions(id, 'blind_ad');
  assert.ok(versions.length >= 2);
  assert.ok(versions.length <= 10);
  assert.equal(versions[0].source, 'edit');
});
