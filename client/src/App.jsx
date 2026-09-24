import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getAuth, setAuth, clearAuth } from './api';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import OnboardingModal, { hasSeenOnboarding } from './components/OnboardingModal';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewDeal = lazy(() => import('./pages/NewDeal'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const AnalyzerApp = lazy(() => import('./pages/analyzer/AnalyzerApp'));
const DiscoveryPrepApp = lazy(() => import('./pages/discovery/DiscoveryPrepApp'));
const AcqCalcApp = lazy(() => import('./pages/buyers/AcqCalcApp'));
const BuyerStrategyApp = lazy(() => import('./pages/buyers/BuyerStrategyApp'));
const DealFinderApp = lazy(() => import('./pages/buyers/DealFinderApp'));
const OtpApp = lazy(() => import('./pages/otp/OtpApp'));
const RedactApp = lazy(() => import('./pages/redact/RedactApp'));
const CommissionCalcApp = lazy(() => import('./pages/advisors/CommissionCalcApp'));
const SuccessPlansApp = lazy(() => import('./pages/advisors/SuccessPlansApp'));
const EngagementsList = lazy(() => import('./pages/engagements/EngagementsList'));
const ProposalPage = lazy(() => import('./pages/engagements/ProposalPage'));


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
    <div className="login-screen">
      <div style={{ width: 400, maxWidth: '100%' }}>
        <div className="login-brand">
          <img src="/phoenix-icon.svg" alt="" width="80" height="92" />
          <div>
            <div className="login-brand-name">Dealmaker Portal</div>
            <div className="login-brand-sub">Peterson Acquisitions — The Deal Team</div>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-hd">
            Team Sign In
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
          color: '#44403c',
          letterSpacing: 0.5,
        }}>
          Authorized personnel only
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240, color: '#57534e' }}>
      <div className="spinner spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', marginRight: 10 }} />
      Loading…
    </div>
  );
}

function PublicShareLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Suspense fallback={<LoadingFallback />}>
        <ProposalPage />
      </Suspense>
    </div>
  );
}

function AuthenticatedShell({ onSignOut, showOnboarding, onCloseOnboarding }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  return (
    <div className={`portal-shell${mobileNavOpen ? ' nav-open' : ''}`}>
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        collapsed={mobileNavOpen ? false : sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onToggle={() => {
          if (window.matchMedia('(max-width: 1024px)').matches) {
            setMobileNavOpen(o => !o);
          } else {
            setSidebarCollapsed(c => !c);
          }
        }}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSignOut={onSignOut}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div data-portal-topbar>
          <Topbar
            onMenuClick={() => setMobileNavOpen(true)}
            menuOpen={mobileNavOpen}
          />
        </div>
        <main className="portal-content">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/marketing" element={<Dashboard />} />
              <Route path="/marketing/deals/new" element={<NewDeal />} />
              <Route path="/marketing/deals/:id/edit" element={<NewDeal />} />
              <Route path="/marketing/deals/:id" element={<DealDetail />} />
              <Route path="/discovery" element={<DiscoveryPrepApp />} />
              <Route path="/analyzer" element={<AnalyzerApp />} />
              <Route path="/analyzer/*" element={<AnalyzerApp />} />
              <Route path="/acqcalc" element={<AcqCalcApp />} />
              <Route path="/buyer-strategy" element={<BuyerStrategyApp />} />
              <Route path="/deal-finder" element={<DealFinderApp />} />
              <Route path="/otp" element={<OtpApp />} />
              <Route path="/redact" element={<RedactApp />} />
              <Route path="/commission" element={<CommissionCalcApp />} />
              <Route path="/success-plan" element={<SuccessPlansApp />} />
              <Route path="/engagements" element={<EngagementsList />} />
              <Route path="/engagements/:token" element={<ProposalPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      {showOnboarding && (
        <OnboardingModal onClose={onCloseOnboarding} />
      )}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getAuth());
  const [loginError, setLoginError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !!getAuth() && !hasSeenOnboarding());

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
        if (!hasSeenOnboarding()) setShowOnboarding(true);
      }
    } catch {
      setLoginError('Server unavailable. Please try again.');
      clearAuth();
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAuthed(false);
    setShowOnboarding(false);
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {authed ? (
        <AuthenticatedShell
          onSignOut={handleLogout}
          showOnboarding={showOnboarding}
          onCloseOnboarding={() => setShowOnboarding(false)}
        />
      ) : (
        <Routes>
          <Route path="/engagements/:token" element={<PublicShareLayout />} />
          <Route path="*" element={<LoginScreen onLogin={handleLogin} error={loginError} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
