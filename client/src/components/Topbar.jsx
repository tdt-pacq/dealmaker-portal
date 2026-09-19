import React from 'react';
import { LOGO_SRC } from '../assets/logo';

export default function Topbar({ onMenuClick, menuOpen = false }) {
  return (
    <div className="portal-topbar" style={{
      background: '#0a0e18',
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: '1px solid #1a2235',
      flexShrink: 0,
      zIndex: 100,
      position: 'relative',
    }}>
      {onMenuClick && (
        <button
          type="button"
          className="topbar-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={onMenuClick}
        >
          <span className="topbar-menu-icon" aria-hidden="true">
            <span /><span /><span />
          </span>
        </button>
      )}
      <img src={LOGO_SRC} alt="Peterson Acquisitions" style={{ height: 66, width: 'auto', maxWidth: '70%' }} />
    </div>
  );
}
