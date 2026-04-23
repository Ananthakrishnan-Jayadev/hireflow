/**
 * career.js — Shyftlabs career page
 * Four <select> dropdown filters + jobs grouped by team.
 */

let allJobs = [];
let currentJobId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLocationType(job) {
  const t = ((job.job_type || '') + ' ' + (job.location_type || '')).toLowerCase();
  if (t.includes('hybrid'))  return 'hybrid';
  if (t.includes('remote'))  return 'remote';
  if (t.includes('on-site') || t.includes('onsite') || t.includes('on site')) return 'on-site';
  return '';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── Load jobs ─────────────────────────────────────────────────────────────────
async function loadJobs() {
  const container = document.getElementById('jobs-container');
  container.innerHTML = '<p class="career-empty">Loading positions…</p>';

  try {
    const res = await fetch('/api/career/jobs');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    allJobs = await res.json();
    populateDropdowns();
    renderJobs();
  } catch (err) {
    container.innerHTML =
      `<p class="career-empty">Could not load positions. Please try again later.<br><small>${esc(err.message)}</small></p>`;
  }
}

// ── Populate dynamic dropdowns (Location, Team) from API data ─────────────────
function populateDropdowns() {
  const locations = [...new Set(allJobs.map(j => j.location).filter(Boolean))].sort();
  const teams     = [...new Set(allJobs.map(j => j.department).filter(Boolean))].sort();

  const locSel  = document.getElementById('filter-location');
  const teamSel = document.getElementById('filter-team');

  locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    locSel.appendChild(opt);
  });

  teams.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team;
    opt.textContent = team;
    teamSel.appendChild(opt);
  });
}

// ── Filter logic ──────────────────────────────────────────────────────────────
function getFilters() {
  return {
    q:            (document.getElementById('search')?.value ?? '').trim().toLowerCase(),
    locationType: document.getElementById('filter-location-type')?.value ?? '',
    location:     document.getElementById('filter-location')?.value ?? '',
    team:         document.getElementById('filter-team')?.value ?? '',
    workType:     document.getElementById('filter-work-type')?.value ?? '',
  };
}

function applyFilters() {
  const f = getFilters();

  return allJobs.filter(j => {
    if (f.q &&
        !(j.title       || '').toLowerCase().includes(f.q) &&
        !(j.description || '').toLowerCase().includes(f.q) &&
        !(j.department  || '').toLowerCase().includes(f.q)) return false;

    if (f.locationType && getLocationType(j) !== f.locationType) return false;
    if (f.location     && j.location   !== f.location)           return false;
    if (f.team         && j.department !== f.team)               return false;
    if (f.workType     && (j.job_type || '').toLowerCase() !== f.workType.toLowerCase()) return false;

    return true;
  });
}

