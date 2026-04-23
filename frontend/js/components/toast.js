const ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

function getContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification.
 *
 * @param {string} message - Main message text
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {Object} [opts]
 * @param {string} [opts.title] - Optional bold title above the message
 * @param {number} [opts.duration] - Auto-dismiss duration in ms (0 = no auto-dismiss)
 */
export function toast(message, type = 'info', opts = {}) {
  const container = getContainer();
  const duration = opts.duration !== undefined ? opts.duration : 4000;
  const icon = ICONS[type] || ICONS.info;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <i data-lucide="${icon}" class="toast-icon"></i>
    <div class="toast-body">
      ${opts.title ? `<div class="toast-title">${opts.title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>
  `;

  el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));

  container.appendChild(el);

  if (window.lucide) lucide.createIcons({ nodes: [el] });

  if (duration > 0) {
    setTimeout(() => dismiss(el), duration);
  }

  return el;
}

function dismiss(el) {
  if (!el.isConnected) return;
  el.classList.add('toast-fade-out');
  setTimeout(() => el.remove(), 300);
}

export const showSuccess = (msg, opts) => toast(msg, 'success', opts);
export const showError = (msg, opts) => toast(msg, 'error', opts);
export const showInfo = (msg, opts) => toast(msg, 'info', opts);
export const showWarning = (msg, opts) => toast(msg, 'warning', opts);
