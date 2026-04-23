import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(data.detail ?? 'Invalid credentials. Please try again.');
      }
      const data = await res.json() as { access_token: string; expires_in: number };
      setToken(data.access_token, data.expires_in);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1a1d21',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #9a3412 100%)',
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        padding: '48px 44px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #ea580c, #f97316)',
            borderRadius: 14, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1d21', letterSpacing: '-0.3px' }}>
            HireFlow
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            AI-Powered Recruitment Platform
          </div>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1d21', marginBottom: 6, margin: '0 0 6px' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 28, margin: '0 0 28px' }}>
          Sign in to your recruiter account
        </p>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20,
            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 11,
              background: '#ea580c', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 8, opacity: loading ? 0.7 : 1, transition: 'background 0.15s',
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = '#c2410c'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#ea580c'; }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#9ca3af' }}>
          HireFlow &copy; 2026 · HireFlow v1.0
        </p>
      </div>
    </div>
  );
}
