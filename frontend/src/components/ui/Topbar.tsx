import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Crumb {
  label: string;
  to?: string;
}

interface TopbarProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, breadcrumbs, actions }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="topbar-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span className="breadcrumb-sep">/</span>}
                {crumb.to
                  ? <Link to={crumb.to} className="breadcrumb-link">{crumb.label}</Link>
                  : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </div>
  );
}
