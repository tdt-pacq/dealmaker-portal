import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'pacq_onboarding_seen';

export function hasSeenOnboarding() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function markOnboardingSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* */ }
}

const STEPS = [
  {
    num: '1',
    title: 'Upload notes',
    body: 'Start a deal in Deal Marketing and upload interview notes or a document. The portal extracts what it can so you are not starting from a blank form.',
  },
  {
    num: '2',
    title: 'Fill the form',
    body: 'Review and complete the interview fields. Your work autosaves as you go so a refresh will not wipe progress.',
  },
  {
    num: '3',
    title: 'Generate outputs',
    body: 'When the form is ready, generate the blind ad, flyer, and CBR (CIM). Download and share from the deal page.',
  },
];

export default function OnboardingModal({ onClose }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (goMarketing = false) => {
    markOnboardingSeen();
    setVisible(false);
    setTimeout(() => {
      onClose?.();
      if (goMarketing) navigate('/marketing');
    }, 160);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: visible ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0)',
        transition: 'background 0.2s ease',
      }}
      onClick={() => dismiss(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#161b27',
          border: '1px solid #1e2d45',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.2s ease, opacity 0.2s ease',
        }}
      >
        <div style={{
          padding: '22px 24px 16px',
          borderBottom: '1px solid #1e2d45',
          background: 'linear-gradient(180deg, #1a2438 0%, #161b27 100%)',
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#2eb860',
            marginBottom: 8,
          }}>
            Welcome
          </div>
          <h2 id="onboarding-title" style={{
            margin: 0,
            fontFamily: 'Oswald, sans-serif',
            fontSize: 26,
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: 0.5,
            lineHeight: 1.2,
          }}>
            Dealmaker Portal
          </h2>
          <p style={{
            margin: '10px 0 0',
            fontSize: 14,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}>
            Three steps to market a listing. Everything else in the sidebar supports that workflow.
          </p>
        </div>

        <div style={{ padding: '8px 24px 20px' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 0',
                borderBottom: i < STEPS.length - 1 ? '1px solid #1e2d45' : 'none',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(46,184,96,0.12)',
                border: '1px solid rgba(46,184,96,0.35)',
                color: '#2eb860',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}>
                {s.num}
              </div>
              <div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#e2e8f0',
                  marginBottom: 4,
                }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                  {s.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          padding: '16px 24px 20px',
          borderTop: '1px solid #1e2d45',
          background: '#121722',
        }}>
          <button
            type="button"
            onClick={() => dismiss(false)}
            style={{
              background: 'transparent',
              border: '1px solid #2d3f57',
              borderRadius: 6,
              color: '#94a3b8',
              fontSize: 13,
              fontWeight: 600,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
          <button
            type="button"
            onClick={() => dismiss(true)}
            style={{
              background: '#2eb860',
              border: 'none',
              borderRadius: 6,
              color: '#0a1628',
              fontSize: 13,
              fontWeight: 700,
              padding: '9px 16px',
              cursor: 'pointer',
            }}
          >
            Start with Deal Marketing →
          </button>
        </div>
      </div>
    </div>
  );
}
