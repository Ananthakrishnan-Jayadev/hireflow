import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send, LayoutTemplate, MailCheck, Eye, Sparkles, Loader, Trash2, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const TEMPLATE_TYPES = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer', 'custom'];
const INTENTS = ['outreach', 'follow_up', 'interview_invite', 'rejection', 'offer'];

function fmtLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  current_stage: string;
  job_id?: number;
  job_title?: string;
}

interface Template {
  id: number;
  name: string;
  template_type?: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: number;
  candidate_id?: number;
  candidate_name?: string;
  subject: string;
  body: string;
  sent_at: string;
  status: string;
}

type TabKey = 'compose' | 'templates' | 'sent';

export function EmailsPage() {
  const { openModal, closeModal, confirm } = useModal();
  const [activeTab, setActiveTab] = useState<TabKey>('compose');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [candidateSearch, setCandidateSearch] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Compose form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [aiIntent, setAiIntent] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [sending, setSending] = useState(false);
  const [aiComposing, setAiComposing] = useState(false);

  const debouncedSearch = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCandidates = useCallback(async () => {
    try {
      const data = await api.get<{ items: Candidate[] }>('/candidates?per_page=100');
      setCandidates(data.items ?? []);
    } catch {
      toast.error('Failed to load candidates.');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadCandidates();
      try {
        const td = await api.get<Template[]>('/emails/templates');
        setTemplates(Array.isArray(td) ? td : []);
      } catch {
        toast.error('Failed to load data.');
      }
    };
    load();
  }, [loadCandidates]);

  async function loadEmailLogs() {
    setLogsLoading(true);
    try {
      const data = await api.get<EmailLog[]>('/emails/logs?per_page=100');
      setEmailLogs(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load email logs.');
    } finally {
      setLogsLoading(false);
    }
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    if (tab === 'sent') loadEmailLogs();
  }

  const filteredCandidates = candidates.filter(c =>
    !candidateSearch ||
    c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  async function handleAiCompose() {
    const intent = aiIntent;
    let context = aiContext.trim();
    if (!intent) { toast.error('Select an intent before composing.'); return; }

    if (intent === 'interview_invite') {
      const calUrl = localStorage.getItem('hireflow_calendar_url');
      if (calUrl) {
        context = context ? `${context}\n\nCalendar booking link: ${calUrl}` : `Calendar booking link for candidate to schedule: ${calUrl}`;
      }
    }

    const firstId = [...selected][0];
    const firstCand = candidates.find(c => c.id === firstId);
    const candName = firstCand?.name || 'the candidate';
    const jobTitle = firstCand?.job_title || 'the position';

    setAiComposing(true);
    try {
      const result = await api.post<{ subject: string; body: string }>('/ai/compose-email', {
        candidate_name: candName,
        candidate_email: firstCand?.email || 'candidate@example.com',
        job_title: jobTitle,
        current_stage: firstCand?.current_stage || 'Applied',
        intent,
        additional_context: context,
      });
      const escaped = candName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      setSubject(result.subject.replace(re, '{{candidate_name}}'));
      setBody(result.body.replace(re, '{{candidate_name}}'));
      toast.success('AI email composed. Review and edit before sending.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI compose failed.');
    } finally {
      setAiComposing(false);
    }
  }

  async function handleSend() {
    const subj = subject.trim();
    const b = body.trim();
    const tmplId = selectedTemplate ? parseInt(selectedTemplate, 10) : null;

    if (!subj || !b) { toast.error('Subject and body are required.'); return; }
    if (selected.size === 0) { toast.error('Select at least one candidate.'); return; }

    setSending(true);
    try {
      const result = await api.post<{ sent: number; failed: number }>('/emails/send', {
        candidate_ids: [...selected],
        template_id: tmplId,
        subject: subj,
        body: b,
      });
      const msg = result.failed > 0
        ? `Sent to ${result.sent}, failed for ${result.failed}.`
        : `Sent to ${result.sent} candidate${result.sent !== 1 ? 's' : ''}.`;
      toast.success(msg);
      setSelected(new Set());
      setSubject('');
      setBody('');
      setSelectedTemplate('');
      setAiIntent('');
      setAiContext('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  function openTemplateModal(existing?: Template) {
    const isEdit = !!existing;
    let name = existing?.name ?? '';
    let tmplType = existing?.template_type ?? '';
    let subj = existing?.subject ?? '';
    let tmplBody = existing?.body ?? '';

    openModal({
      title: isEdit ? 'Edit Template' : 'New Template',
      size: 'lg',
      content: (
        <form id="tmpl-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">Template Name</label>
              <input className="form-input" id="tf-name" defaultValue={name} placeholder="Initial Outreach" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" id="tf-type" defaultValue={tmplType}>
                <option value="">Select type…</option>
                {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{fmtLabel(t)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label required">Subject</label>
            <input className="form-input" id="tf-subject" defaultValue={subj} placeholder="Re: Your application for {{job_title}}" />
          </div>
          <div className="form-group">
            <label className="form-label required">Body</label>
            <textarea className="form-input" id="tf-body" rows={9} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              defaultValue={tmplBody} placeholder="Hi {{candidate_name}},&#10;&#10;…" />
          </div>
        </form>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" id="tf-save"
            onClick={async () => {
              const n = (document.getElementById('tf-name') as HTMLInputElement).value.trim();
              const s = (document.getElementById('tf-subject') as HTMLInputElement).value.trim();
              const b = (document.getElementById('tf-body') as HTMLTextAreaElement).value.trim();
              if (!n || !s || !b) { toast.error('Name, subject, and body are required.'); return; }
              const saveBtn = document.getElementById('tf-save') as HTMLButtonElement;
              saveBtn.disabled = true;
              try {
                const payload = {
                  name: n, subject: s, body: b,
                  template_type: (document.getElementById('tf-type') as HTMLSelectElement).value || null,
                };
                if (existing) {
                  const updated = await api.put<Template>(`/emails/templates/${existing.id}`, payload);
                  setTemplates(prev => prev.map(t => t.id === existing.id ? updated : t));
                  toast.success('Template updated.');
                } else {
                  const created = await api.post<Template>('/emails/templates', payload);
                  setTemplates(prev => [created, ...prev]);
                  toast.success('Template created.');
                }
                closeModal();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Save failed.');
                saveBtn.disabled = false;
              }
            }}>
            <Pencil size={14} /> {isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      ),
    });
  }

  async function deleteTemplate(t: Template) {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Delete template "${t.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/emails/templates/${t.id}`);
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      toast.success('Template deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  const typeColors: Record<string, string> = {
    outreach: 'badge-info',
    follow_up: 'badge-default',
    interview_invite: 'badge-purple',
    rejection: 'badge-error',
    offer: 'badge-success',
    custom: 'badge-accent',
  };

  return (
    <div>
      <Topbar title="Email Outreach" subtitle="Compose and send emails to candidates" />
      <div className="tabs" style={{ padding: '0 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        {(['compose', 'templates', 'sent'] as TabKey[]).map(tab => (
          <button key={tab} className={`tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => switchTab(tab)}>
            {tab === 'compose' && <Send size={14} />}
            {tab === 'templates' && <LayoutTemplate size={14} />}
            {tab === 'sent' && <MailCheck size={14} />}
            {fmtLabel(tab)}
          </button>
        ))}
      </div>

      <div className="page-content">
        {activeTab === 'compose' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>
            {/* Candidate picker */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span className="card-title">Select Recipients</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.size} selected</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    filteredCandidates.forEach(c => setSelected(prev => new Set([...prev, c.id])));
                  }}>Select All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 12 }}>
                <input className="form-input" placeholder="Search candidates…"
                  value={candidateSearch}
                  onChange={e => {
                    setCandidateSearch(e.target.value);
                    if (debouncedSearch.current) clearTimeout(debouncedSearch.current);
                    debouncedSearch.current = setTimeout(() => {
                      setCandidateSearch(e.target.value);
                    }, 250);
                  }}
                  style={{ marginBottom: 10 }} />
                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {candidateSearch ? 'No candidates match.' : 'No candidates found.'}
                  </div>
                ) : (
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', width: 36 }}>
                            <input type="checkbox" checked={selected.size === filteredCandidates.length && filteredCandidates.length > 0}
                              onChange={e => {
                                if (e.target.checked) {
                                  filteredCandidates.forEach(c => setSelected(prev => new Set([...prev, c.id])));
                                } else {
                                  setSelected(new Set());
                                }
                              }} />
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Email</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCandidates.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="checkbox" checked={selected.has(c.id)}
                                onChange={() => {
                                  setSelected(prev => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id);
                                    else next.add(c.id);
                                    return next;
                                  });
                                }} />
                            </td>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.email}</td>
                            <td><span className="badge badge-default" style={{ fontSize: 10 }}>{c.current_stage}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Template picker */}
              <div className="card">
                <div className="card-header"><span className="card-title">Template</span></div>
                <div className="card-body">
                  <select className="form-select" value={selectedTemplate}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedTemplate(val);
                      const tmpl = templates.find(t => String(t.id) === val);
                      if (tmpl) { setSubject(tmpl.subject); setBody(tmpl.body); }
                    }}>
                    <option value="">No template — compose manually</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* AI Composer */}
              <div className="card">
                <div className="card-header"><span className="card-title">AI Composer ✨</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Intent</label>
                    <select className="form-select" value={aiIntent}
                      onChange={e => setAiIntent(e.target.value)}>
                      <option value="">Select intent…</option>
                      {INTENTS.map(i => <option key={i} value={i}>{fmtLabel(i)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Additional Context</label>
                    <textarea className="form-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      placeholder="Interview on Monday at 3pm, role is Backend Engineer…"
                      value={aiContext} onChange={e => setAiContext(e.target.value)} />
                  </div>
                  <button className="btn btn-secondary" onClick={handleAiCompose} disabled={aiComposing} style={{ gap: 6 }}>
                    {aiComposing ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                    {aiComposing ? 'Composing…' : 'Compose with AI'}
                  </button>
                </div>
              </div>

              {/* Message */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <span className="card-title">Message</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Use <code>{'{{candidate_name}}'}</code> <code>{'{{job_title}}'}</code>
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label required">Subject</label>
                    <input className="form-input" placeholder="Subject line…"
                      value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Body</label>
                    <textarea className="form-input" rows={8} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      placeholder="Hi {{candidate_name}},&#10;&#10;…"
                      value={body} onChange={e => setBody(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ gap: 6 }}>
                    {sending ? <Loader size={15} className="spin" /> : <Send size={15} />}
                    Send to {selected.size} candidate{selected.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => openTemplateModal()}>
                <Pencil size={15} /> New Template
              </button>
            </div>
            {templates.length === 0 ? (
              <div className="empty-state">
                <LayoutTemplate size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h2 className="empty-state-title">No templates yet</h2>
                <p className="empty-state-desc">Create reusable email templates to speed up outreach.</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                      {['Name', 'Type', 'Subject', 'Updated', ''].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${typeColors[t.template_type ?? 'custom']}`}>
                            {fmtLabel(t.template_type ?? 'custom')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.subject}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatDate(t.updated_at || t.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openTemplateModal(t)}>
                              <Pencil size={13} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => deleteTemplate(t)}>
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
          </div>
        )}

        {activeTab === 'sent' && (
          <div>
            {logsLoading ? <PageSpinner /> : emailLogs.length === 0 ? (
              <div className="empty-state">
                <MailCheck size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <h2 className="empty-state-title">No emails sent yet</h2>
                <p className="empty-state-desc">Emails you send from the Compose tab will appear here.</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                      {['Candidate', 'Subject', 'Sent At', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          {log.candidate_id ? (
                            <Link to={`/candidates/${log.candidate_id}`} style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                              {log.candidate_name || `Candidate #${log.candidate_id}`}
                            </Link>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.subject}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.sent_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${log.status === 'sent' ? 'badge-success' : 'badge-error'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            openModal({
                              title: log.subject,
                              content: (
                                <div>
                                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                    To: {log.candidate_name || '—'} · {formatDateTime(log.sent_at)}
                                  </p>
                                  <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                                    {log.body}
                                  </div>
                                </div>
                              ),
                              footer: <button className="btn btn-secondary" onClick={closeModal}>Close</button>,
                            });
                          }}>
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
