import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { debounce } from '../utils/helpers.js';

const TYPE_STYLES = {
  behavioural: { label: 'Behavioural', bg: '#eff6ff', color: '#1d4ed8' },
  technical:   { label: 'Technical',   bg: '#f0fdf4', color: '#15803d' },
  situational: { label: 'Situational', bg: '#fefce8', color: '#a16207' },
  culture:     { label: 'Culture',     bg: '#fdf4ff', color: '#7e22ce' },
};

function typeBadge(type) {
  const s = TYPE_STYLES[type] || { label: type, bg: '#f3f4f6', color: '#374151' };
  return `<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;
                       padding:2px 8px;border-radius:20px;background:${s.bg};color:${s.color};">${s.label}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function render(container) {
  container.innerHTML = `
    ${renderTopbar({
      title: 'Interview Assistant',
      subtitle: 'AI-generated interview questions for open jobs',
    })}
    <div class="page-content">
      <div style="display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start;">

        <!-- Left: job selector -->
        <div class="card" style="position:sticky;top:72px;">
          <div class="card-header"><span class="card-title">Select a Job</span></div>
          <div class="card-body" style="padding:0;">
            <div id="ia-job-list" style="max-height:70vh;overflow-y:auto;">
              <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
                Loading open jobs…
              </div>
            </div>
          </div>
        </div>

        <!-- Right: questions panel -->
        <div id="ia-questions-panel">
          <div class="card">
            <div class="card-body" style="padding:48px 32px;text-align:center;">
              <i data-lucide="message-square" style="width:40px;height:40px;color:var(--text-muted);margin-bottom:16px;"></i>
              <h3 style="font-size:16px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
                Select a job to get started
              </h3>
              <p style="font-size:13px;color:var(--text-muted);">
                Choose an open job from the left panel. If questions have already been generated
                they will load instantly — otherwise the AI will create 10 tailored questions.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  await loadOpenJobs(container);
}

async function loadOpenJobs(container) {
  const listEl = container.querySelector('#ia-job-list');
  try {
    const data = await api.get('/jobs?status=open&per_page=100');
    const jobs = data.items || [];

    if (jobs.length === 0) {
      listEl.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
          No open jobs found. Create and publish a job first.
        </div>`;
      return;
    }

    listEl.innerHTML = jobs.map(j => `
      <div class="ia-job-item" data-job-id="${j.id}" style="
        padding:14px 18px;cursor:pointer;border-bottom:1px solid var(--border-light);
        transition:background 120ms ease;position:relative;">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">${j.title}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${j.department ? `<span>${j.department}</span>` : ''}
          ${j.location   ? `<span>${j.location}</span>`   : ''}
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.ia-job-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('ia-active')) item.style.background = 'var(--bg-sidebar)';
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('ia-active')) item.style.background = '';
      });
      item.addEventListener('click', () => {
        listEl.querySelectorAll('.ia-job-item').forEach(el => {
          el.classList.remove('ia-active');
          el.style.background = '';
          el.style.borderLeft = '';
          el.style.paddingLeft = '18px';
        });
        item.classList.add('ia-active');
        item.style.background  = 'var(--accent-muted, #eef2f7)';
        item.style.borderLeft  = '3px solid var(--accent)';
        item.style.paddingLeft = '15px';

        const job = jobs.find(j => j.id === Number(item.dataset.jobId));
        loadQuestionsForJob(container, job);
      });
    });

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    listEl.innerHTML = `
      <div style="padding:20px;color:var(--color-error);font-size:13px;">
        Failed to load jobs: ${err.message}
      </div>`;
  }
}

// ── Load questions: try cache first, then offer to generate ──────────────

