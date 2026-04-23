import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Sparkles, RefreshCw, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

interface Job { id: number; title: string; department?: string; location?: string; }

interface Question {
  type: string;
  question: string;
  guidance: string;
}

interface QuestionsResult {
  questions: Question[];
  generated_at?: string;
}

const TYPE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  behavioral: { label: 'Behavioral', bg: '#eff6ff', color: '#1d4ed8' },
  behavioural: { label: 'Behavioural', bg: '#eff6ff', color: '#1d4ed8' },
  general: { label: 'General', bg: '#f3f4f6', color: '#374151' },
  technical: { label: 'Technical', bg: '#f0fdf4', color: '#15803d' },
  situational: { label: 'Situational', bg: '#fefce8', color: '#a16207' },
  culture: { label: 'Culture', bg: '#fdf4ff', color: '#7e22ce' },
};

function typeBadge(type: string) {
  const s = TYPE_STYLES[type] ?? { label: type, bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function QuestionCard({ q, i }: { q: Question; i: number }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: 18, border: '1px solid var(--border-light)',
      borderRadius: 10, transition: 'box-shadow 120ms ease',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 1,
      }}>
        {i + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {typeBadge(q.type)}
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 10px' }}>
          {q.question}
        </p>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '10px 12px', background: 'var(--bg-sidebar, #f5f7fa)',
          borderRadius: 8, borderLeft: '3px solid var(--accent)',
        }}>
          <span style={{ width: 13, height: 13, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>💡</span>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {q.guidance}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestionsPanelSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, padding: 16, border: '1px solid var(--border-light)', borderRadius: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 15, width: '70%', background: 'var(--border-light)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 11, width: '40%', background: 'var(--border-light)', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InterviewAssistantPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [questionsResult, setQuestionsResult] = useState<QuestionsResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<{ items: Job[] }>('/jobs?status=open&per_page=100')
      .then(d => setJobs(d.items ?? []))
      .catch(() => toast.error('Failed to load jobs.'))
      .finally(() => setLoadingJobs(false));
  }, []);

  async function loadQuestions(job: Job) {
    setSelectedJob(job);
    setLoadingQuestions(true);
    setLoadingError(null);
    setQuestionsResult(null);

    try {
      const result = await api.get<QuestionsResult>(`/ai/interview-questions/${job.id}`);
      setQuestionsResult(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        setQuestionsResult(null);
        setLoadingQuestions(false);
      } else {
        setLoadingError(err instanceof Error ? err.message : 'Failed to load questions.');
        setLoadingQuestions(false);
      }
    }
  }

  async function generateQuestions(job: Job, force = false) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingQuestions(true);
      setLoadingError(null);
      try {
        const result = await api.post<QuestionsResult>('/ai/interview-questions', {
          job_id: job.id,
          force_regenerate: force,
        });
        setQuestionsResult(result);
        toast.success(force ? 'Questions regenerated and saved.' : 'Questions generated and saved for this job.');
      } catch (err) {
        setLoadingError(err instanceof Error ? err.message : 'Failed to generate questions.');
      } finally {
        setLoadingQuestions(false);
      }
    }, 500);
  }

  if (loadingJobs) return <PageSpinner />;

  return (
    <div>
      <Topbar
        title="Interview Assistant"
        subtitle="AI-generated interview questions for open jobs"
      />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left: job selector */}
          <div className="card" style={{ position: 'sticky', top: 72 }}>
            <div className="card-header"><span className="card-title">Select a Job</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              {jobs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No open jobs found. Create and publish a job first.
                </div>
              ) : (
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {jobs.map(j => (
                    <div
                      key={j.id}
                      className="ia-job-item"
                      onClick={() => loadQuestions(j)}
                      style={{
                        padding: '14px 18px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background 120ms ease',
                        background: selectedJob?.id === j.id ? 'var(--accent-muted, #eef2f7)' : undefined,
                        borderLeft: selectedJob?.id === j.id ? '3px solid var(--accent)' : undefined,
                        paddingLeft: selectedJob?.id === j.id ? '15px' : '18px',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {j.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {j.department && <span>{j.department}</span>}
                        {j.location && <span>{j.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: questions panel */}
          {!selectedJob ? (
            <div className="card">
              <div className="card-body" style={{ padding: '48px 32px', textAlign: 'center' }}>
                <MessageSquare size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Select a job to get started
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Choose an open job from the left panel. If questions have already been generated
                  they will load instantly — otherwise the AI will create 10 tailored questions.
                </p>
              </div>
            </div>
          ) : loadingQuestions && !questionsResult ? (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span className="card-title">{selectedJob.title}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[selectedJob.department, selectedJob.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="card-body">
                <QuestionsPanelSkeleton />
              </div>
            </div>
          ) : loadingError ? (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span className="card-title">{selectedJob.title}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[selectedJob.department, selectedJob.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="card-body" style={{ padding: 24, textAlign: 'center', color: 'var(--color-error)', fontSize: 13 }}>
                {loadingError}
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ gap: 6 }}
                    onClick={() => generateQuestions(selectedJob, false)}>
                    <Sparkles size={13} /> Retry
                  </button>
                </div>
              </div>
            </div>
          ) : questionsResult ? (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="card-title">{selectedJob.title}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {[selectedJob.department, selectedJob.location].filter(Boolean).join(' · ')}
                    {questionsResult.generated_at && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        · Generated {fmtDate(questionsResult.generated_at)}
                      </span>
                    )}
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => generateQuestions(selectedJob, true)}>
                  {loadingQuestions ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
                  Regenerate
                </button>
              </div>
              <div className="card-body">
                {questionsResult.questions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
                    No questions available. Please regenerate.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {questionsResult.questions.map((q, i) => (
                      <QuestionCard key={i} q={q} i={i} />
                    ))}
                  </div>
                )}
                <div style={{
                  marginTop: 20, padding: '14px 16px', background: 'var(--bg-sidebar, #f5f7fa)',
                  borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}>ℹ</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    These questions are saved for this job. Use <strong>Regenerate</strong> to create a fresh set at any time.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span className="card-title">{selectedJob.title}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[selectedJob.department, selectedJob.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" id="ia-generate-btn" style={{ gap: 6, whiteSpace: 'nowrap' }}
                  onClick={() => generateQuestions(selectedJob, false)}>
                  <Sparkles size={13} /> Generate Questions
                </button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px', gap: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                <Sparkles size={36} style={{ opacity: 0.4 }} />
                <p style={{ fontSize: 13, maxWidth: 380, lineHeight: 1.6 }}>
                  No questions have been generated for this role yet.<br />
                  Click <strong>Generate Questions</strong> to create 10 AI-powered questions
                  based on the job description.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
