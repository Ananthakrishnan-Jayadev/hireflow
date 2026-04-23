/**
 * charts.js — Chart.js wrappers with rich, interpretive styling for ShyftHatch.
 * Chart.js is loaded globally via CDN in index.html (window.Chart).
 */

// ── Palette ────────────────────────────────────────────────────────────────
const PALETTE = [
  '#1e3a5f', // primary dark blue
  '#2d9d6e', // green
  '#e07b39', // orange
  '#7c5cbf', // purple
  '#d44e6e', // rose
  '#2d82b7', // sky blue
  '#c9a93c', // gold
  '#3d9970', // teal
];

// Stage-specific colours for consistent pipeline visualisation
const STAGE_COLORS = {
  'Applied':   '#3b82f6',
  'Screening': '#f59e0b',
  'Interview': '#8b5cf6',
  'Offer':     '#06b6d4',
  'Hired':     '#10b981',
  'Rejected':  '#ef4444',
};

const TICK = { font: { family: "'Inter', sans-serif", size: 11 }, color: '#6b7280' };
const GRID = { color: 'rgba(229,231,235,0.7)', drawBorder: false };

// ── Instance registry ──────────────────────────────────────────────────────
const _registry = new Map();

function _destroy(id) {
  const c = _registry.get(id);
  if (c) { c.destroy(); _registry.delete(id); }
}
function _register(id, chart) { _destroy(id); _registry.set(id, chart); return chart; }

export function destroyChart(id) { _destroy(id); }
export function destroyAll() { _registry.forEach(c => c.destroy()); _registry.clear(); }

// ── Helper: gradient fill for line charts ─────────────────────────────────
function _gradient(ctx, color, alpha1 = 0.35, alpha2 = 0.02) {
  const h = ctx.canvas.clientHeight || 200;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, color + _alphaHex(alpha1));
  g.addColorStop(1, color + _alphaHex(alpha2));
  return g;
}
function _alphaHex(a) { return Math.round(a * 255).toString(16).padStart(2, '0'); }

// ── Helper: stage colour lookup ────────────────────────────────────────────
function _stageColor(label, idx) {
  return STAGE_COLORS[label] ?? PALETTE[idx % PALETTE.length];
}

// ── 1. Horizontal bar — pipeline stage counts ──────────────────────────────
export function createBarChart(canvasId, labels, data, opts = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const total   = data.reduce((s, v) => s + v, 0) || 1;
  const colors  = labels.map((l, i) => _stageColor(l, i));
  const title   = opts.title || '';
  const suffix  = opts.suffix || '';

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => {
              const pct = ((c.parsed.x / total) * 100).toFixed(1);
              return `  ${c.parsed.x}${suffix} (${pct}% of total)`;
            },
          },
          backgroundColor: '#1e293b',
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "'Inter', sans-serif", size: 12 },
          bodyFont:  { family: "'Inter', sans-serif", size: 12 },
        },
        // Inline data labels
        datalabels: false,
      },
      scales: {
        x: {
          ticks: { ...TICK, precision: 0 },
          grid: GRID,
          border: { display: false },
        },
        y: {
          ticks: { ...TICK },
          grid: { display: false },
          border: { display: false },
        },
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
    },
    // Draw percentage labels on each bar
    plugins: [{
      id: 'barLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c, data } = chart;
        c.save();
        c.font = "500 11px 'Inter', sans-serif";
        c.fillStyle = '#4b5563';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const val = data.datasets[0].data[i];
          const pct = ((val / total) * 100).toFixed(0);
          c.fillText(`${val}  (${pct}%)`, bar.x + 6, bar.y);
        });
        c.restore();
      },
    }],
  });

  return _register(canvasId, chart);
}

