const API_BASE = '/api';
const TIMEOUT_MS = 30_000;

function _getToken() {
  return sessionStorage.getItem('shyfthatch_token') || null;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const token = _getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options.headers,
      },
      credentials: 'include',  // Always send cookies (for refresh token)
      ...options,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') {
      const err = new Error('Request timed out. Please check your connection and try again.');
      err.status = 0;
      throw err;
    }
    const err = new Error('Unable to connect to the server. Please check your network connection.');
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    // Session expired → redirect to login
    if (res.status === 401) {
      sessionStorage.removeItem('shyfthatch_token');
      sessionStorage.removeItem('shyfthatch_expires');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }

    let errorDetail = `Server error (${res.status})`;
    try {
      const data = await res.json();
      errorDetail = data.detail || data.message || errorDetail;
    } catch {
      // non-JSON error body — keep the status string
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Named exports for convenience
export const get   = (path)       => request(path);
export const post  = (path, body) => request(path, { method: 'POST',   body });
export const put   = (path, body) => request(path, { method: 'PUT',    body });
export const patch = (path, body) => request(path, { method: 'PATCH',  body });
export const del   = (path)       => request(path, { method: 'DELETE' });
