import React from 'react';
import { Link } from 'react-router-dom';
import { LOGO_SRC } from '../assets/logo';

export default function Topbar({ onMenuClick, menuOpen = false }) {
  return (
    <div className="portal-topbar" style={{
      background: 'rgba(255,255,255,0.62)',
      backdropFilter: 'blur(18px) saturate(1.15)',
      WebkitBackdropFilter: 'blur(18px) saturate(1.15)',
      height: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.85)',
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
      <Link to="/" className="brand-lockup topbar-brand" aria-label="Dealmaker Portal">
        <img src="/phoenix-icon.svg" alt="" width="64" height="74" />
        <span className="brand-lockup-name">Dealmaker Portal</span>
      </Link>
      <img src={LOGO_SRC} alt="Peterson Acquisitions" style={{ height: 52, width: 'auto', maxWidth: '46%' }} />
    </div>
  );
}
