import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Shield, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
const JOB_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];
const STATUSES = ['draft', 'open', 'closed'];
const TONES = ['professional', 'casual', 'startup'];

interface Job {
  id: number; title: string; department?: string; job_type?: string;
  location?: string; status: string; description?: string;
  salary_min?: number; salary_max?: number; requirements?: string;
}

interface JDResult {
  description: string;
  responsibilities: string[];
  qualifications: string[];
  nice_to_haves: string[];
  benefits: string[];
}

interface BiasResult {
  flags: { phrase: string; suggestion: string; category: string; reason: string }[];
  score: number;
  summary: string;
}

export function JobCreatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loadingJob, setLoadingJob] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<Partial<Job>>({ status: 'draft' });

  const [aiTone, setAiTone] = useState('professional');
  const [aiLoading, setAiLoading] = useState(false);

  const [biasLoading, setBiasLoading] = useState(false);
  const [biasResult, setBiasResult] = useState<BiasResult | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    api.get<Job>(`/jobs/${id}`).then(setJob).catch(() => {
      toast.error('Job not found'); navigate('/jobs');
    }).finally(() => setLoadingJob(false));
  }, [id]);

  function field(key: keyof Job) {
    return {
      value: (job[key] ?? '') as string,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setJob(prev => ({ ...prev, [key]: e.target.value })),
    };
  }

  async function generateJD() {
    if (!job.title) { toast.error('Enter a job title first.'); return; }
    setAiLoading(true);
    try {
      const result = await api.post<JDResult>('/ai/generate-jd', {
        title: job.title,
        department: job.department || '',
        location: job.location || '',
        job_type: job.job_type || '',
        requirements: job.requirements || '',
        tone: aiTone,
      });
      const descriptionParts = [
        result.description,
        result.responsibilities?.length ? `Responsibilities\n${result.responsibilities.map(item => `- ${item}`).join('\n')}` : '',
        result.nice_to_haves?.length ? `Nice to have\n${result.nice_to_haves.map(item => `- ${item}`).join('\n')}` : '',
        result.benefits?.length ? `Benefits\n${result.benefits.map(item => `- ${item}`).join('\n')}` : '',
      ].filter(Boolean);
      setJob(prev => ({
        ...prev,
        description: descriptionParts.join('\n\n'),
        requirements: result.qualifications?.length
          ? result.qualifications.map(item => `- ${item}`).join('\n')
          : prev.requirements,
      }));
      toast.success('Job description generated!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed.');
    } finally {
      setAiLoading(false);
    }
  }

  async function runBiasAudit() {
    const text = [job.description, job.requirements].filter(Boolean).join('\n\n');
    if (!text) { toast.error('Add a description first.'); return; }
    setBiasLoading(true);
    setBiasResult(null);
    try {
      const result = await api.post<BiasResult>('/ai/bias-check', { text });
      setBiasResult(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bias audit failed.');
    } finally {
      setBiasLoading(false);
    }
  }

  async function saveJob(publish = false) {
    if (!job.title?.trim()) { toast.error('Job title is required.'); return; }
    setSaving(true);
    const payload = {
      ...job,
      status: publish ? 'open' : (job.status || 'draft'),
      salary_min: job.salary_min ? Number(job.salary_min) : null,
      salary_max: job.salary_max ? Number(job.salary_max) : null,
    };
    try {
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload);
        toast.success('Job updated.');
        navigate(`/jobs/${id}`);
      } else {
        const created = await api.post<Job>('/jobs', payload);
        toast.success(publish ? 'Job published!' : 'Job saved as draft.');
        navigate(`/jobs/${created.id}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingJob) return <PageSpinner />;

  const breadcrumbs = isEdit
    ? [{ label: 'Jobs', to: '/jobs' }, { label: job.title ?? 'Edit Job', to: `/jobs/${id}` }, { label: 'Edit' }]
    : [{ label: 'Jobs', to: '/jobs' }, { label: 'New Job' }];

  return (
    <div>
      <Topbar title={isEdit ? `Edit: ${job.title}` : 'Create Job'} breadcrumbs={breadcrumbs} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

          {/* Left — form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Job Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label required" htmlFor="jc-title">Job Title</label>
                  <input className="form-input" id="jc-title" placeholder="e.g. Senior Software Engineer" {...field('title')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-dept">Department</label>
                    <select className="form-select" id="jc-dept" {...field('department')}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-type">Job Type</label>
                    <select className="form-select" id="jc-type" {...field('job_type')}>
                      <option value="">Select type</option>
                      {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-location">Location</label>
                    <input className="form-input" id="jc-location" placeholder="e.g. Remote, New York" {...field('location')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-status">Status</label>
                    <select className="form-select" id="jc-status" {...field('status')}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-sal-min">Salary Min (USD)</label>
                    <input className="form-input" id="jc-sal-min" type="number" placeholder="60000" {...field('salary_min')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="jc-sal-max">Salary Max (USD)</label>
                    <input className="form-input" id="jc-sal-max" type="number" placeholder="120000" {...field('salary_max')} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Job Description</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="jc-desc">Description</label>
                  <textarea className="form-input" id="jc-desc" rows={10}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Role overview, responsibilities, what you'll build…"
                    {...field('description')} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="jc-req">Requirements</label>
                  <textarea className="form-input" id="jc-req" rows={6}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Must-have qualifications and skills…"
                    {...field('requirements')} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => navigate('/jobs')} disabled={saving}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => saveJob(false)} disabled={saving}>
                {saving ? <Loader size={15} className="spin" /> : null} Save Draft
              </button>
              {!isEdit && (
                <button className="btn btn-primary" onClick={() => saveJob(true)} disabled={saving}>
                  {saving ? <Loader size={15} className="spin" /> : null} Publish
                </button>
              )}
              {isEdit && (
                <button className="btn btn-primary" onClick={() => saveJob(false)} disabled={saving}>
                  {saving ? <Loader size={15} className="spin" /> : null} Save Changes
                </button>
              )}
            </div>
          </div>

          {/* Right — AI tools */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 12 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <span className="card-title">AI JD Generator</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Generate a full job description from your title and department. Fill in the title first.
                </p>
                <div className="form-group">
                  <label className="form-label" htmlFor="jc-tone">Tone</label>
                  <select className="form-select" id="jc-tone" value={aiTone} onChange={e => setAiTone(e.target.value)}>
                    {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <button className="btn btn-secondary" onClick={generateJD} disabled={aiLoading} style={{ gap: 6 }}>
                  {aiLoading ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                  {aiLoading ? 'Generating…' : 'Generate JD'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Shield size={15} style={{ color: '#7c3aed' }} />
                <span className="card-title">Bias Auditor</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Scan for gendered or exclusionary language in the job description.
                </p>
                <button className="btn btn-secondary" onClick={runBiasAudit} disabled={biasLoading} style={{ gap: 6 }}>
                  {biasLoading ? <Loader size={14} className="spin" /> : <Shield size={14} />}
                  {biasLoading ? 'Auditing…' : 'Run Audit'}
                </button>
                {biasResult && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{
                      padding: '6px 10px', borderRadius: 6, marginBottom: 10,
                      background: biasResult.score >= 80 ? '#f0fdf4' : biasResult.score >= 50 ? '#fffbeb' : '#fef2f2',
                      color: biasResult.score >= 80 ? '#166534' : biasResult.score >= 50 ? '#92400e' : '#991b1b',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      Inclusivity score: {biasResult.score}/100
                    </div>
                    {biasResult.summary && (
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                        {biasResult.summary}
                      </p>
                    )}
                    {biasResult.flags.length === 0 ? (
                      <p style={{ fontSize: 12.5, color: '#16a34a' }}>No bias issues found.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {biasResult.flags.map((issue, i) => (
                          <div key={i} style={{ fontSize: 12, padding: '8px 10px', background: '#fef9c3', borderRadius: 6, borderLeft: '3px solid #eab308' }}>
                            <div style={{ fontWeight: 600, marginBottom: 3 }}>"{issue.phrase}"</div>
                            <div style={{ color: '#92400e', marginBottom: 3 }}>{issue.category}: {issue.reason}</div>
                            <div style={{ color: '#78350f' }}>→ {issue.suggestion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ opacity: 0.6 }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Post to job boards</p>
                <button className="btn btn-secondary btn-sm" disabled style={{ justifyContent: 'flex-start' }}>
                  LinkedIn — Coming soon
                </button>
                <button className="btn btn-secondary btn-sm" disabled style={{ justifyContent: 'flex-start' }}>
                  Indeed — Coming soon
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
