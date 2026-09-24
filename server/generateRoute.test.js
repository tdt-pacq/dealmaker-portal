const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const dbFile = path.join(os.tmpdir(), `pacq-generate-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (_) { /* fresh file */ }
}
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key-not-used';

const { Messages } = require('@anthropic-ai/sdk/resources/messages');
const calls = [];
Messages.prototype.create = async function create(body) {
  calls.push(body);
  if (String(body.system).includes('cut-off-test')) {
    return { stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '', signature: 'sig' }] };
  }
  const text = body.max_tokens === 4000
    ? 'Profitable coffee roaster in the White Mountains'
    : body.max_tokens === 12000
      ? '<!DOCTYPE html><html><body><h1>One-page flyer</h1></body></html>'
      : '<!DOCTYPE html><html><body><h1>Confidential Business Review</h1></body></html>';
  return {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text },
    ],
  };
};

const { getDb } = require('./database');
const generateRouter = require('./routes/generate');
const { replaceSingleDocument, addBusinessPhotos } = require('./dealDocuments');

function app() {
  const server = express();
  server.use(express.json());
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
    const json = await res.json();
    return { status: res.status, json };
  } finally {
    await new Promise((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
  }
}

function insertDeal(interview) {
  const id = `deal-${Math.random().toString(16).slice(2)}`;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name, interview_data)
    VALUES (?, ?, 'active', ?, ?, 'Alisha', ?)
  `).run(id, 'Pinetop Coffeehouse & Roastery', now, now, JSON.stringify(interview));
  return id;
}

test('generate routes keep the text block and refuse a thinking-only reply', { concurrency: 1 }, async (t) => {
  await t.test('saves blind ad, flyer, and CBR from the text block', async () => {
  const server = app();
  const id = insertDeal({
    business_description: 'Drive-through coffeehouse and roastery',
    business_city_state: 'Pinetop, AZ',
    asking_price: '450000',
  });

  const blind = await post(server, '/api/generate/blind-ad', { deal_id: id });
  assert.equal(blind.status, 200);
  assert.equal(blind.json.blind_ad_text, 'Profitable coffee roaster in the White Mountains');
  assert.equal(calls.at(-1).thinking.type, 'disabled');
  assert.equal(calls.at(-1).model, 'claude-sonnet-5');

  const flyer = await post(server, '/api/generate/flyer', { deal_id: id });
  assert.equal(flyer.status, 200);
  assert.match(flyer.json.flyer_html, /One-page flyer/);

  const cbr = await post(server, '/api/generate/cbr', { deal_id: id });
  assert.equal(cbr.status, 200);
  assert.match(cbr.json.cbr_html, /Confidential Business Review/);

  const saved = getDb().prepare('SELECT blind_ad_text, flyer_html, cbr_html FROM deals WHERE id = ?').get(id);
  assert.equal(saved.blind_ad_text, blind.json.blind_ad_text);
  assert.match(saved.flyer_html, /One-page flyer/);
  assert.match(saved.cbr_html, /Confidential Business Review/);
  });

  await t.test('saved source documents and photos are fed into each output', async () => {
    const server = app();
    const id = insertDeal({ asking_price: '450000', business_description: 'Coffeehouse' });
    replaceSingleDocument(id, 'ea', {
      filename: 'ea.pdf',
      mime: 'application/pdf',
      buffer: Buffer.from('ea-bytes'),
      text: 'Engagement agreement asking price is 450000 and rent is 3200.',
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    addBusinessPhotos(id, [{ filename: 'shop.png', mime: 'image/png', buffer: png, text: null }]);
    replaceSingleDocument(id, 'advisor_photo', {
      filename: 'advisor.png',
      mime: 'image/png',
      buffer: png,
      text: null,
    });

    const blind = await post(server, '/api/generate/blind-ad', { deal_id: id });
    assert.equal(blind.status, 200);
    const blindPrompt = calls.at(-1).messages[0].content;
    assert.match(blindPrompt, /Engagement Agreement is authoritative/);
    assert.match(blindPrompt, /rent is 3200/);

    const flyer = await post(server, '/api/generate/flyer', { deal_id: id });
    assert.equal(flyer.status, 200);
    assert.match(flyer.json.flyer_html, /data-pacq="biz-cover"/);
    assert.match(flyer.json.flyer_html, /data-pacq="advisor-photo"/);
    assert.match(flyer.json.flyer_html, /data:image\/png;base64,/);
    assert.match(calls.at(-1).messages[0].content, /\{\{PACQ_BIZ_COVER\}\}/);
    assert.doesNotMatch(flyer.json.flyer_html, /data-pacq="biz-sidebar"/);

    const cbr = await post(server, '/api/generate/cbr', { deal_id: id });
    assert.equal(cbr.status, 200);
    assert.match(cbr.json.cbr_html, /data-pacq="biz-cover"/);
    assert.match(cbr.json.cbr_html, /data-pacq="biz-sidebar"/);
    assert.doesNotMatch(cbr.json.cbr_html, /data-pacq="advisor-photo"/);
  });

  await t.test('a thinking-only reply does not wipe a saved document', async () => {
  const server = app();
  const id = insertDeal({ business_description: 'Already saved' });
  getDb().prepare('UPDATE deals SET blind_ad_text = ? WHERE id = ?').run('Keep this ad', id);

  const original = Messages.prototype.create;
  Messages.prototype.create = async function create() {
    return { stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '', signature: 'sig' }] };
  };
  try {
    const res = await post(server, '/api/generate/blind-ad', { deal_id: id });
    assert.equal(res.status, 502);
    assert.match(res.json.error, /cut off before any document text/);
    const saved = getDb().prepare('SELECT blind_ad_text FROM deals WHERE id = ?').get(id);
    assert.equal(saved.blind_ad_text, 'Keep this ad');
  } finally {
    Messages.prototype.create = original;
  }
  });
});
