import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DollarSign } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  department?: string;
  location?: string;
  job_type?: string;
  location_type?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

function getLocationType(job: Job) {
  const t = ((job.job_type || '') + ' ' + (job.location_type || '')).toLowerCase();
  if (t.includes('hybrid')) return 'hybrid';
  if (t.includes('remote')) return 'remote';
  if (t.includes('on-site') || t.includes('onsite') || t.includes('on site')) return 'on-site';
  return '';
}

function capitalize(s?: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function applyFilters(jobs: Job[], filters: {
  q: string;
  locationType: string;
  location: string;
  team: string;
  workType: string;
}) {
  return jobs.filter(j => {
    if (filters.q &&
      !(j.title || '').toLowerCase().includes(filters.q) &&
      !(j.description || '').toLowerCase().includes(filters.q) &&
      !(j.department || '').toLowerCase().includes(filters.q)) return false;
    if (filters.locationType && getLocationType(j) !== filters.locationType) return false;
    if (filters.location && j.location !== filters.location) return false;
    if (filters.team && j.department !== filters.team) return false;
    if (filters.workType && (j.job_type || '').toLowerCase() !== filters.workType.toLowerCase()) return false;
    return true;
  });
}

export function CareerPage() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    locationType: '',
    location: '',
    team: '',
    workType: '',
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [applyForm, setApplyForm] = useState({ name: '', email: '', phone: '', linkedin: '', cover: '' });
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/career/jobs')
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json(); })
      .then(setAllJobs)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const locations = [...new Set(allJobs.map(j => j.location).filter(Boolean))].sort();
  const teams = [...new Set(allJobs.map(j => j.department).filter(Boolean))].sort();
  const filtered = applyFilters(allJobs, filters);

  const grouped: Record<string, Job[]> = {};
  filtered.forEach(j => {
    const team = j.department || 'Other';
    (grouped[team] = grouped[team] || []).push(j);
  });

  function openApply(job: Job) {
    setApplyJob(job);
    setSelectedJob(null);
    setApplySuccess(false);
    setApplyError('');
    setApplyForm({ name: '', email: '', phone: '', linkedin: '', cover: '' });
  }

  async function handleApply(e: FormEvent) {
    e.preventDefault();
    if (!applyJob) return;
    setApplyError('');
    const { name, email, phone, linkedin, cover } = applyForm;
    if (!name || !email) { setApplyError('Full name and email are required.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/career/jobs/${applyJob.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email,
          phone: phone || null,
          linkedin_url: linkedin || null,
          cover_letter: cover || null,
          resume_url: null,
          resume_text: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyError(Array.isArray(data.detail) ? data.detail.map((x: { msg: string }) => x.msg).join(', ') : (data.detail || 'Submission failed.'));
        return;
      }
      setApplySuccess(true);
    } catch {
      setApplyError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Join Our Team</h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
          We're building the future of hiring. Explore open roles and apply in minutes.
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Search roles…"
            value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          />
          <select className="form-select" style={{ maxWidth: 160 }}
            value={filters.locationType}
            onChange={e => setFilters(f => ({ ...f, locationType: e.target.value }))}>
            <option value="">All Location Types</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
          <select className="form-select" style={{ maxWidth: 160 }}
            value={filters.location}
            onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}>
            <option value="">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }}
            value={filters.team}
            onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }}
            value={filters.workType}
            onChange={e => setFilters(f => ({ ...f, workType: e.target.value }))}>
            <option value="">All Types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading positions…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-error)' }}>
            Could not load positions. Please try again later.<br />
            <small>{error}</small>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            No positions match your filters.
          </div>
        ) : (
          Object.keys(grouped).sort().map(team => (
            <div key={team} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
                {team}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[team].map(job => {
                  const locType = getLocationType(job);
                  const meta = [locType && capitalize(locType), job.job_type && job.job_type.replace(/_/g, ' '), job.location].filter(Boolean);
                  return (
                    <div key={job.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', background: 'var(--bg-card)',
                      border: '1px solid var(--border)', borderRadius: 10,
                      gap: 16, flexWrap: 'wrap',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{job.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {meta.map((m, i) => <span key={i}>{m}</span>)}
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => openApply(job)}>Apply</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setSelectedJob(null); }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 580,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedJob.title}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {[selectedJob.department, selectedJob.location, selectedJob.job_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {selectedJob.salary_min || selectedJob.salary_max ? (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                    ${(selectedJob.salary_min || 0).toLocaleString()} – ${(selectedJob.salary_max || 0).toLocaleString()} USD
                  </span>
                </div>
              ) : null}
              {selectedJob.description ? (
                <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {selectedJob.description}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No description provided.</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setSelectedJob(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => { setSelectedJob(null); openApply(selectedJob); }}>Apply Now</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyJob && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setApplyJob(null); }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 500,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          }}>
            {applySuccess ? (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>✓</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Application Submitted!</h3>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Thank you for applying to <strong>{applyJob.title}</strong>. We'll be in touch soon.
                </p>
                <button className="btn btn-primary" onClick={() => setApplyJob(null)}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>Apply — {applyJob.title}</h2>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[applyJob.department, applyJob.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <form onSubmit={handleApply} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label required">Full Name</label>
                    <input className="form-input" value={applyForm.name}
                      onChange={e => setApplyForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Email</label>
                    <input className="form-input" type="email" value={applyForm.email}
                      onChange={e => setApplyForm(f => ({ ...f, email: e.target.value }))} required placeholder="jane@example.com" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className="form-input" value={applyForm.phone}
                        onChange={e => setApplyForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">LinkedIn</label>
                      <input className="form-input" value={applyForm.linkedin}
                        onChange={e => setApplyForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="linkedin.com/in/…" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cover Letter</label>
                    <textarea className="form-input" rows={3} value={applyForm.cover}
                      onChange={e => setApplyForm(f => ({ ...f, cover: e.target.value }))}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }} placeholder="Tell us why you'd be a great fit…" />
                  </div>
                  {applyError && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 12.5, border: '1px solid #fecaca' }}>
                      {applyError}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setApplyJob(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
