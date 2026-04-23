export function formatDate(dateString: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', opts ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const isFuture = diff < 0;
  const s = Math.floor(abs / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60),
        d = Math.floor(h / 24), w = Math.floor(d / 7), mo = Math.floor(d / 30), y = Math.floor(d / 365);
  let label: string;
  if (s < 60) label = 'just now';
  else if (m < 60) label = `${m}m`;
  else if (h < 24) label = `${h}h`;
  else if (d < 7) label = `${d}d`;
  else if (w < 5) label = `${w}w`;
  else if (mo < 12) label = `${mo}mo`;
  else label = `${y}y`;
  if (label === 'just now') return label;
  return isFuture ? `in ${label}` : `${label} ago`;
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function formatSalaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Not specified';
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min) return `From ${formatCurrency(min)}`;
  return `Up to ${formatCurrency(max)}`;
}

export function stageBadgeClass(stage: string): string {
  const map: Record<string, string> = {
    Applied: 'badge-stage-applied', Screening: 'badge-stage-screening',
    Interview: 'badge-stage-interview', Offer: 'badge-stage-offer',
    Hired: 'badge-stage-hired', Rejected: 'badge-stage-rejected',
  };
  return map[stage] ?? 'badge-default';
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'badge-status-draft', open: 'badge-status-open',
    closed: 'badge-status-closed', archived: 'badge-status-archived',
  };
  return map[status] ?? 'badge-default';
}

export function formatJobType(type: string): string {
  const map: Record<string, string> = {
    full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship',
  };
  return map[type] ?? capitalize(type ?? '');
}

export function formatSource(source: string): string {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn', referral: 'Referral', careers_page: 'Careers Page', indeed: 'Indeed', other: 'Other',
  };
  return map[source] ?? capitalize(source ?? '');
}

export function truncate(text: string, length = 100): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '…';
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

export function daysAgo(dateString: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000));
}
