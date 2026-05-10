import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LOGO_SRC } from '../assets/logo';

const TOOLS = [
  {
    id: 'marketing',
    icon: '📄',
    label: 'Deal Marketing',
    description: 'Generate blind ads, flyers, and CIMs from deal documents in one pass.',
    href: '/marketing',
    live: true,
  },
  {
    id: 'analyzer',
    icon: '📊',
    label: 'Market Price Analyzer',
    description: 'Build and share QSI™ deal valuations with your team in real time.',
    href: '/analyzer',
    live: true,
  },
  {
    id: 'discovery',
    icon: '🔍',
    label: 'Discovery Prep',
    description: 'Research any seller business and generate a complete advisor prep report with live web search.',
    href: '/discovery',
    live: true,
  },
  {
    id: 'engagements',
    icon: '🤝',
    label: 'Engagements',
    description: 'Track engagement agreements and seller onboarding status.',
    live: false,
  },
  {
    id: 'success-plan',
    icon: '🎯',
    label: 'Success Plan',
    description: 'Advisor goal tracking and pipeline management.',
    live: false,
  },
  {
    id: 'otp',
    icon: '📝',
    label: 'OTP',
    description: 'Offer to purchase templates and buyer qualification tools.',
    live: false,
  },
];

export default function Home() {
  const navigate = useNavigate();

  const handleLaunch = (tool) => {
    if (!tool.live) return;
    // External paths (e.g. /discovery-prep.html) need a full page load, not SPA navigation
    if (tool.href && tool.href.includes('.html')) {
      window.location.href = tool.href;
    } else {
      navigate(tool.href);
    }
  };

  return (
    <div style={{ padding: '40px 40px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header with logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
        <img src={LOGO_SRC} alt="Peterson Acquisitions" style={{ height: 80, width: 'auto' }} />
      </div>

      {/* Section label */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        color: '#2d3f57',
        marginBottom: 16,
        fontFamily: 'system-ui, sans-serif',
      }}>
        Tools
      </div>

      {/* Tool grid — 3 columns on wide, 2 on medium */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}>
        {TOOLS.map(tool => (
          <div
            key={tool.id}
            onClick={() => handleLaunch(tool)}
            style={{
              background: '#1e293b',
              border: `1px solid ${tool.live ? '#2d3748' : '#1a2235'}`,
              borderRadius: 10,
              padding: '24px',
              cursor: tool.live ? 'pointer' : 'default',
              opacity: tool.live ? 1 : 0.45,
              transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!tool.live) return;
              e.currentTarget.style.borderColor = '#2eb860';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              if (!tool.live) return;
              e.currentTarget.style.borderColor = '#2d3748';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {!tool.live && (
              <div style={{
                position: 'absolute',
                top: 14,
                right: 14,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: '#2d3f57',
                background: '#111827',
                border: '1px solid #1a2235',
                borderRadius: 3,
                padding: '2px 6px',
                fontFamily: 'system-ui, sans-serif',
              }}>
                Soon
              </div>
            )}

            <div style={{ fontSize: 26, lineHeight: 1 }}>{tool.icon}</div>

            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 600,
              fontSize: 15,
              color: '#e2e8f0',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {tool.label}
            </div>

            <div style={{
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.55,
              fontFamily: 'system-ui, sans-serif',
              flex: 1,
            }}>
              {tool.description}
            </div>

            {tool.live && (
              <div style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#2eb860',
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: 0.3,
              }}>
                Launch <span style={{ fontSize: 14 }}>→</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
