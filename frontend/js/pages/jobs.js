import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import {
  formatJobType,
  statusBadgeClass,
  debounce,
  buildQuery,
} from '../utils/helpers.js';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
const STATUSES = ['draft', 'open', 'closed', 'archived'];

let state = {
  jobs: [],
  total: 0,
  page: 1,
  pages: 1,
  search: '',
  status: '',
  department: '',
  view: 'grid',
  loading: false,
};

export async function render(container, params) {
  state = { ...state, page: 1, search: '', status: '', department: '' };

  container.innerHTML = `
    ${renderTopbar({
      title: 'Jobs',
      subtitle: 'Manage your job postings',
      actions: `
        <button class="btn btn-secondary btn-sm" id="view-toggle" aria-label="Toggle view">
          <i data-lucide="layout-list"></i>
        </button>
        <a href="#/jobs/new" class="btn btn-primary">
          <i data-lucide="plus"></i> Create Job
        </a>
      `,
    })}
    <div class="page-content">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:20px;">
        <div class="search-input-wrapper">
          <i data-lucide="search" class="search-icon"></i>
          <input class="form-input search-input" type="search" id="search-input"
            placeholder="Search jobs…" aria-label="Search jobs" />
        </div>
        <select class="form-select" id="status-filter" style="max-width:160px;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          ${STATUSES.map(s => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
        <select class="form-select" id="dept-filter" style="max-width:180px;" aria-label="Filter by department">
          <option value="">All Departments</option>
          ${DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
        <span id="jobs-count" class="text-muted" style="font-size:13px;margin-left:auto;"></span>
      </div>
      <div id="jobs-grid"></div>
      <div id="jobs-pagination"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  bindFilters(container);
  await loadJobs();
}

function bindFilters(container) {
  container.querySelector('#search-input')?.addEventListener('input', debounce((e) => {
    state.search = e.target.value.trim();
    state.page = 1;
    loadJobs();
  }, 300));

  container.querySelector('#status-filter')?.addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadJobs();
  });

  container.querySelector('#dept-filter')?.addEventListener('change', (e) => {
    state.department = e.target.value;
    state.page = 1;
    loadJobs();
  });

  container.querySelector('#view-toggle')?.addEventListener('click', (e) => {
    state.view = state.view === 'grid' ? 'list' : 'grid';
    const icon = e.currentTarget.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', state.view === 'grid' ? 'layout-list' : 'layout-grid');
      if (window.lucide) lucide.createIcons({ nodes: [e.currentTarget] });
    }
    renderJobs();
  });
}

async function loadJobs() {
  if (state.loading) return;
  state.loading = true;

  const grid = document.getElementById('jobs-grid');
  if (grid) {
    grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${Array(6).fill(0).map(() => `
        <div class="card" style="padding:20px;">
          <div class="skeleton skeleton-text medium" style="height:18px;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-text wide" style="height:13px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text narrow" style="height:13px;"></div>
        </div>`).join('')}
    </div>`;
  }

  try {
    const qs = buildQuery({
      status: state.status,
      department: state.department,
      search: state.search,
      page: state.page,
      per_page: 20,
    });
    const data = await api.get(`/jobs${qs}`);
    state.jobs = data.items || [];
    state.total = data.total || 0;
    state.page = data.page || 1;
    state.pages = data.pages || 1;

    const countEl = document.getElementById('jobs-count');
    if (countEl) countEl.textContent = `${state.total} job${state.total !== 1 ? 's' : ''}`;

    renderJobs();
    renderPagination();
  } catch (err) {
    const g = document.getElementById('jobs-grid');
    if (g) {
      g.innerHTML = `
        <div class="error-state">
          <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
          <p class="error-state-title">Failed to load jobs</p>
          <p class="error-state-desc">${err.message}</p>
          <button class="btn btn-secondary" onclick="window.location.reload()">Retry</button>
        </div>`;
      if (window.lucide) lucide.createIcons();
    }
  } finally {
    state.loading = false;
  }
}

