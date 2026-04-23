import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, LayoutList, LayoutGrid, Archive, MapPin, Users } from 'lucide-react';
import { api } from '../lib/api';
import { formatJobType, statusBadgeClass, buildQuery, daysAgo, debounce } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
const STATUSES = ['draft', 'open', 'closed', 'archived'];

interface Job {
  id: number;
  title: string;
  status: string;
  department?: string;
  job_type?: string;
  location?: string;
  candidate_count: number;
  created_at: string;
}

interface JobsResponse { items: Job[]; total: number; page: number; pages: number; }

export function JobsPage() {
  const navigate = useNavigate();
  const { confirm } = useModal();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async (p = 1, q = search, s = status, d = department) => {
    setLoading(true);
    try {
      const qs = buildQuery({ search: q, status: s, department: d, page: p, per_page: 20 });
      const data = await api.get<JobsResponse>(`/jobs${qs}`);
      setJobs(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 1);
    } catch (err: unknown) {
      toast.error('Failed to load jobs: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [search, status, department]);

  useEffect(() => { loadJobs(); }, []);

  const debouncedSearch = useRef(debounce((val: unknown) => {
    setSearch(val as string);
    loadJobs(1, val as string, status, department);
  }, 300)).current;

  async function archiveJob(job: Job) {
    const ok = await confirm({
      title: 'Archive Job',
      message: `Archive "${job.title}"? It will be hidden from active listings.`,
      confirmLabel: 'Archive',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/jobs/${job.id}`);
      toast.success('Job archived.');
      loadJobs(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive job.');
    }
  }

  return (
    <div>
      <Topbar
        title="Jobs"
        subtitle="Manage your job postings"
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')}
              aria-label="Toggle view"
            >
              {view === 'grid' ? <LayoutList size={16} /> : <LayoutGrid size={16} />}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/jobs/new')}>
              <Plus size={15} /> Create Job
            </button>
          </>
        }
      />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              className="form-input search-input"
              type="search"
              placeholder="Search jobs…"
              onChange={e => debouncedSearch(e.target.value)}
              aria-label="Search jobs"
            />
          </div>
          <select className="form-select" style={{ maxWidth: 160 }} aria-label="Filter by status"
            value={status} onChange={e => { setStatus(e.target.value); loadJobs(1, search, e.target.value, department); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 180 }} aria-label="Filter by department"
            value={department} onChange={e => { setDepartment(e.target.value); loadJobs(1, search, status, e.target.value); }}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
            {total} job{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <PageSpinner />
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: 40 }}>💼</div>
            <h2 className="empty-state-title">No jobs found</h2>
            <p className="empty-state-desc">
              {search || status || department
                ? 'No jobs match your filters. Try adjusting your search.'
                : 'Get started by creating your first job posting.'}
            </p>
            {!search && !status && !department && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/jobs/new')}>
                Create Job
              </button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {jobs.map(job => <JobCard key={job.id} job={job} onArchive={archiveJob} onClick={() => navigate(`/jobs/${job.id}`)} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(job => <JobRow key={job.id} job={job} onArchive={archiveJob} onClick={() => navigate(`/jobs/${job.id}`)} />)}
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            <button className="page-btn" disabled={page <= 1} onClick={() => { loadJobs(page - 1); setPage(p => p - 1); }}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => { loadJobs(p); setPage(p); }}>{p}</button>
            ))}
            <button className="page-btn" disabled={page >= pages} onClick={() => { loadJobs(page + 1); setPage(p => p + 1); }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onArchive, onClick }: { job: Job; onArchive: (j: Job) => void; onClick: () => void }) {
  return (
    <div className="card hover-lift" role="button" tabIndex={0}
      style={{ padding: 20, cursor: 'pointer', position: 'relative' }}
      onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span className={`badge ${statusBadgeClass(job.status)}`}>{job.status}</span>
        <button className="btn-icon" style={{ width: 28, height: 28, opacity: 0.5 }}
          aria-label="Archive job"
          onClick={e => { e.stopPropagation(); onArchive(job); }}>
          <Archive size={14} />
        </button>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{job.title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {job.department && <span className="badge badge-accent">{job.department}</span>}
        {job.job_type && <span className="badge badge-default">{formatJobType(job.job_type)}</span>}
        {job.location && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={12} />{job.location}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={13} /> {job.candidate_count} candidate{job.candidate_count !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{daysAgo(job.created_at)}d ago</span>
      </div>
    </div>
  );
}

function JobRow({ job, onArchive, onClick }: { job: Job; onArchive: (j: Job) => void; onClick: () => void }) {
  return (
    <div className="card" role="button" tabIndex={0}
      style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
      onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{job.title}</span>
          <span className={`badge ${statusBadgeClass(job.status)}`}>{job.status}</span>
          {job.department && <span className="badge badge-accent">{job.department}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {job.location && <span>{job.location}</span>}
          {job.job_type && <span>{formatJobType(job.job_type)}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{job.candidate_count} candidates</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{daysAgo(job.created_at)}d ago</div>
      </div>
      <button className="btn-icon" aria-label="Archive"
        onClick={e => { e.stopPropagation(); onArchive(job); }}>
        <Archive size={15} />
      </button>
    </div>
  );
}
