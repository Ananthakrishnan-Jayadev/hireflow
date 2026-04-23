import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  Briefcase, Users, UserCheck, Calendar, Mail as MailIcon,
  GitMerge, AlertTriangle, ArrowRight,
  FileText, Star, UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Overview {
  open_jobs: number;
  total_jobs: number;
  total_candidates: number;
  candidates_this_month: number;
  hired_count: number;
  upcoming_interviews: number;
  total_interviews: number;
  emails_sent_total: number;
  emails_sent_this_month: number;
  conversion_rate: number;
}

interface PipelineStage { stage: string; count: number; }
interface Activity { activity_type: string; content: string; created_at: string; }

const STAGE_ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

const ACTIVITY_ICONS: Record<string, typeof ArrowRight> = {
  stage_changed: ArrowRight,
  email_sent: MailIcon,
  note_added: FileText,
  scorecard_submitted: Star,
  applied: UserPlus,
  interview_scheduled: Calendar,
};

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Overview>('/analytics/overview'),
      api.get<PipelineStage[]>('/analytics/pipeline'),
      api.get<Activity[]>('/analytics/recent-activity'),
    ]).then(([ov, pl, ac]) => {
      setOverview(ov);
      const sorted = [...pl].sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.stage), bi = STAGE_ORDER.indexOf(b.stage);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setPipeline(sorted);
      setActivity(ac);
    }).catch((err) => {
      toast.error('Failed to load dashboard: ' + err.message);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const rate = (overview?.conversion_rate ?? 0).toFixed(1);

  return (
    <div>
      <Topbar title="Dashboard" subtitle="Hiring overview" />
      <div className="page-content">
        <div className="dash-stats-grid">
          <StatCard icon={<Briefcase size={20} />} label="Open Jobs" value={overview?.open_jobs ?? 0}
            sub={`${overview?.total_jobs ?? 0} roles total`} to="/jobs" />
          <StatCard icon={<Users size={20} />} label="Total Candidates" value={overview?.total_candidates ?? 0}
            sub="across all roles" to="/candidates"
            trend={overview?.candidates_this_month ? { up: true, label: `+${overview.candidates_this_month} this mo` } : undefined} />
          <StatCard icon={<UserCheck size={20} />} label="Hired" value={overview?.hired_count ?? 0}
            sub="successfully placed" to="/candidates"
            trend={parseFloat(rate) > 0 ? { up: parseFloat(rate) >= 20, label: `${rate}% conv.` } : undefined} />
          <StatCard icon={<Calendar size={20} />} label="Upcoming Interviews" value={overview?.upcoming_interviews ?? 0}
            sub={`${overview?.total_interviews ?? 0} scheduled total`} to="/interviews" />
          <StatCard icon={<MailIcon size={20} />} label="Emails Sent" value={overview?.emails_sent_total ?? 0}
            sub="total outreach" to="/emails"
            trend={overview?.emails_sent_this_month ? { up: true, label: `+${overview.emails_sent_this_month} this mo` } : undefined} />
        </div>

        <div className="dash-lower">
          <div className="dash-card">
            <h2 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <GitMerge size={15} style={{ color: 'var(--accent)' }} /> Hiring Funnel
            </h2>
            <p className="dash-card-sub">Stage-by-stage drop-off</p>
            <div className="dash-chart-wrap">
              {pipeline.length > 0 ? (
                <Bar
                  data={{
                    labels: pipeline.map(s => s.stage),
                    datasets: [{
                      label: 'Candidates',
                      data: pipeline.map(s => s.count),
                      backgroundColor: 'rgba(234,88,12,0.75)',
                      borderRadius: 6,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              ) : (
                <p className="dash-empty" style={{ textAlign: 'center', paddingTop: 60 }}>No candidates yet.</p>
              )}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h2 className="dash-card-title">Recent Activity</h2>
                <p className="dash-card-sub">Latest hiring actions</p>
              </div>
              <Link to="/analytics" className="dash-link">Full analytics →</Link>
            </div>
            <div className="activity-feed">
              {activity.length === 0 ? (
                <p className="dash-empty">No activity yet.</p>
              ) : (
                activity.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.activity_type] ?? AlertTriangle;
                  return (
                    <div key={i} className="activity-row">
                      <span className="activity-icon"><Icon size={14} /></span>
                      <div className="activity-body">
                        <p className="activity-content">{a.content}</p>
                        <span className="activity-time">{timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  sub: string;
  to: string;
  trend?: { up: boolean; label: string };
}

function StatCard({ icon, label, value, sub, to, trend }: StatCardProps) {
  return (
    <Link className="dash-stat-card" to={to}>
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-body">
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
          <div className="dash-stat-value">{value}</div>
          {trend && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, marginLeft: 6,
              background: trend.up ? '#dcfce7' : '#fee2e2',
              color: trend.up ? '#16a34a' : '#dc2626',
            }}>
              {trend.up ? '↑' : '↓'} {trend.label}
            </span>
          )}
        </div>
        <div className="dash-stat-label">{label}</div>
        <div className="dash-stat-sub">{sub}</div>
      </div>
    </Link>
  );
}
