import { renderTopbar } from '../components/topbar.js';
import { api } from '../api.js';
import { showError } from '../components/toast.js';
import {
  createFunnelChart,
  createDoughnutChart,
  createLineChart,
  destroyAll,
} from '../components/charts.js';
import { escapeHtml } from '../utils/helpers.js';

export async function render(container, params) {
  container.innerHTML = `
    ${renderTopbar({ title: 'Analytics', subtitle: 'Hiring metrics and insights' })}
    <div class="page-content">
      <div id="analytics-content">
        <div class="page-loader"><div class="spinner"><div class="spinner-circle"></div></div></div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  let pipeline, sources, timeline, jobs, overview;
  try {
    [pipeline, sources, timeline, jobs, overview] = await Promise.all([
      api.get('/analytics/pipeline'),
      api.get('/analytics/by-source'),
      api.get('/analytics/candidates-over-time'),
      api.get('/analytics/by-job'),
      api.get('/analytics/overview'),
    ]);
  } catch (err) {
    showError('Failed to load analytics: ' + err.message);
    document.getElementById('analytics-content').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <h2 class="empty-state-title">Failed to load analytics</h2>
        <p class="empty-state-desc">${err.message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()" style="margin-top:16px;">Retry</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const content = document.getElementById('analytics-content');
  content.innerHTML = _html();
  if (window.lucide) lucide.createIcons();

  _renderInsights(pipeline, sources, timeline, overview);
  _renderPipeline(pipeline);
  _renderSources(sources);
  _renderTimeline(timeline);
  _renderJobsTable(jobs);

  return () => destroyAll();
}

// ── Insight cards ─────────────────────────────────────────────────────────

function _renderInsights(pipeline, sources, timeline, overview) {
  const wrap = document.getElementById('insight-cards');

  // 1. Conversion rate
  const rate = (overview?.conversion_rate ?? 0).toFixed(1);

  // 2. Biggest bottleneck — stage with largest drop from previous
  let bottleneck = '—';
  for (let i = 1; i < pipeline.length; i++) {
    const prev = pipeline[i - 1].count, curr = pipeline[i].count;
    if (prev > 0) {
      const drop = ((1 - curr / prev) * 100);
      if (drop > 50) { bottleneck = `${pipeline[i - 1].stage} → ${pipeline[i].stage} (${drop.toFixed(0)}% drop)`; break; }
    }
  }

  // 3. Top source
  const topSource = sources.length
    ? sources.sort((a, b) => b.count - a.count)[0]
    : null;

  // 4. 4-week trend
  const last4  = timeline.slice(-4).reduce((s, w) => s + w.count, 0);
  const prev4  = timeline.slice(-8, -4).reduce((s, w) => s + w.count, 0);
  const trendPct = prev4 ? Math.round(((last4 - prev4) / prev4) * 100) : null;

  wrap.innerHTML = [
    _insightCard(
      'user-check', '#10b981', '#f0fdf4',
      'Offer → Hire Rate',
      `${rate}%`,
      rate >= 50 ? 'Healthy conversion' : rate >= 20 ? 'Room to improve' : 'Needs attention',
      parseFloat(rate) >= 50,
    ),
    _insightCard(
      'alert-triangle', '#f59e0b', '#fffbeb',
      'Pipeline Bottleneck',
      bottleneck === '—' ? 'None detected' : bottleneck.split('(')[0].trim(),
      bottleneck === '—' ? 'Flow looks healthy' : bottleneck.includes('(') ? bottleneck.split('(')[1].replace(')', '') : '',
      bottleneck === '—',
    ),
    _insightCard(
      'trending-up', '#3b82f6', '#eff6ff',
      'Top Candidate Source',
      topSource ? topSource.source.charAt(0).toUpperCase() + topSource.source.slice(1) : '—',
      topSource ? `${topSource.count} applications` : 'No data yet',
      true,
    ),
    _insightCard(
      trendPct !== null && trendPct >= 0 ? 'trending-up' : 'trending-down',
      trendPct !== null && trendPct >= 0 ? '#10b981' : '#ef4444',
      trendPct !== null && trendPct >= 0 ? '#f0fdf4' : '#fef2f2',
      'Application Velocity',
      trendPct !== null ? `${trendPct >= 0 ? '+' : ''}${trendPct}%` : '—',
      'vs prior 4 weeks',
      trendPct === null || trendPct >= 0,
    ),
  ].join('');

  if (window.lucide) lucide.createIcons();
}

function _insightCard(icon, iconColor, iconBg, title, value, sub, positive) {
  return `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
         padding:18px 20px;display:flex;align-items:flex-start;gap:14px;">
      <div style="width:42px;height:42px;border-radius:10px;background:${iconBg};
           flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <i data-lucide="${icon}" style="width:18px;height:18px;color:${iconColor};"></i>
      </div>
      <div style="min-width:0;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-muted);margin-bottom:4px;">${title}</div>
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);line-height:1.2;
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${sub}</div>
      </div>
    </div>`;
}

// ── Pipeline funnel ───────────────────────────────────────────────────────

function _renderPipeline(pipeline) {
  if (!pipeline.length) {
    document.getElementById('chart-pipeline').closest('.a-chart-wrap').innerHTML =
      '<p style="text-align:center;padding:60px 0;color:var(--text-muted);">No candidates yet.</p>';
    return;
  }
  // Sort by logical funnel order
  const ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  const sorted = [...pipeline].sort((a, b) => {
    const ai = ORDER.indexOf(a.stage), bi = ORDER.indexOf(b.stage);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  createFunnelChart('chart-pipeline', sorted.map(s => s.stage), sorted.map(s => s.count));
}

// ── Source doughnut ───────────────────────────────────────────────────────

function _renderSources(sources) {
  if (!sources.length) {
    document.getElementById('chart-source').closest('.a-chart-wrap').innerHTML =
      '<p style="text-align:center;padding:60px 0;color:var(--text-muted);">No source data yet.</p>';
    return;
  }
  const total = sources.reduce((s, x) => s + x.count, 0);
  createDoughnutChart(
    'chart-source',
    sources.map(s => s.source.charAt(0).toUpperCase() + s.source.slice(1)),
    sources.map(s => s.count),
    { centerLabel: String(total), centerSub: 'applicants' },
  );
}

// ── Timeline line chart ───────────────────────────────────────────────────

function _renderTimeline(timeline) {
  if (!timeline.length) {
    document.getElementById('timeline-wrap').innerHTML =
      '<p style="text-align:center;padding:40px 0;color:var(--text-muted);">Not enough data — add some candidates first.</p>';
    return;
  }
  const labels = timeline.map(w => {
    const d = new Date(w.week);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  createLineChart('chart-timeline', labels, timeline.map(w => w.count), {
    label: 'Applications',
    showAvg: true,
  });
}

// ── Jobs table ────────────────────────────────────────────────────────────

function _renderJobsTable(jobs) {
  const wrap = document.getElementById('jobs-table-wrap');
  if (!jobs.length) {
    wrap.innerHTML = '<p style="padding:20px;color:var(--text-muted);">No jobs data yet.</p>';
    return;
  }

  const max = Math.max(...jobs.map(j => j.candidate_count), 1);

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);background:var(--bg-card-hover);">
          <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Job</th>
          <th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Applied</th>
          <th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Hired</th>
          <th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Conv. Rate</th>
          <th style="padding:11px 16px;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Volume vs max</th>
        </tr>
      </thead>
      <tbody>
        ${jobs.map(j => _jobRow(j, max)).join('')}
      </tbody>
    </table>`;
}

