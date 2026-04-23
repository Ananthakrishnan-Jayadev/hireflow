import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Users, Columns, Calendar, Briefcase, MapPin, DollarSign, Sparkles, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatJobType, formatSalaryRange, statusBadgeClass, stageBadgeClass, daysAgo } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

interface Job {
  id: number; title: string; status: string; department?: string;
  job_type?: string; location?: string; description?: string;
  requirements?: string; salary_min?: number; salary_max?: number;
  created_at: string; stage_counts?: Record<string, number>;
  candidate_count?: number;
}

interface Candidate {
  id: number; name: string; email: string; current_stage: string;
  ai_match_score?: number; applied_at: string;
}

interface Interview {
  id: number;
  candidate_id: number;
  candidate_name?: string;
  interviewer_name: string;
  interview_type?: string;
  scheduled_at: string;
  status: string;
}

interface TalentMatch {
  candidate_id: number;
  name: string;
  email: string;
  current_stage: string;
  previous_job_title?: string | null;
  ai_match_score: number;
  reasoning: string;
  previously_vetted: boolean;
}

type TabKey = 'overview' | 'candidates' | 'pipeline' | 'interviews' | 'talent-pool';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(false);
  const [talentMatches, setTalentMatches] = useState<TalentMatch[] | null>(null);
  const [talentLoading, setTalentLoading] = useState(false);

  useEffect(() => {
    if (!id) { navigate('/jobs'); return; }
    api.get<Job>(`/jobs/${id}`).then(setJob).catch(() => {
      toast.error('Job not found'); navigate('/jobs');
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (tab !== 'candidates' || !id) return;
    setCandLoading(true);
    api.get<{ items: Candidate[] }>(`/candidates?job_id=${id}&per_page=100`)
      .then(d => setCandidates(d.items ?? []))
      .catch(() => toast.error('Failed to load candidates.'))
      .finally(() => setCandLoading(false));
  }, [tab, id]);

  useEffect(() => {
    if (tab !== 'interviews' || !id) return;
    setInterviewsLoading(true);
    api.get<Interview[]>(`/interviews?job_id=${id}`)
      .then(d => setInterviews(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Failed to load interviews.'))
      .finally(() => setInterviewsLoading(false));
  }, [tab, id]);

  async function loadTalentPool() {
    if (!id) return;
    setTalentLoading(true);
    try {
      const result = await api.post<{ matches: TalentMatch[] }>('/ai/talent-pool-match', {
        job_id: parseInt(id, 10),
        limit: 10,
      });
      setTalentMatches(result.matches ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to match talent pool.');
    } finally {
      setTalentLoading(false);
    }
  }

  if (loading) return <PageSpinner />;
  if (!job) return null;

  const totalCandidates = Object.values(job.stage_counts ?? {}).reduce((s, v) => s + v, 0);
  const daysOpen = daysAgo(job.created_at);

  return (
    <div>
      <Topbar
        title={job.title}
        breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: job.title }]}
        actions={
          <Link to={`/jobs/${job.id}/edit`} className="btn btn-secondary">
            <Pencil size={15} /> Edit
          </Link>
        }
      />

      {/* Meta strip */}
      <div style={{ padding: '12px 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span className={`badge ${statusBadgeClass(job.status)}`}>{job.status}</span>
        {job.department && <span className="badge badge-accent">{job.department}</span>}
        {job.job_type && <span className="badge badge-default">{formatJobType(job.job_type)}</span>}
        {job.location && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={13} /> {job.location}
          </span>
        )}
        {(job.salary_min || job.salary_max) && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={13} /> {formatSalaryRange(job.salary_min, job.salary_max)}
          </span>
        )}
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} · {daysOpen}d open
        </span>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        {(['overview', 'candidates', 'pipeline', 'interviews', 'talent-pool'] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '12px 18px', fontSize: 13.5, fontWeight: tab === t ? 600 : 400,
              background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {t.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      <div className="page-content">
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {job.description && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Description</span></div>
                  <div className="card-body">
                    <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{job.description}</p>
                  </div>
                </div>
              )}
              {job.requirements && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Requirements</span></div>
                  <div className="card-body">
                    <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{job.requirements}</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 12 }}>
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <StatRow icon={<Users size={14} />} label="Total Candidates" value={String(totalCandidates)} />
                  <StatRow icon={<Briefcase size={14} />} label="Status" value={job.status} />
                  <StatRow icon={<Calendar size={14} />} label="Posted" value={formatDate(job.created_at)} />
                  <StatRow icon={<Calendar size={14} />} label="Days Open" value={`${daysOpen}d`} />
                </div>
              </div>
              {job.stage_counts && Object.keys(job.stage_counts).length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Pipeline</span></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(job.stage_counts).map(([stage, count]) => (
                      <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge ${stageBadgeClass(stage)}`}>{stage}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'candidates' && (
          <div>
            {candLoading ? <PageSpinner /> : candidates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 36 }}>👥</div>
                <h2 className="empty-state-title">No candidates yet</h2>
                <p className="empty-state-desc">Add candidates from the Candidates page.</p>
                <Link to="/candidates" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Candidates</Link>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                      {['Name', 'Stage', 'AI Score', 'Applied'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                        onClick={() => navigate(`/candidates/${c.id}`)}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${stageBadgeClass(c.current_stage)}`}>{c.current_stage}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <ScoreBadge score={c.ai_match_score} />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {formatDate(c.applied_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Pipeline Breakdown</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {job.stage_counts && Object.keys(job.stage_counts).length > 0 ? (
                  Object.entries(job.stage_counts).map(([stage, count]) => (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${stageBadgeClass(stage)}`}>{stage}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border-light)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${totalCandidates ? (count / totalCandidates) * 100 : 0}%`, height: '100%', background: 'var(--accent)' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No candidates are in this pipeline yet.</p>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/pipeline" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  <Columns size={14} /> Open Kanban
                </Link>
                <Link to="/candidates" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  <Users size={14} /> Add Candidates
                </Link>
              </div>
            </div>
          </div>
        )}

        {tab === 'interviews' && (
          <div>
            {interviewsLoading ? <PageSpinner /> : interviews.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 36 }}>📅</div>
                <h2 className="empty-state-title">No interviews scheduled</h2>
                <p className="empty-state-desc">Schedule interviews from the Interviews page.</p>
                <Link to="/interviews" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Interviews</Link>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                      {['Candidate', 'Interviewer', 'Type', 'Date', 'Status'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map(iv => (
                      <tr key={iv.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <Link to={`/candidates/${iv.candidate_id}`} style={{ fontWeight: 600 }}>{iv.candidate_name || `Candidate #${iv.candidate_id}`}</Link>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{iv.interviewer_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{iv.interview_type?.replace(/_/g, ' ') ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(iv.scheduled_at)}</td>
                        <td style={{ padding: '12px 16px' }}><span className="badge badge-default">{iv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'talent-pool' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={loadTalentPool} disabled={talentLoading}>
                {talentLoading ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                {talentLoading ? 'Matching…' : 'Find Matches'}
              </button>
            </div>
            {!talentMatches ? (
              <div className="empty-state">
                <Sparkles size={38} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h2 className="empty-state-title">Match previous candidates</h2>
                <p className="empty-state-desc">Use AI to find vetted candidates from other roles who may fit this job.</p>
              </div>
            ) : talentMatches.length === 0 ? (
              <div className="empty-state">
                <h2 className="empty-state-title">No matches found</h2>
                <p className="empty-state-desc">No resume-backed candidates were available outside this job.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {talentMatches.map(match => (
                  <Link key={match.candidate_id} to={`/candidates/${match.candidate_id}`} className="card hover-lift" style={{ padding: 16, textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{match.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.email}</div>
                      </div>
                      <ScoreBadge score={match.ai_match_score} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span className={`badge ${stageBadgeClass(match.current_stage)}`}>{match.current_stage}</span>
                      {match.previously_vetted && <span className="badge badge-success">Vetted</span>}
                    </div>
                    {match.previous_job_title && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Previous: {match.previous_job_title}</div>
                    )}
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{match.reasoning}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="badge badge-default" style={{ fontSize: 11 }}>Unranked</span>;
  const pct = Math.round(score);
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return <span className="badge" style={{ fontSize: 11, background: `${color}20`, color, border: `1px solid ${color}40` }}>{pct}%</span>;
}
