import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { showPageLoader } from '../components/loader.js';
import {
  formatDate,
  formatSalaryRange,
  statusBadgeClass,
  stageBadgeClass,
  starsHtml,
  formatJobType,
  timeAgo,
} from '../utils/helpers.js';

let activeTab = 'overview';

export async function render(container, params) {
  const jobId = params[0];
  if (!jobId) { window.location.hash = '#/jobs'; return; }

  activeTab = 'overview';
  showPageLoader(container);

  let job;
  try {
    job = await api.get(`/jobs/${jobId}`);
  } catch (err) {
    container.innerHTML = `
      <div class="error-state" style="margin-top:80px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <p class="error-state-title">${err.status === 404 ? 'Job not found' : 'Failed to load job'}</p>
        <p class="error-state-desc">${err.message}</p>
        <a href="#/jobs" class="btn btn-secondary" style="margin-top:16px;">Back to Jobs</a>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  renderPage(container, job);
}

function renderPage(container, job) {
  const totalCandidates = Object.values(job.stage_counts || {}).reduce((s, v) => s + v, 0);
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000));

  container.innerHTML = `
    ${renderTopbar({
      title: job.title,
      breadcrumbs: [{ label: 'Jobs', href: '#/jobs' }, { label: job.title }],
      actions: `
        <a href="#/jobs/${job.id}/edit" class="btn btn-secondary">
          <i data-lucide="pencil" style="width:15px;height:15px;"></i> Edit
        </a>
      `,
    })}

    <!-- Job header info -->
    <div style="padding:16px 32px;background:var(--bg-card);border-bottom:1px solid var(--border);
                display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <span class="badge ${statusBadgeClass(job.status)}" style="font-size:12px;">${job.status}</span>
      ${job.department ? `<span class="badge badge-accent">${job.department}</span>` : ''}
      ${job.job_type ? `<span class="badge badge-default">${formatJobType(job.job_type)}</span>` : ''}
      ${job.location ? `
        <span style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
          <i data-lucide="map-pin" style="width:13px;height:13px;"></i>${job.location}
        </span>` : ''}
      <span style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
        <i data-lucide="users" style="width:13px;height:13px;"></i>${totalCandidates} candidates
      </span>
      <span style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
        <i data-lucide="calendar" style="width:13px;height:13px;"></i>Posted ${daysOpen}d ago
      </span>
    </div>

    <!-- Tabs -->
    <div class="tabs" style="padding:0 32px;background:var(--bg-card);border-bottom:1px solid var(--border);">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="candidates">
        Candidates
        ${totalCandidates > 0 ? `<span class="badge badge-default" style="margin-left:6px;">${totalCandidates}</span>` : ''}
      </button>
      <button class="tab" data-tab="pipeline">Pipeline</button>
      <button class="tab" data-tab="interviews">Interviews</button>
      <button class="tab" data-tab="talent-pool" style="display:flex;align-items:center;gap:5px;">
        <i data-lucide="zap" style="width:13px;height:13px;color:#2563eb;"></i> Talent Pool
      </button>
    </div>

    <!-- Tab content -->
    <div id="tab-content" class="page-content page-enter"></div>
  `;

  if (window.lucide) lucide.createIcons();
  bindTabs(container, job);
  renderTab('overview', job);
}

function bindTabs(container, job) {
  container.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      activeTab = tab;
      renderTab(tab, job);
    });
  });
}

async function renderTab(tab, job) {
  const content = document.getElementById('tab-content');
  if (!content) return;

  switch (tab) {
    case 'overview':    renderOverview(content, job);          break;
    case 'candidates':  await renderCandidates(content, job);  break;
    case 'pipeline':    renderPipeline(content, job);          break;
    case 'interviews':  await renderInterviews(content, job);  break;
    case 'talent-pool': renderTalentPool(content, job);        break;
  }

  if (window.lucide) lucide.createIcons();
}

// ── Overview tab ───────────────────────────────────────────────────
function renderOverview(content, job) {
  const salary = formatSalaryRange(job.salary_min, job.salary_max);

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 280px;gap:24px;align-items:start;">
      <div>
        ${job.description ? `
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><span class="card-title">Job Description</span></div>
            <div class="card-body">
              <div style="font-size:14px;line-height:1.8;color:var(--text-secondary);white-space:pre-wrap;">${job.description}</div>
            </div>
          </div>` : ''}

        ${job.requirements ? `
          <div class="card">
            <div class="card-header"><span class="card-title">Requirements</span></div>
            <div class="card-body">
              <div style="font-size:14px;line-height:1.8;color:var(--text-secondary);white-space:pre-wrap;">${job.requirements}</div>
            </div>
          </div>` : ''}

        ${!job.description && !job.requirements ? `
          <div class="empty-state">
            <i data-lucide="file-text" class="empty-state-icon"></i>
            <h2 class="empty-state-title">No description yet</h2>
            <p class="empty-state-desc">Add a job description to help candidates understand the role.</p>
            <a href="#/jobs/${job.id}/edit" class="btn btn-primary">Edit Job</a>
          </div>` : ''}
      </div>

      <!-- Right sidebar -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card">
          <div class="card-header"><span class="card-title">Details</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
            ${infoRow('briefcase', 'Type', formatJobType(job.job_type) || '—')}
            ${infoRow('map-pin', 'Location', job.location || '—')}
            ${infoRow('building-2', 'Department', job.department || '—')}
            ${infoRow('dollar-sign', 'Salary', salary)}
            ${infoRow('calendar', 'Posted', formatDate(job.created_at))}
            ${infoRow('clock', 'Updated', job.updated_at ? timeAgo(job.updated_at) : '—')}
          </div>
        </div>

        ${Object.keys(job.stage_counts || {}).length > 0 ? `
          <div class="card">
            <div class="card-header"><span class="card-title">Pipeline</span></div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
              ${(job.pipeline_stages || []).map(stage => {
                const cnt = (job.stage_counts || {})[stage] || 0;
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge ${stageBadgeClass(stage)}">${stage}</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${cnt}</span>
                  </div>`;
              }).join('')}
            </div>
          </div>` : ''}
      </div>
    </div>
  `;
}

function infoRow(icon, label, value) {
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <i data-lucide="${icon}" style="width:15px;height:15px;color:var(--text-muted);margin-top:1px;flex-shrink:0;"></i>
      <div>
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${label}</div>
        <div style="font-size:13.5px;color:var(--text-primary);font-weight:500;">${value}</div>
      </div>
    </div>`;
}

// ── Candidates tab ─────────────────────────────────────────────────
async function renderCandidates(content, job) {
  content.innerHTML = `<div class="page-loader"><div class="spinner"><div class="spinner-circle"></div></div></div>`;

  try {
    const data = await api.get(`/candidates?job_id=${job.id}&per_page=50`);
    const candidates = data.items || [];

    if (candidates.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users" class="empty-state-icon"></i>
          <h2 class="empty-state-title">No candidates yet</h2>
          <p class="empty-state-desc">Candidates will appear here once they apply or are added manually.</p>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Stage</th>
              <th>Rating</th>
              <th>Source</th>
              <th>Applied</th>
            </tr>
          </thead>
          <tbody>
            ${candidates.map(c => `
              <tr class="clickable" onclick="window.location.hash='#/candidates/${c.id}'">
                <td><strong>${c.name}</strong></td>
                <td style="color:var(--text-secondary);">${c.email}</td>
                <td><span class="badge ${stageBadgeClass(c.current_stage)}">${c.current_stage}</span></td>
                <td>${starsHtml(c.rating)}</td>
                <td style="color:var(--text-muted);">${c.source || '—'}</td>
                <td style="color:var(--text-muted);">${formatDate(c.applied_at)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <h2 class="empty-state-title">Failed to load candidates</h2>
        <p class="empty-state-desc">${err.message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()" style="margin-top:16px;">Retry</button>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  }
}

// ── Pipeline tab ───────────────────────────────────────────────────
function renderPipeline(content, job) {
  const stages = job.pipeline_stages || [];
  const stageCounts = job.stage_counts || {};

  if (stages.length === 0) {
    content.innerHTML = `<div class="empty-state"><p class="empty-state-title">No pipeline stages defined.</p></div>`;
    return;
  }

  content.innerHTML = `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
      Pipeline summary for <strong>${job.title}</strong>.
      Full drag-and-drop pipeline is available on the
      <a href="#/pipeline/${job.id}">Pipeline page</a>.
    </p>
    <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">
      ${stages.map(stage => {
        const count = stageCounts[stage] || 0;
        return `
          <div class="kanban-column" data-stage="${stage}" style="min-width:180px;flex-shrink:0;">
            <div class="kanban-column-header">
              <span class="kanban-column-name">${stage}</span>
              <span class="kanban-column-count">${count}</span>
            </div>
            <div style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center;">
              ${count === 0 ? 'Empty' : `${count} candidate${count !== 1 ? 's' : ''}`}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Talent Pool tab ────────────────────────────────────────────────
function renderTalentPool(content, job) {
  content.innerHTML = `
    <div style="max-width:760px;">
      <!-- Header card -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;
                                      gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px;
                        display:flex;align-items:center;gap:7px;">
              <i data-lucide="zap" style="width:15px;height:15px;color:#2563eb;"></i>
              Proactive Talent Matching
            </div>
            <div style="font-size:13px;color:var(--text-secondary);max-width:480px;line-height:1.5;">
              Find the best candidates already in your database who match this role —
              including previously interviewed candidates and high-scorers from other pipelines.
            </div>
          </div>
          <button class="btn btn-primary" id="find-matches-btn" style="gap:7px;white-space:nowrap;">
            <i data-lucide="search" style="width:14px;height:14px;"></i>
            Find Matches
          </button>
        </div>
      </div>

      <div id="talent-pool-results"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons({ nodes: [content] });

  let talentLoaded = false;
  content.querySelector('#find-matches-btn')?.addEventListener('click', () => {
    if (talentLoaded) return;
    talentLoaded = true;
    loadTalentMatches(content, job).catch(() => { talentLoaded = false; });
  });
}

async function loadTalentMatches(content, job) {
  const btn = content.querySelector('#find-matches-btn');
  const resultsEl = content.querySelector('#talent-pool-results');
  if (!resultsEl) return;

  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  resultsEl.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
      <div class="spinner" style="margin:0 auto 16px;"><div class="spinner-circle"></div></div>
      <div style="font-size:13px;">AI is scoring candidates against this role…</div>
      <div style="font-size:11.5px;margin-top:4px;color:var(--text-muted);">This may take 20–40 seconds</div>
    </div>`;

  try {
    const data = await api.post('/ai/talent-pool-match', { job_id: job.id, limit: 10 });
    const matches = data.matches || [];

    if (matches.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users" class="empty-state-icon"></i>
          <h2 class="empty-state-title">No matches found</h2>
          <p class="empty-state-desc">
            No other candidates with resumes exist in the database yet.
            As more candidates apply to other roles, they will appear here.
          </p>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [resultsEl] });
      return;
    }

    resultsEl.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
        Found <strong>${matches.length}</strong> candidate${matches.length !== 1 ? 's' : ''} from your talent pool
        ranked against <strong>${job.title}</strong>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${matches.map((m, i) => talentMatchCardHtml(m, i)).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons({ nodes: [resultsEl] });

    resultsEl.querySelectorAll('[data-reach-out]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-reach-out'), 10);
        openTalentReachOutModal(matches[idx], job);
      });
    });
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <h2 class="empty-state-title">Failed to load matches</h2>
        <p class="empty-state-desc">${err.message}</p>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [resultsEl] });
    throw err;
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

function scoreBadge(score) {
  const pct   = Math.round(score);
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return `<span class="badge" style="font-size:12px;font-weight:700;background:${color}20;
    color:${color};border:1px solid ${color}40;min-width:44px;text-align:center;">${pct}%</span>`;
}

function talentMatchCardHtml(m, idx) {
  return `
    <div class="card" style="padding:14px 16px;">
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">

        <!-- Rank number -->
        <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#06b6d4);
                    display:flex;align-items:center;justify-content:center;
                    font-size:11px;font-weight:800;color:#fff;flex-shrink:0;margin-top:2px;">
          ${idx + 1}
        </div>

        <!-- Info -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <a href="#/candidates/${m.candidate_id}"
               style="font-size:14px;font-weight:700;color:var(--text-primary);text-decoration:none;">
              ${m.name}
            </a>
            ${scoreBadge(m.ai_match_score)}
            ${m.previously_vetted ? `
              <span class="badge" style="font-size:10.5px;background:#8b5cf620;color:#8b5cf6;
                    border:1px solid #8b5cf640;display:flex;align-items:center;gap:3px;">
                <i data-lucide="star" style="width:10px;height:10px;"></i> Previously Vetted
              </span>` : ''}
            <span class="badge ${stageBadgeClass(m.current_stage)}" style="font-size:10.5px;">
              ${m.current_stage}
            </span>
          </div>

          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;
                      display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="display:flex;align-items:center;gap:3px;">
              <i data-lucide="mail" style="width:11px;height:11px;"></i>${m.email}
            </span>
            ${m.previous_job_title ? `
              <span style="display:flex;align-items:center;gap:3px;">
                <i data-lucide="briefcase" style="width:11px;height:11px;"></i>
                From: ${m.previous_job_title}
              </span>` : ''}
          </div>

          <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;
                      background:var(--bg-subtle,#f8fafc);border-radius:6px;padding:7px 10px;
                      border-left:3px solid #2563eb;">
            ${m.reasoning}
          </div>

          ${m.tags && m.tags.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;">
              ${m.tags.map(t => `<span class="badge badge-default" style="font-size:10px;">${t}</span>`).join('')}
            </div>` : ''}
        </div>

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <button class="btn btn-primary btn-sm" data-reach-out="${idx}"
                  style="gap:5px;white-space:nowrap;">
            <i data-lucide="send" style="width:13px;height:13px;"></i> Reach Out
          </button>
          <a href="#/candidates/${m.candidate_id}" class="btn btn-ghost btn-sm"
             style="gap:5px;white-space:nowrap;">
            <i data-lucide="eye" style="width:13px;height:13px;"></i> View Profile
          </a>
        </div>
      </div>
    </div>`;
}

function openTalentReachOutModal(match, job) {
  const INTENTS = ['outreach', 'interview_invite', 'follow_up', 'offer', 'rejection'];
  const fmtLabel = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const calUrl = localStorage.getItem('shyfthatch_calendar_url');

  const body = `
    <form id="tp-email-form" style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label">To</label>
        <input class="form-input" value="${match.name} &lt;${match.email}&gt;" disabled />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <input class="form-input" value="${job.title}" disabled />
      </div>

      <!-- AI strip -->
      <div style="background:var(--bg-subtle,#f8fafc);border:1px solid var(--border-light);
                  border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                    color:var(--text-muted);display:flex;align-items:center;gap:5px;">
          <i data-lucide="sparkles" style="width:12px;height:12px;"></i> AI Composer
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <label class="form-label" style="font-size:11px;">Intent</label>
            <select class="form-select" id="tp-intent" style="font-size:13px;">
              ${INTENTS.map(i => `<option value="${i}" ${i === 'outreach' ? 'selected' : ''}>${fmtLabel(i)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="tp-ai-btn" style="gap:5px;white-space:nowrap;">
            <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Generate
          </button>
        </div>
        ${calUrl ? `
          <div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:5px;">
            <i data-lucide="calendar" style="width:11px;height:11px;color:#2563eb;flex-shrink:0;"></i>
            Booking link auto-included for interview invites
          </div>` : ''}
      </div>

      <div class="form-group">
        <label class="form-label required" for="tp-subject">Subject</label>
        <input class="form-input" id="tp-subject" placeholder="Exciting opportunity at ${job.title}…" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="tp-body">Message</label>
        <textarea class="form-input" id="tp-body" rows="7" required
                  style="resize:vertical;font-family:inherit;"
                  placeholder="Use AI to generate or write your own…"></textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="tp-cancel">Cancel</button>
    <button class="btn btn-primary" id="tp-send">
      <i data-lucide="send" style="width:14px;height:14px;"></i> Send Email
    </button>`;

  openModal(`Reach Out — ${match.name}`, body, { footerHtml: footer, size: 'lg' });
  if (window.lucide) lucide.createIcons();

  document.getElementById('tp-cancel')?.addEventListener('click', closeModal);

  document.getElementById('tp-ai-btn')?.addEventListener('click', async () => {
    const intent = document.getElementById('tp-intent')?.value || 'outreach';
    let additionalContext = `This candidate is being considered for: ${job.title}.`;
    if (intent === 'interview_invite' && calUrl) {
      additionalContext += ` Calendar booking link: ${calUrl}`;
    }

    const aiBtn = document.getElementById('tp-ai-btn');
    aiBtn.classList.add('loading'); aiBtn.disabled = true;

    try {
      const result = await api.post('/ai/compose-email', {
        candidate_name:     match.name,
        candidate_email:    match.email,
        job_title:          job.title,
        current_stage:      match.current_stage || 'Applied',
        intent,
        additional_context: additionalContext,
      });
      const subjEl = document.getElementById('tp-subject');
      const bodyEl = document.getElementById('tp-body');
      if (subjEl) subjEl.value = result.subject;
      if (bodyEl) bodyEl.value = result.body;
    } catch (err) {
      showError('AI compose failed: ' + err.message);
    } finally {
      aiBtn.classList.remove('loading'); aiBtn.disabled = false;
    }
  });

  document.getElementById('tp-send')?.addEventListener('click', async () => {
    const subject = document.getElementById('tp-subject')?.value.trim();
    const msg     = document.getElementById('tp-body')?.value.trim();
    if (!subject || !msg) { showError('Subject and message are required.'); return; }

    const sendBtn = document.getElementById('tp-send');
    sendBtn.classList.add('loading'); sendBtn.disabled = true;

    try {
      await api.post('/emails/send', {
        candidate_ids: [match.candidate_id],
        subject,
        body: msg,
      });
      showSuccess(`Email sent to ${match.name}.`);
      closeModal();
    } catch (err) {
      showError(err.message);
      sendBtn.classList.remove('loading'); sendBtn.disabled = false;
    }
  });
}

// ── Interviews tab ─────────────────────────────────────────────────
async function renderInterviews(content, job) {
  content.innerHTML = `<div class="page-loader"><div class="spinner"><div class="spinner-circle"></div></div></div>`;

  try {
    const interviews = await api.get(`/interviews?job_id=${job.id}`);
    const list = Array.isArray(interviews) ? interviews : (interviews.items || []);

    if (list.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i data-lucide="calendar-check" class="empty-state-icon"></i>
          <h2 class="empty-state-title">No interviews scheduled</h2>
          <p class="empty-state-desc">Interviews for candidates in this job will appear here.</p>
          <a href="#/interviews" class="btn btn-primary">Go to Interviews</a>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Candidate</th><th>Interviewer</th><th>Type</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${list.map(iv => `
              <tr>
                <td><strong>${iv.candidate_name || iv.candidate_id}</strong></td>
                <td>${iv.interviewer_name}</td>
                <td><span class="badge badge-default">${(iv.interview_type || '').replace('_', ' ')}</span></td>
                <td style="color:var(--text-muted);">${formatDate(iv.scheduled_at)}</td>
                <td><span class="badge badge-default">${iv.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <h2 class="empty-state-title">Failed to load interviews</h2>
        <p class="empty-state-desc">${err.message}</p>
        <a href="#/interviews" class="btn btn-secondary" style="margin-top:16px;">Go to Interviews</a>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  }
}
