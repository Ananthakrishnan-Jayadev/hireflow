import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { formatDate, formatDateTime, debounce } from '../utils/helpers.js';
import { attachBiasAuditor } from '../components/biasAuditor.js';

const TEMPLATE_TYPES = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer', 'custom'];
const INTENTS        = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer'];

let activeTab       = 'compose';
let candidates      = [];
let selected        = new Set();
let templates       = [];
let candidateSearch = '';

export async function render(container, params) {
  activeTab       = 'compose';
  selected        = new Set();
  candidates      = [];
  templates       = [];
  candidateSearch = '';

  container.innerHTML = `
    ${renderTopbar({
      title: 'Email Outreach',
      subtitle: 'Compose and send emails to candidates',
    })}
    <div class="tabs" style="padding:0 32px;background:var(--bg-card);border-bottom:1px solid var(--border);">
      <button class="tab active" data-tab="compose">
        <i data-lucide="send" style="width:14px;height:14px;"></i> Compose
      </button>
      <button class="tab" data-tab="templates">
        <i data-lucide="layout-template" style="width:14px;height:14px;"></i> Templates
      </button>
      <button class="tab" data-tab="sent">
        <i data-lucide="mail-check" style="width:14px;height:14px;"></i> Sent
      </button>
    </div>
    <div id="email-tab-content" class="page-content page-enter"></div>
  `;

  if (window.lucide) lucide.createIcons();

  container.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderTab();
    });
  });

  try {
    const [cd, td] = await Promise.all([
      api.get('/candidates?per_page=100'),
      api.get('/emails/templates'),
    ]);
    candidates = cd.items || [];
    templates  = Array.isArray(td) ? td : [];
  } catch (err) {
    showError('Failed to load data: ' + err.message);
  }

  renderTab();
}

// ── Tab dispatcher ─────────────────────────────────────────────────────

function renderTab() {
  const content = document.getElementById('email-tab-content');
  if (!content) return;
  switch (activeTab) {
    case 'compose':   renderCompose(content);   break;
    case 'templates': renderTemplates(content); break;
    case 'sent':      renderSent(content);      break;
  }
  if (window.lucide) lucide.createIcons({ nodes: [content] });
}

// ── COMPOSE tab ────────────────────────────────────────────────────────

