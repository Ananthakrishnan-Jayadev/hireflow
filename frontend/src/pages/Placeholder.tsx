import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, padding: '80px 32px', color: 'var(--text-muted)',
    }}>
      <Construction size={44} strokeWidth={1.5} />
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, margin: 0 }}>This page is not available.</p>
    </div>
  );
}
