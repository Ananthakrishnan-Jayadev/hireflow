import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { formatDateTime, buildQuery } from '../utils/helpers.js';

const INTERVIEW_TYPES = ['phone_screen', 'technical', 'behavioral', 'culture_fit', 'onsite', 'final'];
const STATUSES        = ['scheduled', 'completed', 'cancelled', 'no_show'];

// ── Google Calendar deeplink builder ───────────────────────────────────
// Builds a URL that opens Google Calendar with the event pre-filled.
// No OAuth required — the user clicks Save inside Google Calendar.
function buildGCalUrl({ title, startIso, durationMin, location, description }) {
  const fmt = (iso) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const start = fmt(startIso);
  const endMs = new Date(startIso).getTime() + (durationMin || 60) * 60 * 1000;
  const end   = fmt(new Date(endMs).toISOString());

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     title,
    dates:    `${start}/${end}`,
    details:  description || '',
    location: location   || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

let state = { interviews: [], view: 'list', statusFilter: '', upcomingOnly: false, loading: false };

export async function render(container, params) {
  state = { interviews: [], view: 'list', statusFilter: '', upcomingOnly: false, loading: false };

  container.innerHTML = `
    ${renderTopbar({
      title: 'Interviews',
      subtitle: 'Schedule and track candidate interviews',
      actions: `
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
            <button class="btn btn-ghost btn-sm view-toggle active" data-view="list"
                    style="border-radius:0;border:none;gap:5px;">
              <i data-lucide="list" style="width:14px;height:14px;"></i> List
            </button>
            <button class="btn btn-ghost btn-sm view-toggle" data-view="week"
                    style="border-radius:0;border:none;border-left:1px solid var(--border);gap:5px;">
              <i data-lucide="calendar" style="width:14px;height:14px;"></i> Week
            </button>
          </div>
          <button class="btn btn-primary" id="schedule-btn">
            <i data-lucide="calendar-plus"></i> Schedule Interview
          </button>
        </div>
      `,
    })}
    <div class="page-content">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
        <select class="form-select" id="status-filter" style="max-width:160px;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          ${STATUSES.map(s => `<option value="${s}">${fmtStatus(s)}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);cursor:pointer;user-select:none;">
          <input type="checkbox" id="upcoming-only" /> Upcoming only
        </label>
        <span id="iv-count" style="font-size:13px;color:var(--text-muted);margin-left:auto;"></span>
      </div>
      <div id="iv-content"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  bindControls(container);
  await loadInterviews();
}

// ── Format helpers ─────────────────────────────────────────────────────

function fmtStatus(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtType(t) {
  if (!t) return '—';
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusBadge(s) {
  const map = { scheduled: 'badge-info', completed: 'badge-success', cancelled: 'badge-error', no_show: 'badge-warning' };
  return map[s] || 'badge-default';
}

// ── Controls ───────────────────────────────────────────────────────────

function bindControls(container) {
  container.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.getAttribute('data-view');
      renderContent();
    });
  });

  container.querySelector('#status-filter')?.addEventListener('change', async (e) => {
    state.statusFilter = e.target.value;
    await loadInterviews();
  });

  container.querySelector('#upcoming-only')?.addEventListener('change', async (e) => {
    state.upcomingOnly = e.target.checked;
    await loadInterviews();
  });

  container.querySelector('#schedule-btn')?.addEventListener('click', () => openScheduleModal());
}

// ── Data loading ───────────────────────────────────────────────────────

async function loadInterviews() {
  if (state.loading) return;
  state.loading = true;

  const content = document.getElementById('iv-content');
  if (content) content.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner"><div class="spinner-circle"></div></div></div>`;

  try {
    const qs = buildQuery({ status: state.statusFilter });
    const data = await api.get(`/interviews${qs}`);
    state.interviews = Array.isArray(data) ? data : (data.items || []);

    if (state.upcomingOnly) {
      const now = new Date();
      state.interviews = state.interviews.filter(iv => new Date(iv.scheduled_at) >= now);
    }

    const n = state.interviews.length;
    const countEl = document.getElementById('iv-count');
    if (countEl) countEl.textContent = `${n} interview${n !== 1 ? 's' : ''}`;

    renderContent();
  } catch (err) {
    const content = document.getElementById('iv-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
          <p class="error-state-title">Failed to load interviews</p>
          <p class="error-state-desc">${err.message}</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
    }
  } finally {
    state.loading = false;
  }
}

