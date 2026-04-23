import type { FormEvent } from 'react';

type Props = {
  provider: 'openai' | 'anthropic' | 'ollama';
  source: 'local' | 'meetstream';
  meetingLink: string;
  interviewContext: string;
  connectionState: string;
  statusMessage: string;
  sessionId: string;
  chunkDraft: string;
  onProviderChange: (value: 'openai' | 'anthropic' | 'ollama') => void;
  onSourceChange: (value: 'local' | 'meetstream') => void;
  onMeetingLinkChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onChunkDraftChange: (value: string) => void;
  onStart: () => Promise<void>;
  onDisconnect: () => void;
  onSendChunk: (text: string, isFinal: boolean) => void;
};

export function ContextSidebar({
  provider,
  source,
  meetingLink,
  interviewContext,
  connectionState,
  statusMessage,
  sessionId,
  chunkDraft,
  onProviderChange,
  onSourceChange,
  onMeetingLinkChange,
  onContextChange,
  onChunkDraftChange,
  onStart,
  onDisconnect,
  onSendChunk,
}: Props) {
  const onSubmit = (evt: FormEvent) => {
    evt.preventDefault();
    onSendChunk(chunkDraft, false);
    onChunkDraftChange('');
  };

  return (
    <section className="stack sticky">
      <section className="panel">
        <h3>Session</h3>
        <label>
          Provider
          <select value={provider} onChange={(evt) => onProviderChange(evt.target.value as Props['provider'])}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </label>

        <label>
          Source
          <select value={source} onChange={(evt) => onSourceChange(evt.target.value as Props['source'])}>
            <option value="local">Local Simulator</option>
            <option value="meetstream">MeetStream</option>
          </select>
        </label>

        {source === 'meetstream' && (
          <label>
            Meeting Link
            <input
              type="text"
              value={meetingLink}
              onChange={(evt) => onMeetingLinkChange(evt.target.value)}
              placeholder="Paste Zoom/Meet/Teams link here"
            />
          </label>
        )}

        <label>
          Interview Context
          <textarea
            rows={6}
            value={interviewContext}
            onChange={(evt) => onContextChange(evt.target.value)}
            placeholder="Role, seniority, panel context, and evaluation focus."
          />
        </label>

        <div className="row">
          <button onClick={() => void onStart()} disabled={connectionState === 'connecting'}>
            Start / Reconnect
          </button>
          <button className="secondary" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>

        <p className="muted">State: {connectionState}</p>
        <p className="muted">{statusMessage}</p>
        <p className="mono">Session: {sessionId || 'not started'}</p>
      </section>

      {source === 'local' && (
        <section className="panel">
          <h3>Transcript Chunks</h3>
          <form className="stack" onSubmit={onSubmit}>
            <textarea
              rows={5}
              value={chunkDraft}
              onChange={(evt) => onChunkDraftChange(evt.target.value)}
              placeholder="Paste/send interviewer transcript chunks here"
            />
            <div className="row">
              <button type="submit">Send Chunk</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  onSendChunk(chunkDraft, true);
                  onChunkDraftChange('');
                }}
              >
                Send Final
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}