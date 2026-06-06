import React, { useState, useRef, useCallback } from 'react';
import { authHeaders } from '../../api';

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS      = 10 * 60 * 1000; // 10 min hard cap

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── RedactApp ────────────────────────────────────────────────────────────────
export default function RedactApp() {
  const [dragOver,   setDragOver]   = useState(false);
  const [file,       setFile]       = useState(null);   // File object
  const [state,      setState]      = useState('idle'); // idle | uploading | processing | complete | error
  const [progress,   setProgress]   = useState({ current: 0, total: 0, message: '' });
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [filename,   setFilename]   = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [jobId,      setJobId]      = useState(null);

  const fileInputRef = useRef(null);
  const pollRef      = useRef(null);

  // ── File selection ───────────────────────────────────────────────────────
  const acceptFile = useCallback((f) => {
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please select a PDF file.');
      return;
    }
    setFile(f);
    setErrorMsg('');
    setDownloadUrl(null);
    setState('idle');
    setProgress({ current: 0, total: 0, message: '' });
  }, []);

  const onFileInput = (e) => { if (e.target.files[0]) acceptFile(e.target.files[0]); };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  // ── Polling ───────────────────────────────────────────────────────────────
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPolling(jid, deadline) {
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        stopPolling();
        setState('error');
        setErrorMsg('Redaction timed out after 10 minutes. Please try again.');
        return;
      }
      try {
        const res  = await fetch(`/api/redact/jobs/${jid}`, { headers: authHeaders() });
        if (res.status === 429) return; // back off silently
        if (!res.ok) throw new Error(`Poll error ${res.status}`);
        const data = await res.json();

        if (data.status === 'processing') {
          setProgress(data.progress || {});
        } else if (data.status === 'complete') {
          stopPolling();
          setFilename(data.filename || 'redacted.pdf');
          setDownloadUrl(`/api/redact/download/${jid}`);
          setState('complete');
        } else if (data.status === 'error') {
          stopPolling();
          setState('error');
          setErrorMsg(data.error || 'Redaction failed. Please try again.');
        }
      } catch (e) {
        // swallow transient poll errors, keep polling
        console.warn('[Redact] poll error', e.message);
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Start redaction ───────────────────────────────────────────────────────
  async function handleRedact() {
    if (!file) return;
    stopPolling();
    setErrorMsg('');
    setDownloadUrl(null);
    setState('uploading');
    setProgress({ current: 0, total: 0, message: 'Uploading…' });

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/redact', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const { jobId: jid } = await res.json();
      setJobId(jid);
      setState('processing');
      setProgress({ current: 0, total: 0, message: 'Starting…' });
      startPolling(jid, Date.now() + MAX_POLL_MS);
    } catch (e) {
      setState('error');
      setErrorMsg(e.message);
    }
  }

  // ── Download handler ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!downloadUrl) return;
    try {
      const res = await fetch(downloadUrl, { headers: authHeaders() });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    stopPolling();
    setFile(null);
    setDownloadUrl(null);
    setState('idle');
    setErrorMsg('');
    setProgress({ current: 0, total: 0, message: '' });
    setJobId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Computed ──────────────────────────────────────────────────────────────
  const busy       = state === 'uploading' || state === 'processing';
  const pct        = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;
  const canRedact  = !!file && !busy;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 22, color: '#e2e8f0', margin: 0, letterSpacing: 0.3 }}>
          🔏 Tax Return Redactor
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, marginBottom: 0, fontFamily: 'system-ui, sans-serif' }}>
          Automatically remove SSNs, preparer info, and other personal data before adding returns to a buyer data room.
        </p>
      </div>

      {/* ── Drop Zone ── */}
      <div
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? '#2eb860' : file ? '#1e3a5f' : '#1a2235'}`,
          borderRadius: 8,
          padding: '32px 24px',
          textAlign: 'center',
          cursor: busy ? 'default' : 'pointer',
          background: dragOver ? 'rgba(46,184,96,0.05)' : '#0d1117',
          transition: 'border-color 0.18s, background 0.18s',
          marginBottom: 20,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onFileInput}
          style={{ display: 'none' }}
          disabled={busy}
        />

        {file ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>{file.name}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, fontFamily: 'system-ui, sans-serif' }}>{fmtBytes(file.size)}</div>
            {!busy && (
              <div style={{ color: '#2d3f57', fontSize: 12, marginTop: 8, fontFamily: 'system-ui, sans-serif' }}>
                Click to change file
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
            <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, fontFamily: 'system-ui, sans-serif' }}>
              Drop a tax return PDF here, or click to browse
            </div>
            <div style={{ color: '#2d3f57', fontSize: 12, marginTop: 6, fontFamily: 'system-ui, sans-serif' }}>
              Supports: 1120-S · 1065 · 1120 · Schedule C · 3-year packages
            </div>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={handleRedact}
          disabled={!canRedact}
          style={{
            background:    canRedact ? '#2eb860' : '#1a2235',
            color:         canRedact ? '#fff'    : '#334155',
            border:        'none',
            borderRadius:  6,
            padding:       '10px 22px',
            fontSize:      14,
            fontWeight:    600,
            cursor:        canRedact ? 'pointer' : 'default',
            fontFamily:    'system-ui, sans-serif',
            transition:    'background 0.15s',
          }}
        >
          {busy ? 'Redacting…' : 'Redact & Download →'}
        </button>

        {(file || state !== 'idle') && (
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid #1a2235',
              borderRadius: 6,
              padding: '10px 16px',
              fontSize: 13,
              color: '#64748b',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Progress ── */}
      {busy && (
        <div style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
              {progress.message || 'Processing…'}
            </span>
            {pct !== null && (
              <span style={{ color: '#2eb860', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
                {pct}%
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: '#1a2235', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width:  pct !== null ? `${pct}%` : '100%',
              background: '#2eb860',
              borderRadius: 2,
              transition: 'width 0.4s ease',
              animation: pct === null ? 'redact-pulse 1.5s ease-in-out infinite' : 'none',
            }} />
          </div>
          {progress.total > 0 && (
            <div style={{ color: '#334155', fontSize: 11, marginTop: 6, fontFamily: 'system-ui, sans-serif' }}>
              Page {progress.current} of {progress.total}
            </div>
          )}
        </div>
      )}

      {/* ── Complete ── */}
      {state === 'complete' && downloadUrl && (
        <div style={{ background: 'rgba(46,184,96,0.07)', border: '1px solid rgba(46,184,96,0.25)', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ color: '#2eb860', fontWeight: 700, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
                ✓ Redaction complete
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 3, fontFamily: 'system-ui, sans-serif' }}>
                {filename}
              </div>
            </div>
            <button
              onClick={handleDownload}
              style={{
                background: '#2eb860',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              ⬇ Download Redacted PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {state === 'error' && errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
            {errorMsg}
          </div>
        </div>
      )}

      {/* ── What gets redacted info card ── */}
      <div style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '16px 18px' }}>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'system-ui, sans-serif' }}>
          What gets redacted
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
          {[
            { label: 'Social Security Numbers (every page)', redacted: true },
            { label: 'Spouse SSN / ITIN',                   redacted: true },
            { label: "Paid Preparer's name & firm",          redacted: true },
            { label: "Paid Preparer's PTIN",                 redacted: true },
            { label: "Preparer firm address & phone",        redacted: true },
            { label: "Personal home address (Sch. C)",       redacted: true },
            { label: 'Business name',                        redacted: false },
            { label: 'Business EIN',                         redacted: false },
            { label: 'Business address',                     redacted: false },
            { label: 'All financial figures',                redacted: false },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                fontSize: 11,
                color: item.redacted ? '#ef4444' : '#2eb860',
                flexShrink: 0,
                lineHeight: 1,
              }}>
                {item.redacted ? '✕' : '✓'}
              </span>
              <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pulse animation for indeterminate progress */}
      <style>{`
        @keyframes redact-pulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
