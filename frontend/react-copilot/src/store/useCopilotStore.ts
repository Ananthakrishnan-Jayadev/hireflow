import { create } from 'zustand';

import { createSession, refreshWsTicket } from '../lib/api';
import type { CopilotWsEvent } from '../types/events';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type CopilotState = {
  provider: 'openai' | 'anthropic' | 'ollama';
  source: 'local' | 'meetstream';
  meetingLink: string;
  interviewContext: string;
  sessionId: string;
  wsTicket: string;
  wsTicketExpiresAt: string;
  connectionState: ConnectionState;
  statusMessage: string;
  transcriptBuffer: string;
  answerText: string;
  talkingPoints: string[];
  followUpStrategy: string[];
  lastError: string;
  reconnectAttempt: number;
  tokenCount: number;
  setProvider: (provider: CopilotState['provider']) => void;
  setSource: (source: CopilotState['source']) => void;
  setMeetingLink: (link: string) => void;
  setInterviewContext: (text: string) => void;
  createSessionAndConnect: () => Promise<void>;
  connectSocket: () => Promise<void>;
  disconnectSocket: () => void;
  sendTranscriptChunk: (text: string, isFinal?: boolean) => void;
  clearOutput: () => void;
};

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let manualClose = false;

function wsBaseUrl(): string {
  const envBase = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function isTicketExpired(iso: string): boolean {
  if (!iso) {
    return true;
  }
  const expiry = new Date(iso).getTime();
  return Number.isNaN(expiry) || Date.now() >= expiry - 5000;
}

export const useCopilotStore = create<CopilotState>((set, get) => {
  const scheduleReconnect = () => {
    const attempt = get().reconnectAttempt + 1;
    if (attempt > 6) {
      set({
        connectionState: 'error',
        statusMessage: 'Reconnect attempts exhausted.',
        lastError: 'Could not reconnect websocket.',
      });
      return;
    }

    const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
    set({
      reconnectAttempt: attempt,
      connectionState: 'reconnecting',
      statusMessage: `Reconnecting in ${Math.round(delayMs / 1000)}s...`,
    });

    clearReconnectTimer();
    reconnectTimer = window.setTimeout(async () => {
      try {
        if (isTicketExpired(get().wsTicketExpiresAt)) {
          const refreshed = await refreshWsTicket(get().sessionId);
          set({
            wsTicket: refreshed.ws_ticket,
            wsTicketExpiresAt: refreshed.ws_ticket_expires_at,
          });
        }
        await get().connectSocket();
      } catch (err) {
        set({
          connectionState: 'error',
          lastError: err instanceof Error ? err.message : 'Reconnect failed.',
        });
        scheduleReconnect();
      }
    }, delayMs);
  };

  const handleMessage = (evt: MessageEvent<string>) => {
    let parsed: CopilotWsEvent;
    try {
      parsed = JSON.parse(evt.data) as CopilotWsEvent;
    } catch {
      return;
    }

    switch (parsed.event) {
      case 'status.connected': {
        set((state) => ({ statusMessage: state.source === 'meetstream' ? 'Bot joined — listening...' : 'Connected.', lastError: '' }));
        break;
      }
      case 'status.generating': {
        set({ statusMessage: 'Generating coaching response...' });
        break;
      }
      case 'status.cancelled': {
        set({ statusMessage: 'Previous generation cancelled (new context).' });
        break;
      }
      case 'transcript.buffer': {
        const text = String(parsed.data.text || '');
        set({ transcriptBuffer: text });
        break;
      }
      case 'coaching.token': {
        const delta = String(parsed.data.delta || '');
        if (!delta) {
          break;
        }
        set((state) => ({
          answerText: state.answerText + delta,
          tokenCount: state.tokenCount + 1,
        }));
        break;
      }
      case 'coaching.meta': {
        const talkingPoints = Array.isArray(parsed.data.talking_points)
          ? parsed.data.talking_points.map(String)
          : [];
        const followUpStrategy = Array.isArray(parsed.data.follow_up_strategy)
          ? parsed.data.follow_up_strategy.map(String)
          : [];
        set({ talkingPoints, followUpStrategy });
        break;
      }
      case 'coaching.final': {
        const answer = String(parsed.data.answer_suggestion || '');
        set((state) => ({
          answerText: answer || state.answerText,
          statusMessage: 'Generation complete.',
        }));
        break;
      }
      case 'error.event': {
        const message = String(parsed.data.message || 'Copilot websocket error.');
        set({
          lastError: message,
          statusMessage: 'Error received from server.',
        });
        break;
      }
      default:
        break;
    }
  };

  return {
    provider: 'openai',
    source: 'local',
    meetingLink: '',
    interviewContext: '',
    sessionId: '',
    wsTicket: '',
    wsTicketExpiresAt: '',
    connectionState: 'idle',
    statusMessage: 'Ready.',
    transcriptBuffer: '',
    answerText: '',
    talkingPoints: [],
    followUpStrategy: [],
    lastError: '',
    reconnectAttempt: 0,
    tokenCount: 0,
    setProvider: (provider) => set({ provider }),
    setSource: (source) => set({ source }),
    setMeetingLink: (link) => set({ meetingLink: link }),
    setInterviewContext: (text) => set({ interviewContext: text }),
    clearOutput: () =>
      set({
        answerText: '',
        talkingPoints: [],
        followUpStrategy: [],
        tokenCount: 0,
      }),

    createSessionAndConnect: async () => {
      const state = get();
      const isMeetStream = state.source === 'meetstream';
      set({ connectionState: 'connecting', statusMessage: isMeetStream ? 'Deploying bot to meeting...' : 'Creating session...', lastError: '' });
      const session = await createSession(state.provider, state.interviewContext, state.source, state.meetingLink);
      set({
        sessionId: session.session_id,
        wsTicket: session.ws_ticket,
        wsTicketExpiresAt: session.ws_ticket_expires_at,
        statusMessage: isMeetStream ? 'Session created. Bot joining...' : 'Session created. Connecting websocket...',
      });
      await get().connectSocket();
    },

    connectSocket: async () => {
      const { sessionId, wsTicket } = get();
      if (!sessionId || !wsTicket) {
        throw new Error('Session is not initialized.');
      }

      manualClose = false;
      clearReconnectTimer();

      if (socket) {
        socket.close();
        socket = null;
      }

      set({
        connectionState: 'connecting',
        statusMessage: 'Connecting websocket...',
      });

      const url = `${wsBaseUrl()}/api/copilot/ws/${encodeURIComponent(sessionId)}?ticket=${encodeURIComponent(wsTicket)}`;
      const ws = new WebSocket(url);
      socket = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          set({
            connectionState: 'connected',
            statusMessage: 'Websocket connected.',
            reconnectAttempt: 0,
            lastError: '',
          });
          resolve();
        };

        ws.onmessage = handleMessage;

        ws.onerror = () => {
          set({ connectionState: 'error', statusMessage: 'Websocket error.' });
        };

        ws.onclose = () => {
          if (socket === ws) {
            socket = null;
          }
          if (manualClose) {
            set({ connectionState: 'idle', statusMessage: 'Disconnected.' });
            return;
          }
          scheduleReconnect();
        };

        window.setTimeout(() => reject(new Error('Websocket connection timeout.')), 7000);
      });
    },

    disconnectSocket: () => {
      manualClose = true;
      clearReconnectTimer();
      if (socket) {
        socket.close();
        socket = null;
      }
      set({ connectionState: 'idle', statusMessage: 'Disconnected.' });
    },

    sendTranscriptChunk: (text: string, isFinal = false) => {
      const chunk = text.trim();
      if (!chunk) {
        return;
      }
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        set({ lastError: 'Websocket not connected.' });
        return;
      }
      socket.send(
        JSON.stringify({
          event: 'transcript.chunk',
          data: {
            text: chunk,
            timestamp_ms: Date.now(),
            is_final: isFinal,
          },
        }),
      );
    },
  };
});
