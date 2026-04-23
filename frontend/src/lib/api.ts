import { getToken, clearToken } from './auth';

const API_BASE = '/api';
const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...((init.headers as Record<string, string>) ?? {}),
      },
      ...init,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 0);
    }
    throw new ApiError('Unable to connect to the server.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.location.href = '/login';
      throw new ApiError('Session expired. Please log in again.', 401);
    }
    let message = `Server error (${res.status})`;
    try {
      const data = (await res.json()) as { detail?: string; message?: string };
      message = data.detail ?? data.message ?? message;
    } catch { /* non-JSON body */ }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:   <T = unknown>(path: string)               => request<T>(path),
  post:  <T = unknown>(path: string, body: unknown) => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:   <T = unknown>(path: string, body: unknown) => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del:   <T = unknown>(path: string)               => request<T>(path, { method: 'DELETE' }),
};

// ── Copilot-specific (kept from original) ─────────────────────────────────────

export type SessionResponse = {
  session_id: string;
  provider: string;
  ws_ticket: string;
  ws_ticket_expires_at: string;
  created_at: string;
};

export type WsTicketResponse = {
  session_id: string;
  ws_ticket: string;
  ws_ticket_expires_at: string;
};

export async function createSession(
  provider: string,
  interviewContext: string,
  source: string,
  meetingLink: string,
): Promise<SessionResponse> {
  return request<SessionResponse>('/copilot/sessions', {
    method: 'POST',
    body: JSON.stringify({
      provider,
      interview_context: interviewContext || null,
      source,
      meeting_link: meetingLink || null,
    }),
  });
}

export async function refreshWsTicket(sessionId: string): Promise<WsTicketResponse> {
  return request<WsTicketResponse>(
    `/copilot/sessions/${encodeURIComponent(sessionId)}/ws-ticket`,
    { method: 'POST' },
  );
}
