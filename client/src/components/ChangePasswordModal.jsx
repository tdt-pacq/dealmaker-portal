import React, { useState } from 'react';
import { changePassword, fetchCurrentUser, setAuth, getAuth } from '../api';

function authUsername() {
  try {
    const raw = atob(getAuth() || '');
    const i = raw.indexOf(':');
    return i >= 0 ? raw.slice(0, i) : '';
  } catch {
    return '';
  }
}

export default function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    const username = authUsername();
    if (username && password.toLowerCase() === username.toLowerCase()) {
      setError('Password cannot be the same as your username');
      return;
    }

    setSaving(true);
    try {
      const me = await fetchCurrentUser();
      await changePassword(me.data.id, password);
      setAuth(username, password);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
        <div className="modal-title">Change Password</div>
        {done ? (
          <p style={{ fontSize: 14, color: '#4ade80' }}>Password updated.</p>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
              Use a unique password (not your username). Minimum 8 characters.
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="field-group">
              <label>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="field-group">
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" />Saving…</> : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
