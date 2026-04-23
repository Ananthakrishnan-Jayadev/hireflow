import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { showPageLoader } from '../components/loader.js';
import { formatDateTime, stageBadgeClass } from '../utils/helpers.js';

// params = [interview_id, 'scorecard']
export async function render(container, params) {
  const interviewId = params[0];
  if (!interviewId) { window.location.hash = '#/interviews'; return; }

  showPageLoader(container);

  // Load interview and scorecard in parallel (scorecard may 404 if not yet submitted)
  let interview, scorecard;
  try {
    interview = await api.get(`/interviews/${interviewId}`);
  } catch (err) {
    container.innerHTML = `
      <div class="error-state" style="margin-top:80px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <p class="error-state-title">Interview not found</p>
        <p class="error-state-desc">${err.message}</p>
        <a href="#/interviews" class="btn btn-secondary" style="margin-top:16px;">Back to Interviews</a>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  try {
    scorecard = await api.get(`/interviews/${interviewId}/scorecard`);
  } catch {
    scorecard = null; // Not submitted yet
  }

  renderPage(container, interview, scorecard);
}

function renderPage(container, interview, scorecard) {
  const fmtType = (t) => t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
  const fmtStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  container.innerHTML = `
    ${renderTopbar({
      title: 'Interview Scorecard',
      breadcrumbs: [
        { label: 'Interviews', href: '#/interviews' },
        { label: interview.candidate_name || 'Candidate', href: `#/candidates/${interview.candidate_id}` },
        { label: 'Scorecard' },
      ],
    })}

    <!-- Interview summary strip -->
    <div style="padding:12px 32px;background:var(--bg-card);border-bottom:1px solid var(--border);
                display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <span style="font-size:13px;font-weight:600;color:var(--text-primary);">
        ${interview.candidate_name || 'Candidate'}
      </span>
      <span style="font-size:13px;color:var(--text-muted);">${interview.job_title || '—'}</span>
      <span class="badge badge-default">${fmtType(interview.interview_type)}</span>
      <span style="font-size:13px;color:var(--text-muted);">
        ${formatDateTime(interview.scheduled_at)} · ${interview.duration_min} min
      </span>
      <span style="font-size:13px;color:var(--text-muted);">
        with ${interview.interviewer_name}
      </span>
    </div>

    <div class="page-content" style="max-width:780px;">
      ${scorecard ? renderViewMode(scorecard) : renderFormMode(interview.id)}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  if (!scorecard) bindForm(container, interview);
}

// ── View mode (read-only) ──────────────────────────────────────────────

function renderViewMode(sc) {
  const CRITERIA = [
    { key: 'technical',       label: 'Technical Skills' },
    { key: 'communication',   label: 'Communication' },
    { key: 'culture_fit',     label: 'Culture Fit' },
    { key: 'problem_solving', label: 'Problem Solving' },
  ];

  const recLabels = {
    strong_yes: { label: 'Strong Yes',  color: '#065F46', bg: 'var(--color-success-bg)' },
    yes:        { label: 'Yes',         color: '#065F46', bg: 'var(--color-success-bg)' },
    neutral:    { label: 'Neutral',     color: '#92400E', bg: 'var(--color-warning-bg)' },
    no:         { label: 'No',          color: '#991B1B', bg: 'var(--color-error-bg)' },
    strong_no:  { label: 'Strong No',   color: '#991B1B', bg: 'var(--color-error-bg)' },
  };
  const rec = recLabels[sc.recommendation] || { label: sc.recommendation || '—', color: 'var(--text-secondary)', bg: 'var(--border-light)' };

  return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="card-title">Scorecard</span>
        <span style="padding:6px 16px;border-radius:var(--radius-sm);font-size:13px;font-weight:700;
                     background:${rec.bg};color:${rec.color};">
          ${rec.label}
        </span>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:20px;">

        <!-- Rating criteria -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${CRITERIA.map(c => `
            <div>
              <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
                ${c.label}
              </div>
              <div style="display:flex;gap:4px;align-items:center;">
                ${renderStars(sc[c.key] || 0)}
                <span style="font-size:13px;color:var(--text-muted);margin-left:6px;">
                  ${sc[c.key] ? sc[c.key] + '/5' : 'Not rated'}
                </span>
              </div>
            </div>`).join('')}
        </div>

        <!-- Overall -->
        ${sc.overall_rating ? `
          <div style="padding:16px;background:var(--bg-body);border-radius:var(--radius-sm);
                      display:flex;align-items:center;gap:12px;">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Overall Rating:</span>
            <div style="display:flex;gap:4px;">${renderStars(sc.overall_rating)}</div>
            <span style="font-size:13px;color:var(--text-muted);">${sc.overall_rating}/5</span>
          </div>` : ''}

        <!-- Strengths & Concerns -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${textSection('Strengths', sc.strengths, '#065F46', 'var(--color-success-bg)')}
          ${textSection('Concerns', sc.concerns, '#991B1B', 'var(--color-error-bg)')}
        </div>

        ${sc.notes ? `
          <div>
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
              Additional Notes
            </div>
            <div style="font-size:14px;color:var(--text-secondary);line-height:1.7;white-space:pre-wrap;">
              ${sc.notes}
            </div>
          </div>` : ''}

      </div>
    </div>`;
}

function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) => `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="${i < rating ? '#F59E0B' : 'none'}"
         stroke="${i < rating ? '#F59E0B' : 'var(--border)'}" stroke-width="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`).join('');
}

function textSection(label, text, color, bg) {
  return `
    <div style="padding:12px;background:${bg};border-radius:var(--radius-sm);">
      <div style="font-size:12px;font-weight:600;color:${color};text-transform:uppercase;
                  letter-spacing:0.04em;margin-bottom:6px;">${label}</div>
      <div style="font-size:13.5px;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">
        ${text || `<span style="color:${color};opacity:0.5;">None noted</span>`}
      </div>
    </div>`;
}

// ── Form mode ──────────────────────────────────────────────────────────

function renderFormMode(interviewId) {
  const CRITERIA = [
    { key: 'technical',       label: 'Technical Skills',  desc: 'Domain knowledge, coding ability, technical depth' },
    { key: 'communication',   label: 'Communication',     desc: 'Clarity, listening, articulation of ideas' },
    { key: 'culture_fit',     label: 'Culture Fit',       desc: 'Values alignment, team collaboration, attitude' },
    { key: 'problem_solving', label: 'Problem Solving',   desc: 'Analytical thinking, creativity, approach to challenges' },
  ];

  const RECOMMENDATIONS = [
    { value: 'strong_yes', label: 'Strong Yes — Highly recommended' },
    { value: 'yes',        label: 'Yes — Recommended' },
    { value: 'neutral',    label: 'Neutral — On the fence' },
    { value: 'no',         label: 'No — Not recommended' },
    { value: 'strong_no',  label: 'Strong No — Do not proceed' },
  ];

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Submit Scorecard</span>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:24px;">

        <!-- Rating criteria -->
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:16px;">
            Rate Each Area (1 = Poor, 5 = Excellent)
          </div>
          <div style="display:flex;flex-direction:column;gap:18px;">
            ${CRITERIA.map(c => `
              <div>
                <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
                  <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${c.label}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${c.desc}</span>
                </div>
                <div class="star-input" data-field="${c.key}" style="display:flex;gap:6px;cursor:pointer;">
                  ${Array.from({ length: 5 }, (_, i) => `
                    <svg class="star-btn" data-value="${i + 1}" width="28" height="28" viewBox="0 0 24 24"
                         fill="none" stroke="var(--border)" stroke-width="2" style="transition:all 0.15s;">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>`).join('')}
                  <input type="hidden" name="${c.key}" value="" />
                  <span class="star-label" style="font-size:13px;color:var(--text-muted);margin-left:4px;align-self:center;"></span>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Overall rating -->
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
            Overall Rating
          </div>
          <div class="star-input" data-field="overall_rating" style="display:flex;gap:6px;cursor:pointer;">
            ${Array.from({ length: 5 }, (_, i) => `
              <svg class="star-btn" data-value="${i + 1}" width="32" height="32" viewBox="0 0 24 24"
                   fill="none" stroke="var(--border)" stroke-width="2" style="transition:all 0.15s;">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>`).join('')}
            <input type="hidden" name="overall_rating" value="" />
            <span class="star-label" style="font-size:13px;color:var(--text-muted);margin-left:4px;align-self:center;"></span>
          </div>
        </div>

        <!-- Recommendation -->
        <div>
          <label class="form-label" for="sc-rec" style="font-size:14px;font-weight:600;color:var(--text-primary);">
            Hiring Recommendation
          </label>
          <select class="form-select" id="sc-rec" name="recommendation" style="max-width:360px;margin-top:8px;">
            <option value="">Select recommendation…</option>
            ${RECOMMENDATIONS.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
          </select>
        </div>

        <!-- Strengths & Concerns -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label class="form-label" for="sc-strengths"
                   style="color:#065F46;">Strengths</label>
            <textarea class="form-input" id="sc-strengths" name="strengths" rows="4"
                      style="resize:vertical;font-family:inherit;"
                      placeholder="What stood out positively?"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="sc-concerns"
                   style="color:#991B1B;">Concerns</label>
            <textarea class="form-input" id="sc-concerns" name="concerns" rows="4"
                      style="resize:vertical;font-family:inherit;"
                      placeholder="Any red flags or areas for improvement?"></textarea>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label" for="sc-notes">Additional Notes</label>
          <textarea class="form-input" id="sc-notes" name="notes" rows="3"
                    style="resize:vertical;font-family:inherit;"
                    placeholder="Any other observations or context…"></textarea>
        </div>

        <!-- Submit -->
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:4px;">
          <a href="#/interviews" class="btn btn-secondary">Cancel</a>
          <button class="btn btn-primary" id="sc-submit" data-interview-id="${interviewId}">
            <i data-lucide="clipboard-check" style="width:15px;height:15px;"></i> Submit Scorecard
          </button>
        </div>

      </div>
    </div>`;
}

function bindForm(container, interview) {
  // Interactive star ratings
  container.querySelectorAll('.star-input').forEach(group => {
    const stars     = group.querySelectorAll('.star-btn');
    const hidden    = group.querySelector('input[type=hidden]');
    const label     = group.querySelector('.star-label');
    const LABELS    = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    let current     = 0;

    function paint(n) {
      stars.forEach((s, i) => {
        s.setAttribute('fill', i < n ? '#F59E0B' : 'none');
        s.setAttribute('stroke', i < n ? '#F59E0B' : 'var(--border)');
      });
      if (label) label.textContent = n ? `${n} — ${LABELS[n]}` : '';
    }

    stars.forEach(star => {
      star.addEventListener('mouseenter', () => paint(parseInt(star.dataset.value, 10)));
      star.addEventListener('mouseleave', () => paint(current));
      star.addEventListener('click', () => {
        current       = parseInt(star.dataset.value, 10);
        hidden.value  = current;
        paint(current);
      });
    });
  });

  // Submit
  container.querySelector('#sc-submit')?.addEventListener('click', async () => {
    const interviewId = parseInt(container.querySelector('#sc-submit').dataset.interviewId, 10);

    const get = (name) => container.querySelector(`[name=${name}]`)?.value?.trim() || null;
    const getInt = (name) => {
      const v = container.querySelector(`input[name=${name}]`)?.value;
      return v ? parseInt(v, 10) : null;
    };

    const payload = {
      technical:       getInt('technical'),
      communication:   getInt('communication'),
      culture_fit:     getInt('culture_fit'),
      problem_solving: getInt('problem_solving'),
      overall_rating:  getInt('overall_rating'),
      recommendation:  get('recommendation'),
      strengths:       get('strengths'),
      concerns:        get('concerns'),
      notes:           get('notes'),
    };

    const submitBtn = container.querySelector('#sc-submit');
    submitBtn.classList.add('loading'); submitBtn.disabled = true;

    try {
      const sc = await api.post(`/interviews/${interviewId}/scorecard`, payload);
      showSuccess('Scorecard submitted.');
      // Re-render in view mode
      const updated = await api.get(`/interviews/${interviewId}`);
      renderPage(container, updated, sc);
    } catch (err) {
      showError(err.message);
      submitBtn.classList.remove('loading'); submitBtn.disabled = false;
    }
  });
}
