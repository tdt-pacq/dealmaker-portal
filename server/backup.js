/**
 * backup.js — Daily SQLite backup with 7-day rotation and optional email delivery.
 *
 * Uses better-sqlite3's db.backup() for a consistent hot backup (safe on a live DB).
 * Stores files at BACKUP_DIR (default /data/backups), keeps the most recent 7.
 * If GMAIL_USER + GMAIL_APP_PASSWORD are set, emails the file to BACKUP_EMAIL.
 */

const path     = require('path');
const fs       = require('fs');
const nodemailer = require('nodemailer');
const { getDb } = require('./database');

const BACKUP_DIR = process.env.BACKUP_PATH
  || (process.env.OUTPUT_PATH ? path.join(path.dirname(process.env.OUTPUT_PATH), 'backups') : null)
  || path.join(__dirname, '..', 'backups');

const KEEP = 7; // rolling days to retain

function timestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('-');
}

function pruneOldBackups() {
  let files;
  try {
    files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('pacq_deals_') && f.endsWith('.db'))
      .sort(); // lexicographic = chronological (timestamp prefix)
  } catch {
    return;
  }
  const toDelete = files.slice(0, Math.max(0, files.length - KEEP));
  for (const f of toDelete) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
  }
  if (toDelete.length) {
    console.log(`[Backup] Pruned ${toDelete.length} old backup(s), keeping ${KEEP}`);
  }
}

async function emailBackup(filePath) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to   = process.env.BACKUP_EMAIL || process.env.GMAIL_USER;

  if (!user || !pass) {
    console.log('[Backup] Skipping email — GMAIL_USER / GMAIL_APP_PASSWORD not set');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const stat = fs.statSync(filePath);
  const sizeKb = Math.round(stat.size / 1024);
  const basename = path.basename(filePath);

  await transporter.sendMail({
    from:    `"Dealmaker Portal" <${user}>`,
    to,
    subject: `[PACQ Backup] ${basename}`,
    text:    `Automated daily backup of the Dealmaker Portal database.\n\nFile: ${basename}\nSize: ${sizeKb} KB\nTimestamp: ${new Date().toISOString()}`,
    attachments: [{ filename: basename, path: filePath }],
  });

  console.log(`[Backup] Emailed ${basename} (${sizeKb} KB) to ${to}`);
}

async function runBackup() {
  console.log('[Backup] Starting daily backup…');

  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (e) {
    console.error('[Backup] Could not create backup directory:', e.message);
    return;
  }

  const filename = `pacq_deals_${timestamp()}.db`;
  const dest     = path.join(BACKUP_DIR, filename);

  try {
    await getDb().backup(dest);
    console.log(`[Backup] Wrote ${dest}`);
  } catch (e) {
    console.error('[Backup] db.backup() failed:', e.message);
    return;
  }

  pruneOldBackups();

  try {
    await emailBackup(dest);
  } catch (e) {
    console.error('[Backup] Email failed (backup file still on disk):', e.message);
  }

  console.log('[Backup] Done');
}

module.exports = { runBackup };
