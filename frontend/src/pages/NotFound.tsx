import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80, gap: 12, color: 'var(--text-muted)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        Page not found
      </h2>
      <p style={{ fontSize: 14, margin: 0 }}>The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 8 }}>
        Go to Dashboard
      </Link>
    </div>
  );
}