// ── Render grouped job list ───────────────────────────────────────────────────
function renderJobs() {
  const filtered  = applyFilters();
  const container = document.getElementById('jobs-container');

  if (filtered.length === 0) {
    container.innerHTML = '<p class="career-empty">No positions match your filters.</p>';
    return;
  }

  // Group by department/team
  const byTeam = {};
  filtered.forEach(j => {
    const team = j.department || 'Other';
    (byTeam[team] = byTeam[team] || []).push(j);
  });

  let html = '';
  Object.keys(byTeam).sort().forEach(team => {
    html += `<div class="career-team-section"><h2 class="career-team-title">${esc(team)}</h2>`;
    byTeam[team].forEach(j => { html += jobRowHtml(j); });
    html += `</div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.career-job-apply').forEach(btn => {
    btn.addEventListener('click', () =>
      openApply(Number(btn.dataset.jobId), btn.dataset.jobTitle, btn.dataset.jobDept, btn.dataset.jobLoc)
    );
  });

  container.querySelectorAll('.career-job-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const job = allJobs.find(j => j.id === Number(link.dataset.detailId));
      if (job) openJobDetail(job);
    });
  });

  if (window.lucide) lucide.createIcons();
}

// ── Build a single job row ────────────────────────────────────────────────────
function jobRowHtml(j) {
  const locType  = getLocationType(j);
  const workType = j.job_type || '';
  const location = j.location || '';

  const metaParts = [];
  if (locType)   metaParts.push(capitalize(locType));
  if (workType)  metaParts.push(workType);
  if (location)  metaParts.push(location);

  const metaHtml = metaParts.map(p => `<span>${esc(p)}</span>`).join('');

  return `
    <div class="career-job-row">
      <div class="career-job-info">
        <h3 class="career-job-title">
          <a href="#" class="career-job-link" data-detail-id="${j.id}">${esc(j.title)}</a>
        </h3>
        <p class="career-job-meta">${metaHtml}</p>
      </div>
      <button type="button" class="career-job-apply"
        data-job-id="${j.id}"
        data-job-title="${esc(j.title)}"
        data-job-dept="${esc(j.department || '')}"
        data-job-loc="${esc(j.location || '')}">Apply</button>
    </div>`;
}

// ── Job Detail modal ──────────────────────────────────────────────────────────
function openJobDetail(job) {
  const locType  = getLocationType(job);
  const metaParts = [];
  if (job.department)  metaParts.push(job.department);
  if (locType)         metaParts.push(capitalize(locType));
  if (job.job_type)    metaParts.push(job.job_type);
  if (job.location)    metaParts.push(job.location);

  const salary = (job.salary_min || job.salary_max)
    ? `$${(job.salary_min || 0).toLocaleString()} – $${(job.salary_max || 0).toLocaleString()} USD`
    : null;

  const descHtml = job.description
    ? job.description
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.startsWith('#')
          ? `<h4 style="font-size:14px;font-weight:700;color:#1a1a1a;margin:18px 0 6px;">${esc(line.replace(/^#+\s*/, ''))}</h4>`
          : line.startsWith('-') || line.startsWith('•')
            ? `<li style="margin-bottom:4px;">${esc(line.replace(/^[-•]\s*/, ''))}</li>`
            : `<p style="margin:0 0 10px;line-height:1.7;">${esc(line)}</p>`)
        .join('')
    : '<p style="color:#9ca3af;">No description provided.</p>';

  document.getElementById('detail-job-title').textContent  = job.title;
  document.getElementById('detail-job-meta').textContent   = metaParts.join(' · ');
  document.getElementById('detail-job-salary').textContent = salary || '';
  document.getElementById('detail-job-salary').hidden      = !salary;
  document.getElementById('detail-job-desc').innerHTML     = descHtml;

  document.getElementById('detail-apply-btn').onclick = () => {
    closeDetailModal();
    openApply(job.id, job.title, job.department || '', job.location || '');
  };

  document.getElementById('job-detail-modal').hidden = false;
  document.body.classList.add('modal-open');
}

function closeDetailModal() {
  document.getElementById('job-detail-modal').hidden = true;
  document.body.classList.remove('modal-open');
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function openApply(jobId, title, dept, loc) {
  currentJobId = jobId;
  document.getElementById('modal-job-title').textContent = `Apply — ${title}`;
  document.getElementById('modal-job-meta').textContent  = [dept, loc].filter(Boolean).join(' · ');
  document.getElementById('apply-form-wrap').hidden = false;
  document.getElementById('apply-success').hidden   = true;
  document.getElementById('apply-form').reset();
  document.getElementById('apply-error').hidden = true;
  document.getElementById('apply-modal').hidden = false;
  document.body.classList.add('modal-open');
  document.getElementById('app-name').focus();
}

function closeModal() {
  document.getElementById('apply-modal').hidden = true;
  document.body.classList.remove('modal-open');
  currentJobId = null;
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const name     = document.getElementById('app-name').value.trim();
  const email    = document.getElementById('app-email').value.trim();
  const phone    = document.getElementById('app-phone').value.trim();
  const linkedin = document.getElementById('app-linkedin').value.trim();
  const cover    = document.getElementById('app-cover').value.trim();
  const file     = document.getElementById('app-resume')?.files[0];
  const errEl    = document.getElementById('apply-error');
  const btn      = document.getElementById('submit-apply');

  if (!currentJobId) { errEl.textContent = 'No job selected.'; errEl.hidden = false; return; }
  if (!name || !email) { errEl.textContent = 'Full name and email are required.'; errEl.hidden = false; return; }

  btn.disabled = true;
  errEl.hidden = true;

  let resume_url = null, resume_text = null;

  if (file) {
    btn.textContent = 'Uploading resume…';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const upRes  = await fetch('/api/uploads/resume', { method: 'POST', body: fd });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        errEl.textContent = Array.isArray(upData.detail)
          ? upData.detail.map(x => x.msg).join(', ')
          : (upData.detail || 'Upload failed.');
        errEl.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Submit Application';
        return;
      }
      resume_url = upData.url;
      resume_text = upData.resume_text;
    } catch {
      errEl.textContent = 'Network error uploading resume.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Submit Application';
      return;
    }
  }

  btn.textContent = 'Submitting…';
  try {
    const res  = await fetch(`/api/career/jobs/${currentJobId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email,
        phone:        phone    || null,
        linkedin_url: linkedin || null,
        cover_letter: cover    || null,
        resume_url:   resume_url  || null,
        resume_text:  resume_text || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = Array.isArray(data.detail)
        ? data.detail.map(x => x.msg).join(', ')
        : (data.detail || 'Submission failed.');
      errEl.hidden = false;
      return;
    }
    document.getElementById('apply-form-wrap').hidden = true;
    document.getElementById('apply-success').hidden   = false;
  } catch {
    errEl.textContent = 'Network error. Please try again.';
    errEl.hidden = false;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Application';
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click',   closeModal);
document.getElementById('cancel-apply').addEventListener('click',  closeModal);
document.getElementById('success-close').addEventListener('click', closeModal);
document.getElementById('apply-modal').addEventListener('click',   e => { if (e.target === e.currentTarget) closeModal(); });

document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
document.getElementById('job-detail-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDetailModal(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('apply-modal').hidden)      closeModal();
    if (!document.getElementById('job-detail-modal').hidden) closeDetailModal();
  }
});
document.getElementById('apply-form').addEventListener('submit', handleSubmit);

// All four dropdown selects trigger a re-render immediately
['filter-location-type', 'filter-location', 'filter-team', 'filter-work-type'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderJobs);
});
document.getElementById('search').addEventListener('input', renderJobs);

// ── Init ──────────────────────────────────────────────────────────────────────
loadJobs();
if (window.lucide) lucide.createIcons();
