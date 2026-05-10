import React from 'react';
import { LOGO_SRC } from '../assets/logo';

export default function Topbar() {
  return (
    <div style={{
      background: '#0a0e18',
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: '1px solid #1a2235',
      flexShrink: 0,
      zIndex: 100,
    }}>
      <img src={LOGO_SRC} alt="Peterson Acquisitions" style={{ height: 66, width: 'auto' }} />
    </div>
  );
}