// ── 2. Line chart — candidates over time ──────────────────────────────────
export function createLineChart(canvasId, labels, data, opts = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const color    = opts.color || PALETTE[0];
  const label    = opts.label || 'Candidates';
  const showAvg  = opts.showAvg !== false;

  // Compute 3-week moving average
  const movingAvg = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 2), i + 1);
    return +(slice.reduce((s, v) => s + v, 0) / slice.length).toFixed(1);
  });

  const datasets = [
    {
      label,
      data,
      borderColor:     color,
      backgroundColor: (c) => _gradient(c.chart.ctx, color),
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: '#fff',
      pointBorderColor: color,
      pointBorderWidth: 2,
      borderWidth: 2.5,
      order: 1,
    },
  ];

  if (showAvg && data.length >= 3) {
    datasets.push({
      label: '3-wk avg',
      data: movingAvg,
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [5, 4],
      order: 2,
    });
  }

  // Trend: compare last 3 vs previous 3 weeks
  const trendText = _trendText(data);

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: showAvg && data.length >= 3,
          position: 'top',
          align: 'end',
          labels: { ...TICK, boxWidth: 20, padding: 12, usePointStyle: true, pointStyleWidth: 14 },
        },
        tooltip: {
          callbacks: {
            title: items => `Week of ${items[0].label}`,
            label: c => `  ${c.dataset.label}: ${c.parsed.y}`,
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              if (idx > 0) {
                const prev = data[idx - 1], curr = data[idx];
                const delta = curr - prev;
                const sign  = delta >= 0 ? '+' : '';
                return [`  vs prev week: ${sign}${delta}`];
              }
              return [];
            },
          },
          backgroundColor: '#1e293b',
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          bodyFont:  { family: "'Inter', sans-serif", size: 12 },
        },
      },
      scales: {
        x: {
          ticks: { ...TICK, maxRotation: 0 },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: { ...TICK, precision: 0 },
          grid: GRID,
          border: { display: false },
          beginAtZero: true,
        },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });

  // Attach trend badge if container has id `*-wrap`
  const wrap = ctx.closest('[id$="-wrap"]') || ctx.parentElement;
  if (wrap && trendText) {
    const badge = document.createElement('div');
    badge.style.cssText = `position:absolute;top:0;right:0;font-size:11px;font-weight:600;
      padding:3px 9px;border-radius:20px;${trendText.up
        ? 'background:#dcfce7;color:#16a34a;'
        : 'background:#fee2e2;color:#dc2626;'}`;
    badge.textContent = trendText.label;
    wrap.style.position = 'relative';
    wrap.appendChild(badge);
  }

  return _register(canvasId, chart);
}

function _trendText(data) {
  if (data.length < 6) return null;
  const recent = data.slice(-3).reduce((s, v) => s + v, 0);
  const prev   = data.slice(-6, -3).reduce((s, v) => s + v, 0);
  if (prev === 0) return null;
  const pct = Math.round(((recent - prev) / prev) * 100);
  return pct >= 0
    ? { up: true,  label: `↑ ${pct}% vs prior 3 wks` }
    : { up: false, label: `↓ ${Math.abs(pct)}% vs prior 3 wks` };
}

