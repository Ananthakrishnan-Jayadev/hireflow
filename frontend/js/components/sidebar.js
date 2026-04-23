import { showSuccess } from './toast.js';

const NAV_SECTIONS = [
  {
    label: 'Recruit',
    items: [
      { href: '#/dashboard', icon: 'layout-dashboard', label: 'Dashboard', key: 'dashboard' },
      { href: '#/jobs', icon: 'briefcase', label: 'Jobs', key: 'jobs' },
      { href: '#/candidates', icon: 'users', label: 'Candidates', key: 'candidates' },
      { href: '#/pipeline', icon: 'columns', label: 'Pipeline', key: 'pipeline' },
    ],
  },
  {
    label: 'Evaluate',
    items: [
      { href: '#/interviews', icon: 'calendar-check', label: 'Interviews', key: 'interviews' },
      { href: '#/interview-assistant', icon: 'message-square', label: 'Interview Assistant', key: 'interview-assistant' },
      { href: '/copilot/', icon: 'bot', label: 'Live Copilot', key: 'live-copilot', external: true },
    ],
  },
  {
    label: 'Engage',
    items: [
      { href: '#/emails', icon: 'mail', label: 'Email Outreach', key: 'emails' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '#/analytics', icon: 'bar-chart-2', label: 'Analytics', key: 'analytics' },
    ],
  },
  {
    label: 'Public',
    items: [
      { href: '/career.html', icon: 'globe', label: 'Career Page', key: 'career', external: true },
    ],
  },
];

// Admin-only section — appended only when role === 'admin'
const ADMIN_SECTION = {
  label: 'Admin',
  items: [
    { href: '#/admin-users', icon: 'shield-check', label: 'User Management', key: 'admin-users' },
  ],
};

function _getRole() {
  const token = sessionStorage.getItem('shyfthatch_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role || null;
  } catch { return null; }
}

