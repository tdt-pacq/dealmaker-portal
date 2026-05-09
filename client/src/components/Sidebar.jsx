import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// ─── Navigation Registry ──────────────────────────────────────────────────────
const PORTAL_SECTIONS = [
  {
    id: 'advisors',
    label: 'Advisors',
    items: [
      { id: 'success-plan', label: 'Success Plan',         icon: '🎯', basePath: '/success-plan', live: false },
      { id: 'sops',         label: "SOP's",                icon: '📋', basePath: '/sops',         live: false },
      { id: 'training',     label: 'Training',             icon: '🎓', basePath: '/training',     live: false },
    ],
  },
  {
    id: 'sellers',
    label: 'Sellers',
    items: [
      { id: 'discovery',   label: 'Discovery Prep',        icon: '🔍', basePath: '/discovery',   live: false },
      { id: 'analyzer',    label: 'Market Price Analyzer', icon: '📊', basePath: '/analyzer',    live: true  },
      { id: 'engagements', label: 'Engagements',           icon: '🤝', basePath: '/engagements', live: false },
      { id: 'marketing',   label: 'Deal Marketing',        icon: '📄', basePath: '/marketing',   live: true  },
    ],
  },
  {
    id: 'buyers',
    label: 'Buyers',
    items: [
      { id: 'otp', label: 'OTP', icon: '📝', basePath: '/otp', live: false },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, onToggle, onSignOut }) {
  const [openSections, setOpenSections] = useState({ advisors: true, sellers: true, buyers: true });
  const location = useLocation();

  const toggleSection = (id) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const isActive = (basePath) =>
    location.pathname === basePath || location.pathname.startsWith(basePath + '/');

  return (
    <aside style={{
      width: collapsed ? 56 : 220,
      minHeight: '100vh',
      background: '#0a0e18',
      borderRight: '1px solid #1a2235',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 50,
    }}>

      {/* ── Brand + Toggle ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '18px 0' : '20px 16px 16px',
        borderBottom: '1px solid #1a2235',
        minHeight: 72,
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: '#e2e8f0',
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              lineHeight: 1.15,
            }}>
              Dealmaker
            </div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: '#2eb860',
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              lineHeight: 1.15,
            }}>
              Portal
            </div>
            <div style={{
              fontSize: 9,
              color: '#2d3f57',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginTop: 5,
            }}>
              Peterson Acquisitions
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            border: '1px solid #1a2235',
            borderRadius: 5,
            color: '#334155',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 11,
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2eb860'; e.currentTarget.style.color = '#2eb860'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2235'; e.currentTarget.style.color = '#334155'; }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* ── Sections ── */}
      <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
        {PORTAL_SECTIONS.map(section => {
          const sectionOpen = openSections[section.id];
          return (
            <div key={section.id} style={{ marginBottom: 4 }}>

              {/* Section header (hidden when collapsed) */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.id)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 16px 5px',
                    cursor: 'pointer',
                    borderRadius: 0,
                  }}
                >
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: '#2d3f57',
                    fontFamily: 'system-ui, sans-serif',
                  }}>
                    {section.label}
                  </span>
                  <span style={{
                    color: '#2d3f57',
                    fontSize: 13,
                    lineHeight: 1,
                    transform: sectionOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s',
                    display: 'inline-block',
                  }}>›</span>
                </button>
              )}

              {/* Items */}
              {(sectionOpen || collapsed) && (
                <ul style={{ listStyle: 'none', margin: 0, padding: collapsed ? '0 6px' : '0 8px' }}>
                  {section.items.map(item => {
                    const active = isActive(item.basePath);

                    if (!item.live) {
                      // Coming soon — muted, non-clickable
                      return (
                        <li key={item.id}>
                          <div
                            title={collapsed ? `${item.label} — Coming Soon` : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              padding: collapsed ? '8px 0' : '7px 10px',
                              borderRadius: 5,
                              borderLeft: '2px solid transparent',
                              marginBottom: 1,
                              opacity: 0.4,
                              cursor: 'default',
                              justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                          >
                            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                            {!collapsed && (
                              <>
                                <span style={{
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  color: '#64748b',
                                  fontFamily: 'system-ui, sans-serif',
                                  flex: 1,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {item.label}
                                </span>
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  letterSpacing: 0.5,
                                  color: '#2d3f57',
                                  background: '#111827',
                                  border: '1px solid #1a2235',
                                  borderRadius: 3,
                                  padding: '1px 5px',
                                  textTransform: 'uppercase',
                                  flexShrink: 0,
                                }}>
                                  Soon
                                </span>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    }

                    // Live item
                    return (
                      <li key={item.id}>
                        <NavLink
                          to={item.basePath}
                          title={collapsed ? item.label : undefined}
                          style={{ textDecoration: 'none', display: 'block', marginBottom: 1 }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              padding: collapsed ? '8px 0' : '7px 10px',
                              borderRadius: 5,
                              borderLeft: active ? '2px solid #2eb860' : '2px solid transparent',
                              background: active ? 'rgba(46,184,96,0.09)' : 'transparent',
                              transition: 'background 0.14s, border-color 0.14s',
                              justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                            {!collapsed && (
                              <span style={{
                                fontSize: 12.5,
                                fontWeight: active ? 600 : 500,
                                color: active ? '#e2e8f0' : '#94a3b8',
                                fontFamily: 'system-ui, sans-serif',
                                transition: 'color 0.14s',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {item.label}
                              </span>
                            )}
                          </div>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Sign Out ── */}
      <div style={{
        padding: collapsed ? '12px 6px' : '12px 8px',
        borderTop: '1px solid #1a2235',
        flexShrink: 0,
      }}>
        <button
          onClick={onSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #1a2235',
            borderRadius: 5,
            color: '#334155',
            fontSize: collapsed ? 14 : 11,
            fontWeight: 600,
            letterSpacing: collapsed ? 0 : 0.8,
            padding: collapsed ? '7px 0' : '7px 0',
            cursor: 'pointer',
            textTransform: collapsed ? 'none' : 'uppercase',
            transition: 'border-color 0.15s, color 0.15s',
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2235'; e.currentTarget.style.color = '#334155'; }}
        >
          {collapsed ? '⎋' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
