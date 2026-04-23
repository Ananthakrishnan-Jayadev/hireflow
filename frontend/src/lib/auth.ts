const TOKEN_KEY = 'hireflow_token';
const EXPIRES_KEY = 'hireflow_expires';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, expiresInSeconds: number): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000));
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

export function isTokenValid(): boolean {
  const token = getToken();
  const expires = parseInt(sessionStorage.getItem(EXPIRES_KEY) || '0', 10);
  return !!token && Date.now() < expires - 30_000;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUser(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  return decodeToken(token);
}

export async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token: string; expires_in: number };
      setToken(data.access_token, data.expires_in);
      return true;
    }
  } catch { /* network error */ }
  return false;
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
  clearToken();
}