// ── 3. Doughnut chart — with centre label ─────────────────────────────────
export function createDoughnutChart(canvasId, labels, data, opts = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const total  = data.reduce((s, v) => s + v, 0);
  const colors = labels.map((l, i) => _stageColor(l, i));
  const centerLabel = opts.centerLabel || String(total);
  const centerSub   = opts.centerSub   || 'total';

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'dd'),
        borderColor: '#fff',
        borderWidth: 2.5,
        hoverOffset: 8,
        hoverBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            ...TICK,
            boxWidth: 11,
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0];
              return chart.data.labels.map((label, i) => ({
                text: `${label}  ${ds.data[i]}  (${((ds.data[i] / total) * 100).toFixed(0)}%)`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: ds.backgroundColor[i],
                hidden: false,
                index: i,
              }));
            },
          },
        },
        tooltip: {
          callbacks: {
            label: c => {
              const pct = ((c.parsed / total) * 100).toFixed(1);
              return `  ${c.label}: ${c.parsed} (${pct}%)`;
            },
          },
          backgroundColor: '#1e293b',
          padding: 10,
          cornerRadius: 8,
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
        },
      },
      animation: { animateRotate: true, duration: 700 },
    },
    // Centre label plugin
    plugins: [{
      id: 'centreLabel',
      beforeDraw(chart) {
        const { width, height, ctx: c } = chart;
        const cx = chart.chartArea ? (chart.chartArea.left + chart.chartArea.right) / 2 : width / 2;
        const cy = chart.chartArea ? (chart.chartArea.top + chart.chartArea.bottom) / 2 : height / 2;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `700 22px 'Inter', sans-serif`;
        c.fillStyle = '#1a1d21';
        c.fillText(centerLabel, cx, cy - 8);
        c.font = `400 11px 'Inter', sans-serif`;
        c.fillStyle = '#6b7280';
        c.fillText(centerSub, cx, cy + 12);
        c.restore();
      },
    }],
  });

  return _register(canvasId, chart);
}

// ── 4. Funnel / stacked bar — pipeline drop-off ────────────────────────────
export function createFunnelChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const max    = Math.max(...data, 1);
  const colors = labels.map((l, i) => _stageColor(l, i));

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 1.5,
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: 'bottom',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => {
              const val  = c.parsed.y;
              const pct  = ((val / data[0]) * 100).toFixed(0);
              const prev = c.dataIndex > 0 ? data[c.dataIndex - 1] : null;
              const drop = prev ? ` (${((1 - val / prev) * 100).toFixed(0)}% drop from prev)` : '';
              return `  ${val} candidates  —  ${pct}% of applicants${drop}`;
            },
          },
          backgroundColor: '#1e293b',
          padding: 12,
          cornerRadius: 8,
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
        },
      },
      scales: {
        x: {
          ticks: { ...TICK },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: { ...TICK, precision: 0 },
          grid: GRID,
          border: { display: false },
          beginAtZero: true,
        },
      },
      animation: { duration: 700, easing: 'easeOutQuart' },
    },
    // Draw value + conversion % labels on top of each bar
    plugins: [{
      id: 'funnelLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c, data: d } = chart;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'bottom';
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const val  = d.datasets[0].data[i];
          const pct  = ((val / data[0]) * 100).toFixed(0);
          c.font = `600 12px 'Inter', sans-serif`;
          c.fillStyle = '#1e293b';
          c.fillText(val, bar.x, bar.y - 4);
          if (i > 0) {
            const drop = ((1 - val / data[i - 1]) * 100).toFixed(0);
            c.font = `400 10px 'Inter', sans-serif`;
            c.fillStyle = parseInt(drop) > 30 ? '#ef4444' : '#6b7280';
            c.fillText(`↓${drop}%`, bar.x, bar.y - 18);
          }
        });
        c.restore();
      },
    }],
  });

  return _register(canvasId, chart);
}

// ── 5. Multi-line chart — for comparisons ─────────────────────────────────
export function createMultiLineChart(canvasId, labels, seriesList) {
  // seriesList: [{ label, data, color? }]
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const datasets = seriesList.map((s, i) => {
    const color = s.color || PALETTE[i % PALETTE.length];
    return {
      label: s.label,
      data: s.data,
      borderColor: color,
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: '#fff',
      pointBorderColor: color,
      pointBorderWidth: 2,
      borderWidth: 2,
    };
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { ...TICK, boxWidth: 20, padding: 12, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          bodyFont:  { family: "'Inter', sans-serif", size: 12 },
        },
      },
      scales: {
        x: { ticks: { ...TICK, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
        y: { ticks: { ...TICK, precision: 0 },   grid: GRID,               border: { display: false }, beginAtZero: true },
      },
      animation: { duration: 700 },
    },
  });

  return _register(canvasId, chart);
}
