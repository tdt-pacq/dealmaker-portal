const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const dbFile = path.join(os.tmpdir(), `pacq-docs-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (_) { /* fresh file */ }
}
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';

const { getDb } = require('./database');
const documentsRouter = require('./routes/deal-documents');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function app() {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.user = { id: 'user-alisha', display_name: 'Alisha' };
    next();
  });
  server.use('/api/deals', documentsRouter);
  return server;
}

function insertDeal() {
  const id = `deal-${Math.random().toString(16).slice(2)}`;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name, interview_data)
    VALUES (?, 'Pinetop Coffeehouse', 'active', ?, ?, 'Alisha', '{}')
  `).run(id, now, now);
  return id;
}

async function withServer(fn) {
  const server = app();
  const httpServer = await new Promise((resolve) => {
    const listening = server.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const { port } = httpServer.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
  }
}

function makePdf(text) {
  const safe = String(text).replace(/[()\\]/g, '');
  const stream = `BT /F1 12 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const startxref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test('deal documents persist per section and survive a fresh read', async () => {
  const dealId = insertDeal();
  const pdf = await makePdf('Engagement agreement asking price 450000.');

  await withServer(async (base) => {
    const interview = new FormData();
    interview.append('kind', 'interview');
    interview.append('file', new Blob([Buffer.from('Owner interview notes about the roastery and eight employees.')], { type: 'text/plain' }), 'interview.txt');
    const interviewRes = await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: interview });
    assert.equal(interviewRes.status, 201);

    const pasted = new FormData();
    pasted.append('kind', 'interview');
    pasted.append('text', 'Pasted interview notes that replace the uploaded text file for this deal.');
    const pastedRes = await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: pasted });
    assert.equal(pastedRes.status, 201);

    const ea = new FormData();
    ea.append('kind', 'ea');
    ea.append('file', new Blob([pdf], { type: 'application/pdf' }), 'engagement.pdf');
    const eaRes = await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: ea });
    const eaJson = await eaRes.json();
    assert.equal(eaRes.status, 201, eaJson.error || '');

    const photos = new FormData();
    photos.append('kind', 'biz_photo');
    photos.append('files', new Blob([PNG], { type: 'image/png' }), 'front.png');
    photos.append('files', new Blob([PNG], { type: 'image/png' }), 'side.png');
    const photoRes = await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: photos });
    assert.equal(photoRes.status, 201);

    const headshot = new FormData();
    headshot.append('kind', 'advisor_photo');
    headshot.append('file', new Blob([PNG], { type: 'image/png' }), 'alisha.png');
    assert.equal((await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: headshot })).status, 201);

    const bad = new FormData();
    bad.append('kind', 'mpa');
    bad.append('file', new Blob([Buffer.from('not a pdf')], { type: 'text/plain' }), 'notes.txt');
    const badRes = await fetch(`${base}/api/deals/${dealId}/documents`, { method: 'POST', body: bad });
    assert.equal(badRes.status, 400);

    const listed = await (await fetch(`${base}/api/deals/${dealId}/documents`)).json();
    const kinds = listed.documents.map(doc => doc.kind);
    assert.deepEqual(kinds, ['interview', 'ea', 'biz_photo', 'biz_photo', 'advisor_photo']);
    const interviewRow = listed.documents.find(doc => doc.kind === 'interview');
    assert.equal(interviewRow.filename, 'Pasted interview notes');
    assert.ok(interviewRow.text_chars > 20);
    assert.equal(interviewRow.has_file, false);
    const eaRow = listed.documents.find(doc => doc.kind === 'ea');
    assert.equal(eaRow.filename, 'engagement.pdf');
    assert.ok(eaRow.text_chars > 10);
    assert.equal(JSON.stringify(listed).includes('file_blob'), false);

    const fileRes = await fetch(`${base}/api/deals/${dealId}/documents/${eaRow.id}/file`);
    assert.equal(fileRes.status, 200);
    assert.match(fileRes.headers.get('content-type'), /pdf/);
    const savedPdf = Buffer.from(await fileRes.arrayBuffer());
    assert.ok(savedPdf.slice(0, 4).toString() === '%PDF');

    const firstPhoto = listed.documents.find(doc => doc.kind === 'biz_photo');
    const removed = await fetch(`${base}/api/deals/${dealId}/documents/${firstPhoto.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
  });

  const after = getDb().prepare(
    `SELECT kind, filename FROM deal_documents WHERE deal_id = ? ORDER BY kind, sort_order`
  ).all(dealId);
  assert.equal(after.filter(row => row.kind === 'biz_photo').length, 1);
  assert.equal(after.find(row => row.kind === 'ea').filename, 'engagement.pdf');
  const text = getDb().prepare(
    `SELECT text_extract FROM deal_documents WHERE deal_id = ? AND kind = 'ea'`
  ).get(dealId).text_extract;
  assert.match(text, /450000/);
});
