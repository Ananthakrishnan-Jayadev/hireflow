import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mail, Trash2, ArrowRightCircle, Zap, FileText, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatSource, stageBadgeClass, timeAgo } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

interface Candidate {
  id: number; name: string; email: string; phone?: string;
  current_stage: string; source?: string; job_id?: number; job_title?: string;
  ai_match_score?: number; rating?: number; applied_at: string;
  resume_url?: string; resume_text?: string; notes?: string;
  activities?: Activity[];
}

interface Activity { activity_type: string; content: string; created_at: string; }
interface GhostingRisk {
  score: number;
  level: string;
  level_color: string;
  days_in_stage: number;
  days_since_email?: number | null;
  touchpoints: number;
  factors: { label: string; description: string; weight: string }[];
}

export function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, openModal, closeModal } = useModal();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingStage, setMovingStage] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [aiScore, setAiScore] = useState<{ score: number; reasoning: string } | null>(null);
  const [ghostingRisk, setGhostingRisk] = useState<GhostingRisk | null>(null);

  function load() {
    if (!id) { navigate('/candidates'); return; }
    Promise.all([
      api.get<Candidate>(`/candidates/${id}`),
      api.get<GhostingRisk>(`/ai/ghosting-risk/${id}`).catch(() => null),
    ]).then(([c, risk]) => {
      setCandidate(c);
      setActivity(c.activities ?? []);
      setGhostingRisk(risk);
    }).catch(() => {
      toast.error('Candidate not found');
      navigate('/candidates');
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function moveStage(newStage: string) {
    if (!candidate) return;
    setMovingStage(true);
    try {
      await api.put('/pipeline/move', { candidate_id: candidate.id, new_stage: newStage });
      toast.success(`Moved to ${newStage}.`);
      setCandidate(prev => prev ? { ...prev, current_stage: newStage } : prev);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Move failed.');
    } finally {
      setMovingStage(false);
    }
  }

  async function rankCandidate() {
    if (!candidate?.job_id) { toast.error('Assign a job to enable AI ranking.'); return; }
    setRanking(true);
    try {
      const result = await api.post<{ score: number; reasoning: string }>('/ai/rank-candidate', { candidate_id: candidate.id });
      setAiScore(result);
      toast.success(`AI Score: ${result.score}%`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ranking failed.');
    } finally {
      setRanking(false);
    }
  }

  async function deleteCandidate() {
    if (!candidate) return;
    const ok = await confirm({ title: 'Delete Candidate', message: `Permanently delete ${candidate.name}?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/candidates/${candidate.id}`);
      toast.success('Candidate deleted.');
      navigate('/candidates');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  function openStageModal() {
    if (!candidate) return;
    openModal({
      title: 'Move Stage',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Current stage: <strong>{candidate.current_stage}</strong>
          </p>
          {STAGES.filter(s => s !== candidate.current_stage).map(s => (
            <button key={s} className={`btn btn-secondary`}
              style={{ justifyContent: 'flex-start' }}
              onClick={async () => { closeModal(); await moveStage(s); }}>
              <ArrowRightCircle size={14} /> Move to {s}
            </button>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={closeModal}>Cancel</button>
        </div>
      ),
    });
  }

  if (loading) return <PageSpinner />;
  if (!candidate) return null;

  const score = candidate.ai_match_score != null ? Math.round(candidate.ai_match_score) : null;
  const scoreColor = score == null ? '#6b7280' : score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div>
      <Topbar
        title={candidate.name}
        breadcrumbs={[{ label: 'Candidates', to: '/candidates' }, { label: candidate.name }]}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ color: 'var(--color-error)' }} onClick={deleteCandidate}>
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      {/* Sub-header */}
      <div style={{ padding: '12px 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className={`badge ${stageBadgeClass(candidate.current_stage)}`}>{candidate.current_stage}</span>
        {candidate.source && <span className="badge badge-accent">{formatSource(candidate.source)}</span>}
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{candidate.email}</span>
        {candidate.phone && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{candidate.phone}</span>}
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={openStageModal} disabled={movingStage}>
          {movingStage ? <Loader size={14} className="spin" /> : <ArrowRightCircle size={14} />} Move Stage
        </button>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info card */}
            <div className="card">
              <div className="card-header"><span className="card-title">Contact Info</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoRow label="Email" value={<a href={`mailto:${candidate.email}`}>{candidate.email}</a>} />
                {candidate.phone && <InfoRow label="Phone" value={candidate.phone} />}
                {candidate.job_title && <InfoRow label="Applied For" value={<Link to={`/jobs/${candidate.job_id}`}>{candidate.job_title}</Link>} />}
                <InfoRow label="Applied" value={formatDate(candidate.applied_at)} />
                {candidate.source && <InfoRow label="Source" value={formatSource(candidate.source)} />}
              </div>
            </div>

            {/* Resume text */}
            {candidate.resume_text && (
              <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileText size={14} />
                  <span className="card-title">Resume</span>
                  {candidate.resume_url && (
                    <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 12 }}>
                      Download
                    </a>
                  )}
                </div>
                <div className="card-body">
                  <pre style={{ fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit', margin: 0 }}>
                    {candidate.resume_text}
                  </pre>
                </div>
              </div>
            )}

            {/* Activity */}
            {activity.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Activity</span></div>
                <div className="card-body">
                  <div className="activity-feed">
                    {activity.map((a, i) => (
                      <div key={i} className="activity-row">
                        <span className="activity-icon"><ArrowRightCircle size={13} /></span>
                        <div className="activity-body">
                          <p className="activity-content">{a.content}</p>
                          <span className="activity-time">{timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 12 }}>
            {/* AI Score */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Zap size={14} style={{ color: 'var(--accent)' }} />
                <span className="card-title">AI Match Score</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {score != null || aiScore ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>
                      {aiScore?.score ?? score}%
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {aiScore?.reasoning ?? 'AI match score'}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Not yet ranked.</p>
                )}
                <button className="btn btn-secondary btn-sm" onClick={rankCandidate} disabled={ranking || !candidate.job_id}>
                  {ranking ? <Loader size={13} className="spin" /> : <Zap size={13} />}
                  {ranking ? 'Ranking…' : 'Run AI Rank'}
                </button>
                {!candidate.job_id && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assign a job to enable ranking.</p>
                )}
              </div>
            </div>

            {/* Quick actions */}
            {ghostingRisk && (
              <div className="card">
                <div className="card-header"><span className="card-title">Ghosting Risk</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: ghostingRisk.level_color }}>{ghostingRisk.score}%</span>
                    <span className="badge badge-default">{ghostingRisk.level}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {ghostingRisk.days_in_stage}d in stage · {ghostingRisk.touchpoints} touchpoint{ghostingRisk.touchpoints !== 1 ? 's' : ''}
                  </div>
                  {ghostingRisk.factors.slice(0, 3).map(f => (
                    <div key={f.label} style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      <strong>{f.label}:</strong> {f.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><span className="card-title">Quick Actions</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/emails" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                  <Mail size={13} /> Send Email
                </Link>
                <Link to="/interviews" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                  Schedule Interview
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
