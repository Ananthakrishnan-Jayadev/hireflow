import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CalendarPlus, Pencil, Trash2, Sparkles, Loader, List, Calendar as CalIcon } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const INTERVIEW_TYPES = ['phone_screen', 'technical', 'behavioral', 'culture_fit', 'onsite', 'final'];
const STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];
const PER_PAGE = 20;

const TYPE_LABELS: Record<string, string> = {
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  behavioral: 'Behavioral',
  culture_fit: 'Culture Fit',
  onsite: 'Onsite',
  final: 'Final',
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-error',
  no_show: 'badge-warning',
};

function fmtType(t?: string) {
  if (!t) return '—';
  return TYPE_LABELS[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildGCalUrl({ title, startIso, durationMin, location, description }: {
  title: string;
  startIso: string;
  durationMin?: number;
  location?: string;
  description?: string;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmt(startIso);
  const endMs = new Date(startIso).getTime() + (durationMin || 60) * 60 * 1000;
  const end = fmt(new Date(endMs).toISOString());
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface Interview {
  id: number;
  candidate_id: number;
  candidate_name?: string;
  job_id: number;
  job_title?: string;
  interviewer_name: string;
  interview_type?: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  location?: string;
  notes?: string;
  scorecard?: { id: number } | null;
}

interface DebriefResult {
  candidate_name: string;
  job_title: string;
  verdict: string;
  verdict_label?: string;
  confidence: number;
  highlight_quote?: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
}

function DebriefModalContent({ interviewId, onCancel }: { interviewId: number; onCancel: () => void }) {
  const [transcript, setTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DebriefResult | null>(null);

  async function generateDebrief() {
    setGenerating(true);
    try {
      const data = await api.post<DebriefResult>('/ai/interview-debrief', {
        interview_id: interviewId,
        transcript: transcript.trim() || null,
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Debrief failed.');
    } finally {
      setGenerating(false);
    }
  }

  if (!result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Paste the interview transcript below for the most accurate debrief.
          If you don't have one, the AI will use saved interview notes and scorecard instead.
        </p>
        <div className="form-group">
          <label className="form-label">Interview Transcript <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>Optional</span></label>
          <textarea
            className="form-input"
            rows={10}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            style={{ fontSize: 12.5, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }}
            placeholder="Paste the full interview transcript here…"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={generateDebrief} disabled={generating}>
            {generating ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating…' : 'Generate Debrief'}
          </button>
        </div>
      </div>
    );
  }

  const verdictStyles: Record<string, { color: string; bg: string }> = {
    strong_yes: { color: '#16a34a', bg: '#f0fdf4' },
    yes: { color: '#2563eb', bg: '#eff6ff' },
    maybe: { color: '#d97706', bg: '#fffbeb' },
    no: { color: '#dc2626', bg: '#fef2f2' },
    strong_no: { color: '#991b1b', bg: '#fee2e2' },
  };
  const vs = verdictStyles[result.verdict] ?? verdictStyles.maybe;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{result.candidate_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>for {result.job_title}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
            borderRadius: 20, background: vs.bg, color: vs.color, fontSize: 13, fontWeight: 700 }}>
            {result.verdict_label ?? result.verdict}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.confidence}% confidence</span>
        </div>
      </div>
      {result.highlight_quote && (
        <div style={{ borderLeft: '3px solid #7c3aed', padding: '10px 14px', background: '#f5f3ff',
          borderRadius: '0 8px 8px 0', marginBottom: 16, fontSize: 13, color: '#5b21b6', fontStyle: 'italic', lineHeight: 1.6 }}>
          "{result.highlight_quote}"
        </div>
      )}
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 18 }}>
        {result.summary}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Strengths</div>
          {result.strengths.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
              <span style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0, marginTop: 2 }}>✓</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Concerns</div>
          {result.concerns.length ? result.concerns.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
              <span style={{ width: 14, height: 14, color: '#f97316', flexShrink: 0, marginTop: 2 }}>!</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c}</span>
            </div>
          )) : <p style={{ fontSize: 13, color: '#16a34a' }}>No major concerns noted.</p>}
        </div>
      </div>
      <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Recommendation
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{result.recommendation}</p>
      </div>
    </div>
  );
}