// ── Render dispatcher ──────────────────────────────────────────────────

function renderContent() {
  const content = document.getElementById('iv-content');
  if (!content) return;

  if (state.interviews.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-check" class="empty-state-icon"></i>
        <h2 class="empty-state-title">No interviews found</h2>
        <p class="empty-state-desc">
          ${state.statusFilter || state.upcomingOnly
            ? 'No interviews match the current filters.'
            : 'Schedule your first interview using the button above.'}
        </p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  state.view === 'week' ? renderWeekView(content) : renderListView(content);
  if (window.lucide) lucide.createIcons({ nodes: [content] });
  bindContentActions(content);
}

// ── List view ──────────────────────────────────────────────────────────

function renderListView(content) {
  content.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Job</th>
            <th>Interviewer</th>
            <th>Type</th>
            <th>Date & Time</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Scorecard</th>
            <th>AI Debrief</th>
            <th style="width:80px;"></th>
          </tr>
        </thead>
        <tbody>
          ${state.interviews.map(iv => `
            <tr>
              <td>
                <a href="#/candidates/${iv.candidate_id}"
                   style="font-weight:600;color:var(--accent);text-decoration:none;">
                  ${iv.candidate_name || 'Candidate #' + iv.candidate_id}
                </a>
              </td>
              <td style="font-size:13px;color:var(--text-secondary);">${iv.job_title || '—'}</td>
              <td style="font-size:13px;">${iv.interviewer_name}</td>
              <td><span class="badge badge-default">${fmtType(iv.interview_type)}</span></td>
              <td style="font-size:13px;color:var(--text-muted);white-space:nowrap;">
                ${formatDateTime(iv.scheduled_at)}
              </td>
              <td style="font-size:13px;color:var(--text-muted);">${iv.duration_min} min</td>
              <td><span class="badge ${statusBadge(iv.status)}">${fmtStatus(iv.status)}</span></td>
              <td>
                ${iv.scorecard
                  ? `<a href="#/interviews/${iv.id}/scorecard"
                        class="btn btn-ghost btn-sm" style="color:#065F46;gap:4px;">
                       <i data-lucide="clipboard-check" style="width:13px;height:13px;"></i> View
                     </a>`
                  : `<a href="#/interviews/${iv.id}/scorecard"
                        class="btn btn-ghost btn-sm" style="gap:4px;">
                       <i data-lucide="clipboard" style="width:13px;height:13px;"></i> Fill
                     </a>`}
              </td>
              <td>
                ${iv.status === 'completed'
                  ? `<button class="btn btn-ghost btn-sm debrief-btn" data-interview-id="${iv.id}"
                       data-candidate="${iv.candidate_name || ''}" data-job="${iv.job_title || ''}"
                       style="gap:4px;color:#7c3aed;"
                       title="Generate AI Debrief">
                       <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Debrief
                     </button>`
                  : `<span style="font-size:11px;color:var(--text-muted);">—</span>`}
              </td>
              <td>
                <div style="display:flex;gap:4px;">
                  <a class="btn btn-ghost btn-sm"
                     href="${buildGCalUrl({
                       title: `Interview: ${iv.candidate_name || 'Candidate'} — ${iv.job_title || 'Role'}`,
                       startIso: iv.scheduled_at,
                       durationMin: iv.duration_min,
                       location: iv.location || '',
                       description: `Interviewer: ${iv.interviewer_name}\nType: ${fmtType(iv.interview_type)}\n${iv.notes || ''}`.trim(),
                     })}"
                     target="_blank" rel="noopener"
                     title="Add to Google Calendar"
                     aria-label="Add to Google Calendar"
                     style="color:#1a73e8;">
                    <i data-lucide="calendar-plus" style="width:13px;height:13px;"></i>
                  </a>
                  <button class="btn btn-ghost btn-sm" data-edit="${iv.id}" aria-label="Edit">
                    <i data-lucide="pencil" style="width:13px;height:13px;"></i>
                  </button>
                  <button class="btn btn-ghost btn-sm" data-delete="${iv.id}"
                          data-name="${iv.candidate_name || 'this candidate'}" aria-label="Delete">
                    <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--color-error);"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Week view ──────────────────────────────────────────────────────────

function renderWeekView(content) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const byDay = {};
  state.interviews.forEach(iv => {
    const d = new Date(iv.scheduled_at);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString();
    (byDay[k] = byDay[k] || []).push(iv);
  });

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:8px;overflow-x:auto;">
      ${days.map(day => {
        const k       = day.toISOString();
        const isToday = day.getTime() === today.getTime();
        const list    = byDay[k] || [];
        return `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
            <div style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;
                        background:${isToday ? 'var(--accent)' : 'var(--bg-body)'};
                        color:${isToday ? '#fff' : 'var(--text-secondary)'};">
              ${DAY[day.getDay()]} ${day.getDate()} ${MON[day.getMonth()]}
            </div>
            <div style="padding:6px;min-height:100px;display:flex;flex-direction:column;gap:4px;background:var(--bg-card);">
              ${list.length === 0
                ? `<div style="font-size:11px;color:var(--border);text-align:center;padding:20px 0;">—</div>`
                : list.map(iv => `
                    <div style="background:var(--accent-light);border-left:3px solid var(--accent);
                                padding:5px 7px;border-radius:4px;cursor:pointer;font-size:11px;line-height:1.4;"
                         onclick="window.location.hash='#/candidates/${iv.candidate_id}'">
                      <div style="font-weight:600;color:var(--text-primary);
                                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${iv.candidate_name || 'Candidate'}
                      </div>
                      <div style="color:var(--text-muted);">
                        ${new Date(iv.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        · ${fmtType(iv.interview_type)}
                      </div>
                    </div>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Action button handlers ─────────────────────────────────────────────

function bindContentActions(content) {
  content.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const iv = state.interviews.find(i => i.id === parseInt(btn.dataset.edit, 10));
      if (iv) openEditModal(iv);
    });
  });

  content.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await confirmModal(
        `Delete the interview with <strong>${btn.dataset.name}</strong>? This cannot be undone.`,
        { title: 'Delete Interview', confirmLabel: 'Delete', danger: true }
      );
      if (!confirmed) return;
      try {
        await api.del(`/interviews/${btn.dataset.delete}`);
        showSuccess('Interview deleted.');
        state.interviews = state.interviews.filter(i => i.id !== parseInt(btn.dataset.delete, 10));
        const n = state.interviews.length;
        const el = document.getElementById('iv-count');
        if (el) el.textContent = `${n} interview${n !== 1 ? 's' : ''}`;
        renderContent();
      } catch (err) { showError(err.message); }
    });
  });

  // AI Debrief buttons
  content.querySelectorAll('.debrief-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDebriefModal(parseInt(btn.dataset.interviewId, 10));
    });
  });
}

// ── AI Interview Debrief modal ─────────────────────────────────────────

async function openDebriefModal(interviewId) {
  const iv = state.interviews.find(i => i.id === interviewId);

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.45);
    backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:20px;`;

  overlay.innerHTML = `
    <div id="debrief-modal" style="background:var(--bg-card);border-radius:16px;width:100%;max-width:600px;
         max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.25);">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;
           padding:20px 24px 16px;border-bottom:1px solid var(--border);">
        <h2 style="font-size:16px;font-weight:700;color:var(--text-primary);
             display:flex;align-items:center;gap:8px;margin:0;">
          <i data-lucide="sparkles" style="width:17px;height:17px;color:#7c3aed;"></i>
          AI Interview Debrief
          ${iv ? `<span style="font-size:12px;font-weight:500;color:var(--text-muted);margin-left:4px;">
            — ${iv.candidate_name || ''}</span>` : ''}
        </h2>
        <button id="debrief-close" style="background:none;border:none;cursor:pointer;
          padding:4px;color:var(--text-muted);">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>

      <!-- Step 1: transcript input -->
      <div id="debrief-input-step" style="padding:20px 24px 24px;">
        <p style="font-size:13.5px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          Paste the interview transcript below for the most accurate debrief.
          If you don't have one, the AI will use the saved interview notes and scorecard instead.
        </p>

        <div class="form-group">
          <label class="form-label" for="debrief-transcript" style="display:flex;align-items:center;gap:6px;">
            <i data-lucide="file-text" style="width:13px;height:13px;color:var(--text-muted);"></i>
            Interview Transcript
            <span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--text-muted);">Optional</span>
          </label>
          <textarea id="debrief-transcript" class="form-textarea" rows="10"
            style="font-size:12.5px;font-family:ui-monospace,monospace;resize:vertical;"
            placeholder="Paste the full interview transcript here…&#10;&#10;Interviewer: Tell me about your experience with distributed systems.&#10;Candidate: Sure, at my previous company I worked on…"></textarea>
          <p class="form-hint" style="margin-top:6px;">
            <i data-lucide="info" style="width:11px;height:11px;vertical-align:middle;"></i>
            Transcripts from Zoom, Google Meet, Otter.ai, or any text format work great.
          </p>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button id="debrief-cancel" class="btn btn-secondary">Cancel</button>
          <button id="debrief-generate" class="btn btn-primary" style="gap:6px;">
            <i data-lucide="sparkles" style="width:14px;height:14px;"></i>
            Generate Debrief
          </button>
        </div>
      </div>

      <!-- Step 2: result (hidden initially) -->
      <div id="debrief-result-step" style="display:none;padding:20px 24px 24px;"></div>
    </div>`;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#debrief-close').addEventListener('click', close);
  overlay.querySelector('#debrief-cancel').addEventListener('click', close);

  overlay.querySelector('#debrief-generate').addEventListener('click', async () => {
    const transcript = overlay.querySelector('#debrief-transcript').value.trim();
    const inputStep  = overlay.querySelector('#debrief-input-step');
    const resultStep = overlay.querySelector('#debrief-result-step');
    const genBtn     = overlay.querySelector('#debrief-generate');

    genBtn.disabled = true;
    genBtn.innerHTML = `<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Generating…`;
    if (window.lucide) lucide.createIcons({ nodes: [genBtn] });

    try {
      const debrief = await api.post('/ai/interview-debrief', {
        interview_id: interviewId,
        transcript:   transcript || null,
      });

      // Switch to result step
      inputStep.style.display  = 'none';
      resultStep.style.display = 'block';
      _renderDebriefBody(resultStep, debrief);
      if (window.lucide) lucide.createIcons({ nodes: [overlay] });

      // "Re-run" button wires back to the input step
      resultStep.querySelector('#debrief-redo')?.addEventListener('click', () => {
        resultStep.style.display = 'none';
        resultStep.innerHTML     = '';
        inputStep.style.display  = 'block';
        genBtn.disabled          = false;
        genBtn.innerHTML = `<i data-lucide="sparkles" style="width:14px;height:14px;"></i> Generate Debrief`;
        if (window.lucide) lucide.createIcons({ nodes: [overlay] });
      });
    } catch (err) {
      genBtn.disabled = false;
      genBtn.innerHTML = `<i data-lucide="sparkles" style="width:14px;height:14px;"></i> Generate Debrief`;
      if (window.lucide) lucide.createIcons({ nodes: [genBtn] });
      resultStep.style.display = 'block';
      resultStep.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--color-error);">
          <i data-lucide="alert-triangle" style="width:24px;height:24px;display:block;margin:0 auto 10px;"></i>
          <p style="font-size:13px;">${err.message}</p>
          <button class="btn btn-secondary" style="margin-top:12px;" onclick="this.closest('[id=debrief-modal]').querySelector('#debrief-result-step').style.display='none';
            document.getElementById('debrief-input-step') && (document.getElementById('debrief-input-step').style.display='block')">
            Try again
          </button>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [resultStep] });
    }
  });
}

function _renderDebriefBody(body, d) {
  const VERDICT_STYLES = {
    strong_yes: { color: '#16a34a', bg: '#f0fdf4', icon: 'check-circle-2' },
    yes:        { color: '#2563eb', bg: '#eff6ff', icon: 'thumbs-up'       },
    maybe:      { color: '#d97706', bg: '#fffbeb', icon: 'help-circle'     },
    no:         { color: '#dc2626', bg: '#fef2f2', icon: 'thumbs-down'     },
    strong_no:  { color: '#991b1b', bg: '#fee2e2', icon: 'x-circle'        },
  };
  const vs = VERDICT_STYLES[d.verdict] || VERDICT_STYLES.maybe;

  const strengthsHtml = d.strengths.map(s => `
    <div style="display:flex;gap:7px;margin-bottom:6px;">
      <i data-lucide="check" style="width:14px;height:14px;color:#16a34a;flex-shrink:0;margin-top:2px;"></i>
      <span style="font-size:13px;color:var(--text-secondary);">${s}</span>
    </div>`).join('');

  const concernsHtml = d.concerns.length ? d.concerns.map(c => `
    <div style="display:flex;gap:7px;margin-bottom:6px;">
      <i data-lucide="alert-circle" style="width:14px;height:14px;color:#f97316;flex-shrink:0;margin-top:2px;"></i>
      <span style="font-size:13px;color:var(--text-secondary);">${c}</span>
    </div>`).join('') : `<p style="font-size:13px;color:#16a34a;">No major concerns noted.</p>`;

  body.innerHTML = `
    <!-- Header: candidate + verdict -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${d.candidate_name}</div>
        <div style="font-size:12px;color:var(--text-muted);">for ${d.job_title}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;
             border-radius:20px;background:${vs.bg};color:${vs.color};font-size:13px;font-weight:700;">
          <i data-lucide="${vs.icon}" style="width:14px;height:14px;"></i>
          ${d.verdict_label}
        </div>
        <span style="font-size:11px;color:var(--text-muted);">${d.confidence}% confidence</span>
      </div>
    </div>

    <!-- Highlight quote -->
    ${d.highlight_quote ? `
    <div style="border-left:3px solid #7c3aed;padding:10px 14px;background:#f5f3ff;border-radius:0 8px 8px 0;
         margin-bottom:16px;font-size:13px;color:#5b21b6;font-style:italic;line-height:1.6;">
      "${d.highlight_quote}"
    </div>` : ''}

    <!-- Summary -->
    <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.65;margin-bottom:18px;">${d.summary}</p>

    <!-- Strengths + concerns -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-muted);margin-bottom:8px;">Strengths</div>
        ${strengthsHtml}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-muted);margin-bottom:8px;">Concerns</div>
        ${concernsHtml}
      </div>
    </div>

    <!-- Recommendation -->
    <div style="background:var(--bg-card-hover);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
           color:var(--text-muted);margin-bottom:6px;display:flex;align-items:center;gap:5px;">
        <i data-lucide="lightbulb" style="width:12px;height:12px;color:#d97706;"></i>
        Recommendation
      </div>
      <p style="font-size:13.5px;color:var(--text-primary);line-height:1.6;margin:0;">${d.recommendation}</p>
    </div>

    <!-- Back button to re-run with different transcript -->
    <div style="text-align:right;">
      <button id="debrief-redo" class="btn btn-ghost btn-sm" style="gap:5px;font-size:12px;">
        <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i>
        Re-run with different transcript
      </button>
    </div>`;
}

// ── Schedule modal ─────────────────────────────────────────────────────

async function openScheduleModal() {
  let candidates = [], jobs = [];
  try {
    // No status filter on jobs — interviews can be scheduled against any job
    // (draft, open, closed) since hiring may be in progress at any stage.
    const [cd, jd] = await Promise.all([
      api.get('/candidates?per_page=100'),
      api.get('/jobs?per_page=100'),
    ]);
    candidates = cd.items || [];
    jobs       = jd.items || [];
  } catch (err) {
    showError('Failed to load candidates/jobs: ' + err.message);
    return;
  }

  const dt = new Date();
  dt.setHours(dt.getHours() + 1, 0, 0, 0);
  const defaultDt = dt.toISOString().slice(0, 16);

  const body = `
    <form id="sf" novalidate style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label required" for="sf-cand">Candidate</label>
        <select class="form-select" id="sf-cand" name="candidate_id" required>
          <option value="">Select candidate…</option>
          ${candidates.map(c =>
            `<option value="${c.id}" data-job-id="${c.job_id || ''}">${c.name} — ${c.email}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required" for="sf-job">Job</label>
        <select class="form-select" id="sf-job" name="job_id" required>
          <option value="">Select job…</option>
          ${jobs.map(j => `<option value="${j.id}">${j.title}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="sf-iwr">Interviewer Name</label>
          <input class="form-input" id="sf-iwr" name="interviewer_name" required placeholder="Jane Smith" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sf-type">Type</label>
          <select class="form-select" id="sf-type" name="interview_type">
            <option value="">Select type…</option>
            ${INTERVIEW_TYPES.map(t => `<option value="${t}">${fmtType(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="sf-dt">Date & Time</label>
          <input class="form-input" id="sf-dt" name="scheduled_at" type="datetime-local"
                 required value="${defaultDt}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sf-dur">Duration</label>
          <select class="form-select" id="sf-dur" name="duration_min">
            <option value="30">30 min</option><option value="45">45 min</option>
            <option value="60" selected>60 min</option>
            <option value="90">90 min</option><option value="120">120 min</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="sf-loc">Location / Meeting Link</label>
        <input class="form-input" id="sf-loc" name="location"
               placeholder="Room A / https://meet.google.com/…" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sf-notes">Notes</label>
        <textarea class="form-input" id="sf-notes" name="notes" rows="2"
                  style="resize:vertical;font-family:inherit;"
                  placeholder="Topics to cover, what to prepare…"></textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="sf-cancel">Cancel</button>
    <button class="btn btn-primary" id="sf-save">
      <i data-lucide="calendar-plus" style="width:15px;height:15px;"></i> Schedule
    </button>`;

  openModal('Schedule Interview', body, { footerHtml: footer, size: 'lg' });
  if (window.lucide) lucide.createIcons();

  // Auto-fill job when candidate is selected
  document.getElementById('sf-cand')?.addEventListener('change', (e) => {
    const jobId = e.target.selectedOptions[0]?.getAttribute('data-job-id');
    if (jobId) document.getElementById('sf-job').value = jobId;
  });

  document.getElementById('sf-cancel')?.addEventListener('click', closeModal);
  document.getElementById('sf-save')?.addEventListener('click', async () => {
    const form        = document.getElementById('sf');
    const candidateId = parseInt(form.querySelector('[name=candidate_id]').value, 10);
    const jobId       = parseInt(form.querySelector('[name=job_id]').value, 10);
    const interviewer = form.querySelector('[name=interviewer_name]').value.trim();
    const dt          = form.querySelector('[name=scheduled_at]').value;

    if (!candidateId || !jobId || !interviewer || !dt) {
      showError('Candidate, job, interviewer, and date/time are required.');
      return;
    }
    const saveBtn = document.getElementById('sf-save');
    saveBtn.classList.add('loading'); saveBtn.disabled = true;

    const interviewType = form.querySelector('[name=interview_type]').value || null;
    const durationMin   = parseInt(form.querySelector('[name=duration_min]').value, 10);
    const location      = form.querySelector('[name=location]').value.trim() || null;
    const notes         = form.querySelector('[name=notes]').value.trim() || null;
    const startIso      = new Date(dt).toISOString();

    // Find candidate name + job title for calendar event title
    const candEl    = form.querySelector('[name=candidate_id]');
    const candName  = candEl.selectedOptions[0]?.text?.split(' — ')[0] || 'Candidate';
    const jobEl     = form.querySelector('[name=job_id]');
    const jobTitle  = jobEl.selectedOptions[0]?.text || 'Role';

    try {
      await api.post('/interviews', {
        candidate_id:     candidateId,
        job_id:           jobId,
        interviewer_name: interviewer,
        interview_type:   interviewType,
        scheduled_at:     startIso,
        duration_min:     durationMin,
        location,
        notes,
      });

      closeModal();
      await loadInterviews();

      // Build Google Calendar deeplink and show calendar prompt
      const gcalUrl = buildGCalUrl({
        title:       `Interview: ${candName} — ${jobTitle}`,
        startIso,
        durationMin,
        location:    location || '',
        description: `Interviewer: ${interviewer}\nType: ${interviewType ? fmtType(interviewType) : 'Interview'}${notes ? '\n\n' + notes : ''}`,
      });

      showCalendarPrompt(gcalUrl, candName, startIso, durationMin);
    } catch (err) {
      showError(err.message);
      saveBtn.classList.remove('loading'); saveBtn.disabled = false;
    }
  });
}

// ── Google Calendar prompt ─────────────────────────────────────────────

function showCalendarPrompt(gcalUrl, candidateName, startIso, durationMin) {
  const dateStr = new Date(startIso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const body = `
    <div style="text-align:center;padding:8px 0;">
      <div style="width:56px;height:56px;border-radius:50%;
                  background:linear-gradient(135deg,#1a73e8,#34a853);
                  display:flex;align-items:center;justify-content:center;
                  margin:0 auto 16px;">
        <i data-lucide="calendar-check" style="width:26px;height:26px;color:#fff;"></i>
      </div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">
        Interview Scheduled!
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.5;">
        <strong>${candidateName}</strong><br>
        ${dateStr} · ${durationMin} min
      </div>
      <a href="${gcalUrl}" target="_blank" rel="noopener"
         class="btn btn-primary"
         style="gap:8px;display:inline-flex;align-items:center;text-decoration:none;
                background:linear-gradient(135deg,#1a73e8,#1558b0);font-size:14px;
                padding:10px 22px;border-radius:8px;">
        <i data-lucide="calendar-plus" style="width:16px;height:16px;"></i>
        Add to Google Calendar
      </a>
      <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
        Opens Google Calendar with the event pre-filled — just click Save.
      </div>
    </div>`;

  const footer = `<button class="btn btn-secondary" id="gcal-skip-btn">Skip</button>`;
  openModal('Add to Calendar', body, { footerHtml: footer, size: 'sm' });
  if (window.lucide) lucide.createIcons();
  document.getElementById('gcal-skip-btn')?.addEventListener('click', closeModal);
}

// ── Edit modal ─────────────────────────────────────────────────────────

function openEditModal(iv) {
  const dtLocal = new Date(iv.scheduled_at).toISOString().slice(0, 16);

  const body = `
    <form id="ef" style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="ef-iwr">Interviewer</label>
          <input class="form-input" id="ef-iwr" name="interviewer_name"
                 required value="${iv.interviewer_name}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-type">Type</label>
          <select class="form-select" id="ef-type" name="interview_type">
            <option value="">Select type…</option>
            ${INTERVIEW_TYPES.map(t =>
              `<option value="${t}" ${iv.interview_type === t ? 'selected' : ''}>${fmtType(t)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="ef-dt">Date & Time</label>
          <input class="form-input" id="ef-dt" name="scheduled_at"
                 type="datetime-local" required value="${dtLocal}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-dur">Duration</label>
          <select class="form-select" id="ef-dur" name="duration_min">
            ${[30,45,60,90,120].map(m =>
              `<option value="${m}" ${iv.duration_min === m ? 'selected' : ''}>${m} min</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="ef-status">Status</label>
        <select class="form-select" id="ef-status" name="status">
          ${STATUSES.map(s =>
            `<option value="${s}" ${iv.status === s ? 'selected' : ''}>${fmtStatus(s)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ef-loc">Location / Link</label>
        <input class="form-input" id="ef-loc" name="location" value="${iv.location || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="ef-notes">Notes</label>
        <textarea class="form-input" id="ef-notes" name="notes" rows="2"
                  style="resize:vertical;font-family:inherit;">${iv.notes || ''}</textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="ef-cancel">Cancel</button>
    <button class="btn btn-primary" id="ef-save">
      <i data-lucide="save" style="width:15px;height:15px;"></i> Save Changes
    </button>`;

  openModal('Edit Interview', body, { footerHtml: footer });
  if (window.lucide) lucide.createIcons();

  document.getElementById('ef-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ef-save')?.addEventListener('click', async () => {
    const form    = document.getElementById('ef');
    const saveBtn = document.getElementById('ef-save');
    saveBtn.classList.add('loading'); saveBtn.disabled = true;
    try {
      const updated = await api.put(`/interviews/${iv.id}`, {
        interviewer_name: form.querySelector('[name=interviewer_name]').value.trim(),
        interview_type:   form.querySelector('[name=interview_type]').value || null,
        scheduled_at:     new Date(form.querySelector('[name=scheduled_at]').value).toISOString(),
        duration_min:     parseInt(form.querySelector('[name=duration_min]').value, 10),
        status:           form.querySelector('[name=status]').value,
        location:         form.querySelector('[name=location]').value.trim() || null,
        notes:            form.querySelector('[name=notes]').value.trim() || null,
      });
      showSuccess('Interview updated.');
      closeModal();
      const idx = state.interviews.findIndex(i => i.id === iv.id);
      if (idx !== -1) state.interviews[idx] = { ...state.interviews[idx], ...updated };
      renderContent();
    } catch (err) {
      showError(err.message);
      saveBtn.classList.remove('loading'); saveBtn.disabled = false;
    }
  });
}
