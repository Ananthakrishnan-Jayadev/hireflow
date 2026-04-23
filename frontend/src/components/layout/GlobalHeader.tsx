import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function GlobalHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const name = user?.email?.split('@')[0] ?? 'User';
  const role = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Recruiter';

  return (
    <header className="global-header">
      <Link to="/dashboard" className="global-header-logo">
        <img src="/assets/logo.svg" alt="HireFlow" style={{ height: 28, width: 'auto' }} />
        <span>HireFlow</span>
      </Link>

      <div className="global-header-search" />

      <div className="global-header-actions">
        <div
          className="global-header-user"
          style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{name}</span>
          <ChevronDown size={13} style={{ opacity: 0.7 }} />

          {open && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 499 }}
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: 180, background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 500, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d21' }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{role}</div>
                </div>
                <button
                  onClick={logout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: '#dc2626', fontFamily: 'inherit', textAlign: 'left',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
