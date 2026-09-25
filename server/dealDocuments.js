const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { getDb } = require('./database');

const STORED_TEXT_LIMIT = 100000;
const PROMPT_TEXT_LIMIT = 40000;

const SINGLE_KINDS = new Set(['interview', 'ea', 'mpa', 'termsheet', 'discovery', 'advisor_photo']);
const PDF_KINDS = new Set(['ea', 'mpa', 'termsheet', 'discovery']);
const PHOTO_KINDS = new Set(['biz_photo', 'advisor_photo']);
const BIZ_PHOTO_LIMIT = 5;

const DOC_SPECS = [
  ['interview', 'DOCUMENT 1 - INTERVIEW DOC'],
  ['ea', 'DOCUMENT 2 - ENGAGEMENT AGREEMENT'],
  ['mpa', 'DOCUMENT 3 - QSI MPA REPORT'],
  ['termsheet', 'DOCUMENT 4 - BANK TERM SHEET (optional — use for the SBA section: bank name, rate, loan terms, and payment)'],
  ['discovery', 'DOCUMENT 5 - DISCOVERY PREP REPORT (optional — use for seller intel, industry context, buyer profile, and marketing angle)'],
];

const SOURCE_RULES = `SOURCE DOCUMENT RULES:
- Use ONLY numbers present in the interview form or these documents. Never invent figures.
- The Engagement Agreement is authoritative for listing price, asking price, and deal terms, including reason for selling, building square footage, rent, year founded, hours, and employees.
- The QSI MPA is authoritative for financial performance, SDE, DSCR, and valuation.
- Where the Engagement Agreement and the MPA conflict on price, the Engagement Agreement governs.
- A confirmed asking price already saved on the interview form overrides every other price figure.
- The most recent year is the highest calendar year in the MPA. Use that year's SDE for flyer price boxes and the blind ad. In the CBR financial table, show both the weighted-average SDE and the most recent year SDE when both are present.
- The Bank Term Sheet supplies the SBA bank name, interest rate, loan terms, and payment. Do not invent them.
- The Discovery Prep Report may enrich the business description, seller differentiators, ideal buyer, and industry narrative. Do not use it for financial figures.`;

async function extractPdfBuffer(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, disableWorker: true, verbosity: 0 }).promise;
  try {
    let out = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map(item => item.str).join(' ') + '\n\n';
    }
    return out;
  } finally {
    if (typeof doc.destroy === 'function') await doc.destroy();
  }
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isPdf(file) {
  const name = (file.originalname || '').toLowerCase();
  return file.mimetype === 'application/pdf' || name.endsWith('.pdf');
}

function isDocx(file) {
  const name = (file.originalname || '').toLowerCase();
  return file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx');
}

function isTxt(file) {
  const name = (file.originalname || '').toLowerCase();
  return file.mimetype === 'text/plain' || name.endsWith('.txt');
}

function isImage(file) {
  const mime = file.mimetype || '';
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || mime === 'image/gif';
}

async function extractUploadText(file) {
  let text = '';
  if (isDocx(file)) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value || '';
    } catch (err) {
      throw httpError(422, `Could not read .docx file: ${err.message}`);
    }
  } else if (isTxt(file)) {
    text = file.buffer.toString('utf8');
  } else if (isPdf(file)) {
    try {
      text = await extractPdfBuffer(file.buffer);
    } catch (err) {
      throw httpError(422, `Could not read PDF: ${err.message}`);
    }
    if (!text.trim()) {
      throw httpError(422, 'No text found — this PDF may be image-based or encrypted.');
    }
  } else {
    throw httpError(400, 'Only .docx, .txt, and .pdf files are supported.');
  }
  return text.slice(0, STORED_TEXT_LIMIT);
}

function assertDeal(dealId) {
  const deal = getDb().prepare('SELECT id FROM deals WHERE id = ?').get(dealId);
  if (!deal) throw httpError(404, 'Deal not found');
}

function insertRow(dealId, kind, { filename, mime, buffer, text, sortOrder }) {
  const now = new Date().toISOString();
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO deal_documents (
      id, deal_id, kind, filename, mime, size_bytes, text_extract, file_blob, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dealId,
    kind,
    filename || null,
    mime || null,
    buffer ? buffer.length : (text ? Buffer.byteLength(text) : 0),
    text || null,
    buffer || null,
    sortOrder || 0,
    now,
    now
  );
  return id;
}