export function renderSidebar() {
  const role     = _getRole();
  const sections = role === 'admin' ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;

  const sectionsHtml = sections.map(section => `
    <div class="nav-section${section.label === 'Admin' ? ' nav-section--admin' : ''}">
      <span class="nav-section-label">${section.label}</span>
      ${section.items.map(item => `
        <a
          href="${item.href}"
          class="nav-item"
          data-key="${item.key}"
          ${item.external ? 'target="_blank" rel="noopener"' : ''}
          aria-label="${item.label}"
        >
          <i data-lucide="${item.icon}" class="nav-icon"></i>
          <span>${item.label}</span>
          ${item.external ? '<i data-lucide="external-link" style="width:12px;height:12px;margin-left:auto;opacity:0.4;"></i>' : ''}
        </a>
      `).join('')}
    </div>
  `).join('');

  return `
    <aside class="sidebar" id="sidebar" role="navigation" aria-label="Main navigation">
      <nav class="sidebar-nav">
        ${sectionsHtml}
      </nav>

      <div class="sidebar-footer">
        <div class="user-avatar" aria-hidden="true" id="sidebar-user-avatar">HR</div>
        <div class="user-info">
          <div class="user-name" id="sidebar-user-name">Hiring Manager</div>
          <div class="user-role" id="sidebar-user-role">Recruiter</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:2px;">
          <button id="sidebar-settings-btn" title="Settings"
            style="background:none;border:none;cursor:pointer;
                   padding:6px;border-radius:6px;color:var(--text-muted);
                   display:flex;align-items:center;justify-content:center;
                   transition:background 0.15s,color 0.15s;"
            onmouseover="this.style.background='var(--border-light)';this.style.color='var(--text-primary)'"
            onmouseout="this.style.background='none';this.style.color='var(--text-muted)'"
            aria-label="Open settings">
            <i data-lucide="settings" style="width:16px;height:16px;"></i>
          </button>
          <button id="sidebar-logout-btn" title="Sign Out"
            style="background:none;border:none;cursor:pointer;
                   padding:6px;border-radius:6px;color:var(--text-muted);
                   display:flex;align-items:center;justify-content:center;
                   transition:background 0.15s,color 0.15s;"
            onmouseover="this.style.background='#fee2e2';this.style.color='#dc2626'"
            onmouseout="this.style.background='none';this.style.color='var(--text-muted)'"
            aria-label="Sign out">
            <i data-lucide="log-out" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>
    </aside>

    <!-- Settings overlay -->
    <div id="settings-overlay" style="display:none;position:fixed;inset:0;z-index:1100;
         background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);" role="dialog"
         aria-modal="true" aria-label="Settings">
      <div style="position:absolute;bottom:80px;left:16px;width:320px;
                  background:var(--bg-card);border:1px solid var(--border);
                  border-radius:12px;box-shadow:var(--shadow-lg);padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <span style="font-size:14px;font-weight:700;color:var(--text-primary);
                       display:flex;align-items:center;gap:7px;">
            <i data-lucide="settings" style="width:15px;height:15px;"></i> Settings
          </span>
          <button id="settings-close-btn" style="background:none;border:none;cursor:pointer;
                  padding:4px;border-radius:4px;color:var(--text-muted);"
                  aria-label="Close settings">
            <i data-lucide="x" style="width:15px;height:15px;"></i>
          </button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.06em;color:var(--text-muted);display:flex;
                        align-items:center;gap:5px;margin-bottom:6px;">
            <i data-lucide="calendar" style="width:13px;height:13px;"></i>
            Calendar Booking URL
          </label>
          <input id="settings-calendar-url" class="form-input" type="url"
                 placeholder="https://calendly.com/yourname"
                 style="font-size:13px;" />
          <p style="font-size:11px;color:var(--text-muted);margin-top:5px;line-height:1.5;">
            Paste your Calendly, Google Calendar, or any booking link.
            It will be automatically added to interview invite emails.
          </p>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn btn-secondary btn-sm" id="settings-cancel-btn">Cancel</button>
          <button class="btn btn-primary btn-sm" id="settings-save-btn">
            <i data-lucide="save" style="width:13px;height:13px;"></i> Save
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initSettingsModal() {
  const triggerBtn  = document.getElementById('sidebar-settings-btn');
  const overlay     = document.getElementById('settings-overlay');
  const closeBtn    = document.getElementById('settings-close-btn');
  const cancelBtn   = document.getElementById('settings-cancel-btn');
  const saveBtn     = document.getElementById('settings-save-btn');
  const urlInput    = document.getElementById('settings-calendar-url');

  if (!triggerBtn || !overlay) return;

  // Populate sidebar user info from the stored token (decoded client-side)
  _populateUserInfo();

  function openSettings() {
    urlInput.value = localStorage.getItem('shyfthatch_calendar_url') || '';
    overlay.style.display = 'block';
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
    urlInput.focus();
  }

  function closeSettings() {
    overlay.style.display = 'none';
  }

  triggerBtn.addEventListener('click', (e) => { e.stopPropagation(); openSettings(); });
  closeBtn?.addEventListener('click',  closeSettings);
  cancelBtn?.addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });

  saveBtn?.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      localStorage.setItem('shyfthatch_calendar_url', url);
    } else {
      localStorage.removeItem('shyfthatch_calendar_url');
    }
    closeSettings();
    showSuccess('Settings saved.');
  });

  // Logout button
  document.getElementById('sidebar-logout-btn')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    sessionStorage.removeItem('shyfthatch_token');
    sessionStorage.removeItem('shyfthatch_expires');
    window.location.href = '/login';
  });
}

function _populateUserInfo() {
  const token = sessionStorage.getItem('shyfthatch_token');
  if (!token) return;
  try {
    // Decode the JWT payload (base64url middle segment — no signature verification needed client-side)
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const email = payload.email || '';
    const role  = payload.role  || 'recruiter';

    const nameEl   = document.getElementById('sidebar-user-name');
    const roleEl   = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl)   nameEl.textContent   = email.split('@')[0] || 'User';
    if (roleEl)   roleEl.textContent   = role.charAt(0).toUpperCase() + role.slice(1);
    if (avatarEl) avatarEl.textContent = (email[0] || 'U').toUpperCase();

    // Update header name + dropdown info
    const headerName = document.getElementById('header-user-name');
    if (headerName) headerName.textContent = email.split('@')[0] || 'User';

    const ddName = document.getElementById('header-dropdown-name');
    const ddRole = document.getElementById('header-dropdown-role');
    if (ddName) ddName.textContent = email.split('@')[0] || 'User';
    if (ddRole) ddRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
  } catch { /* malformed token — leave defaults */ }

  // Toggle dropdown on click
  const userInfo = document.getElementById('header-user-info');
  const dropdown = document.getElementById('header-user-dropdown');
  if (userInfo && dropdown) {
    userInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.style.display === 'block';
      dropdown.style.display = open ? 'none' : 'block';
      if (window.lucide) lucide.createIcons({ nodes: [dropdown] });
    });
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });
  }

  // Header logout button
  document.getElementById('header-logout-btn')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    sessionStorage.removeItem('shyfthatch_token');
    sessionStorage.removeItem('shyfthatch_expires');
    window.location.href = '/login';
  });
}

export function updateSidebarActive(currentPage) {
  document.querySelectorAll('.nav-item[data-key]').forEach(item => {
    const key = item.getAttribute('data-key');
    item.classList.toggle('active', key === currentPage);
  });
}
