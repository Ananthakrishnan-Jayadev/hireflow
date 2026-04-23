import { useEffect, useState, useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Eye, Zap, Trash2, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatSource, stageBadgeClass, debounce, buildQuery } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
const SOURCES = ['linkedin', 'referral', 'careers_page', 'indeed', 'other'];

interface Candidate {
  id: number; name: string; email: string; phone?: string;
  current_stage: string; source?: string; job_title?: string;
  job_id?: number; ai_match_score?: number; rating?: number;
  applied_at: string;
}

interface CandidatesResponse { items: Candidate[]; total: number; page: number; pages: number; }

interface Job { id: number; title: string; }

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="badge badge-default" style={{ fontSize: 11 }}>Unranked</span>;
  const pct = Math.round(score);
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return <span className="badge" style={{ fontSize: 11, background: `${color}20`, color, border: `1px solid ${color}40` }}>{pct}%</span>;
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const { confirm, openModal, closeModal } = useModal();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [jobId, setJobId] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rankingId, setRankingId] = useState<number | null>(null);

  const loadCandidates = useCallback(async (p = 1, q = search, jid = jobId, st = stage, src = source) => {
    setLoading(true);
    try {
      const qs = buildQuery({ search: q, job_id: jid, stage: st, source: src, page: p, per_page: 20 });
      const data = await api.get<CandidatesResponse>(`/candidates${qs}`);
      setCandidates(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 1);
    } catch (err: unknown) {
      toast.error('Failed to load candidates: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [search, jobId, stage, source]);

  useEffect(() => {
    api.get<{ items: Job[] }>('/jobs?per_page=100&status=open').then(d => setJobs(d.items ?? [])).catch(() => {});
    loadCandidates();
  }, []);

  const debouncedSearch = useRef(debounce((val: unknown) => {
    setSearch(val as string);
    loadCandidates(1, val as string, jobId, stage, source);
  }, 300)).current;

  async function rankCandidate(c: Candidate) {
    if (!c.job_id) { toast.error('Assign a job to enable AI ranking.'); return; }
    setRankingId(c.id);
    try {
      const result = await api.post<{ score: number; reasoning: string }>('/ai/rank-candidate', { candidate_id: c.id });
      toast.success(`AI Score: ${result.score}% — ${result.reasoning}`);
      loadCandidates(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ranking failed.');
    } finally {
      setRankingId(null);
    }
  }

  async function deleteCandidate(c: Candidate) {
    const ok = await confirm({ title: 'Delete Candidate', message: `Permanently delete ${c.name}? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/candidates/${c.id}`);
      toast.success('Candidate deleted.');
      loadCandidates(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  function openAddModal() {
    openModal({
      title: 'Add Candidate',
      content: <AddCandidateForm jobs={jobs} onSuccess={() => { closeModal(); loadCandidates(1); }} onCancel={closeModal} />,
    });
  }

  return (
    <div>
      <Topbar
        title="Candidates"
        subtitle="All applicants across jobs"
        actions={
          <button className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={15} /> Add Candidate
          </button>
        }
      />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input className="form-input search-input" type="search" placeholder="Search name or email…"
              aria-label="Search candidates" onChange={e => debouncedSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ maxWidth: 200 }} value={jobId}
            onChange={e => { setJobId(e.target.value); loadCandidates(1, search, e.target.value, stage, source); }}>
            <option value="">All Jobs</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }} value={stage}
            onChange={e => { setStage(e.target.value); loadCandidates(1, search, jobId, e.target.value, source); }}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }} value={source}
            onChange={e => { setSource(e.target.value); loadCandidates(1, search, jobId, stage, e.target.value); }}>
            <option value="">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{formatSource(s)}</option>)}
          </select>
          <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
            {total} candidate{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? <PageSpinner /> : candidates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: 40 }}>👥</div>
            <h2 className="empty-state-title">No candidates found</h2>
            <p className="empty-state-desc">
              {search || jobId || stage || source ? 'No candidates match your current filters.' : 'Add your first candidate to get started.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                  {['Candidate', 'Job', 'Stage', 'Source', 'AI Score', 'Applied', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                    onClick={() => navigate(`/candidates/${c.id}`)}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {c.job_title ?? <span className="text-muted">—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${stageBadgeClass(c.current_stage)}`}>{c.current_stage}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {c.source ? formatSource(c.source) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}><ScoreBadge score={c.ai_match_score} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(c.applied_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" aria-label="View" onClick={() => navigate(`/candidates/${c.id}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" aria-label="AI rank" disabled={!c.job_id || rankingId === c.id}
                          onClick={() => rankCandidate(c)}>
                          {rankingId === c.id ? <Loader size={14} className="spin" /> : <Zap size={14} />}
                        </button>
                        <button className="btn btn-ghost btn-sm" aria-label="Delete"
                          style={{ color: 'var(--color-error)' }} onClick={() => deleteCandidate(c)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            <button className="page-btn" disabled={page <= 1} onClick={() => { loadCandidates(page - 1); setPage(p => p - 1); }}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => { loadCandidates(p); setPage(p); }}>{p}</button>
            ))}
            <button className="page-btn" disabled={page >= pages} onClick={() => { loadCandidates(page + 1); setPage(p => p + 1); }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCandidateForm({ jobs, onSuccess, onCancel }: { jobs: Job[]; onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', job_id: '', resume_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function field(key: keyof typeof form) {
    return { value: form[key], onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(prev => ({ ...prev, [key]: e.target.value })) };
  }

  async function submit() {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required.'); return; }
    setSaving(true);
    try {
      let resume_url = form.resume_url.trim() || null;
      let resume_text: string | null = null;
      if (file) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/uploads/resume', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail ?? 'Upload failed.');
        resume_url = data.url; resume_text = data.resume_text;
      }
      await api.post('/candidates', {
        name: form.name, email: form.email, phone: form.phone || null,
        source: form.source || null, job_id: form.job_id ? parseInt(form.job_id) : null,
        resume_url, resume_text,
      });
      toast.success(`${form.name} added successfully.`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add candidate.');
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      <div className="form-group">
        <label className="form-label required">Full Name</label>
        <input className="form-input" placeholder="Jane Smith" {...field('name')} />
      </div>
      <div className="form-group">
        <label className="form-label required">Email</label>
        <input className="form-input" type="email" placeholder="jane@example.com" {...field('email')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" placeholder="+1 555 000 0000" {...field('phone')} />
        </div>
        <div className="form-group">
          <label className="form-label">Source</label>
          <select className="form-select" {...field('source')}>
            <option value="">Select source</option>
            {SOURCES.map(s => <option key={s} value={s}>{formatSource(s)}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Job</label>
        <select className="form-select" {...field('job_id')}>
          <option value="">No job assigned</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Resume <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(PDF/DOCX, max 5 MB)</span></label>
        <input className="form-input" type="file" accept=".pdf,.docx,.doc" style={{ padding: 6 }}
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="form-group">
        <label className="form-label">Or Resume URL</label>
        <input className="form-input" type="url" placeholder="https://…" {...field('resume_url')} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Loader size={14} className="spin" /> : <UserPlus size={14} />} Add Candidate
        </button>
      </div>
    </div>
  );
}
