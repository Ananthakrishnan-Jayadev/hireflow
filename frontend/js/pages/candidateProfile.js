import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { showPageLoader } from '../components/loader.js';
import {
  formatDate, formatDateTime, timeAgo,
  starsHtml, stageBadgeClass, formatSource,
} from '../utils/helpers.js';

const STAGES  = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
const SOURCES = ['linkedin', 'referral', 'careers_page', 'indeed', 'other'];

// Module-level so re-renders can find the container
let _container = null;

export async function render(container, params) {
  _container = container;
  const candidateId = params[0];
  if (!candidateId) { window.location.hash = '#/candidates'; return; }

  showPageLoader(container);

  let candidate;
  try {
    candidate = await api.get(`/candidates/${candidateId}`);
  } catch (err) {
    container.innerHTML = `
      <div class="error-state" style="margin-top:80px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <p class="error-state-title">${err.status === 404 ? 'Candidate not found' : 'Failed to load candidate'}</p>
        <p class="error-state-desc">${err.message}</p>
        <a href="#/candidates" class="btn btn-secondary" style="margin-top:16px;">Back to Candidates</a>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  renderPage(container, candidate);
}

function renderPage(container, candidate) {
  container.innerHTML = `
    ${renderTopbar({
      title: candidate.name,
      breadcrumbs: [
        { label: 'Candidates', href: '#/candidates' },
        { label: candidate.name },
      ],
      actions: `
        <button class="btn btn-secondary" id="cp-edit-btn">
          <i data-lucide="pencil" style="width:15px;height:15px;"></i> Edit
        </button>
        <button class="btn btn-ghost" id="cp-email-btn">
          <i data-lucide="mail" style="width:15px;height:15px;"></i> Email
        </button>
        <button class="btn btn-ghost" id="cp-delete-btn" style="color:var(--color-error);">
          <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        </button>
      `,
    })}

    <!-- Sub-header strip -->
    <div style="padding:12px 32px;background:var(--bg-card);border-bottom:1px solid var(--border);
                display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span class="badge ${stageBadgeClass(candidate.current_stage)}">${candidate.current_stage}</span>
      ${candidate.source ? `<span class="badge badge-accent">${formatSource(candidate.source)}</span>` : ''}
      <span style="font-size:13px;color:var(--text-muted);">${candidate.email}</span>
      ${candidate.phone ? `<span style="font-size:13px;color:var(--text-muted);">${candidate.phone}</span>` : ''}
      <span style="display:flex;align-items:center;gap:4px;">${starsHtml(candidate.rating)}</span>
      <button class="btn btn-primary btn-sm" id="cp-move-stage-btn" style="margin-left:auto;">
        <i data-lucide="arrow-right-circle" style="width:14px;height:14px;"></i> Move Stage
      </button>
    </div>

    <div class="page-content">
      <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start;">

        <!-- Left column -->
        <div>
          ${renderNotesCard(candidate)}
          ${renderActivityCard(candidate)}
          ${renderInterviewsCard(candidate)}
          ${renderEmailsCard(candidate)}
        </div>

        <!-- Right sidebar -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${renderInfoCard(candidate)}
          <!-- Ghosting risk card (loaded async) -->
          <div id="ghosting-risk-card"></div>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  bindActions(container, candidate);

  // Load ghosting risk async (non-blocking)
  if (!['Hired','Rejected'].includes(candidate.current_stage)) {
    _loadGhostingRiskCard(candidate.id);
  }
}

// ── Cards ─────────────────────────────────────────────────────────────

function renderNotesCard(candidate) {
  return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="card-title">Notes</span>
        <button class="btn btn-ghost btn-sm" id="cp-edit-notes-btn">
          <i data-lucide="edit-3" style="width:13px;height:13px;"></i> Edit
        </button>
      </div>
      <div class="card-body">
        <div id="notes-display" style="font-size:14px;line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;">
          ${candidate.notes
            ? candidate.notes
            : '<span style="color:var(--text-muted);font-style:italic;">No notes yet. Click Edit to add notes.</span>'}
        </div>
        <div id="notes-edit" style="display:none;">
          <textarea class="form-input" id="notes-textarea" rows="5"
            style="resize:vertical;width:100%;box-sizing:border-box;font-family:inherit;"
            placeholder="Add notes about this candidate…">${candidate.notes || ''}</textarea>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-primary btn-sm" id="notes-save-btn">Save Notes</button>
            <button class="btn btn-ghost btn-sm" id="notes-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderActivityCard(candidate) {
  const activities = candidate.activities || [];
  if (activities.length === 0) return '';

  const iconMap = {
    candidate_applied:    'user-plus',
    stage_change:         'arrow-right',
    note_added:           'file-text',
    email_sent:           'mail',
    interview_scheduled:  'calendar',
  };

  return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Activity Timeline</span></div>
      <div class="card-body" style="padding:0;">
        ${activities.map((act, i) => `
          <div style="display:flex;gap:12px;padding:12px 20px;
                      ${i < activities.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--border-light);
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
              <i data-lucide="${iconMap[act.activity_type] || 'activity'}"
                 style="width:13px;height:13px;color:var(--text-secondary);"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13.5px;color:var(--text-primary);line-height:1.4;">${act.content}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${timeAgo(act.created_at)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderInterviewsCard(candidate) {
  const interviews = candidate.interviews || [];
  if (interviews.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Interviews</span></div>
      <div class="card-body" style="padding:0;">
        ${interviews.map((iv, i) => `
          <div style="padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;
                      ${i < interviews.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
            <div>
              <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);">
                ${iv.interviewer_name}
                <span class="badge badge-default" style="margin-left:6px;font-size:11px;">
                  ${(iv.interview_type || 'interview').replace('_', ' ')}
                </span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                ${formatDateTime(iv.scheduled_at)} · ${iv.duration_min} min
                ${iv.location ? `· ${iv.location}` : ''}
              </div>
            </div>
            <span class="badge badge-default">${iv.status}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderEmailsCard(candidate) {
  const emails = candidate.email_logs || [];
  if (emails.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Email History</span></div>
      <div class="card-body" style="padding:0;">
        ${emails.map((em, i) => `
          <div style="padding:12px 20px;
                      ${i < emails.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${em.subject}
              </div>
              <span class="badge badge-default" style="flex-shrink:0;">${em.status}</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${formatDateTime(em.sent_at)}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderInfoCard(candidate) {
  return `
    <div class="card">
      <div class="card-header"><span class="card-title">Details</span></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
        ${infoRow('mail', 'Email', `<a href="mailto:${candidate.email}" style="color:var(--accent);">${candidate.email}</a>`)}
        ${infoRow('phone', 'Phone', candidate.phone || '—')}
        ${infoRow('briefcase', 'Job', candidate.job_title
            ? `<a href="#/jobs/${candidate.job_id}" style="color:var(--accent);">${candidate.job_title}</a>`
            : '—')}
        ${infoRow('layers', 'Stage', `<span class="badge ${stageBadgeClass(candidate.current_stage)}">${candidate.current_stage}</span>`)}
        ${infoRow('star', 'Rating', starsHtml(candidate.rating))}
        ${infoRow('globe', 'Source', candidate.source ? formatSource(candidate.source) : '—')}
        ${infoRow('calendar', 'Applied', formatDate(candidate.applied_at))}
        ${candidate.resume_url
          ? infoRow('file-text', 'Resume', `<a href="${candidate.resume_url}" target="_blank" rel="noopener" style="color:var(--accent);">View Resume ↗</a>`)
          : ''}
      </div>
    </div>
    ${renderAiScoreCard(candidate)}
    ${candidate.tags && candidate.tags.length > 0 ? `
    <div class="card">
      <div class="card-header"><span class="card-title">Tags</span></div>
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:6px;">
        ${candidate.tags.map(t => `<span class="badge badge-default">${t}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

function renderAiScoreCard(candidate) {
  const score = candidate.ai_match_score;
  let badgeHtml;
  if (score == null) {
    badgeHtml = `<span class="badge badge-default" style="font-size:13px;">Unranked</span>`;
  } else {
    const pct   = Math.round(score);
    const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
    badgeHtml = `<span class="badge" style="font-size:15px;font-weight:700;background:${color}20;color:${color};border:1px solid ${color}40;">${pct}%</span>`;
  }
  return `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="card-title">AI Match Score</span>
        <button class="btn btn-ghost btn-sm" id="cp-rank-btn"
                ${!candidate.job_id ? 'disabled title="Assign a job to enable AI ranking"' : ''}>
          <i data-lucide="zap" style="width:13px;height:13px;"></i>
          ${score == null ? 'Rank' : 'Re-rank'}
        </button>
      </div>
      <div class="card-body" id="ai-score-body">
        ${badgeHtml}
        ${!candidate.job_id ? '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Assign a job to enable AI ranking.</p>' : ''}
      </div>
    </div>`;
}

function infoRow(icon, label, value) {
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <i data-lucide="${icon}" style="width:15px;height:15px;color:var(--text-muted);margin-top:2px;flex-shrink:0;"></i>
      <div>
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${label}</div>
        <div style="font-size:13.5px;color:var(--text-primary);font-weight:500;">${value}</div>
      </div>
    </div>`;
}

// ── Event binding ──────────────────────────────────────────────────────

function bindActions(container, candidate) {
  /* Notes: toggle edit mode */
  container.querySelector('#cp-edit-notes-btn')?.addEventListener('click', () => {
    container.querySelector('#notes-display').style.display = 'none';
    container.querySelector('#notes-edit').style.display    = 'block';
    container.querySelector('#notes-textarea')?.focus();
  });

  container.querySelector('#notes-cancel-btn')?.addEventListener('click', () => {
    container.querySelector('#notes-display').style.display = 'block';
    container.querySelector('#notes-edit').style.display    = 'none';
  });

  container.querySelector('#notes-save-btn')?.addEventListener('click', async () => {
    const notes   = container.querySelector('#notes-textarea')?.value ?? '';
    const saveBtn = container.querySelector('#notes-save-btn');
    saveBtn.classList.add('loading'); saveBtn.disabled = true;
    try {
      const updated = await api.put(`/candidates/${candidate.id}`, { notes });
      candidate.notes = updated.notes;
      const display = container.querySelector('#notes-display');
      display.innerHTML = updated.notes
        || '<span style="color:var(--text-muted);font-style:italic;">No notes yet. Click Edit to add notes.</span>';
      display.style.display = 'block';
      container.querySelector('#notes-edit').style.display = 'none';
      showSuccess('Notes saved.');
    } catch (err) {
      showError(err.message);
    } finally {
      saveBtn.classList.remove('loading'); saveBtn.disabled = false;
    }
  });

  /* AI rank */
  container.querySelector('#cp-rank-btn')?.addEventListener('click', async () => {
    const rankBtn = container.querySelector('#cp-rank-btn');
    rankBtn.classList.add('loading'); rankBtn.disabled = true;
    try {
      const result = await api.post('/ai/rank-candidate', { candidate_id: candidate.id });
      candidate.ai_match_score = result.score;
      showSuccess(`AI Score: ${result.score}% — ${result.reasoning}`);
      const scoreBody = container.querySelector('#ai-score-body');
      if (scoreBody) {
        const pct   = Math.round(result.score);
        const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
        scoreBody.innerHTML = `<span class="badge" style="font-size:15px;font-weight:700;background:${color}20;color:${color};border:1px solid ${color}40;">${pct}%</span>`;
      }
      rankBtn.innerHTML = `<i data-lucide="zap" style="width:13px;height:13px;"></i> Re-rank`;
      if (window.lucide) lucide.createIcons({ nodes: [rankBtn] });
    } catch (err) {
      showError(err.message);
    } finally {
      rankBtn.classList.remove('loading'); rankBtn.disabled = false;
    }
  });

  /* Edit candidate modal */
  container.querySelector('#cp-edit-btn')?.addEventListener('click', () => openEditModal(candidate));

  /* Move stage modal */
  container.querySelector('#cp-move-stage-btn')?.addEventListener('click', () => openMoveStageModal(candidate));

  /* Quick email modal */
  container.querySelector('#cp-email-btn')?.addEventListener('click', () => openEmailModal(candidate));

  /* Delete */
  container.querySelector('#cp-delete-btn')?.addEventListener('click', async () => {
    const confirmed = await confirmModal(
      `Permanently delete <strong>${candidate.name}</strong>? This cannot be undone.`,
      { title: 'Delete Candidate', confirmLabel: 'Delete', danger: true }
    );
    if (!confirmed) return;
    try {
      await api.del(`/candidates/${candidate.id}`);
      showSuccess('Candidate deleted.');
      window.location.hash = '#/candidates';
    } catch (err) { showError(err.message); }
  });
}

// ── Modals ─────────────────────────────────────────────────────────────

function openEditModal(candidate) {
  const body = `
    <form id="edit-candidate-form" novalidate style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="ec-name">Full Name</label>
          <input class="form-input" id="ec-name" name="name" required value="${candidate.name}" />
        </div>
        <div class="form-group">
          <label class="form-label required" for="ec-email">Email</label>
          <input class="form-input" id="ec-email" name="email" type="email" required value="${candidate.email}" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label" for="ec-phone">Phone</label>
          <input class="form-input" id="ec-phone" name="phone" value="${candidate.phone || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ec-source">Source</label>
          <select class="form-select" id="ec-source" name="source">
            <option value="">Select source</option>
            ${SOURCES.map(s => `<option value="${s}" ${candidate.source === s ? 'selected' : ''}>${formatSource(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="ec-resume">Resume URL</label>
        <input class="form-input" id="ec-resume" name="resume_url" type="url"
               placeholder="https://…" value="${candidate.resume_url || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="ec-rating">Rating</label>
        <select class="form-select" id="ec-rating" name="rating" style="max-width:160px;">
          ${[0,1,2,3,4,5].map(r => `
            <option value="${r}" ${candidate.rating === r ? 'selected' : ''}>
              ${r === 0 ? 'No rating' : '★'.repeat(r) + ' (' + r + ')'}
            </option>`).join('')}
        </select>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="ec-cancel">Cancel</button>
    <button class="btn btn-primary" id="ec-save">
      <i data-lucide="save" style="width:15px;height:15px;"></i> Save Changes
    </button>`;

  openModal('Edit Candidate', body, { footerHtml: footer });
  if (window.lucide) lucide.createIcons();

  document.getElementById('ec-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ec-save')?.addEventListener('click', async () => {
    const form  = document.getElementById('edit-candidate-form');
    const name  = form.querySelector('[name=name]').value.trim();
    const email = form.querySelector('[name=email]').value.trim();
    if (!name || !email) { showError('Name and email are required.'); return; }

    const saveBtn = document.getElementById('ec-save');
    saveBtn.classList.add('loading'); saveBtn.disabled = true;

    try {
      const payload = {
        name,
        email,
        phone:      form.querySelector('[name=phone]').value.trim() || null,
        source:     form.querySelector('[name=source]').value || null,
        resume_url: form.querySelector('[name=resume_url]').value.trim() || null,
        rating:     parseInt(form.querySelector('[name=rating]').value, 10),
      };
      await api.put(`/candidates/${candidate.id}`, payload);
      showSuccess('Candidate updated.');
      closeModal();
      // Reload the whole profile
      const updated = await api.get(`/candidates/${candidate.id}`);
      if (_container) renderPage(_container, updated);
    } catch (err) {
      showError(err.message);
      saveBtn.classList.remove('loading'); saveBtn.disabled = false;
    }
  });
}

function openMoveStageModal(candidate) {
  const current = candidate.current_stage;
  const body = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px;">
        Current stage: <span class="badge ${stageBadgeClass(current)}">${current}</span>
      </p>
      ${STAGES.filter(s => s !== current).map(s => `
        <button class="btn btn-secondary stage-option" data-stage="${s}"
                style="justify-content:flex-start;gap:10px;text-align:left;">
          <span class="badge ${stageBadgeClass(s)}" style="min-width:80px;justify-content:center;">${s}</span>
        </button>`).join('')}
    </div>`;

  openModal('Move to Stage', body, {
    footerHtml: '<button class="btn btn-secondary" id="ms-cancel">Cancel</button>',
  });

  document.getElementById('ms-cancel')?.addEventListener('click', closeModal);

  document.querySelectorAll('.stage-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newStage = btn.getAttribute('data-stage');
      btn.classList.add('loading'); btn.disabled = true;
      try {
        await api.put('/pipeline/move', { candidate_id: candidate.id, new_stage: newStage });
        showSuccess(`Moved to ${newStage}.`);
        closeModal();
        const updated = await api.get(`/candidates/${candidate.id}`);
        if (_container) renderPage(_container, updated);
      } catch (err) {
        showError(err.message);
        btn.classList.remove('loading'); btn.disabled = false;
      }
    });
  });
}

function openEmailModal(candidate, prefillIntent = '') {
  const INTENTS = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer'];
  const fmtLabel = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const calUrl  = localStorage.getItem('shyfthatch_calendar_url');

  const body = `
    <form id="quick-email-form" style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label">To</label>
        <input class="form-input" value="${candidate.name} &lt;${candidate.email}&gt;" disabled />
      </div>

      <!-- AI Compose strip -->
      <div style="background:var(--bg-subtle,#f8fafc);border:1px solid var(--border-light);
                  border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                    color:var(--text-muted);display:flex;align-items:center;gap:5px;">
          <i data-lucide="sparkles" style="width:12px;height:12px;"></i> AI Composer
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <label class="form-label" for="qe-intent" style="font-size:11px;">Intent</label>
            <select class="form-select" id="qe-intent" style="font-size:13px;">
              <option value="">Select intent…</option>
              ${INTENTS.map(i => `<option value="${i}" ${i === prefillIntent ? 'selected' : ''}>${fmtLabel(i)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="qe-ai-btn" style="gap:5px;white-space:nowrap;">
            <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Generate
          </button>
        </div>
        ${calUrl ? `
          <div id="qe-cal-hint" style="font-size:11.5px;color:var(--text-muted);
               display:flex;align-items:center;gap:5px;">
            <i data-lucide="calendar" style="width:11px;height:11px;color:#2563eb;flex-shrink:0;"></i>
            Booking link auto-included for interview invites
          </div>` : ''}
      </div>

      <div class="form-group">
        <label class="form-label required" for="qe-subject">Subject</label>
        <input class="form-input" id="qe-subject" placeholder="Re: Your application…" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="qe-body">Message</label>
        <textarea class="form-input" id="qe-body" rows="6" required
                  style="resize:vertical;font-family:inherit;"
                  placeholder="Write your message or use AI to generate…"></textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="qe-cancel">Cancel</button>
    <button class="btn btn-primary" id="qe-send">
      <i data-lucide="send" style="width:14px;height:14px;"></i> Send Email
    </button>`;

  openModal('Send Email', body, { footerHtml: footer, size: 'lg' });
  if (window.lucide) lucide.createIcons();

  document.getElementById('qe-cancel')?.addEventListener('click', closeModal);

  // AI generate button
  document.getElementById('qe-ai-btn')?.addEventListener('click', async () => {
    const intent = document.getElementById('qe-intent')?.value;
    if (!intent) { showError('Select an intent first.'); return; }

    let additionalContext = '';
    if (intent === 'interview_invite' && calUrl) {
      additionalContext = `Calendar booking link for candidate to schedule: ${calUrl}`;
    }

    const aiBtn = document.getElementById('qe-ai-btn');
    aiBtn.classList.add('loading'); aiBtn.disabled = true;

    try {
      const result = await api.post('/ai/compose-email', {
        candidate_name:     candidate.name,
        candidate_email:    candidate.email,
        job_title:          candidate.job_title || 'the position',
        current_stage:      candidate.current_stage || 'Applied',
        intent,
        additional_context: additionalContext,
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

// ── Ghosting Risk Card ────────────────────────────────────────────────────

async function _loadGhostingRiskCard(candidateId) {
  const wrap = document.getElementById('ghosting-risk-card');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:6px;">
        <i data-lucide="ghost" style="width:15px;height:15px;color:#f97316;"></i> Ghosting Risk
      </span></div>
      <div class="card-body" style="display:flex;justify-content:center;padding:20px;">
        <div class="spinner"><div class="spinner-circle"></div></div>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });

  try {
    const risk = await api.get(`/ai/ghosting-risk/${candidateId}`);
    _renderGhostingCard(wrap, risk);
  } catch {
    wrap.innerHTML = '';
  }
}

function _renderGhostingCard(wrap, risk) {
  const { score, level, level_color: color, factors, days_in_stage, days_since_email, touchpoints } = risk;

  const LEVEL_LABELS = { low: 'Low Risk', medium: 'Moderate Risk', high: 'High Risk', critical: 'Critical Risk' };
  const label = LEVEL_LABELS[level] || level;

  const factorsHtml = factors.length
    ? factors.map(f => `
        <div style="display:flex;gap:8px;margin-bottom:8px;padding:8px 10px;
             border-radius:7px;background:${color}0d;border:1px solid ${color}25;">
          <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;margin-top:5px;"></div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${f.label}</div>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-top:1px;">${f.description}</div>
          </div>
        </div>`).join('')
    : `<p style="font-size:12.5px;color:#16a34a;text-align:center;padding:8px 0;">
         ✓ No risk signals detected
       </p>`;

  wrap.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:6px;">
        <i data-lucide="ghost" style="width:15px;height:15px;color:${color};"></i> Ghosting Risk
      </span></div>
      <div class="card-body">
        <!-- Score ring -->
        <div style="text-align:center;margin-bottom:14px;">
          <div style="display:inline-flex;flex-direction:column;align-items:center;
               width:80px;height:80px;border-radius:50%;
               border:4px solid ${color};justify-content:center;">
            <span style="font-size:22px;font-weight:800;color:${color};">${score}</span>
            <span style="font-size:10px;color:var(--text-muted);">/ 100</span>
          </div>
          <div style="margin-top:8px;font-size:13px;font-weight:700;color:${color};">${label}</div>
        </div>

        <!-- Quick stats -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:var(--bg-card-hover);border-radius:7px;padding:8px;text-align:center;">
            <div style="font-size:17px;font-weight:700;color:var(--text-primary);">${days_in_stage}</div>
            <div style="font-size:10px;color:var(--text-muted);">days in stage</div>
          </div>
          <div style="background:var(--bg-card-hover);border-radius:7px;padding:8px;text-align:center;">
            <div style="font-size:17px;font-weight:700;color:var(--text-primary);">${touchpoints}</div>
            <div style="font-size:10px;color:var(--text-muted);">touchpoints</div>
          </div>
        </div>

        <!-- Risk factors -->
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-muted);margin-bottom:8px;">Risk Factors</div>
        ${factorsHtml}
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });
}