function renderJobs() {
  const grid = document.getElementById('jobs-grid');
  if (!grid) return;

  if (state.jobs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="briefcase" class="empty-state-icon"></i>
        <h2 class="empty-state-title">No jobs found</h2>
        <p class="empty-state-desc">
          ${state.search || state.status || state.department
            ? 'No jobs match your filters. Try adjusting your search.'
            : 'Get started by creating your first job posting.'}
        </p>
        ${!state.search && !state.status && !state.department
          ? '<a href="#/jobs/new" class="btn btn-primary" style="margin-top:16px;">Create Job</a>'
          : ''}
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (state.view === 'grid') {
    grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${state.jobs.map(jobCardHtml).join('')}
    </div>`;
  } else {
    grid.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
      ${state.jobs.map(jobRowHtml).join('')}
    </div>`;
  }

  if (window.lucide) lucide.createIcons();
  bindJobActions(grid);
}

function bindJobActions(grid) {
  grid.querySelectorAll('[data-job-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-no-nav]')) return;
      window.location.hash = `#/jobs/${card.getAttribute('data-job-id')}`;
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.location.hash = `#/jobs/${card.getAttribute('data-job-id')}`;
    });
  });

  grid.querySelectorAll('[data-delete-job]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-job');
      const job = state.jobs.find(j => String(j.id) === id);
      const confirmed = await confirmModal(
        `Archive "<strong>${job?.title}</strong>"? It will be hidden from active listings.`,
        { title: 'Archive Job', confirmLabel: 'Archive', danger: true }
      );
      if (!confirmed) return;
      try {
        await api.del(`/jobs/${id}`);
        showSuccess('Job archived.');
        loadJobs();
      } catch (err) {
        showError(err.message);
      }
    });
  });
}

function jobCardHtml(job) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000));
  return `
    <div class="card hover-lift" data-job-id="${job.id}" role="button" tabindex="0"
         style="padding:20px;cursor:pointer;position:relative;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <span class="badge ${statusBadgeClass(job.status)}">${job.status}</span>
        <button class="btn-icon" data-delete-job="${job.id}" data-no-nav
                aria-label="Archive job" style="width:28px;height:28px;opacity:0.5;">
          <i data-lucide="archive" style="width:14px;height:14px;"></i>
        </button>
      </div>
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px;line-height:1.3;">${job.title}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
        ${job.department ? `<span class="badge badge-accent">${job.department}</span>` : ''}
        ${job.job_type ? `<span class="badge badge-default">${formatJobType(job.job_type)}</span>` : ''}
        ${job.location ? `<span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:3px;">
          <i data-lucide="map-pin" style="width:12px;height:12px;"></i>${job.location}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border-light);">
        <span style="font-size:12.5px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
          <i data-lucide="users" style="width:13px;height:13px;"></i>
          ${job.candidate_count} candidate${job.candidate_count !== 1 ? 's' : ''}
        </span>
        <span style="font-size:12px;color:var(--text-muted);">${days}d ago</span>
      </div>
    </div>`;
}

function jobRowHtml(job) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000));
  return `
    <div class="card" data-job-id="${job.id}" role="button" tabindex="0"
         style="padding:14px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:14.5px;font-weight:600;">${job.title}</span>
          <span class="badge ${statusBadgeClass(job.status)}">${job.status}</span>
          ${job.department ? `<span class="badge badge-accent">${job.department}</span>` : ''}
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          ${job.location ? `<span>${job.location}</span>` : ''}
          ${job.job_type ? `<span>${formatJobType(job.job_type)}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;color:var(--text-secondary);">${job.candidate_count} candidates</div>
        <div style="font-size:12px;color:var(--text-muted);">${days}d ago</div>
      </div>
      <button class="btn-icon" data-delete-job="${job.id}" data-no-nav aria-label="Archive">
        <i data-lucide="archive" style="width:15px;height:15px;"></i>
      </button>
    </div>`;
}

function renderPagination() {
  const el = document.getElementById('jobs-pagination');
  if (!el) return;
  if (state.pages <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:24px;">
      <button class="page-btn" data-p="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>‹</button>
      ${Array.from({ length: state.pages }, (_, i) => i + 1)
        .map(p => `<button class="page-btn ${p === state.page ? 'active' : ''}" data-p="${p}">${p}</button>`)
        .join('')}
      <button class="page-btn" data-p="${state.page + 1}" ${state.page >= state.pages ? 'disabled' : ''}>›</button>
    </div>`;

  el.querySelectorAll('[data-p]:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.getAttribute('data-p'), 10);
      loadJobs();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
