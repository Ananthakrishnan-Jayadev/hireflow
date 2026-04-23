import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ClipboardCheck, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

const CRITERIA = [
  { key: 'technical', label: 'Technical Skills', desc: 'Domain knowledge, coding ability, technical depth' },
  { key: 'communication', label: 'Communication', desc: 'Clarity, listening, articulation of ideas' },
  { key: 'culture_fit', label: 'Culture Fit', desc: 'Values alignment, team collaboration, attitude' },
  { key: 'problem_solving', label: 'Problem Solving', desc: 'Analytical thinking, creativity, approach to challenges' },
];

const RECOMMENDATIONS = [
  { value: 'strong_yes', label: 'Strong Yes — Highly recommended' },
  { value: 'yes', label: 'Yes — Recommended' },
  { value: 'neutral', label: 'Neutral — On the fence' },
  { value: 'no', label: 'No — Not recommended' },
  { value: 'strong_no', label: 'Strong No — Do not proceed' },
];

function fmtType(t?: string) {
  if (!t) return '—';
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Interview {
  id: number;
  candidate_id: number;
  candidate_name?: string;
  job_title?: string;
  interviewer_name: string;
  interview_type?: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  location?: string;
  notes?: string;
}

interface Scorecard {
  technical: number;
  communication: number;
  culture_fit: number;
  problem_solving: number;
  overall_rating?: number;
  recommendation: string;
  strengths?: string;
  concerns?: string;
  notes?: string;
}

function StarRating({ value, onChange, readonly }: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          width="28" height="28" viewBox="0 0 24 24"
          fill={n <= value ? '#F59E0B' : 'none'}
          stroke={n <= value ? '#F59E0B' : 'var(--border)'}
          strokeWidth="2"
          style={{ cursor: readonly ? 'default' : 'pointer', transition: 'all 0.15s' }}
          onClick={() => !readonly && onChange?.(n)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4, alignSelf: 'center' }}>
        {value ? `${value}/5` : 'Not rated'}
      </span>
    </div>
  );
}

function renderStarsDisplay(rating: number) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width="18" height="18" viewBox="0 0 24 24"
          fill={n <= rating ? '#F59E0B' : 'none'}
          stroke={n <= rating ? '#F59E0B' : 'var(--border)'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>{rating}/5</span>
    </div>
  );
}

