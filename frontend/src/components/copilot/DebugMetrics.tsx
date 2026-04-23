type Props = {
  reconnectAttempt: number;
  tokenCount: number;
  lastError: string;
};

export function DebugMetrics({ reconnectAttempt, tokenCount, lastError }: Props) {
  return (
    <section className="panel compact">
      <h3>Debug Metrics</h3>
      <p className="mono">Reconnect attempts: {reconnectAttempt}</p>
      <p className="mono">Token chunks streamed: {tokenCount}</p>
      <p className="mono">Last error: {lastError || 'none'}</p>
    </section>
  );
}