function _jobRow(j, max) {
  const rate = j.candidate_count > 0
    ? ((j.hired_count / j.candidate_count) * 100).toFixed(1)
    : '0.0';
  const pct = Math.round((j.candidate_count / max) * 100);
  const rateNum = parseFloat(rate);
  const rateColor = rateNum >= 20 ? '#16a34a' : rateNum >= 5 ? '#d97706' : '#dc2626';

  return `
    <tr style="border-bottom:1px solid var(--border-light);"
        onmouseover="this.style.background='var(--bg-card-hover)'"
        onmouseout="this.style.background=''">
      <td style="padding:13px 16px;">
        <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);">${escapeHtml(j.job_title)}</div>
      </td>
      <td style="padding:13px 16px;text-align:right;font-size:14px;font-weight:700;color:var(--text-primary);">
        ${j.candidate_count}
      </td>
      <td style="padding:13px 16px;text-align:right;font-size:14px;color:var(--text-secondary);">
        ${j.hired_count}
      </td>
      <td style="padding:13px 16px;text-align:right;">
        <span style="font-size:13px;font-weight:700;color:${rateColor};">${rate}%</span>
      </td>
      <td style="padding:13px 16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:7px;background:var(--border-light);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;
                 transition:width .6s ease;"></div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);width:30px;text-align:right;">${pct}%</span>
        </div>
      </td>
    </tr>`;
}

// ── Page HTML ──────────────────────────────────────────────────────────────

function _html() {
  return `
    <!-- Insight summary row -->
    <div id="insight-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px;"></div>

    <div class="analytics-grid">
      <!-- Pipeline funnel -->
      <div class="analytics-card analytics-card-half">
        <div style="margin-bottom:14px;">
          <h2 class="dash-card-title" style="display:flex;align-items:center;gap:7px;">
            <i data-lucide="git-merge" style="width:15px;height:15px;color:var(--accent);"></i>
            Hiring Funnel
          </h2>
          <p class="dash-card-sub">Drop-off between each pipeline stage</p>
        </div>
        <div class="a-chart-wrap" style="height:240px;">
          <canvas id="chart-pipeline"></canvas>
        </div>
      </div>

      <!-- Source doughnut -->
      <div class="analytics-card analytics-card-half">
        <div style="margin-bottom:14px;">
          <h2 class="dash-card-title" style="display:flex;align-items:center;gap:7px;">
            <i data-lucide="pie-chart" style="width:15px;height:15px;color:var(--accent);"></i>
            Applications by Source
          </h2>
          <p class="dash-card-sub">Where candidates are coming from</p>
        </div>
        <div class="a-chart-wrap" style="height:240px;">
          <canvas id="chart-source"></canvas>
        </div>
      </div>

      <!-- Timeline -->
      <div class="analytics-card analytics-card-full">
        <div style="margin-bottom:14px;">
          <h2 class="dash-card-title" style="display:flex;align-items:center;gap:7px;">
            <i data-lucide="trending-up" style="width:15px;height:15px;color:var(--accent);"></i>
            Application Volume Over Time
          </h2>
          <p class="dash-card-sub">Weekly applications — dashed line shows 3-week moving average</p>
        </div>
        <div id="timeline-wrap" class="a-chart-wrap" style="height:220px;position:relative;">
          <canvas id="chart-timeline"></canvas>
        </div>
      </div>

      <!-- Jobs table -->
      <div class="analytics-card analytics-card-full">
        <div style="margin-bottom:14px;">
          <h2 class="dash-card-title" style="display:flex;align-items:center;gap:7px;">
            <i data-lucide="briefcase" style="width:15px;height:15px;color:var(--accent);"></i>
            Performance by Job
          </h2>
          <p class="dash-card-sub">Application volume and conversion rates per open role</p>
        </div>
        <div id="jobs-table-wrap" style="overflow-x:auto;"></div>
      </div>
    </div>
  `;
}