export function ScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallRating, setOverallRating] = useState(0);
  const [recommendation, setRecommendation] = useState('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) { navigate('/interviews'); return; }
    const numId = parseInt(id, 10);
    Promise.all([
      api.get<Interview>(`/interviews/${numId}`),
      api.get<Scorecard>(`/interviews/${numId}/scorecard`).catch(() => null),
    ]).then(([iv, sc]) => {
      setInterview(iv);
      setScorecard(sc);
      if (sc) {
        setRatings({
          technical: sc.technical ?? 0,
          communication: sc.communication ?? 0,
          culture_fit: sc.culture_fit ?? 0,
          problem_solving: sc.problem_solving ?? 0,
        });
        setOverallRating(sc.overall_rating ?? 0);
        setRecommendation(sc.recommendation ?? '');
        setStrengths(sc.strengths ?? '');
        setConcerns(sc.concerns ?? '');
        setNotes(sc.notes ?? '');
      }
    }).catch(() => {
      toast.error('Interview not found');
      navigate('/interviews');
    }).finally(() => setLoading(false));
  }, [id]);

  async function submitScorecard() {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (!recommendation) { toast.error('Please select a recommendation.'); return; }

    setSubmitting(true);
    try {
      const sc = await api.post<Scorecard>(`/interviews/${numId}/scorecard`, {
        technical: ratings.technical || null,
        communication: ratings.communication || null,
        culture_fit: ratings.culture_fit || null,
        problem_solving: ratings.problem_solving || null,
        overall_rating: overallRating || null,
        recommendation,
        strengths: strengths.trim() || null,
        concerns: concerns.trim() || null,
        notes: notes.trim() || null,
      });
      setScorecard(sc);
      toast.success('Scorecard submitted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit scorecard.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageSpinner />;
  if (!interview) return null;

  const recLabels: Record<string, { label: string; color: string; bg: string }> = {
    strong_yes: { label: 'Strong Yes', color: '#065F46', bg: 'var(--color-success-bg)' },
    yes: { label: 'Yes', color: '#065F46', bg: 'var(--color-success-bg)' },
    neutral: { label: 'Neutral', color: '#92400E', bg: 'var(--color-warning-bg)' },
    no: { label: 'No', color: '#991B1B', bg: 'var(--color-error-bg)' },
    strong_no: { label: 'Strong No', color: '#991B1B', bg: 'var(--color-error-bg)' },
  };

  return (
    <div>
      <Topbar
        title="Interview Scorecard"
        breadcrumbs={[
          { label: 'Interviews', to: '/interviews' },
          { label: interview.candidate_name || 'Candidate', to: `/candidates/${interview.candidate_id}` },
          { label: 'Scorecard' },
        ]}
      />

      <div style={{
        padding: '12px 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{interview.candidate_name || 'Candidate'}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{interview.job_title || '—'}</span>
        <span className="badge badge-default">{fmtType(interview.interview_type)}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {formatDateTime(interview.scheduled_at)} · {interview.duration_min} min
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>with {interview.interviewer_name}</span>
      </div>

      <div className="page-content" style={{ maxWidth: 780 }}>
        {scorecard ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="card-title">Scorecard</span>
              {scorecard.recommendation && (
                <span style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700,
                  background: recLabels[scorecard.recommendation]?.bg,
                  color: recLabels[scorecard.recommendation]?.color,
                }}>
                  {recLabels[scorecard.recommendation]?.label ?? scorecard.recommendation}
                </span>
              )}
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {CRITERIA.map(c => (
                  <div key={c.key}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                      {c.label}
                    </div>
                    {renderStarsDisplay(scorecard[c.key as keyof Scorecard] as number ?? 0)}
                  </div>
                ))}
              </div>

              {scorecard.overall_rating ? (
                <div style={{ padding: 16, background: 'var(--bg-body)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Overall Rating:</span>
                  {renderStarsDisplay(scorecard.overall_rating)}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, background: 'var(--color-success-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#065F46', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Strengths</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {scorecard.strengths || <span style={{ color: '#16a34a', opacity: 0.5 }}>None noted</span>}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--color-error-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Concerns</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {scorecard.concerns || <span style={{ color: '#16a34a', opacity: 0.5 }}>None noted</span>}
                  </div>
                </div>
              </div>

              {scorecard.notes && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Additional Notes</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {scorecard.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header"><span className="card-title">Submit Scorecard</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Rate Each Area (1 = Poor, 5 = Excellent)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {CRITERIA.map(c => (
                    <div key={c.key}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</span>
                      </div>
                      <StarRating
                        value={ratings[c.key] ?? 0}
                        onChange={v => setRatings(prev => ({ ...prev, [c.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Overall Rating</div>
                <StarRating value={overallRating} onChange={v => setOverallRating(v)} />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Hiring Recommendation</label>
                <select
                  className="form-select"
                  style={{ maxWidth: 360, marginTop: 8 }}
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value)}
                >
                  <option value="">Select recommendation…</option>
                  {RECOMMENDATIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#065F46' }}>Strengths</label>
                  <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="What stood out positively?"
                    value={strengths} onChange={e => setStrengths(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#991B1B' }}>Concerns</label>
                  <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Any red flags or areas for improvement?"
                    value={concerns} onChange={e => setConcerns(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Any other observations or context…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Link to="/interviews" className="btn btn-secondary">Cancel</Link>
                <button className="btn btn-primary" onClick={submitScorecard} disabled={submitting}>
                  {submitting ? <Loader size={15} className="spin" /> : <ClipboardCheck size={15} />} Submit Scorecard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
