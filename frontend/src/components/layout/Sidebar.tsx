import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, Columns, CalendarCheck,
  MessageSquare, Bot, Mail, BarChart2, Globe, ShieldCheck,
  Settings, LogOut, Save, Calendar, X, ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../store/toastStore';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}


const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Recruit',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/jobs',       icon: Briefcase,        label: 'Jobs' },
      { to: '/candidates', icon: Users,            label: 'Candidates' },
      { to: '/pipeline',   icon: Columns,          label: 'Pipeline' },
    ],
  },
  {
    label: 'Evaluate',
    items: [
      { to: '/interviews',          icon: CalendarCheck,  label: 'Interviews' },
      { to: '/interview-assistant', icon: MessageSquare,  label: 'Interview Assistant' },
      { to: '/copilot',             icon: Bot,            label: 'Live Copilot' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { to: '/emails', icon: Mail, label: 'Email Outreach' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: BarChart2, label: 'Analytics' },
    ],
  },
  {
    label: 'Public',
    items: [
      { to: '/career', icon: Globe, label: 'Career Page', external: true },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  label: 'Admin',
  adminOnly: true,
  items: [
    { to: '/admin-users', icon: ShieldCheck, label: 'User Management' },
  ],
};

export function Sidebar({ open }: { open: boolean }) {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calUrl, setCalUrl] = useState(
    () => localStorage.getItem('hireflow_calendar_url') ?? '',
  );

  const sections =
    user?.role === 'admin' ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;
  const initials = (user?.email?.[0] ?? 'U').toUpperCase();
  const name = user?.email?.split('@')[0] ?? 'User';
  const role = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Recruiter';

  function saveSettings() {
    const url = calUrl.trim();
    if (url) localStorage.setItem('hireflow_calendar_url', url);
    else localStorage.removeItem('hireflow_calendar_url');
    setSettingsOpen(false);
    toast.success('Settings saved.');
  }

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar" role="navigation" aria-label="Main navigation">
        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div
              key={section.label}
              className={`nav-section${section.adminOnly ? ' nav-section--admin' : ''}`}
            >
              <span className="nav-section-label">{section.label}</span>
              {section.items.map((item) =>
                item.external ? (
                  <a
                    key={item.to}
                    href="/career"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-item"
                  >
                    <item.icon size={17} className="nav-icon" />
                    <span>{item.label}</span>
                    <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <item.icon size={17} className="nav-icon" />
                    <span>{item.label}</span>
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="user-role">{role}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              aria-label="Open settings"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <Settings size={16} />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {settingsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div style={{ position: 'absolute', bottom: 80, left: 16, width: 320, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Settings size={15} /> Settings
              </span>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--text-muted)' }} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Calendar size={13} /> Calendar Booking URL
              </label>
              <input
                className="form-input"
                type="url"
                value={calUrl}
                onChange={(e) => setCalUrl(e.target.value)}
                placeholder="https://calendly.com/yourname"
                style={{ fontSize: 13 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                Paste your Calendly or Google Calendar booking link. It will be added to interview invite emails.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveSettings}>
                <Save size={13} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
