import { renderSidebar, updateSidebarActive, initSettingsModal } from './components/sidebar.js';
import { showPageLoader } from './components/loader.js';
import { showError } from './components/toast.js';

// Route map: segment → page module path
const ROUTES = {
  dashboard: () => import('./pages/dashboard.js'),
  jobs: () => import('./pages/jobs.js'),
  candidates: () => import('./pages/candidates.js'),
  pipeline: () => import('./pages/pipeline.js'),
  interviews: () => import('./pages/interviews.js'),
  emails: () => import('./pages/emails.js'),
  analytics: () => import('./pages/analytics.js'),
  'interview-assistant': () => import('./pages/interviewAssistant.js'),
  'admin-users': () => import('./pages/adminUsers.js'),
};

// Routes that use different modules based on params
function resolveModule(segments) {
  const [page, ...rest] = segments;

  if (page === 'jobs') {
    if (rest[0] === 'new') return { module: () => import('./pages/jobCreate.js'), params: [] };
    if (rest[0] && rest[1] === 'edit') return { module: () => import('./pages/jobCreate.js'), params: rest };
    if (rest[0]) return { module: () => import('./pages/jobDetail.js'), params: rest };
  }

  if (page === 'candidates' && rest[0]) {
    return { module: () => import('./pages/candidateProfile.js'), params: rest };
  }

  if (page === 'pipeline') {
    return { module: () => import('./pages/pipeline.js'), params: rest };
  }

  if (page === 'interviews' && rest[0] && rest[1] === 'scorecard') {
    return { module: () => import('./pages/scorecard.js'), params: rest };
  }

  if (ROUTES[page]) {
    return { module: ROUTES[page], params: rest };
  }

  return null;
}

let currentCleanup = null;

async function router() {
  const hash = window.location.hash.slice(2) || 'dashboard';
  const segments = hash.split('/').filter(Boolean);
  const page = segments[0] || 'dashboard';

  const content = document.getElementById('content');
  showPageLoader(content);

  updateSidebarActive(page);
  closeMobileSidebar();

  if (currentCleanup) {
    try { currentCleanup(); } catch { /* ignore */ }
    currentCleanup = null;
  }

  const resolved = resolveModule(segments);

  if (!resolved) {
    content.innerHTML = `
      <div class="empty-state" style="margin-top: 80px;">
        <i data-lucide="map-off" class="empty-state-icon"></i>
        <h2 class="empty-state-title">Page not found</h2>
        <p class="empty-state-desc">The page you're looking for doesn't exist.</p>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  try {
    const mod = await resolved.module();
    if (mod && typeof mod.render === 'function') {
      const cleanup = await mod.render(content, resolved.params);
      if (typeof cleanup === 'function') currentCleanup = cleanup;
    }
  } catch (err) {
    console.error('Page load error:', err);
    content.innerHTML = `
      <div class="error-state" style="margin-top: 80px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color: var(--color-error);"></i>
        <h2 class="error-state-title">Failed to load page</h2>
        <p class="error-state-desc">${err.message}</p>
        <a href="#/dashboard" class="btn btn-secondary" style="margin-top: 16px;">Go to Dashboard</a>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// ── Mobile sidebar toggle ──────────────────────────────────────────
function initMobileSidebar() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

// ── Initialization ─────────────────────────────────────────────────
function initApp() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = renderSidebar();
    if (window.lucide) lucide.createIcons();
    initSettingsModal();
  }

  initMobileSidebar();
}

// ── Auth guard ─────────────────────────────────────────────────────
async function ensureAuthenticated() {
  // Check if access token is stored and not expired
  const token   = sessionStorage.getItem('shyfthatch_token');
  const expires = parseInt(sessionStorage.getItem('shyfthatch_expires') || '0', 10);

  if (token && Date.now() < expires - 30_000) {
    return true; // Token still valid
  }

  // Try silent refresh via the httpOnly refresh cookie
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem('shyfthatch_token', data.access_token);
      sessionStorage.setItem('shyfthatch_expires', Date.now() + data.expires_in * 1000);
      return true;
    }
  } catch { /* network error */ }

  // Redirect to login
  window.location.href = '/login';
  return false;
}

export function getAuthToken() {
  return sessionStorage.getItem('shyfthatch_token');
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
  sessionStorage.removeItem('shyfthatch_token');
  sessionStorage.removeItem('shyfthatch_expires');
  window.location.href = '/login';
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
  const authed = await ensureAuthenticated();
  if (!authed) return;
  initApp();
  router();
});
