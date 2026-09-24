import React from 'react';
import { useNavigate } from 'react-router-dom';

const TOOLS = [
  {
    id: 'marketing',
    icon: '📄',
    label: 'Deal Marketing',
    description: 'Fill the deal interview, then generate branded blind ads, flyers, and CBRs (CIMs) from Deal Marketing.',
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
    label: 'Engagement Proposal',
    description: 'Private long-scroll seller engagement proposal — after MPA + BIR, for the Zoom walkthrough.',
    href: '/engagements',
    live: true,
  },
  {
    id: 'success-plan',
    icon: '🎯',
    label: 'Annual Success Plans',
    description: 'Company rollup and each person\'s WTF goals and strategic priorities.',
    href: '/success-plan',
    live: true,
  },
  {
    id: 'otp',
    icon: '📝',
    label: 'OTP',
    description: 'Offer to purchase templates and buyer qualification tools.',
    href: '/otp',
    live: true,
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
    <div className="page-content">

      {/* Section label */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        color: '#57534e',
        marginBottom: 16,
        fontFamily: 'system-ui, sans-serif',
      }}>
        Tools
      </div>

      {/* Tool grid — wraps into more columns as the page widens */}
      <div className="home-tool-grid">
        {TOOLS.map(tool => (
          <div
            key={tool.id}
            onClick={() => handleLaunch(tool)}
            style={{
              background: 'rgba(255,255,255,0.94)',
              border: `1px solid ${tool.live ? '#e4dcd2' : '#e6dfd6'}`,
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
              e.currentTarget.style.borderColor = '#C4592F';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              if (!tool.live) return;
              e.currentTarget.style.borderColor = '#e4dcd2';
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
                color: '#57534e',
                background: '#f7f3ee',
                border: '1px solid #e6dfd6',
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
              color: '#1c1917',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {tool.label}
            </div>

            <div style={{
              fontSize: 13,
              color: '#57534e',
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
                color: '#C4592F',
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
