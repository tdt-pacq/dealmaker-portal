import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, setAuth, clearAuth } from './api';
import Sidebar from './components/Sidebar';

const AnalyzerApp = lazy(() => import('./pages/analyzer/AnalyzerApp'));


function LoginScreen({ onLogin, error }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(user, pass);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1117',
    }}>
      <div style={{ width: 380 }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontWeight: 700,
            fontSize: 26,
            color: '#e2e8f0',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            Dealmaker Portal
          </div>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 11,
            color: '#2eb860',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Peterson Acquisitions — The Deal Team
          </div>
          <div style={{
            width: 40,
            height: 2,
            background: '#2eb860',
            margin: '14px auto 0',
            borderRadius: 1,
          }} />
        </div>

        {/* Login card */}
        <div style={{
          background: '#1e293b',
          borderRadius: 10,
          border: '1px solid #2d3748',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: '#161f2e',
            padding: '18px 28px',
            borderBottom: '1px solid #2d3748',
          }}>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: '#64748b',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              Team Sign In
            </div>
          </div>

          <form onSubmit={submit} style={{ padding: '24px 28px' }}>
            <div style={{ marginBottom: 16 }}>
              <label>Username</label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="Enter username"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label>Password</label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? <><span className="spinner" />Signing in…</> : 'Sign In →'}
            </button>
          </form>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 11,
          color: '#334155',
          letterSpacing: 0.5,
        }}>
          Authorized personnel only
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getAuth());
  const [loginError, setLoginError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogin = async (user, pass) => {
    setAuth(user, pass);
    try {
      const res = await fetch('/api/deals', {
        headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
      });
      if (res.status === 401) {
        clearAuth();
        setLoginError('Invalid username or password');
      } else {
        setAuthed(true);
        setLoginError('');
      }
    } catch {
      setLoginError('Server unavailable. Please try again.');
      clearAuth();
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAuthed(false);
  };

  if (!authed) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="portal-shell">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          onSignOut={handleLogout}
        />
        <main className="portal-content">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              <div className="spinner spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', marginRight: 10 }} />
              Loading…
            </div>
          }>
            <Routes>
              <Route path="/" element={<Navigate to="/analyzer" replace />} />
              <Route path="/analyzer" element={<AnalyzerApp />} />
              <Route path="/analyzer/*" element={<AnalyzerApp />} />
              <Route path="*" element={<Navigate to="/analyzer" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
