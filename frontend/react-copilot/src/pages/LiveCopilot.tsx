import { useEffect, useState } from 'react';

import { ContextSidebar } from '../components/copilot/ContextSidebar';
import { DebugMetrics } from '../components/copilot/DebugMetrics';
import { StreamingResponsePanel } from '../components/copilot/StreamingResponsePanel';
import { useCopilotStore } from '../store/useCopilotStore';

export function LiveCopilotPage() {
  const [chunkDraft, setChunkDraft] = useState('');
  const {
    provider,
    source,
    meetingLink,
    interviewContext,
    sessionId,
    connectionState,
    statusMessage,
    transcriptBuffer,
    answerText,
    talkingPoints,
    followUpStrategy,
    reconnectAttempt,
    tokenCount,
    lastError,
    setProvider,
    setSource,
    setMeetingLink,
    setInterviewContext,
    createSessionAndConnect,
    disconnectSocket,
    sendTranscriptChunk,
    clearOutput,
  } = useCopilotStore();

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  return (
    <main className="layout">
      <ContextSidebar
        provider={provider}
        source={source}
        meetingLink={meetingLink}
        interviewContext={interviewContext}
        connectionState={connectionState}
        statusMessage={statusMessage}
        sessionId={sessionId}
        chunkDraft={chunkDraft}
        onProviderChange={setProvider}
        onSourceChange={setSource}
        onMeetingLinkChange={setMeetingLink}
        onContextChange={setInterviewContext}
        onChunkDraftChange={setChunkDraft}
        onStart={createSessionAndConnect}
        onDisconnect={disconnectSocket}
        onSendChunk={sendTranscriptChunk}
      />

      <section className="stack">
        <header className="panel compact">
          <h2>Live Interview Copilot</h2>
          <p className="muted">
            Phase 2 WebSocket mode with Redis-backed transcript buffering and cancellable generation.
          </p>
          <div className="row">
            <button className="secondary" onClick={clearOutput}>
              Clear Output
            </button>
          </div>
        </header>

        <section className="panel compact">
          <h3>Transcript Buffer</h3>
          <pre className="buffer">{transcriptBuffer || 'No transcript buffered yet.'}</pre>
        </section>

        <StreamingResponsePanel
          answer={answerText}
          talkingPoints={talkingPoints}
          followUpStrategy={followUpStrategy}
        />

        <DebugMetrics reconnectAttempt={reconnectAttempt} tokenCount={tokenCount} lastError={lastError} />
      </section>
    </main>
  );
}
