export type CopilotEventName =
  | 'status.connected'
  | 'status.generating'
  | 'status.cancelled'
  | 'transcript.buffer'
  | 'coaching.token'
  | 'coaching.meta'
  | 'coaching.final'
  | 'error.event';

export type CopilotWsEvent = {
  event: CopilotEventName | string;
  data: Record<string, unknown>;
};
