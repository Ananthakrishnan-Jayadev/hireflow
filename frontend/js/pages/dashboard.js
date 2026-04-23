import { renderTopbar } from '../components/topbar.js';
import { api } from '../api.js';
import { showError } from '../components/toast.js';
import { createFunnelChart, destroyAll } from '../components/charts.js';
import { timeAgo, escapeHtml } from '../utils/helpers.js';

export async function render(container, params) {
  container.innerHTML = `
    ${renderTopbar({ title: 'Dashboard', subtitle: 'Hiring overview' })}
    <div class="page-content">
      <div id="dash-content">
        <div class="page-loader"><div class="spinner"><div class="spinner-circle"></div></div></div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  // Load all dashboard data in parallel
  let overview, pipeline, activity;
  try {
    [overview, pipeline, activity] = await Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/pipeline'),
      api.get('/analytics/recent-activity'),
    ]);
  } catch (err) {
    showError('Failed to load dashboard: ' + err.message);
    document.getElementById('dash-content').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <i data-lucide="alert-triangle" class="empty-state-icon" style="color:var(--color-error);"></i>
        <h2 class="empty-state-title">Failed to load dashboard</h2>
        <p class="empty-state-desc">${err.message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()" style="margin-top:16px;">
          Retry
        </button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const dash = document.getElementById('dash-content');
  dash.innerHTML = dashboardHtml(overview);
  if (window.lucide) lucide.createIcons();

  // Pipeline funnel chart
  if (pipeline.length > 0) {
    const ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const sorted = [...pipeline].sort((a, b) => {
      const ai = ORDER.indexOf(a.stage), bi = ORDER.indexOf(b.stage);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    createFunnelChart(
      'pipeline-chart',
      sorted.map(s => s.stage),
      sorted.map(s => s.count),
    );
  } else {
    document.getElementById('pipeline-chart-wrap').innerHTML =
      '<p class="dash-empty" style="text-align:center;padding-top:60px">No candidates yet.</p>';
  }

  // Recent activity list
  const feedEl = document.getElementById('activity-feed');
  if (activity.length === 0) {
    feedEl.innerHTML = '<p class="dash-empty">No activity yet.</p>';
  } else {
    feedEl.innerHTML = activity.map(activityRow).join('');
    if (window.lucide) lucide.createIcons();
  }

  return () => destroyAll();
}

// ── HTML builders ──────────────────────────────────────────────────────────
function dashboardHtml(o) {
  const rate = (o.conversion_rate ?? 0).toFixed(1);
  const rateNum = parseFloat(rate);

  // Derive simple trend signals from available data
  const candTrend = o.candidates_this_month > 0
    ? { up: true, label: `+${o.candidates_this_month} this mo` }
    : null;
  const rateTrend = rateNum > 0
    ? { up: rateNum >= 20, label: `${rate}% conv.` }
    : null;
  const emailTrend = o.emails_sent_this_month > 0
    ? { up: true, label: `+${o.emails_sent_this_month} this mo` }
    : null;

  return `
    <div class="dash-stats-grid">
      ${statCard('briefcase',   'Open Jobs',           o.open_jobs,            `${o.total_jobs} roles total`,            '#/jobs')}
      ${statCard('users',       'Total Candidates',    o.total_candidates,     'across all roles',                       '#/candidates', candTrend)}
      ${statCard('user-check',  'Hired',               o.hired_count,          'successfully placed',                    '#/candidates', rateTrend)}
      ${statCard('calendar',    'Upcoming Interviews', o.upcoming_interviews,  `${o.total_interviews} scheduled total`,  '#/interviews')}
      ${statCard('mail',        'Emails Sent',         o.emails_sent_total,    'total outreach',                         '#/emails', emailTrend)}
    </div>

    <div class="dash-lower">
      <div class="dash-card">
        <h2 class="dash-card-title" style="display:flex;align-items:center;gap:7px;">
          <i data-lucide="git-merge" style="width:15px;height:15px;color:var(--accent);"></i>
          Hiring Funnel
        </h2>
        <p class="dash-card-sub">Stage-by-stage drop-off — hover for conversion rates</p>
        <div class="dash-chart-wrap" id="pipeline-chart-wrap">
          <canvas id="pipeline-chart"></canvas>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-header">
          <div>
            <h2 class="dash-card-title">Recent Activity</h2>
            <p class="dash-card-sub">Latest hiring actions</p>
          </div>
          <a href="#/analytics" class="dash-link">Full analytics →</a>
        </div>
        <div id="activity-feed" class="activity-feed"></div>
      </div>
    </div>
  `;
}

function statCard(icon, label, value, sub, href, trend) {
  const trendHtml = trend
    ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px;margin-left:6px;
         ${trend.up ? 'background:#dcfce7;color:#16a34a;' : 'background:#fee2e2;color:#dc2626;'}">
         ${trend.up ? '↑' : '↓'} ${trend.label}
       </span>`
    : '';
  return `
    <a class="dash-stat-card" href="${href}">
      <div class="dash-stat-icon"><i data-lucide="${icon}"></i></div>
      <div class="dash-stat-body">
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px;">
          <div class="dash-stat-value">${value}</div>
          ${trendHtml}
        </div>
        <div class="dash-stat-label">${label}</div>
        <div class="dash-stat-sub">${sub}</div>
      </div>
    </a>`;
}

const ACTIVITY_ICONS = {
  stage_changed:       'arrow-right',
  email_sent:          'mail',
  note_added:          'file-text',
  scorecard_submitted: 'star',
  applied:             'user-plus',
  interview_scheduled: 'calendar',
};

function activityRow(a) {
  const icon = ACTIVITY_ICONS[a.activity_type] ?? 'activity';
  return `
    <div class="activity-row">
      <span class="activity-icon"><i data-lucide="${icon}"></i></span>
      <div class="activity-body">
        <p class="activity-content">${escapeHtml(a.content)}</p>
        <span class="activity-time">${timeAgo(a.created_at)}</span>
      </div>
    </div>`;
}
