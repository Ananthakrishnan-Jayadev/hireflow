const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = sessionStorage.getItem('shyfthatch_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { detail?: string; message?: string };
      message = data.detail || data.message || message;
    } catch {
      // Ignore non-json body.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

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
  meetingLink: string
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
  return request<WsTicketResponse>(`/copilot/sessions/${encodeURIComponent(sessionId)}/ws-ticket`, {
    method: 'POST',
  });
}
