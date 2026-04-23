import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { DataTable } from '../components/table.js';
import { escapeHtml } from '../utils/helpers.js';
import {
  formatDate,
  stageBadgeClass,
  statusBadgeClass,
  starsHtml,
  formatSource,
  debounce,
  buildQuery,
} from '../utils/helpers.js';

const SOURCES = ['linkedin', 'referral', 'careers_page', 'indeed', 'other'];
const STAGES  = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

function scoreBadgeHtml(score) {
  if (score == null) {
    return `<span class="badge badge-default" style="font-size:11px;">Unranked</span>`;
  }
  const pct   = Math.round(score);
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return `<span class="badge" style="font-size:11px;background:${color}20;color:${color};border:1px solid ${color}40;">${pct}%</span>`;
}

let state = {
  candidates: [],
  total: 0,
  page: 1,
  pages: 1,
  search: '',
  job_id: '',
  stage: '',
  source: '',
  rating_min: '',
  loading: false,
};

let jobsCache = [];

export async function render(container, params) {
  state = { ...state, page: 1, search: '', job_id: '', stage: '', source: '', rating_min: '' };

  // Load jobs list for filter dropdown
  try {
    const jd = await api.get('/jobs?per_page=100&status=open');
    jobsCache = jd.items || [];
  } catch { jobsCache = []; }

  container.innerHTML = `
    ${renderTopbar({
      title: 'Candidates',
      subtitle: 'All applicants across jobs',
      actions: `<button class="btn btn-primary" id="add-candidate-btn">
        <i data-lucide="user-plus"></i> Add Candidate
      </button>`,
    })}
    <div class="page-content">
      <!-- Filters -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:20px;">
        <div class="search-input-wrapper">
          <i data-lucide="search" class="search-icon"></i>
          <input class="form-input search-input" type="search" id="search-input"
            placeholder="Search name or email…" aria-label="Search candidates" />
        </div>
        <select class="form-select" id="job-filter" style="max-width:200px;" aria-label="Filter by job">
          <option value="">All Jobs</option>
          ${jobsCache.map(j => `<option value="${j.id}">${j.title}</option>`).join('')}
        </select>
        <select class="form-select" id="stage-filter" style="max-width:160px;" aria-label="Filter by stage">
          <option value="">All Stages</option>
          ${STAGES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select class="form-select" id="source-filter" style="max-width:160px;" aria-label="Filter by source">
          <option value="">All Sources</option>
          ${SOURCES.map(s => `<option value="${s}">${formatSource(s)}</option>`).join('')}
        </select>
        <select class="form-select" id="rating-filter" style="max-width:140px;" aria-label="Min rating">
          <option value="">Any Rating</option>
          ${[1,2,3,4,5].map(r => `<option value="${r}">${'★'.repeat(r)} & up</option>`).join('')}
        </select>
        <span id="candidates-count" class="text-muted" style="font-size:13px;margin-left:auto;"></span>
      </div>

      <div id="candidates-table-container"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  bindFilters(container);
  bindAddButton(container);
  await loadCandidates();
}

function bindFilters(container) {
  container.querySelector('#search-input')?.addEventListener('input', debounce((e) => {
    state.search = e.target.value.trim();
    state.page = 1;
    loadCandidates();
  }, 300));

  ['#job-filter', '#stage-filter', '#source-filter', '#rating-filter'].forEach((sel, i) => {
    const keys = ['job_id', 'stage', 'source', 'rating_min'];
    container.querySelector(sel)?.addEventListener('change', (e) => {
      state[keys[i]] = e.target.value;
      state.page = 1;
      loadCandidates();
    });
  });
}

function bindAddButton(container) {
  container.querySelector('#add-candidate-btn')?.addEventListener('click', () => openAddModal());
}

async function loadCandidates() {
  if (state.loading) return;
  state.loading = true;

  const tableContainer = document.getElementById('candidates-table-container');
  if (tableContainer) {
    tableContainer.innerHTML = `<div style="padding:40px;text-align:center;">
      <div class="spinner"><div class="spinner-circle"></div></div>
    </div>`;
  }

  try {
    const qs = buildQuery({
      search: state.search, job_id: state.job_id, stage: state.stage,
      source: state.source, rating_min: state.rating_min,
      page: state.page, per_page: 20,
    });
    const data = await api.get(`/candidates${qs}`);
    state.candidates = data.items || [];
    state.total = data.total || 0;
    state.page = data.page || 1;
    state.pages = data.pages || 1;

    const countEl = document.getElementById('candidates-count');
    if (countEl) countEl.textContent = `${state.total} candidate${state.total !== 1 ? 's' : ''}`;

    renderTable();
  } catch (err) {
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div class="error-state">
          <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
          <p class="error-state-title">Failed to load candidates</p>
          <p class="error-state-desc">${err.message}</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
    }
  } finally {
    state.loading = false;
  }
}

function renderTable() {
  const container = document.getElementById('candidates-table-container');
  if (!container) return;

  if (state.candidates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="users" class="empty-state-icon"></i>
        <h2 class="empty-state-title">No candidates found</h2>
        <p class="empty-state-desc">
          ${state.search || state.job_id || state.stage || state.source || state.rating_min
            ? 'No candidates match your current filters.'
            : 'Add your first candidate to get started.'}
        </p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const table = new DataTable(container, {
    columns: [
      {
        key: 'name', label: 'Candidate', sortable: true,
        render: (val, row) => `
          <div>
            <div style="font-weight:600;">${val}</div>
            <div style="font-size:12px;color:var(--text-muted);">${row.email}</div>
          </div>`,
      },
      {
        key: 'job_title', label: 'Job', sortable: true,
        render: (val) => val ? `<span style="font-size:13px;">${val}</span>` : '<span class="text-muted">—</span>',
      },
      {
        key: 'current_stage', label: 'Stage', sortable: true,
        render: (val) => `<span class="badge ${stageBadgeClass(val)}">${val}</span>`,
      },
      {
        key: 'source', label: 'Source', sortable: true,
        render: (val) => val ? `<span style="font-size:13px;color:var(--text-secondary);">${formatSource(val)}</span>` : '—',
      },
      {
        key: 'ai_match_score', label: 'AI Score', sortable: true,
        render: (val) => scoreBadgeHtml(val),
      },
      {
        key: 'id', label: 'Ghosting Risk', sortable: false,
        render: (val, row) => {
          if (['Hired','Rejected'].includes(row.current_stage)) return '<span style="color:var(--text-muted);font-size:11px;">—</span>';
          return `<span class="ghost-risk-badge" data-cid="${val}"
            style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
                   background:#f3f4f6;color:#6b7280;cursor:default;">
            <i data-lucide="loader" style="width:10px;height:10px;animation:spin 1s linear infinite;"></i>
          </span>`;
        },
      },
      {
        key: 'rating', label: 'Rating', sortable: true,
        render: (val) => starsHtml(val || 0),
      },
      {
        key: 'applied_at', label: 'Applied', sortable: true,
        render: (val) => `<span style="font-size:13px;color:var(--text-muted);">${formatDate(val)}</span>`,
      },
      {
        key: 'id', label: 'Actions', sortable: false,
        render: (val, row) => `
          <div style="display:flex;gap:6px;" data-no-row-click>
            <a href="#/candidates/${val}" class="btn btn-ghost btn-sm" aria-label="View profile">
              <i data-lucide="eye" style="width:14px;height:14px;"></i>
            </a>
            <button class="btn btn-ghost btn-sm" data-rank-candidate="${val}"
                    ${!row.job_id ? 'disabled title="Assign a job to enable AI ranking"' : ''}
                    aria-label="AI rank">
              <i data-lucide="zap" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-ghost btn-sm" data-send-email="${val}" data-name="${row.name}"
                    data-email="${row.email}" aria-label="Quick email">
              <i data-lucide="mail" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-ghost btn-sm" data-delete-candidate="${val}" data-name="${row.name}"
                    aria-label="Delete candidate">
              <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-error);"></i>
            </button>
          </div>`,
      },
    ],
    data: state.candidates,
    onRowClick: (row) => { window.location.hash = `#/candidates/${row.id}`; },
    emptyMessage: 'No candidates found',
    emptyIcon: 'users',
    pagination: {
      page: state.page,
      total: state.total,
      perPage: 20,
      onPageChange: (p) => { state.page = p; loadCandidates(); },
    },
  });

  table.render();
  if (window.lucide) lucide.createIcons({ nodes: [container] });

  // Load ghosting risk badges asynchronously (fire-and-forget)
  _loadGhostingBadges(container);

  // Quick email buttons
  container.querySelectorAll('[data-send-email]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id    = btn.getAttribute('data-send-email');
      const name  = btn.getAttribute('data-name');
      const email = btn.getAttribute('data-email');
      openQuickEmailModal({ id: parseInt(id, 10), name, email });
    });
  });

  // Rank buttons
  container.querySelectorAll('[data-rank-candidate]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-rank-candidate');
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const result = await api.post('/ai/rank-candidate', { candidate_id: parseInt(id, 10) });
        showSuccess(`AI Score: ${result.score}% — ${result.reasoning}`);
        loadCandidates();
      } catch (err) {
        showError(err.message);
        btn.classList.remove('loading'); btn.disabled = false;
      }
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-delete-candidate]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-candidate');
      const name = btn.getAttribute('data-name');
      const confirmed = await confirmModal(
        `Permanently delete <strong>${name}</strong>? This cannot be undone.`,
        { title: 'Delete Candidate', confirmLabel: 'Delete', danger: true }
      );
      if (!confirmed) return;
      try {
        await api.del(`/candidates/${id}`);
        showSuccess('Candidate deleted.');
        loadCandidates();
      } catch (err) { showError(err.message); }
    });
  });
}