async function loadQuestionsForJob(container, job) {
  const panel = container.querySelector('#ia-questions-panel');

  // Show a quick loading skeleton while we check the cache
  panel.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span class="card-title">${job.title}</span>
          <p style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            ${[job.department, job.location].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div class="card-body" id="ia-output">
        <div style="padding:30px;text-align:center;color:var(--text-muted);">
          <div class="spinner" style="margin:0 auto 12px;"><div class="spinner-circle"></div></div>
          <div style="font-size:13px;">Checking for saved questions…</div>
        </div>
      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();

  try {
    // Try to load cached questions from the server
    const result = await api.get(`/ai/interview-questions/${job.id}`);
    renderQuestionsPanel(container, job, result);
  } catch (err) {
    if (err.status === 404) {
      // No questions stored yet — show the generate prompt
      renderGeneratePrompt(container, job);
    } else {
      const output = container.querySelector('#ia-output');
      if (output) {
        output.innerHTML = `
          <div style="padding:24px;text-align:center;color:var(--color-error);font-size:13px;">
            ${err.message}
          </div>`;
      }
    }
  }
}

// ── "No questions yet" state ─────────────────────────────────────────────

function renderGeneratePrompt(container, job) {
  const panel = container.querySelector('#ia-questions-panel');
  panel.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span class="card-title">${job.title}</span>
          <p style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            ${[job.department, job.location].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button class="btn btn-primary btn-sm" id="ia-generate-btn" style="gap:6px;white-space:nowrap;">
          <i data-lucide="sparkles" style="width:13px;height:13px;"></i> Generate Questions
        </button>
      </div>
      <div class="card-body" id="ia-output">
        <div style="display:flex;flex-direction:column;align-items:center;padding:48px 32px;gap:12px;
                    color:var(--text-muted);text-align:center;">
          <i data-lucide="sparkles" style="width:36px;height:36px;opacity:0.4;"></i>
          <p style="font-size:13px;max-width:380px;line-height:1.6;">
            No questions have been generated for this role yet.<br>
            Click <strong>Generate Questions</strong> to create 10 AI-powered questions
            based on the job description.
          </p>
        </div>
      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();

  panel.querySelector('#ia-generate-btn')?.addEventListener('click', debounce(() => {
    fetchAndStoreQuestions(container, job, false);
  }, 500));
}

// ── Questions already exist state ────────────────────────────────────────

function renderQuestionsPanel(container, job, result) {
  const panel = container.querySelector('#ia-questions-panel');
  const genAt = result.generated_at ? fmtDate(result.generated_at) : null;

  panel.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <span class="card-title">${job.title}</span>
          <p style="font-size:12px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${[job.department, job.location].filter(Boolean).join(' · ')}
            ${genAt ? `<span style="display:flex;align-items:center;gap:3px;">
              <i data-lucide="clock" style="width:11px;height:11px;"></i>
              Generated ${genAt}
            </span>` : ''}
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" id="ia-regenerate-btn" style="gap:6px;white-space:nowrap;flex-shrink:0;"
                title="Generate a fresh set of questions and replace the stored ones">
          <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Regenerate
        </button>
      </div>
      <div class="card-body" id="ia-output">
        ${questionsHtml(result.questions)}
      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();

  panel.querySelector('#ia-regenerate-btn')?.addEventListener('click', debounce(() => {
    fetchAndStoreQuestions(container, job, true);
  }, 500));
}

// ── Actually call the AI and show skeleton while waiting ─────────────────

async function fetchAndStoreQuestions(container, job, forceRegenerate) {
  const panel   = container.querySelector('#ia-questions-panel');
  const btn     = panel?.querySelector('#ia-generate-btn, #ia-regenerate-btn');
  const output  = panel?.querySelector('#ia-output');

  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  if (output) {
    output.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${Array(10).fill(0).map((_, i) => `
          <div style="display:flex;gap:14px;padding:16px;border:1px solid var(--border-light);border-radius:10px;">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--border-light);
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;
                        font-size:12px;font-weight:700;color:var(--text-muted);">${i + 1}</div>
            <div style="flex:1;">
              <div class="skeleton skeleton-text wide" style="height:15px;margin-bottom:8px;"></div>
              <div class="skeleton skeleton-text narrow" style="height:11px;"></div>
            </div>
          </div>`).join('')}
      </div>`;
  }

  try {
    const result = await api.post('/ai/interview-questions', {
      job_id: job.id,
      force_regenerate: forceRegenerate,
    });

    renderQuestionsPanel(container, job, result);

    if (forceRegenerate) {
      showSuccess('Questions regenerated and saved.');
    } else {
      showSuccess('Questions generated and saved for this job.');
    }
  } catch (err) {
    showError(err.message || 'Failed to generate questions.');
    if (output) {
      output.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--color-error);font-size:13px;">
          ${err.message || 'Failed to generate questions. Please try again.'}
        </div>`;
      // Re-attach the generate button
      const header = panel?.querySelector('.card-header');
      if (header && !header.querySelector('#ia-generate-btn')) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-primary btn-sm';
        retryBtn.id = forceRegenerate ? 'ia-regenerate-btn' : 'ia-generate-btn';
        retryBtn.style.cssText = 'gap:6px;white-space:nowrap;flex-shrink:0;';
        retryBtn.innerHTML = `<i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> ${forceRegenerate ? 'Retry Regenerate' : 'Retry'}`;
        header.appendChild(retryBtn);
        if (window.lucide) lucide.createIcons({ nodes: [retryBtn] });
        retryBtn.addEventListener('click', debounce(() => {
          fetchAndStoreQuestions(container, job, forceRegenerate);
        }, 500));
      }
    }
  }
}

// ── Questions list HTML ──────────────────────────────────────────────────

function questionsHtml(questions) {
  if (!questions || questions.length === 0) {
    return `<p style="color:var(--text-muted);font-size:13px;padding:16px;">No questions available. Please regenerate.</p>`;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${questions.map((q, i) => `
        <div style="display:flex;gap:14px;padding:18px;border:1px solid var(--border-light);
                    border-radius:10px;transition:box-shadow 120ms ease;"
             onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'"
             onmouseleave="this.style.boxShadow=''">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--accent);
                      display:flex;align-items:center;justify-content:center;flex-shrink:0;
                      font-size:12px;font-weight:700;color:#fff;margin-top:1px;">${i + 1}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
              ${typeBadge(q.type)}
            </div>
            <p style="font-size:14.5px;font-weight:600;color:var(--text-primary);
                      line-height:1.5;margin:0 0 10px;">${q.question}</p>
            <div style="display:flex;gap:8px;align-items:flex-start;
                        padding:10px 12px;background:var(--bg-sidebar, #f5f7fa);
                        border-radius:8px;border-left:3px solid var(--accent);">
              <i data-lucide="lightbulb" style="width:13px;height:13px;color:var(--accent);
                 flex-shrink:0;margin-top:2px;"></i>
              <p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin:0;">
                ${q.guidance}
              </p>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <div style="margin-top:20px;padding:14px 16px;background:var(--bg-sidebar,#f5f7fa);
                border-radius:8px;display:flex;align-items:center;gap:8px;">
      <i data-lucide="info" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0;"></i>
      <p style="font-size:12px;color:var(--text-muted);margin:0;line-height:1.5;">
        These questions are saved for this job. Use <strong>Regenerate</strong> to create a fresh set at any time.
      </p>
    </div>`;
}