export function InterviewsPage() {
  const navigate = useNavigate();
  const { confirm, openModal, closeModal } = useModal();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'week'>('list');

  const loadInterviews = useCallback(async (p = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      const data = await api.get<Interview[]>(`/interviews${qs.toString() ? `?${qs}` : ''}`);
      let items = Array.isArray(data) ? data : [];
      if (upcomingOnly) {
        const now = new Date();
        items = items.filter(iv => new Date(iv.scheduled_at) >= now);
      }
      const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
      const nextPage = Math.min(p, totalPages);
      setInterviews(items);
      setPage(nextPage);
      setPages(totalPages);
    } catch (err) {
      toast.error('Failed to load interviews: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, upcomingOnly]);

  useEffect(() => { loadInterviews(); }, [loadInterviews]);

  async function deleteInterview(iv: Interview) {
    const ok = await confirm({
      title: 'Delete Interview',
      message: `Delete the interview with ${iv.candidate_name || 'this candidate'}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/interviews/${iv.id}`);
      toast.success('Interview deleted.');
      loadInterviews(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  function openScheduleModal(candidates: { id: number; name: string; email: string; job_id?: number }[], jobs: { id: number; title: string }[]) {
    const dt = new Date();
    dt.setHours(dt.getHours() + 1, 0, 0, 0);
    const defaultDt = dt.toISOString().slice(0, 16);

    openModal({
      title: 'Schedule Interview',
      size: 'lg',
      content: (
        <form id="sf" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label required">Candidate</label>
            <select className="form-select" id="sf-cand" name="candidate_id" required>
              <option value="">Select candidate…</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id} data-job-id={c.job_id || ''}>
                  {c.name} — {c.email}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Job</label>
            <select className="form-select" id="sf-job" name="job_id" required>
              <option value="">Select job…</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Interviewer Name</label>
              <input className="form-input" id="sf-iwr" name="interviewer_name" required placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" id="sf-type" name="interview_type">
                <option value="">Select type…</option>
                {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{fmtType(t)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Date & Time</label>
              <input className="form-input" id="sf-dt" name="scheduled_at" type="datetime-local" required defaultValue={defaultDt} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <select className="form-select" id="sf-dur" name="duration_min" defaultValue="60">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location / Meeting Link</label>
            <input className="form-input" id="sf-loc" name="location" placeholder="Room A / https://meet.google.com/…" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" id="sf-notes" name="notes" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Topics to cover, what to prepare…" />
          </div>
        </form>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" id="sf-save"
            onClick={async () => {
              const form = document.getElementById('sf') as HTMLFormElement;
              const candidateId = parseInt((form.querySelector('[name=candidate_id]') as HTMLSelectElement).value, 10);
              const jobId = parseInt((form.querySelector('[name=job_id]') as HTMLSelectElement).value, 10);
              const interviewer = (form.querySelector('[name=interviewer_name]') as HTMLInputElement).value.trim();
              const dt = (form.querySelector('[name=scheduled_at]') as HTMLInputElement).value;

              if (!candidateId || !jobId || !interviewer || !dt) {
                toast.error('Candidate, job, interviewer, and date/time are required.');
                return;
              }
              const saveBtn = document.getElementById('sf-save') as HTMLButtonElement;
              saveBtn.disabled = true;

              const interviewType = (form.querySelector('[name=interview_type]') as HTMLSelectElement).value || null;
              const durationMin = parseInt((form.querySelector('[name=duration_min]') as HTMLSelectElement).value, 10);
              const location = (form.querySelector('[name=location]') as HTMLInputElement).value.trim() || null;
              const notes = (form.querySelector('[name=notes]') as HTMLTextAreaElement).value.trim() || null;
              const startIso = new Date(dt).toISOString();

              const candEl = form.querySelector('[name=candidate_id]') as HTMLSelectElement;
              const candName = candEl.selectedOptions[0]?.text?.split(' — ')[0] || 'Candidate';
              const jobEl = form.querySelector('[name=job_id]') as HTMLSelectElement;
              const jobTitle = jobEl.selectedOptions[0]?.text || 'Role';

              try {
                await api.post('/interviews', {
                  candidate_id: candidateId,
                  job_id: jobId,
                  interviewer_name: interviewer,
                  interview_type: interviewType,
                  scheduled_at: startIso,
                  duration_min: durationMin,
                  location,
                  notes,
                });
                closeModal();
                loadInterviews(1);

                const gcalUrl = buildGCalUrl({
                  title: `Interview: ${candName} — ${jobTitle}`,
                  startIso,
                  durationMin,
                  location: location || '',
                  description: `Interviewer: ${interviewer}\nType: ${interviewType ? fmtType(interviewType) : 'Interview'}${notes ? '\n\n' + notes : ''}`,
                });
                showCalendarPrompt(gcalUrl, candName, startIso, durationMin);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to schedule.');
                saveBtn.disabled = false;
              }
            }}>
            <CalendarPlus size={15} /> Schedule
          </button>
        </div>
      ),
    });
  }

  function showCalendarPrompt(gcalUrl: string, candidateName: string, startIso: string, durationMin: number) {
    const dateStr = new Date(startIso).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    openModal({
      title: 'Add to Calendar',
      size: 'sm',
      content: (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#1a73e8,#34a853)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CalendarPlus size={26} style={{ color: '#fff' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Interview Scheduled!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
            <strong>{candidateName}</strong><br />{dateStr} · {durationMin} min
          </div>
          <a href={gcalUrl} target="_blank" rel="noopener"
            className="btn btn-primary"
            style={{ gap: 8, display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
              background: 'linear-gradient(135deg,#1a73e8,#1558b0)', fontSize: 14, padding: '10px 22px', borderRadius: 8 }}>
            <CalendarPlus size={16} /> Add to Google Calendar
          </a>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            Opens Google Calendar with event pre-filled — just click Save.
          </div>
        </div>
      ),
      footer: <button className="btn btn-secondary" onClick={closeModal}>Skip</button>,
    });
  }

  function openDebriefModal(interviewId: number) {
    openModal({
      title: 'AI Interview Debrief',
      size: 'lg',
      content: <DebriefModalContent interviewId={interviewId} onCancel={closeModal} />,
      footer: <button className="btn btn-secondary" onClick={closeModal}>Close</button>,
    });
  }

  async function openEditModal(iv: Interview) {
    const dtLocal = new Date(iv.scheduled_at).toISOString().slice(0, 16);
    openModal({
      title: 'Edit Interview',
      content: (
        <form id="ef" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Interviewer</label>
              <input className="form-input" id="ef-iwr" name="interviewer_name" required defaultValue={iv.interviewer_name} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" id="ef-type" name="interview_type" defaultValue={iv.interview_type || ''}>
                <option value="">Select type…</option>
                {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{fmtType(t)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Date & Time</label>
              <input className="form-input" id="ef-dt" name="scheduled_at" type="datetime-local" required defaultValue={dtLocal} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <select className="form-select" id="ef-dur" name="duration_min" defaultValue={String(iv.duration_min)}>
                {[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" id="ef-status" name="status" defaultValue={iv.status}>
              {STATUSES.map(s => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Location / Link</label>
            <input className="form-input" id="ef-loc" name="location" defaultValue={iv.location || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" id="ef-notes" name="notes" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              defaultValue={iv.notes || ''} />
          </div>
        </form>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" id="ef-save"
            onClick={async () => {
              const form = document.getElementById('ef') as HTMLFormElement;
              const saveBtn = document.getElementById('ef-save') as HTMLButtonElement;
              saveBtn.disabled = true;
              try {
                await api.put(`/interviews/${iv.id}`, {
                  interviewer_name: (form.querySelector('[name=interviewer_name]') as HTMLInputElement).value.trim(),
                  interview_type: (form.querySelector('[name=interview_type]') as HTMLSelectElement).value || null,
                  scheduled_at: new Date((form.querySelector('[name=scheduled_at]') as HTMLInputElement).value).toISOString(),
                  duration_min: parseInt((form.querySelector('[name=duration_min]') as HTMLSelectElement).value, 10),
                  status: (form.querySelector('[name=status]') as HTMLSelectElement).value,
                  location: (form.querySelector('[name=location]') as HTMLInputElement).value.trim() || null,
                  notes: (form.querySelector('[name=notes]') as HTMLTextAreaElement).value.trim() || null,
                });
                toast.success('Interview updated.');
                closeModal();
                loadInterviews(page);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Update failed.');
                saveBtn.disabled = false;
              }
            }}>
            <Pencil size={15} /> Save Changes
          </button>
        </div>
      ),
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const byDay: Record<string, Interview[]> = {};
  interviews.forEach(iv => {
    const d = new Date(iv.scheduled_at);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString();
    (byDay[k] = byDay[k] || []).push(iv);
  });
  const pagedInterviews = interviews.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div>
      <Topbar
        title="Interviews"
        subtitle="Schedule and track candidate interviews"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <button
                className={`btn btn-ghost btn-sm ${view === 'list' ? 'active' : ''}`}
                style={{ borderRadius: 0, border: 'none', gap: 5 }}
                onClick={() => setView('list')}
              >
                <List size={14} /> List
              </button>
              <button
                className={`btn btn-ghost btn-sm ${view === 'week' ? 'active' : ''}`}
                style={{ borderRadius: 0, borderLeft: '1px solid var(--border)', gap: 5 }}
                onClick={() => setView('week')}
              >
                <CalIcon size={14} /> Week
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => {
              Promise.all([
                api.get<{ items: { id: number; name: string; email: string; job_id?: number }[] }>('/candidates?per_page=100'),
                api.get<{ items: { id: number; title: string }[] }>('/jobs?per_page=100'),
              ]).then(([cd, jd]) => {
                openScheduleModal(cd.items ?? [], jd.items ?? []);
              }).catch(() => toast.error('Failed to load candidates/jobs.'));
            }}>
              <CalendarPlus size={15} /> Schedule Interview
            </button>
          </div>
        }
      />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <select className="form-select" style={{ maxWidth: 160 }} value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); loadInterviews(1, e.target.value); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{fmtStatus(s)}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={upcomingOnly}
              onChange={e => { setUpcomingOnly(e.target.checked); loadInterviews(1); }} />
            Upcoming only
          </label>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {interviews.length} interview{interviews.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? <PageSpinner /> : interviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: 40 }}>📅</div>
            <h2 className="empty-state-title">No interviews found</h2>
            <p className="empty-state-desc">
              {statusFilter || upcomingOnly ? 'No interviews match the current filters.' : 'Schedule your first interview using the button above.'}
            </p>
          </div>
        ) : view === 'week' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 8, overflowX: 'auto' }}>
            {days.map(day => {
              const k = day.toISOString();
              const isToday = day.getTime() === today.getTime();
              const list = byDay[k] || [];
              return (
                <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                    background: isToday ? 'var(--accent)' : 'var(--bg-body)',
                    color: isToday ? '#fff' : 'var(--text-secondary)' }}>
                    {DAY[day.getDay()]} {day.getDate()} {MON[day.getMonth()]}
                  </div>
                  <div style={{ padding: 6, minHeight: 100, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-card)' }}>
                    {list.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--border)', textAlign: 'center', padding: 20 }}>—</div>
                    ) : list.map(iv => (
                      <div key={iv.id} style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)',
                        padding: '5px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 11, lineHeight: 1.4 }}
                        onClick={() => navigate(`/candidates/${iv.candidate_id}`)}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {iv.candidate_name || 'Candidate'}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {new Date(iv.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {fmtType(iv.interview_type)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                  {['Candidate', 'Job', 'Interviewer', 'Type', 'Date & Time', 'Duration', 'Status', 'Scorecard', 'AI Debrief', ''].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedInterviews.map(iv => (
                  <tr key={iv.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/candidates/${iv.candidate_id}`} style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                        {iv.candidate_name || `Candidate #${iv.candidate_id}`}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {iv.job_title || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{iv.interviewer_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-default">{fmtType(iv.interview_type)}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(iv.scheduled_at)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{iv.duration_min} min</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${STATUS_BADGE[iv.status]}`}>{fmtStatus(iv.status)}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/interviews/${iv.id}/scorecard`} className="btn btn-ghost btn-sm" style={{ gap: 4, color: iv.scorecard ? '#065F46' : undefined }}>
                        {iv.scorecard ? '📋 View' : '✏️ Fill'}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {iv.status === 'completed' ? (
                        <button className="btn btn-ghost btn-sm" style={{ gap: 4, color: '#7c3aed' }}
                          onClick={() => openDebriefModal(iv.id)}>
                          <Sparkles size={13} /> Debrief
                        </button>
                      ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a
                          href={buildGCalUrl({
                            title: `Interview: ${iv.candidate_name || 'Candidate'} — ${iv.job_title || 'Role'}`,
                            startIso: iv.scheduled_at,
                            durationMin: iv.duration_min,
                            location: iv.location || '',
                            description: `Interviewer: ${iv.interviewer_name}\nType: ${fmtType(iv.interview_type)}\n${iv.notes || ''}`.trim(),
                          })}
                          target="_blank" rel="noopener"
                          title="Add to Google Calendar"
                          style={{ color: '#1a73e8' }}
                          className="btn btn-ghost btn-sm"
                        >
                          <CalendarPlus size={13} />
                        </a>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(iv)}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => deleteInterview(iv)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'list' && pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            <button className="page-btn" disabled={page <= 1} onClick={() => { loadInterviews(page - 1); setPage(p => p - 1); }}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => { loadInterviews(p); setPage(p); }}>{p}</button>
            ))}
            <button className="page-btn" disabled={page >= pages} onClick={() => { loadInterviews(page + 1); setPage(p => p + 1); }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}
