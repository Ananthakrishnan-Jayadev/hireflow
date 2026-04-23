import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { UserCheck, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../lib/api';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

interface PipelineStage { stage: string; count: number; }
interface SourceData { source: string; count: number; }
interface TimelineEntry { week: string; count: number; }
interface JobPerf { job_title: string; candidate_count: number; hired_count: number; }
interface Overview { conversion_rate: number; }

const STAGE_ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const CHART_COLORS = ['#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [jobs, setJobs] = useState<JobPerf[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<PipelineStage[]>('/analytics/pipeline'),
      api.get<SourceData[]>('/analytics/by-source'),
      api.get<TimelineEntry[]>('/analytics/candidates-over-time'),
      api.get<JobPerf[]>('/analytics/by-job'),
      api.get<Overview>('/analytics/overview'),
    ]).then(([pl, src, tl, jb, ov]) => {
      const sorted = [...pl].sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.stage), bi = STAGE_ORDER.indexOf(b.stage);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setPipeline(sorted);
      setSources(src);
      setTimeline(tl);
      setJobs(jb);
      setOverview(ov);
    }).catch(err => toast.error('Failed to load analytics: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  // Compute insights
  const rate = (overview?.conversion_rate ?? 0).toFixed(1);
  let bottleneck = '—';
  for (let i = 1; i < pipeline.length; i++) {
    const prev = pipeline[i - 1].count, curr = pipeline[i].count;
    if (prev > 0) {
      const drop = (1 - curr / prev) * 100;
      if (drop > 50) { bottleneck = `${pipeline[i - 1].stage} → ${pipeline[i].stage} (${drop.toFixed(0)}% drop)`; break; }
    }
  }
  const topSource = sources.length ? [...sources].sort((a, b) => b.count - a.count)[0] : null;
  const last4 = timeline.slice(-4).reduce((s, w) => s + w.count, 0);
  const prev4 = timeline.slice(-8, -4).reduce((s, w) => s + w.count, 0);
  const trendPct = prev4 ? Math.round(((last4 - prev4) / prev4) * 100) : null;

  const tlLabels = timeline.map(w => {
    const d = new Date(w.week);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  const tlData = timeline.map(w => w.count);
  const avg = tlData.length ? tlData.reduce((s, v) => s + v, 0) / tlData.length : 0;

  const jobsMax = Math.max(...jobs.map(j => j.candidate_count), 1);

  return (
    <div>
      <Topbar title="Analytics" subtitle="Hiring metrics and insights" />
      <div className="page-content">
        {/* Insight cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
          <InsightCard icon={<UserCheck size={18} />} iconColor="#10b981" iconBg="#f0fdf4"
            title="Offer → Hire Rate" value={`${rate}%`}
            sub={parseFloat(rate) >= 50 ? 'Healthy conversion' : parseFloat(rate) >= 20 ? 'Room to improve' : 'Needs attention'} />
          <InsightCard icon={<AlertTriangle size={18} />} iconColor="#f59e0b" iconBg="#fffbeb"
            title="Pipeline Bottleneck"
            value={bottleneck === '—' ? 'None detected' : bottleneck.split('(')[0].trim()}
            sub={bottleneck === '—' ? 'Flow looks healthy' : bottleneck.includes('(') ? bottleneck.split('(')[1]?.replace(')', '') ?? '' : ''} />
          <InsightCard icon={<TrendingUp size={18} />} iconColor="#3b82f6" iconBg="#eff6ff"
            title="Top Candidate Source"
            value={topSource ? topSource.source.charAt(0).toUpperCase() + topSource.source.slice(1) : '—'}
            sub={topSource ? `${topSource.count} applications` : 'No data yet'} />
          <InsightCard
            icon={trendPct != null && trendPct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            iconColor={trendPct != null && trendPct >= 0 ? '#10b981' : '#ef4444'}
            iconBg={trendPct != null && trendPct >= 0 ? '#f0fdf4' : '#fef2f2'}
            title="Application Velocity"
            value={trendPct != null ? `${trendPct >= 0 ? '+' : ''}${trendPct}%` : '—'}
            sub="vs prior 4 weeks" />
        </div>

        <div className="analytics-grid">
          {/* Funnel */}
          <div className="analytics-card analytics-card-half">
            <h2 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              Hiring Funnel
            </h2>
            <p className="dash-card-sub">Drop-off between each pipeline stage</p>
            <div className="a-chart-wrap" style={{ height: 240 }}>
              {pipeline.length > 0 ? (
                <Bar data={{
                  labels: pipeline.map(s => s.stage),
                  datasets: [{ label: 'Candidates', data: pipeline.map(s => s.count), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 6 }],
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Source doughnut */}
          <div className="analytics-card analytics-card-half">
            <h2 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              Applications by Source
            </h2>
            <p className="dash-card-sub">Where candidates are coming from</p>
            <div className="a-chart-wrap" style={{ height: 240 }}>
              {sources.length > 0 ? (
                <Doughnut data={{
                  labels: sources.map(s => s.source.charAt(0).toUpperCase() + s.source.slice(1)),
                  datasets: [{ data: sources.map(s => s.count), backgroundColor: CHART_COLORS, borderWidth: 2 }],
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Timeline */}
          <div className="analytics-card analytics-card-full">
            <h2 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              Application Volume Over Time
            </h2>
            <p className="dash-card-sub">Weekly applications — dashed line shows average</p>
            <div className="a-chart-wrap" style={{ height: 220 }}>
              {timeline.length > 0 ? (
                <Line data={{
                  labels: tlLabels,
                  datasets: [
                    { label: 'Applications', data: tlData, borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.1)', fill: true, tension: 0.35, pointRadius: 3 },
                    { label: 'Avg', data: tlData.map(() => avg), borderColor: '#9ca3af', borderDash: [5, 5], pointRadius: 0, fill: false },
                  ],
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
              ) : <EmptyChart text="Not enough data — add some candidates first." />}
            </div>
          </div>

          {/* Jobs table */}
          <div className="analytics-card analytics-card-full">
            <h2 className="dash-card-title" style={{ marginBottom: 4 }}>Performance by Job</h2>
            <p className="dash-card-sub">Application volume and conversion rates per open role</p>
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              {jobs.length === 0 ? <p style={{ padding: 20, color: 'var(--text-muted)' }}>No jobs data yet.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                      {['Job', 'Applied', 'Hired', 'Conv. Rate', 'Volume vs max'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: h === 'Job' ? 'left' : 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
                          {h === 'Volume vs max' ? '' : h}{h === 'Volume vs max' && 'Volume'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j, i) => {
                      const convRate = j.candidate_count > 0 ? ((j.hired_count / j.candidate_count) * 100).toFixed(1) : '0.0';
                      const rateNum = parseFloat(convRate);
                      const rateColor = rateNum >= 20 ? '#16a34a' : rateNum >= 5 ? '#d97706' : '#dc2626';
                      const pct = Math.round((j.candidate_count / jobsMax) * 100);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600 }}>{j.job_title}</td>
                          <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{j.candidate_count}</td>
                          <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 14, color: 'var(--text-secondary)' }}>{j.hired_count}</td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: rateColor }}>{convRate}%</span>
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 7, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width .6s ease' }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ icon, iconColor, iconBg, title, value, sub }: { icon: ReactNode; iconColor: string; iconBg: string; title: string; value: string; sub: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
}

function EmptyChart({ text = 'No candidates yet.' }: { text?: string }) {
  return <p style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>{text}</p>;
}