function replaceSingleDocument(dealId, kind, record) {
  assertDeal(dealId);
  if (!SINGLE_KINDS.has(kind)) throw httpError(400, 'Unsupported document type');
  const db = getDb();
  const write = db.transaction(() => {
    db.prepare('DELETE FROM deal_documents WHERE deal_id = ? AND kind = ?').run(dealId, kind);
    return insertRow(dealId, kind, { ...record, sortOrder: 0 });
  });
  return write();
}

function addBusinessPhotos(dealId, records) {
  assertDeal(dealId);
  const db = getDb();
  const write = db.transaction(() => {
    const current = db.prepare(
      `SELECT COUNT(*) AS n FROM deal_documents WHERE deal_id = ? AND kind = 'biz_photo'`
    ).get(dealId).n;
    const room = BIZ_PHOTO_LIMIT - current;
    if (room <= 0) throw httpError(400, 'Business photos are limited to 5.');
    const accepted = records.slice(0, room);
    let order = db.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM deal_documents WHERE deal_id = ? AND kind = 'biz_photo'`
    ).get(dealId).m;
    const ids = [];
    for (const record of accepted) {
      order += 1;
      ids.push(insertRow(dealId, 'biz_photo', { ...record, sortOrder: order }));
    }
    return { ids, stored: ids.length, skipped: records.length - ids.length };
  });
  return write();
}

function listDocuments(dealId) {
  assertDeal(dealId);
  return getDb().prepare(`
    SELECT id, kind, filename, mime, size_bytes,
           CASE WHEN text_extract IS NULL OR text_extract = '' THEN 0 ELSE length(text_extract) END AS text_chars,
           CASE WHEN file_blob IS NULL THEN 0 ELSE 1 END AS has_file,
           sort_order, created_at, updated_at
    FROM deal_documents
    WHERE deal_id = ?
    ORDER BY
      CASE kind
        WHEN 'interview' THEN 1
        WHEN 'ea' THEN 2
        WHEN 'mpa' THEN 3
        WHEN 'termsheet' THEN 4
        WHEN 'discovery' THEN 5
        WHEN 'biz_photo' THEN 6
        WHEN 'advisor_photo' THEN 7
        ELSE 8
      END,
      sort_order ASC,
      created_at ASC
  `).all(dealId).map(row => ({
    ...row,
    has_file: !!row.has_file,
  }));
}

function readDocumentFile(dealId, docId) {
  assertDeal(dealId);
  const row = getDb().prepare(`
    SELECT id, filename, mime, file_blob FROM deal_documents
    WHERE deal_id = ? AND id = ?
  `).get(dealId, docId);
  if (!row || !row.file_blob) throw httpError(404, 'File not found');
  return row;
}

function removeDocument(dealId, docId) {
  assertDeal(dealId);
  const row = getDb().prepare(
    'SELECT id, kind, filename FROM deal_documents WHERE deal_id = ? AND id = ?'
  ).get(dealId, docId);
  if (!row) throw httpError(404, 'Document not found');
  getDb().prepare('DELETE FROM deal_documents WHERE id = ? AND deal_id = ?').run(docId, dealId);
  return row;
}

function interviewText(dealId) {
  assertDeal(dealId);
  const row = getDb().prepare(
    `SELECT text_extract FROM deal_documents WHERE deal_id = ? AND kind = 'interview'`
  ).get(dealId);
  return row?.text_extract || '';
}

function sourceBlockForDeal(dealId) {
  const rows = getDb().prepare(`
    SELECT kind, text_extract FROM deal_documents
    WHERE deal_id = ? AND kind IN ('interview', 'ea', 'mpa', 'termsheet', 'discovery')
  `).all(dealId);
  const byKind = {};
  for (const row of rows) {
    const text = (row.text_extract || '').slice(0, PROMPT_TEXT_LIMIT).trim();
    if (text) byKind[row.kind] = text;
  }
  const parts = DOC_SPECS
    .filter(([kind]) => byKind[kind])
    .map(([kind, label]) => `${label}:\n${byKind[kind]}`);
  if (!parts.length) return '';
  return `${SOURCE_RULES}\n\n${parts.join('\n\n')}`;
}

function dataUrl(row) {
  if (!row?.file_blob) return null;
  const buf = Buffer.isBuffer(row.file_blob) ? row.file_blob : Buffer.from(row.file_blob);
  const mime = row.mime || 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function buildGallery(urls) {
  const cells = urls.slice(0, 4).map(src =>
    `<div style="flex:1;min-width:0;overflow:hidden"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
  );
  const top = cells.slice(0, 2).join('');
  const bottom = cells.slice(2, 4).join('');
  return `<div data-pacq="photo-gallery" style="width:816px;min-height:1056px;background:#1A1A1A;display:flex;flex-direction:column;page-break-after:always;overflow:hidden">
    <div style="height:5px;background:#C1622F;flex-shrink:0"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;padding:4px">
      <div style="flex:1;display:flex;gap:4px;min-height:480px">${top}</div>
      ${bottom ? `<div style="flex:1;display:flex;gap:4px;min-height:480px">${bottom}</div>` : ''}
    </div>
    <div style="padding:10px 24px;background:#111;display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.45);letter-spacing:1px;text-transform:uppercase">
      <span>Peterson Acquisitions · Confidential</span><span>Property Photo Gallery</span>
    </div>
  </div>`;
}

function loadPhotoAssets(dealId) {
  const rows = getDb().prepare(`
    SELECT kind, mime, file_blob, sort_order FROM deal_documents
    WHERE deal_id = ? AND kind IN ('biz_photo', 'advisor_photo')
    ORDER BY sort_order ASC, created_at ASC
  `).all(dealId);
  const biz = rows.filter(row => row.kind === 'biz_photo').map(dataUrl).filter(Boolean);
  const advisorRow = rows.find(row => row.kind === 'advisor_photo');
  return {
    cover: biz[0] || null,
    sidebar: biz[1] || biz[0] || null,
    advisor: advisorRow ? dataUrl(advisorRow) : null,
    galleryHtml: biz.length >= 3 ? buildGallery(biz) : '',
    hasCover: biz.length > 0,
    hasSidebar: biz.length > 0,
    hasAdvisor: !!(advisorRow && advisorRow.file_blob),
    hasGallery: biz.length >= 3,
  };
}

function fallbackImage(attr, src, style) {
  return `<img data-pacq="${attr}" src="${src}" alt="" style="${style}"/>`;
}

function stampMarketingHtml(html, photos) {
  if (!html) return html;
  const assets = photos || {};
  let out = html;
  const replacements = [
    ['{{PACQ_BIZ_COVER}}', assets.cover || ''],
    ['{{PACQ_ADVISOR_PHOTO}}', assets.advisor || ''],
    ['{{PACQ_CIM_SIDEBAR}}', assets.sidebar || ''],
    ['{{PACQ_GALLERY}}', assets.galleryHtml || ''],
  ];
  for (const [token, value] of replacements) {
    if (out.includes(token)) out = out.split(token).join(value);
  }
  out = out.replace(/<img\b[^>]*data-pacq="[^"]*"[^>]*\ssrc=""[^>]*>/gi, '');
  out = out.replace(/<img\b[^>]*\ssrc=""[^>]*data-pacq="[^"]*"[^>]*>/gi, '');

  if (assets.cover && assets.stampCover !== false && !out.includes('data-pacq="biz-cover"')) {
    const img = fallbackImage('biz-cover', assets.cover, 'width:100%;height:280px;object-fit:cover;display:block');
    out = out.replace(/<body([^>]*)>/i, `<body$1>${img}`);
  }
  if (assets.sidebar && assets.stampSidebar && !out.includes('data-pacq="biz-sidebar"')) {
    const img = fallbackImage('biz-sidebar', assets.sidebar, 'width:100%;max-height:220px;object-fit:cover;display:block;border-radius:4px;margin:0 0 16px');
    out = out.replace(/<\/body>/i, `${img}</body>`);
  }
  if (assets.advisor && assets.stampAdvisor && !out.includes('data-pacq="advisor-photo"')) {
    const img = fallbackImage('advisor-photo', assets.advisor, 'width:72px;height:72px;border-radius:50%;object-fit:cover;border:2.5px solid #C1622F;display:block');
    out = out.replace(/<\/body>/i, `${img}</body>`);
  }
  if (assets.galleryHtml && assets.stampGallery && !out.includes('data-pacq="photo-gallery"')) {
    out = out.replace(/<\/body>/i, `${assets.galleryHtml}</body>`);
  }
  return out;
}

module.exports = {
  STORED_TEXT_LIMIT,
  PROMPT_TEXT_LIMIT,
  PDF_KINDS,
  PHOTO_KINDS,
  BIZ_PHOTO_LIMIT,
  isPdf,
  isDocx,
  isTxt,
  isImage,
  extractUploadText,
  replaceSingleDocument,
  addBusinessPhotos,
  listDocuments,
  readDocumentFile,
  removeDocument,
  interviewText,
  sourceBlockForDeal,
  loadPhotoAssets,
  stampMarketingHtml,
};
