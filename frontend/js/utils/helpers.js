/**
 * Format a date string into a readable format.
 * @param {string|Date} dateString
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatDate(dateString, opts) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', opts || { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format a datetime string into a readable date + time.
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Return a relative time string like "2 hours ago" or "in 3 days".
 * @param {string|Date} dateString
 */
export function timeAgo(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  const now = Date.now();
  const diff = now - date.getTime(); // positive = past, negative = future
  const abs = Math.abs(diff);
  const isFuture = diff < 0;

  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let label;
  if (seconds < 60) label = 'just now';
  else if (minutes < 60) label = `${minutes}m`;
  else if (hours < 24) label = `${hours}h`;
  else if (days < 7) label = `${days}d`;
  else if (weeks < 5) label = `${weeks}w`;
  else if (months < 12) label = `${months}mo`;
  else label = `${years}y`;

  if (label === 'just now') return label;
  return isFuture ? `in ${label}` : `${label} ago`;
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay - milliseconds
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Capitalize the first character of a string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a string to slug format.
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Format a number as a currency string.
 * @param {number} value
 * @param {string} [currency]
 */
export function formatCurrency(value, currency = 'USD') {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a salary range.
 */
export function formatSalaryRange(min, max) {
  if (!min && !max) return 'Not specified';
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min) return `From ${formatCurrency(min)}`;
  return `Up to ${formatCurrency(max)}`;
}

/**
 * Generate star rating HTML.
 * @param {number} rating - 0 to 5
 * @param {boolean} [readonly]
 */
export function starsHtml(rating, readonly = true) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = i < rating ? ' filled' : '';
    return `<span class="star${filled}" data-value="${i + 1}" aria-hidden="true">★</span>`;
  }).join('');
  return `<div class="star-rating${readonly ? ' readonly' : ''}" role="img" aria-label="${rating} out of 5 stars">${stars}</div>`;
}

/**
 * Get a CSS class for a pipeline stage name.
 */
export function stageBadgeClass(stage) {
  const map = {
    Applied: 'badge-stage-applied',
    Screening: 'badge-stage-screening',
    Interview: 'badge-stage-interview',
    Offer: 'badge-stage-offer',
    Hired: 'badge-stage-hired',
    Rejected: 'badge-stage-rejected',
  };
  return map[stage] || 'badge-default';
}

/**
 * Get badge class for job status.
 */
export function statusBadgeClass(status) {
  const map = {
    draft: 'badge-status-draft',
    open: 'badge-status-open',
    closed: 'badge-status-closed',
    archived: 'badge-status-archived',
  };
  return map[status] || 'badge-default';
}

/**
 * Format job_type enum to a readable label.
 */
export function formatJobType(type) {
  const map = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
  };
  return map[type] || capitalize(type || '');
}

/**
 * Format source enum to a readable label.
 */
export function formatSource(source) {
  const map = {
    linkedin: 'LinkedIn',
    referral: 'Referral',
    careers_page: 'Careers Page',
    indeed: 'Indeed',
    other: 'Other',
  };
  return map[source] || capitalize(source || '');
}

/**
 * Truncate text to a given length.
 */
export function truncate(text, length = 100) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '…';
}

/**
 * Build a query string from an object, omitting null/undefined/empty string values.
 */
export function buildQuery(params) {
  const parts = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

/**
 * Parse query params from a URL search string.
 */
export function parseQuery(search) {
  const params = {};
  new URLSearchParams(search).forEach((val, key) => {
    params[key] = val;
  });
  return params;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
