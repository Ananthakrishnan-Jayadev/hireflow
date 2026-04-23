type Props = {
  answer: string;
  talkingPoints: string[];
  followUpStrategy: string[];
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="panel compact">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">No items yet.</p>
      ) : (
        <ul>
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StreamingResponsePanel({ answer, talkingPoints, followUpStrategy }: Props) {
  return (
    <section className="stack">
      <section className="panel">
        <h3>Suggested Answer</h3>
        <pre className="answer">{answer || 'Waiting for model output...'}</pre>
      </section>
      <section className="grid two">
        <List title="Talking Points" items={talkingPoints} />
        <List title="Follow-up Strategy" items={followUpStrategy} />
      </section>
    </section>
  );
}
