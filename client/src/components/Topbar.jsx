import React from 'react';
import { LOGO_SRC } from '../assets/logo';

export default function Topbar({ onSignOut }) {
  return (
    <div style={{
      background: '#0a0e18',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      borderBottom: '1px solid #1a2235',
      flexShrink: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <img src={LOGO_SRC} alt="Peterson Acquisitions" style={{ height: 32, width: 'auto' }} />

      {/* Brand text */}
      <div>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontWeight: 700,
          fontSize: 15,
          color: '#e2e8f0',
          letterSpacing: 0.5,
          lineHeight: 1.1,
        }}>
          Peterson Acquisitions
        </div>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 10,
          color: '#2eb860',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          lineHeight: 1.1,
        }}>
          The Deal Team
        </div>
      </div>
    </div>
  );
}
