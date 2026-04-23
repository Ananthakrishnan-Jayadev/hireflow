/**
 * biasAuditor.js — Reusable bias-check panel.
 *
 * Usage:
 *   import { attachBiasAuditor } from '../components/biasAuditor.js';
 *   attachBiasAuditor({ getTextFn: () => textarea.value, containerId: 'bias-wrap' });
 */
import { api } from '../api.js';
import { showError } from './toast.js';

const CATEGORY_LABELS = {
  gender_coded:      { label: 'Gender-coded',      color: '#7c3aed', bg: '#f5f3ff' },
  age_bias:          { label: 'Age bias',           color: '#d97706', bg: '#fffbeb' },
  ableist:           { label: 'Ableist',            color: '#dc2626', bg: '#fef2f2' },
  exclusionary:      { label: 'Exclusionary',       color: '#0369a1', bg: '#e0f2fe' },
  overly_restrictive:{ label: 'Overly restrictive', color: '#059669', bg: '#ecfdf5' },
};

function _cat(c) {
  return CATEGORY_LABELS[c] || { label: c, color: '#6b7280', bg: '#f3f4f6' };
}

function _scoreColor(s) {
  return s >= 80 ? '#16a34a' : s >= 55 ? '#d97706' : '#dc2626';
}

function _meterHtml(score) {
  const color = _scoreColor(score);
  return `
    <div style="margin:14px 0 10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">Inclusivity score</span>
        <span style="font-size:22px;font-weight:800;color:${color};">${score}<span style="font-size:13px;font-weight:500;">/100</span></span>
      </div>
      <div style="height:8px;background:var(--border-light);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${score}%;background:${color};border-radius:4px;transition:width .5s ease;"></div>
      </div>
    </div>`;
}

function _flagHtml(flag) {
  const cat = _cat(flag.category);
  return `
    <div style="border:1px solid ${cat.bg === '#f3f4f6' ? 'var(--border)' : cat.color + '40'};
         border-left:3px solid ${cat.color};border-radius:8px;padding:12px 14px;margin-bottom:10px;
         background:${cat.bg};">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
             padding:2px 7px;border-radius:20px;background:${cat.color}20;color:${cat.color};">
          ${cat.label}
        </span>
        <span style="font-size:13px;font-weight:600;color:var(--text-primary);">"${flag.phrase}"</span>
      </div>
      <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:6px;line-height:1.5;">
        ${flag.reason}
      </p>
      <div style="display:flex;align-items:flex-start;gap:6px;">
        <i data-lucide="lightbulb" style="width:13px;height:13px;color:#16a34a;flex-shrink:0;margin-top:2px;"></i>
        <span style="font-size:12.5px;color:#16a34a;font-weight:500;">${flag.suggestion}</span>
      </div>
    </div>`;
}

export function attachBiasAuditor({ getTextFn, containerId }) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  wrap.innerHTML = `
    <button type="button" id="bias-check-btn"
      style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;
             border:1px solid #7c3aed40;border-radius:7px;background:#f5f3ff;
             color:#7c3aed;font-size:12.5px;font-weight:600;cursor:pointer;
             font-family:inherit;transition:background .15s,border-color .15s;"
      onmouseover="this.style.background='#ede9fe';this.style.borderColor='#7c3aed80'"
      onmouseout="this.style.background='#f5f3ff';this.style.borderColor='#7c3aed40'">
      <i data-lucide="shield-check" style="width:14px;height:14px;"></i>
      Check for Bias
    </button>
    <div id="bias-result-wrap" style="display:none;margin-top:12px;"></div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });

  document.getElementById('bias-check-btn').addEventListener('click', async () => {
    const text = getTextFn();
    if (!text || text.trim().length < 20) {
      showError('Please enter some text first before checking for bias.');
      return;
    }

    const btn = document.getElementById('bias-check-btn');
    const resultWrap = document.getElementById('bias-result-wrap');

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Analysing…`;
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
    resultWrap.style.display = 'none';

    try {
      const res = await api.post('/ai/bias-check', { text });
      _renderResult(resultWrap, res);
    } catch (err) {
      showError('Bias check failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="shield-check" style="width:14px;height:14px;"></i> Check for Bias`;
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }
  });
}

function _renderResult(wrap, res) {
  const hasFlags = res.flags && res.flags.length > 0;
  const headerColor = res.is_inclusive ? '#16a34a' : '#dc2626';
  const headerBg    = res.is_inclusive ? '#f0fdf4' : '#fef2f2';
  const headerIcon  = res.is_inclusive ? 'shield-check' : 'shield-alert';
  const headerText  = res.is_inclusive ? 'Looking inclusive!' : `${res.flags.length} concern${res.flags.length > 1 ? 's' : ''} found`;

  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div style="border:1px solid ${headerColor}30;border-radius:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:9px;padding:12px 14px;background:${headerBg};
           border-bottom:${hasFlags ? '1px solid ' + headerColor + '20' : 'none'};">
        <i data-lucide="${headerIcon}" style="width:16px;height:16px;color:${headerColor};flex-shrink:0;"></i>
        <span style="font-size:13px;font-weight:700;color:${headerColor};">${headerText}</span>
        <span style="font-size:12px;color:${headerColor};margin-left:auto;opacity:.8;">${res.summary}</span>
      </div>
      ${_meterHtml(res.score)}
      <div style="padding:0 14px 14px;">
        ${hasFlags ? res.flags.map(_flagHtml).join('') : '<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px 0;">No issues detected. Great work!</p>'}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });
}
