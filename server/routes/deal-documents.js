const express = require('express');
const multer = require('multer');
const { logEvent } = require('../database');
const { extractInterviewFromText } = require('./extract');
const {
  PDF_KINDS,
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
} = require('../dealDocuments');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
});

const KIND_LABELS = {
  interview: 'Interview Doc',
  ea: 'Engagement Agreement',
  mpa: 'QSI MPA Report',
  termsheet: 'Bank Term Sheet',
  discovery: 'Discovery Prep Report',
  biz_photo: 'Business Photo',
  advisor_photo: 'Advisor Headshot',
};

function filesFrom(req) {
  return (req.files || []).filter(file => file && file.buffer);
}

router.get('/:dealId/documents', (req, res) => {
  try {
    res.json({ documents: listDocuments(req.params.dealId) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/:dealId/documents/:docId/file', (req, res) => {
  try {
    const row = readDocumentFile(req.params.dealId, req.params.docId);
    const filename = String(row.filename || 'file').replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(row.file_blob);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.delete('/:dealId/documents/:docId', (req, res) => {
  try {
    const row = removeDocument(req.params.dealId, req.params.docId);
    logEvent(req.params.dealId, req.user, 'document_removed', `Removed ${KIND_LABELS[row.kind] || row.kind}`);
    res.json({ success: true, id: row.id });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:dealId/documents/interview/extract', async (req, res) => {
  try {
    const text = interviewText(req.params.dealId);
    const result = await extractInterviewFromText(text);
    res.json(result);
  } catch (err) {
    console.error('Stored interview extraction error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:dealId/documents', upload.any(), async (req, res) => {
  const kind = String(req.body.kind || '').trim();
  const dealId = req.params.dealId;
  try {
    if (!KIND_LABELS[kind]) return res.status(400).json({ error: 'Unknown document type' });

    if (kind === 'interview' && req.body.text && String(req.body.text).trim() && filesFrom(req).length === 0) {
      const text = String(req.body.text).trim().slice(0, 100000);
      if (text.length < 20) {
        return res.status(400).json({ error: 'Paste at least a few sentences of interview notes.' });
      }
      const id = replaceSingleDocument(dealId, 'interview', {
        filename: 'Pasted interview notes',
        mime: 'text/plain',
        buffer: null,
        text,
      });
      logEvent(dealId, req.user, 'document_uploaded', 'Saved pasted interview notes');
      return res.status(201).json({ documents: listDocuments(dealId), id });
    }

    const files = filesFrom(req);
    if (!files.length) return res.status(400).json({ error: 'Choose a file to upload.' });

    if (kind === 'biz_photo' || kind === 'advisor_photo') {
      const images = files.filter(isImage);
      if (!images.length) {
        return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP, or GIF image.' });
      }
      if (kind === 'advisor_photo') {
        const file = images[0];
        const id = replaceSingleDocument(dealId, 'advisor_photo', {
          filename: file.originalname,
          mime: file.mimetype,
          buffer: file.buffer,
          text: null,
        });
        logEvent(dealId, req.user, 'document_uploaded', `Uploaded Advisor Headshot: ${file.originalname}`);
        return res.status(201).json({ documents: listDocuments(dealId), id });
      }
      const saved = addBusinessPhotos(dealId, images.map(file => ({
        filename: file.originalname,
        mime: file.mimetype,
        buffer: file.buffer,
        text: null,
      })));
      logEvent(dealId, req.user, 'document_uploaded', `Uploaded ${saved.stored} business photo${saved.stored === 1 ? '' : 's'}`);
      return res.status(201).json({ documents: listDocuments(dealId), ...saved });
    }

    const file = files[0];
    if (PDF_KINDS.has(kind)) {
      if (!isPdf(file)) return res.status(400).json({ error: 'Only PDF files are accepted.' });
    } else if (kind === 'interview') {
      if (!isPdf(file) && !isDocx(file) && !isTxt(file)) {
        return res.status(400).json({ error: 'Interview notes must be a PDF, .docx, or .txt file.' });
      }
    }

    const text = await extractUploadText(file);
    if (!text.trim()) {
      return res.status(422).json({ error: 'No text found in that file.' });
    }
    const id = replaceSingleDocument(dealId, kind, {
      filename: file.originalname,
      mime: file.mimetype || (isPdf(file) ? 'application/pdf' : 'application/octet-stream'),
      buffer: file.buffer,
      text,
    });
    logEvent(dealId, req.user, 'document_uploaded', `Uploaded ${KIND_LABELS[kind]}: ${file.originalname}`);
    res.status(201).json({ documents: listDocuments(dealId), id });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20MB.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Upload up to 5 business photos at a time.' });
  }
  res.status(400).json({ error: err.message || 'Upload failed' });
});

module.exports = router;