function openQuickEmailModal(candidate) {
  const INTENTS = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer'];
  const fmtLabel = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const calUrl = localStorage.getItem('shyfthatch_calendar_url');

  const body = `
    <form id="qe-form" style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label">To</label>
        <input class="form-input" value="${escapeHtml(candidate.name)} &lt;${escapeHtml(candidate.email)}&gt;" disabled />
      </div>

      <div style="background:var(--bg-subtle,#f8fafc);border:1px solid var(--border-light);
                  border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                    color:var(--text-muted);display:flex;align-items:center;gap:5px;">
          <i data-lucide="sparkles" style="width:12px;height:12px;"></i> AI Composer
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <label class="form-label" style="font-size:11px;">Intent</label>
            <select class="form-select" id="qe-intent" style="font-size:13px;">
              ${INTENTS.map(i => `<option value="${i}">${fmtLabel(i)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="qe-ai-btn" style="gap:5px;white-space:nowrap;">
            <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Generate
          </button>
        </div>
        ${calUrl ? `<div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:5px;">
          <i data-lucide="calendar" style="width:11px;height:11px;color:#2563eb;"></i>
          Booking link auto-included for interview invites
        </div>` : ''}
      </div>

      <div class="form-group">
        <label class="form-label required" for="qe-subject">Subject</label>
        <input class="form-input" id="qe-subject" placeholder="Subject line…" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="qe-body">Message</label>
        <textarea class="form-input" id="qe-body" rows="7" required
                  style="resize:vertical;font-family:inherit;"
                  placeholder="Use AI to generate or write your own…"></textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="qe-cancel">Cancel</button>
    <button class="btn btn-primary" id="qe-send">
      <i data-lucide="send" style="width:14px;height:14px;"></i> Send Email
    </button>`;

  openModal(`Email — ${candidate.name}`, body, { footerHtml: footer, size: 'lg' });
  if (window.lucide) lucide.createIcons();

  document.getElementById('qe-cancel')?.addEventListener('click', closeModal);

  document.getElementById('qe-ai-btn')?.addEventListener('click', async () => {
    const intent  = document.getElementById('qe-intent')?.value || 'outreach';
    const aiBtn   = document.getElementById('qe-ai-btn');
    let context   = intent === 'interview_invite' && calUrl
      ? `Calendar booking link for candidate to schedule: ${calUrl}`
      : '';

    aiBtn.classList.add('loading'); aiBtn.disabled = true;
    try {
      const result = await api.post('/ai/compose-email', {
        candidate_name:     candidate.name,
        candidate_email:    candidate.email,
        job_title:          '',
        current_stage:      'Applied',
        intent,
        additional_context: context,
      });
      const subjEl = document.getElementById('qe-subject');
      const bodyEl = document.getElementById('qe-body');
      if (subjEl) subjEl.value = result.subject;
      if (bodyEl) bodyEl.value = result.body;
    } catch (err) {
      showError('AI compose failed: ' + err.message);
    } finally {
      aiBtn.classList.remove('loading'); aiBtn.disabled = false;
    }
  });

  document.getElementById('qe-send')?.addEventListener('click', async () => {
    const subject = document.getElementById('qe-subject')?.value.trim();
    const msg     = document.getElementById('qe-body')?.value.trim();
    if (!subject || !msg) { showError('Subject and message are required.'); return; }

    const sendBtn = document.getElementById('qe-send');
    sendBtn.classList.add('loading'); sendBtn.disabled = true;
    try {
      await api.post('/emails/send', {
        candidate_ids: [candidate.id],
        subject,
        body: msg,
      });
      showSuccess(`Email sent to ${candidate.name}.`);
      closeModal();
    } catch (err) {
      showError(err.message);
      sendBtn.classList.remove('loading'); sendBtn.disabled = false;
    }
  });
}

function openAddModal() {
  const jobOptions = jobsCache.map(j => `<option value="${j.id}">${j.title}</option>`).join('');
  const body = `
    <form id="add-candidate-form" novalidate style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label required" for="ac-name">Full Name</label>
        <input class="form-input" id="ac-name" name="name" required placeholder="Jane Smith" />
      </div>
      <div class="form-group">
        <label class="form-label required" for="ac-email">Email</label>
        <input class="form-input" id="ac-email" name="email" type="email" required placeholder="jane@example.com" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label" for="ac-phone">Phone</label>
          <input class="form-input" id="ac-phone" name="phone" placeholder="+1 555 000 0000" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ac-source">Source</label>
          <select class="form-select" id="ac-source" name="source">
            <option value="">Select source</option>
            ${SOURCES.map(s => `<option value="${s}">${formatSource(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="ac-job">Job</label>
        <select class="form-select" id="ac-job" name="job_id">
          <option value="">No job assigned</option>
          ${jobOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ac-resume-file">Resume <span style="font-weight:400;color:var(--text-muted);">(PDF or DOCX, max 5 MB)</span></label>
        <input class="form-input" id="ac-resume-file" type="file" accept=".pdf,.docx,.doc" style="padding:6px;" />
      </div>
      <div class="form-group">
        <label class="form-label" for="ac-resume">Or Resume URL</label>
        <input class="form-input" id="ac-resume" name="resume_url" type="url" placeholder="https://..." />
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="ac-cancel">Cancel</button>
    <button class="btn btn-primary" id="ac-save">
      <i data-lucide="user-plus" style="width:15px;height:15px;"></i> Add Candidate
    </button>`;

  openModal('Add Candidate', body, { footerHtml: footer, size: '' });

  document.getElementById('ac-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ac-save')?.addEventListener('click', async () => {
    const form = document.getElementById('add-candidate-form');
    const name = form.querySelector('[name=name]').value.trim();
    const email = form.querySelector('[name=email]').value.trim();
    if (!name || !email) { showError('Name and email are required.'); return; }

    const saveBtn = document.getElementById('ac-save');
    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    try {
      let resume_url  = form.querySelector('[name=resume_url]').value.trim() || null;
      let resume_text = null;

      const resumeFile = document.getElementById('ac-resume-file')?.files[0];
      if (resumeFile) {
        saveBtn.textContent = 'Uploading…';
        const fd = new FormData();
        fd.append('file', resumeFile);
        const upRes = await fetch('/api/uploads/resume', { method: 'POST', body: fd });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok) {
          throw new Error(upData.detail || 'Resume upload failed.');
        }
        resume_url  = upData.url;
        resume_text = upData.resume_text;
      }

      const payload = {
        name,
        email,
        phone:       form.querySelector('[name=phone]').value.trim() || null,
        source:      form.querySelector('[name=source]').value || null,
        job_id:      form.querySelector('[name=job_id]').value ? parseInt(form.querySelector('[name=job_id]').value, 10) : null,
        resume_url,
        resume_text,
      };
      const created = await api.post('/candidates', payload);
      showSuccess(`${created.name} added successfully.`);
      closeModal();
      loadCandidates();
    } catch (err) {
      showError(err.message);
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="user-plus" style="width:15px;height:15px;"></i> Add Candidate`;
      if (window.lucide) lucide.createIcons({ nodes: [saveBtn] });
    }
  });
}

// ── Ghosting Risk Badges ─────────────────────────────────────────────────

async function _loadGhostingBadges(container) {
  const badges = container.querySelectorAll('.ghost-risk-badge[data-cid]');
  if (!badges.length) return;

  // Fire all requests in parallel
  await Promise.allSettled([...badges].map(async (badge) => {
    const id = badge.getAttribute('data-cid');
    try {
      const risk = await api.get(`/ai/ghosting-risk/${id}`);
      const { level, level_color: color, score } = risk;
      badge.style.background = color + '18';
      badge.style.color = color;
      badge.style.borderColor = color + '40';
      badge.innerHTML = `<span title="Ghosting risk: ${score}/100 — ${level}">${_ghostIcon(level)} ${level.charAt(0).toUpperCase() + level.slice(1)}</span>`;
    } catch {
      badge.innerHTML = '—';
      badge.style.cssText = 'font-size:11px;color:var(--text-muted);';
    }
  }));
}

function _ghostIcon(level) {
  if (level === 'critical') return '🔴';
  if (level === 'high')     return '🟠';
  if (level === 'medium')   return '🟡';
  return '🟢';
}