function renderCompose(content) {
  const filtered = candidates.filter(c =>
    !candidateSearch ||
    c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 420px;gap:24px;align-items:start;">

      <!-- Candidate picker -->
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span class="card-title">Select Recipients</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:13px;color:var(--text-muted);" id="sel-count">${selected.size} selected</span>
            <button class="btn btn-ghost btn-sm" id="select-all-btn">Select All</button>
            <button class="btn btn-ghost btn-sm" id="clear-sel-btn">Clear</button>
          </div>
        </div>
        <div class="card-body" style="padding:12px;">
          <input class="form-input" id="cand-search" placeholder="Search candidates…"
                 value="${candidateSearch}" style="margin-bottom:10px;" />
          ${filtered.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
                 ${candidateSearch ? 'No candidates match.' : 'No candidates found.'}
               </div>`
            : `<div style="max-height:380px;overflow-y:auto;">
                 <table class="data-table" style="font-size:13px;">
                   <thead>
                     <tr>
                       <th style="width:36px;"><input type="checkbox" id="check-all" /></th>
                       <th>Name</th><th>Email</th><th>Stage</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${filtered.map(c => `
                       <tr style="cursor:pointer;" data-cid="${c.id}">
                         <td><input type="checkbox" class="cand-check" data-id="${c.id}"
                                    ${selected.has(c.id) ? 'checked' : ''} /></td>
                         <td style="font-weight:600;">${c.name}</td>
                         <td style="color:var(--text-muted);font-size:12px;">${c.email}</td>
                         <td><span class="badge badge-default" style="font-size:10px;">${c.current_stage}</span></td>
                       </tr>`).join('')}
                   </tbody>
                 </table>
               </div>`}
        </div>
      </div>

      <!-- Composer -->
      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- Template picker -->
        <div class="card">
          <div class="card-header"><span class="card-title">Template</span></div>
          <div class="card-body">
            <select class="form-select" id="template-picker">
              <option value="">No template — compose manually</option>
              ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- AI Composer -->
        <div class="card">
          <div class="card-header"><span class="card-title">AI Composer ✨</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px;">
            <div class="form-group">
              <label class="form-label" for="ai-intent">Intent</label>
              <select class="form-select" id="ai-intent">
                <option value="">Select intent…</option>
                ${INTENTS.map(i => `<option value="${i}">${fmtLabel(i)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ai-context">Additional Context</label>
              <textarea class="form-input" id="ai-context" rows="2"
                        style="resize:vertical;font-family:inherit;"
                        placeholder="Interview on Monday at 3pm, role is Backend Engineer…"></textarea>
            </div>
            <div id="calendar-url-hint" style="display:none;font-size:11.5px;color:var(--text-muted);
                 background:var(--bg-subtle,#f8fafc);border:1px solid var(--border-light);
                 border-radius:6px;padding:7px 10px;display:flex;align-items:center;gap:6px;">
              <i data-lucide="calendar" style="width:12px;height:12px;flex-shrink:0;color:#2563eb;"></i>
              <span id="calendar-url-hint-text"></span>
            </div>
            <button class="btn btn-secondary" id="ai-compose-btn" style="gap:6px;">
              <i data-lucide="sparkles" style="width:14px;height:14px;"></i> Compose with AI
            </button>
          </div>
        </div>

        <!-- Message -->
        <div class="card">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <span class="card-title">Message</span>
            <span style="font-size:11px;color:var(--text-muted);">
              Use <code>{{candidate_name}}</code> <code>{{job_title}}</code>
            </span>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
            <div class="form-group">
              <label class="form-label required" for="email-subject">Subject</label>
              <input class="form-input" id="email-subject" placeholder="Subject line…" />
            </div>
            <div class="form-group">
              <label class="form-label required" for="email-body">Body</label>
              <textarea class="form-input" id="email-body" rows="8"
                        style="resize:vertical;font-family:inherit;"
                        placeholder="Hi {{candidate_name}},&#10;&#10;…"></textarea>
            </div>
            <!-- Bias auditor -->
            <div id="email-bias-wrap"></div>

            <button class="btn btn-primary" id="send-email-btn" style="gap:6px;">
              <i data-lucide="send" style="width:15px;height:15px;"></i>
              Send to <span id="send-count">${selected.size}</span> candidate${selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  bindComposeActions(content);

  // Bias auditor on email body
  attachBiasAuditor({
    getTextFn: () => {
      const subj = document.getElementById('email-subject')?.value || '';
      const body = document.getElementById('email-body')?.value || '';
      return `${subj}\n\n${body}`;
    },
    containerId: 'email-bias-wrap',
  });
}

function fmtLabel(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function updateSelUI() {
  const selCount  = document.getElementById('sel-count');
  const sendCount = document.getElementById('send-count');
  if (selCount)  selCount.textContent  = `${selected.size} selected`;
  if (sendCount) sendCount.textContent = String(selected.size);
}

function bindComposeActions(content) {
  // Search
  content.querySelector('#cand-search')?.addEventListener('input', debounce((e) => {
    candidateSearch = e.target.value;
    renderTab();
  }, 250));

  // Select all visible
  content.querySelector('#select-all-btn')?.addEventListener('click', () => {
    const filtered = candidates.filter(c =>
      !candidateSearch ||
      c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(candidateSearch.toLowerCase())
    );
    filtered.forEach(c => selected.add(c.id));
    renderTab();
  });

  // Clear
  content.querySelector('#clear-sel-btn')?.addEventListener('click', () => {
    selected.clear(); renderTab();
  });

  // Header checkbox
  content.querySelector('#check-all')?.addEventListener('change', (e) => {
    content.querySelectorAll('.cand-check').forEach(cb => {
      const id = parseInt(cb.dataset.id, 10);
      if (e.target.checked) selected.add(id); else selected.delete(id);
      cb.checked = e.target.checked;
    });
    updateSelUI();
  });

  // Per-row checkboxes
  content.querySelectorAll('.cand-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id, 10);
      if (cb.checked) selected.add(id); else selected.delete(id);
      updateSelUI();
    });
  });

  // Row click
  content.querySelectorAll('tr[data-cid]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const cb = row.querySelector('.cand-check');
      cb.checked = !cb.checked;
      const id = parseInt(cb.dataset.id, 10);
      if (cb.checked) selected.add(id); else selected.delete(id);
      updateSelUI();
    });
  });

  // Template → fill subject/body
  content.querySelector('#template-picker')?.addEventListener('change', (e) => {
    const tmpl = templates.find(t => t.id === parseInt(e.target.value, 10));
    if (tmpl) {
      const subj = content.querySelector('#email-subject');
      const body = content.querySelector('#email-body');
      if (subj) subj.value = tmpl.subject;
      if (body) body.value = tmpl.body;
    }
  });

  // Auto-inject calendar URL hint when intent changes to interview_invite
  content.querySelector('#ai-intent')?.addEventListener('change', (e) => {
    const calUrl = localStorage.getItem('shyfthatch_calendar_url');
    const hint   = content.querySelector('#calendar-url-hint');
    const hintTxt = content.querySelector('#calendar-url-hint-text');
    if (!hint) return;
    if (e.target.value === 'interview_invite' && calUrl) {
      hint.style.display = 'flex';
      if (hintTxt) hintTxt.textContent = `Booking link will be included: ${calUrl}`;
      if (window.lucide) lucide.createIcons({ nodes: [hint] });
    } else {
      hint.style.display = 'none';
    }
  });

  // AI Compose
  content.querySelector('#ai-compose-btn')?.addEventListener('click', async () => {
    const intent     = content.querySelector('#ai-intent')?.value;
    let   context    = content.querySelector('#ai-context')?.value?.trim() || '';
    if (!intent) { showError('Select an intent before composing.'); return; }

    // Append calendar booking URL for interview invites
    if (intent === 'interview_invite') {
      const calUrl = localStorage.getItem('shyfthatch_calendar_url');
      if (calUrl) {
        context = context
          ? `${context}\n\nCalendar booking link: ${calUrl}`
          : `Calendar booking link for candidate to schedule: ${calUrl}`;
      }
    }

    const firstId   = [...selected][0];
    const firstCand = candidates.find(c => c.id === firstId);
    const candName  = firstCand?.name  || 'the candidate';
    const jobTitle  = firstCand?.job_title || 'the position';

    const btn = content.querySelector('#ai-compose-btn');
    btn.classList.add('loading'); btn.disabled = true;

    try {
      const result = await api.post('/ai/compose-email', {
        candidate_name:     candName,
        candidate_email:    firstCand?.email || 'candidate@example.com',
        job_title:          jobTitle,
        current_stage:      firstCand?.current_stage || 'Applied',
        intent,
        additional_context: context,
      });

      // Replace the real candidate name with the variable for bulk sending
      const escaped = candName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re      = new RegExp(escaped, 'g');
      const subjectEl = content.querySelector('#email-subject');
      const bodyEl    = content.querySelector('#email-body');
      if (subjectEl) subjectEl.value = result.subject.replace(re, '{{candidate_name}}');
      if (bodyEl)    bodyEl.value    = result.body.replace(re, '{{candidate_name}}');
      showSuccess('AI email composed. Review and edit before sending.');
    } catch (err) {
      showError(err.message);
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  });

  // Send
  content.querySelector('#send-email-btn')?.addEventListener('click', async () => {
    const subject = content.querySelector('#email-subject')?.value?.trim();
    const body    = content.querySelector('#email-body')?.value?.trim();
    const tmplId  = parseInt(content.querySelector('#template-picker')?.value, 10) || null;

    if (!subject || !body) { showError('Subject and body are required.'); return; }
    if (selected.size === 0) { showError('Select at least one candidate.'); return; }

    const sendBtn = content.querySelector('#send-email-btn');
    sendBtn.classList.add('loading'); sendBtn.disabled = true;

    try {
      const result = await api.post('/emails/send', {
        candidate_ids: [...selected],
        template_id:   tmplId,
        subject,
        body,
      });
      const msg = result.failed > 0
        ? `Sent to ${result.sent}, failed for ${result.failed}.`
        : `Sent to ${result.sent} candidate${result.sent !== 1 ? 's' : ''}.`;
      showSuccess(msg);
      selected.clear();
      renderTab();
    } catch (err) {
      showError(err.message);
      sendBtn.classList.remove('loading'); sendBtn.disabled = false;
    }
  });
}

// ── TEMPLATES tab ──────────────────────────────────────────────────────

function renderTemplates(content) {
  const typeColor = {
    outreach:        'badge-info',
    follow_up:       'badge-default',
    interview_invite:'badge-purple',
    rejection:       'badge-error',
    offer:           'badge-success',
    custom:          'badge-accent',
  };

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-primary" id="create-tmpl-btn">
        <i data-lucide="plus"></i> New Template
      </button>
    </div>
    ${templates.length === 0
      ? `<div class="empty-state">
           <i data-lucide="layout-template" class="empty-state-icon"></i>
           <h2 class="empty-state-title">No templates yet</h2>
           <p class="empty-state-desc">Create reusable email templates to speed up outreach.</p>
         </div>`
      : `<div class="table-wrapper">
           <table class="data-table">
             <thead>
               <tr>
                 <th>Name</th><th>Type</th><th>Subject</th><th>Updated</th>
                 <th style="width:90px;"></th>
               </tr>
             </thead>
             <tbody>
               ${templates.map(t => `
                 <tr>
                   <td style="font-weight:600;">${t.name}</td>
                   <td><span class="badge ${typeColor[t.template_type] || 'badge-default'}">
                     ${fmtLabel(t.template_type || 'custom')}
                   </span></td>
                   <td style="font-size:13px;color:var(--text-secondary);max-width:240px;
                               white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                     ${t.subject}
                   </td>
                   <td style="font-size:12px;color:var(--text-muted);">
                     ${formatDate(t.updated_at || t.created_at)}
                   </td>
                   <td>
                     <div style="display:flex;gap:4px;">
                       <button class="btn btn-ghost btn-sm" data-edit-tmpl="${t.id}" aria-label="Edit">
                         <i data-lucide="pencil" style="width:13px;height:13px;"></i>
                       </button>
                       <button class="btn btn-ghost btn-sm" data-del-tmpl="${t.id}"
                               data-name="${t.name}" aria-label="Delete">
                         <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--color-error);"></i>
                       </button>
                     </div>
                   </td>
                 </tr>`).join('')}
             </tbody>
           </table>
         </div>`}
  `;

  if (window.lucide) lucide.createIcons({ nodes: [content] });

  content.querySelector('#create-tmpl-btn')?.addEventListener('click', () => openTemplateModal());

  content.querySelectorAll('[data-edit-tmpl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tmpl = templates.find(t => t.id === parseInt(btn.dataset.editTmpl, 10));
      if (tmpl) openTemplateModal(tmpl);
    });
  });

  content.querySelectorAll('[data-del-tmpl]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmModal(
        `Delete template <strong>${btn.dataset.name}</strong>? This cannot be undone.`,
        { title: 'Delete Template', confirmLabel: 'Delete', danger: true }
      );
      if (!confirmed) return;
      try {
        await api.del(`/emails/templates/${btn.dataset.delTmpl}`);
        templates = templates.filter(t => t.id !== parseInt(btn.dataset.delTmpl, 10));
        showSuccess('Template deleted.');
        renderTab();
      } catch (err) { showError(err.message); }
    });
  });
}

function openTemplateModal(existing = null) {
  const isEdit = !!existing;
  const VARS   = ['{{candidate_name}}', '{{job_title}}'];

  const varButtons = (targetId) =>
    VARS.map(v =>
      `<code class="var-btn" data-var="${v}" data-target="${targetId}"
             style="cursor:pointer;padding:1px 4px;border-radius:3px;
                    background:var(--border-light);font-size:11px;">${v}</code>`
    ).join(' ');

  const body = `
    <form id="tmpl-form" style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label required" for="tf-name">Template Name</label>
          <input class="form-input" id="tf-name" name="name" required
                 placeholder="Initial Outreach" value="${existing?.name || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="tf-type">Type</label>
          <select class="form-select" id="tf-type" name="template_type">
            <option value="">Select type…</option>
            ${TEMPLATE_TYPES.map(t =>
              `<option value="${t}" ${existing?.template_type === t ? 'selected' : ''}>${fmtLabel(t)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
          <label class="form-label required" style="margin:0;" for="tf-subject">Subject</label>
          <div style="display:flex;gap:4px;">${varButtons('tf-subject')}</div>
        </div>
        <input class="form-input" id="tf-subject" name="subject" required
               placeholder="Re: Your application for {{job_title}}"
               value="${existing?.subject || ''}" />
      </div>
      <div class="form-group">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
          <label class="form-label required" style="margin:0;" for="tf-body">Body</label>
          <div style="display:flex;gap:4px;">${varButtons('tf-body')}</div>
        </div>
        <textarea class="form-input" id="tf-body" name="body" rows="9" required
                  style="resize:vertical;font-family:inherit;"
                  placeholder="Hi {{candidate_name}},&#10;&#10;…">${existing?.body || ''}</textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" id="tf-cancel">Cancel</button>
    <button class="btn btn-primary" id="tf-save">
      <i data-lucide="save" style="width:15px;height:15px;"></i>
      ${isEdit ? 'Save Changes' : 'Create Template'}
    </button>`;

  openModal(isEdit ? 'Edit Template' : 'New Template', body, { footerHtml: footer, size: 'lg' });
  if (window.lucide) lucide.createIcons();

  // Variable insertion at cursor
  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.target);
      if (!el) return;
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd   ?? el.value.length;
      el.value = el.value.slice(0, s) + btn.dataset.var + el.value.slice(e);
      el.focus();
      el.selectionStart = el.selectionEnd = s + btn.dataset.var.length;
    });
  });

  document.getElementById('tf-cancel')?.addEventListener('click', closeModal);
  document.getElementById('tf-save')?.addEventListener('click', async () => {
    const form    = document.getElementById('tmpl-form');
    const name    = form.querySelector('[name=name]').value.trim();
    const subject = form.querySelector('[name=subject]').value.trim();
    const body    = form.querySelector('[name=body]').value.trim();
    if (!name || !subject || !body) { showError('Name, subject, and body are required.'); return; }

    const saveBtn = document.getElementById('tf-save');
    saveBtn.classList.add('loading'); saveBtn.disabled = true;

    try {
      const payload = {
        name, subject, body,
        template_type: form.querySelector('[name=template_type]').value || null,
      };
      if (isEdit) {
        const updated = await api.put(`/emails/templates/${existing.id}`, payload);
        const idx = templates.findIndex(t => t.id === existing.id);
        if (idx !== -1) templates[idx] = updated;
        showSuccess('Template updated.');
      } else {
        const created = await api.post('/emails/templates', payload);
        templates.unshift(created);
        showSuccess('Template created.');
      }
      closeModal();
      renderTab();
    } catch (err) {
      showError(err.message);
      saveBtn.classList.remove('loading'); saveBtn.disabled = false;
    }
  });
}

// ── SENT tab ───────────────────────────────────────────────────────────

async function renderSent(content) {
  content.innerHTML = `
    <div style="padding:40px;text-align:center;">
      <div class="spinner"><div class="spinner-circle"></div></div>
    </div>`;

  try {
    const logs = await api.get('/emails/logs?per_page=100');
    const list = Array.isArray(logs) ? logs : [];

    if (list.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i data-lucide="mail-check" class="empty-state-icon"></i>
          <h2 class="empty-state-title">No emails sent yet</h2>
          <p class="empty-state-desc">Emails you send from the Compose tab will appear here.</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Keep log bodies for preview
    const logMap = Object.fromEntries(list.map(l => [l.id, l]));

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Candidate</th><th>Subject</th><th>Sent At</th>
              <th>Status</th><th style="width:70px;"></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(log => `
              <tr>
                <td>
                  ${log.candidate_id
                    ? `<a href="#/candidates/${log.candidate_id}"
                          style="font-weight:600;color:var(--accent);text-decoration:none;">
                         ${log.candidate_name || 'Candidate #' + log.candidate_id}
                       </a>`
                    : '<span class="text-muted">—</span>'}
                </td>
                <td style="font-size:13px;max-width:260px;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">${log.subject}</td>
                <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">
                  ${formatDateTime(log.sent_at)}
                </td>
                <td>
                  <span class="badge ${log.status === 'sent' ? 'badge-success' : 'badge-error'}">
                    ${log.status}
                  </span>
                </td>
                <td>
                  <button class="btn btn-ghost btn-sm" data-preview="${log.id}" style="gap:4px;">
                    <i data-lucide="eye" style="width:13px;height:13px;"></i>
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    if (window.lucide) lucide.createIcons({ nodes: [content] });

    content.querySelectorAll('[data-preview]').forEach(btn => {
      btn.addEventListener('click', () => {
        const log = logMap[parseInt(btn.dataset.preview, 10)];
        if (!log) return;
        openModal(log.subject, `
          <div>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
              To: ${log.candidate_name || '—'} · ${formatDateTime(log.sent_at)}
            </p>
            <div style="font-size:14px;line-height:1.8;white-space:pre-wrap;
                        color:var(--text-secondary);font-family:inherit;">
              ${log.body}
            </div>
          </div>`,
          { footerHtml: '<button class="btn btn-secondary" id="preview-close">Close</button>' }
        );
        setTimeout(() => {
          document.getElementById('preview-close')?.addEventListener('click', closeModal);
        }, 0);
      });
    });
  } catch (err) {
    content.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <p class="error-state-title">Failed to load email logs</p>
        <p class="error-state-desc">${err.message}</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
}
