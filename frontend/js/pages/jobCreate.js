import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess, showInfo } from '../components/toast.js';
import { formatJobType } from '../utils/helpers.js';
import { attachBiasAuditor } from '../components/biasAuditor.js';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
const JOB_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];
const STATUSES = ['draft', 'open', 'closed'];
const TONES = ['professional', 'casual', 'startup'];

export async function render(container, params) {
  // params[0] = job id when editing, absent when creating
  // app.js passes params like ['42', 'edit'] for edit mode
  const jobId = params[0] && params[0] !== 'new' ? params[0] : null;
  const isEdit = jobId !== null;

  let job = null;
  if (isEdit) {
    try {
      job = await api.get(`/jobs/${jobId}`);
    } catch (err) {
      container.innerHTML = `
        <div class="error-state" style="margin-top:80px;">
          <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
          <p class="error-state-title">Job not found</p>
          <a href="#/jobs" class="btn btn-secondary" style="margin-top:16px;">Back to Jobs</a>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }
  }

  const title = isEdit ? `Edit: ${job.title}` : 'Create Job';
  const breadcrumbs = isEdit
    ? [{ label: 'Jobs', href: '#/jobs' }, { label: job.title, href: `#/jobs/${jobId}` }, { label: 'Edit' }]
    : [{ label: 'Jobs', href: '#/jobs' }, { label: 'New Job' }];

  container.innerHTML = `
    ${renderTopbar({ title, breadcrumbs })}
    <div class="page-content">
      <form id="job-form" novalidate>
        <div style="display:grid;grid-template-columns:1fr 420px;gap:24px;align-items:start;">

          <!-- ── Left: Job fields ── -->
          <div style="display:flex;flex-direction:column;gap:20px;">

            <div class="card">
              <div class="card-header"><span class="card-title">Job Details</span></div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">

                <div class="form-group">
                  <label class="form-label required" for="title">Job Title</label>
                  <input class="form-input" type="text" id="title" name="title"
                    placeholder="e.g. Senior Software Engineer"
                    value="${job?.title || ''}" required />
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="form-group">
                    <label class="form-label" for="department">Department</label>
                    <select class="form-select" id="department" name="department">
                      <option value="">Select department</option>
                      ${DEPARTMENTS.map(d => `<option value="${d}" ${job?.department === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="job_type">Job Type</label>
                    <select class="form-select" id="job_type" name="job_type">
                      <option value="">Select type</option>
                      ${JOB_TYPES.map(t => `<option value="${t.value}" ${job?.job_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="location">Location</label>
                  <input class="form-input" type="text" id="location" name="location"
                    placeholder="e.g. Toronto, ON or Remote"
                    value="${job?.location || ''}" />
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="form-group">
                    <label class="form-label" for="salary_min">Salary Min (USD)</label>
                    <input class="form-input" type="number" id="salary_min" name="salary_min"
                      placeholder="e.g. 80000" min="0"
                      value="${job?.salary_min ?? ''}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="salary_max">Salary Max (USD)</label>
                    <input class="form-input" type="number" id="salary_max" name="salary_max"
                      placeholder="e.g. 120000" min="0"
                      value="${job?.salary_max ?? ''}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="status">Status</label>
                  <select class="form-select" id="status" name="status">
                    ${STATUSES.map(s => `<option value="${s}" ${(job?.status ?? 'draft') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                  </select>
                </div>

              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Job Description</span></div>
              <div class="card-body">
                <div class="form-group">
                  <label class="form-label" for="description">Description</label>
                  <textarea class="form-textarea" id="description" name="description"
                    rows="14" placeholder="Paste or generate a job description…">${job?.description || ''}</textarea>
                  <p class="form-hint">Use the AI Generator panel on the right to generate one from requirements.</p>
                </div>
                <!-- Bias auditor -->
                <div id="jd-bias-wrap"></div>
              </div>
            </div>

            <div style="display:flex;gap:12px;justify-content:flex-end;">
              <a href="${isEdit ? `#/jobs/${jobId}` : '#/jobs'}" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary" id="save-btn">
                <i data-lucide="save" style="width:15px;height:15px;"></i>
                ${isEdit ? 'Save Changes' : 'Create Job'}
              </button>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
              <button type="button" id="publish-linkedin-btn" class="btn btn-secondary" style="display:flex;align-items:center;gap:7px;" title="Coming soon">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Publish to LinkedIn
              </button>
              <button type="button" id="publish-indeed-btn" class="btn btn-secondary" style="display:flex;align-items:center;gap:7px;" title="Coming soon">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;
                             background:#003A9B;border-radius:3px;color:#fff;font-size:11px;font-weight:800;
                             font-family:serif;line-height:1;">i</span>
                Publish to Indeed
              </button>
            </div>

          </div>

          <!-- ── Right: AI JD Generator ── -->
          <div style="position:sticky;top:72px;">
            <div class="card">
              <div class="card-header">
                <span class="card-title">
                  <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--accent);vertical-align:middle;margin-right:6px;"></i>
                  AI JD Generator
                </span>
              </div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">

                <div class="form-group">
                  <label class="form-label" for="ai-requirements">Key Requirements</label>
                  <textarea class="form-textarea" id="ai-requirements" rows="6"
                    placeholder="Paste bullet points or describe the role requirements…
• 5+ years Python experience
• Strong SQL skills
• Experience with cloud infrastructure"></textarea>
                  <p class="form-hint">The AI will use your form's title, department, location and type automatically.</p>
                </div>

                <div class="form-group">
                  <label class="form-label" for="ai-tone">Tone</label>
                  <select class="form-select" id="ai-tone">
                    ${TONES.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                  </select>
                </div>

                <button type="button" class="btn btn-primary w-full" id="ai-generate-btn">
                  <i data-lucide="sparkles" style="width:15px;height:15px;"></i>
                  Generate with AI
                </button>

                <!-- Output area (hidden until generation) -->
                <div id="ai-output" style="display:none;"></div>

              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  bindForm(container, isEdit, jobId);
  bindAiGenerator(container);
  bindPublishButtons(container);

  // Bias auditor on the description field
  attachBiasAuditor({
    getTextFn: () => document.getElementById('description')?.value || '',
    containerId: 'jd-bias-wrap',
  });
}

function getFormData(form) {
  const fd = new FormData(form);
  return {
    title: fd.get('title')?.trim() || '',
    department: fd.get('department') || null,
    location: fd.get('location')?.trim() || null,
    job_type: fd.get('job_type') || null,
    salary_min: fd.get('salary_min') ? parseInt(fd.get('salary_min'), 10) : null,
    salary_max: fd.get('salary_max') ? parseInt(fd.get('salary_max'), 10) : null,
    status: fd.get('status') || 'draft',
    description: fd.get('description')?.trim() || null,
  };
}

function bindForm(container, isEdit, jobId) {
  const form = container.querySelector('#job-form');
  const saveBtn = container.querySelector('#save-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = getFormData(form);
    if (!data.title) {
      showError('Job title is required.');
      form.querySelector('#title')?.focus();
      return;
    }

    if (data.salary_min !== null && data.salary_max !== null && data.salary_min > data.salary_max) {
      showError('Salary minimum cannot be greater than the maximum.');
      form.querySelector('#salary_min')?.focus();
      return;
    }

    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    try {
      if (isEdit) {
        await api.put(`/jobs/${jobId}`, data);
        showSuccess('Job updated successfully.');
        window.location.hash = `#/jobs/${jobId}`;
      } else {
        const created = await api.post('/jobs', data);
        showSuccess('Job created successfully.');
        window.location.hash = `#/jobs/${created.id}`;
      }
    } catch (err) {
      showError(err.message || 'Failed to save job.');
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
    }
  });
}

function bindPublishButtons(container) {
  container.querySelector('#publish-linkedin-btn')?.addEventListener('click', () => {
    showInfo('LinkedIn publishing integration coming soon. Save your job first, then use LinkedIn Job Poster to copy the details.', { title: 'Coming Soon' });
  });
  container.querySelector('#publish-indeed-btn')?.addEventListener('click', () => {
    showInfo('Indeed publishing integration coming soon. Save your job first, then post it directly on Indeed.', { title: 'Coming Soon' });
  });
}

function bindAiGenerator(container) {
  const generateBtn = container.querySelector('#ai-generate-btn');

  generateBtn?.addEventListener('click', async () => {
    const requirements = container.querySelector('#ai-requirements')?.value.trim();
    if (!requirements) {
      showError('Please enter key requirements first.');
      container.querySelector('#ai-requirements')?.focus();
      return;
    }

    const title = container.querySelector('#title')?.value.trim() || 'Untitled Role';
    const department = container.querySelector('#department')?.value || '';
    const location = container.querySelector('#location')?.value.trim() || '';
    const job_type = container.querySelector('#job_type')?.value || '';
    const tone = container.querySelector('#ai-tone')?.value || 'professional';

    generateBtn.classList.add('loading');
    generateBtn.disabled = true;
    const outputEl = container.querySelector('#ai-output');
    if (outputEl) { outputEl.style.display = 'none'; outputEl.innerHTML = ''; }

    try {
      const result = await api.post('/ai/generate-jd', { title, department, location, job_type, requirements, tone });
      renderAiOutput(container, result);
    } catch (err) {
      showError(err.message || 'AI generation failed. Please try again.');
    } finally {
      generateBtn.classList.remove('loading');
      generateBtn.disabled = false;
    }
  });
}

function renderAiOutput(container, result) {
  const outputEl = container.querySelector('#ai-output');
  if (!outputEl) return;

  const listItems = (arr) => (arr || []).map(item => `<li style="margin-bottom:4px;">${item}</li>`).join('');

  const fullDescription = [
    result.description || '',
    '',
    '## Responsibilities',
    ...(result.responsibilities || []).map(r => `- ${r}`),
    '',
    '## Required Qualifications',
    ...(result.qualifications || []).map(q => `- ${q}`),
    '',
    '## Nice to Have',
    ...(result.nice_to_haves || []).map(n => `- ${n}`),
    '',
    '## Benefits',
    ...(result.benefits || []).map(b => `- ${b}`),
  ].join('\n');

  outputEl.innerHTML = `
    <div style="border-top:1px solid var(--border-light);padding-top:14px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:10px;">
        Generated Preview
      </div>

      ${result.description ? `<p style="font-size:13px;line-height:1.7;color:var(--text-secondary);margin-bottom:12px;">${result.description}</p>` : ''}

      ${result.responsibilities?.length ? `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Responsibilities</div>
          <ul style="list-style:disc;padding-left:16px;font-size:12.5px;color:var(--text-secondary);">
            ${listItems(result.responsibilities)}
          </ul>
        </div>` : ''}

      ${result.qualifications?.length ? `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Required Qualifications</div>
          <ul style="list-style:disc;padding-left:16px;font-size:12.5px;color:var(--text-secondary);">
            ${listItems(result.qualifications)}
          </ul>
        </div>` : ''}

      ${result.nice_to_haves?.length ? `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Nice to Have</div>
          <ul style="list-style:disc;padding-left:16px;font-size:12.5px;color:var(--text-secondary);">
            ${listItems(result.nice_to_haves)}
          </ul>
        </div>` : ''}

      ${result.benefits?.length ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Benefits</div>
          <ul style="list-style:disc;padding-left:16px;font-size:12.5px;color:var(--text-secondary);">
            ${listItems(result.benefits)}
          </ul>
        </div>` : ''}

      <button type="button" class="btn btn-primary w-full" id="use-description-btn">
        <i data-lucide="check" style="width:15px;height:15px;"></i>
        Use This Description
      </button>
    </div>
  `;

  outputEl.style.display = 'block';
  if (window.lucide) lucide.createIcons({ nodes: [outputEl] });

  outputEl.querySelector('#use-description-btn')?.addEventListener('click', () => {
    const descTextarea = container.querySelector('#description');
    if (descTextarea) {
      descTextarea.value = fullDescription;
      descTextarea.dispatchEvent(new Event('input'));
      showSuccess('Description applied. Review and edit as needed.');
      descTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
