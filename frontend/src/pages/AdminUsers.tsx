import { useEffect, useState } from 'react';
import { UserPlus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { api } from '../lib/api';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';
import { useModal } from '../contexts/ModalContext';

const ROLE_STYLE: Record<string, { color: string; bg: string }> = {
  admin: { color: '#7c3aed', bg: '#f5f3ff' },
  recruiter: { color: '#0369a1', bg: '#e0f2fe' },
  viewer: { color: '#374151', bg: '#f3f4f6' },
};

interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.viewer;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.02, color: s.color, background: s.bg,
    }}>
      {role}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
      Active
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} />
      Inactive
    </span>
  );
}

export function AdminUsersPage() {
  const { openModal, closeModal, confirm } = useModal();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<number | null>(null);

  useEffect(() => {
    api.get<User[]>('/auth/users')
      .then(setUsers)
      .catch(() => toast.error('Failed to load users.'))
      .finally(() => setLoading(false));

    const token = sessionStorage.getItem('hireflow_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        setSelfId(parseInt(payload.sub));
      } catch { setSelfId(null); }
    }
  }, []);

  async function toggleActive(user: User) {
    try {
      await api.patch<User>(`/auth/users/${user.id}`, { is_active: !user.is_active });
      toast.success(user.is_active ? `${user.email} deactivated.` : `${user.email} activated.`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user.');
    }
  }

  async function deleteUser(user: User) {
    const ok = await confirm({
      title: 'Delete User',
      message: `This will permanently delete ${user.email}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/auth/users/${user.id}`);
      toast.success(`User ${user.email} deleted.`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  function openCreateModal() {
    let email = '';
    let name = '';
    let role = 'recruiter';
    let password = '';

    openModal({
      title: 'Add New User',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label required">Email address</label>
            <input className="form-input" id="create-email" type="email" placeholder="jane@company.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" id="create-name" placeholder="Jane Smith" />
          </div>
          <div className="form-group">
            <label className="form-label required">Role</label>
            <select className="form-select" id="create-role" defaultValue={role}
              onChange={e => { role = e.target.value; }}>
              <option value="recruiter">Recruiter — can manage jobs &amp; candidates</option>
              <option value="viewer">Viewer — read-only access</option>
              <option value="admin">Admin — full access + user management</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Password</label>
            <input className="form-input" id="create-password" type="password" placeholder="Min 8 chars, 1 letter + 1 digit" />
          </div>
          <div id="create-error" style={{ display: 'none', padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 12.5, border: '1px solid #fecaca' }} />
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" id="create-submit-btn"
            onClick={async () => {
              email = (document.getElementById('create-email') as HTMLInputElement).value.trim();
              name = (document.getElementById('create-name') as HTMLInputElement).value.trim();
              role = (document.getElementById('create-role') as HTMLSelectElement).value;
              password = (document.getElementById('create-password') as HTMLInputElement).value;
              const errEl = document.getElementById('create-error') as HTMLDivElement;
              errEl.style.display = 'none';

              if (!email || !password) { errEl.textContent = 'Email and password are required.'; errEl.style.display = 'block'; return; }
              if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; return; }
              if (!/[A-Za-z]/.test(password)) { errEl.textContent = 'Password must include at least one letter.'; errEl.style.display = 'block'; return; }
              if (!/\d/.test(password)) { errEl.textContent = 'Password must include at least one digit.'; errEl.style.display = 'block'; return; }

              const btn = document.getElementById('create-submit-btn') as HTMLButtonElement;
              btn.disabled = true;
              try {
                const created = await api.post<User>('/auth/users', { email, full_name: name || undefined, role, password });
                setUsers(prev => [...prev, created]);
                toast.success('User created successfully.');
                closeModal();
              } catch (err) {
                errEl.textContent = err instanceof Error ? err.message : 'Failed to create user.';
                errEl.style.display = 'block';
                btn.disabled = false;
              }
            }}>
            <UserPlus size={14} /> Create User
          </button>
        </div>
      ),
    });
  }

  function openEditModal(user: User) {
    let name = user.full_name ?? '';
    let role = user.role;

    openModal({
      title: 'Edit User',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Email</label>
            <div style={{ padding: '9px 12px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, color: 'var(--text-muted)' }}>{user.email}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" id="edit-name" defaultValue={name} />
          </div>
          <div className="form-group">
            <label className="form-label required">Role</label>
            <select className="form-select" id="edit-role" defaultValue={role}
              onChange={e => { role = e.target.value; }}>
              <option value="recruiter">Recruiter — can manage jobs &amp; candidates</option>
              <option value="viewer">Viewer — read-only access</option>
              <option value="admin">Admin — full access + user management</option>
            </select>
          </div>
          <div id="edit-error" style={{ display: 'none', padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 12.5, border: '1px solid #fecaca' }} />
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" id="edit-submit-btn"
            onClick={async () => {
              name = (document.getElementById('edit-name') as HTMLInputElement).value.trim();
              const errEl = document.getElementById('edit-error') as HTMLDivElement;
              errEl.style.display = 'none';
              const btn = document.getElementById('edit-submit-btn') as HTMLButtonElement;
              btn.disabled = true;
              try {
                const updated = await api.patch<User>(`/auth/users/${user.id}`, { full_name: name || null, role });
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u));
                toast.success('User updated.');
                closeModal();
              } catch (err) {
                errEl.textContent = err instanceof Error ? err.message : 'Failed to update user.';
                errEl.style.display = 'block';
                btn.disabled = false;
              }
            }}>
            <Pencil size={14} /> Save Changes
          </button>
        </div>
      ),
    });
  }

  if (loading) return <PageSpinner />;

  return (
    <div>
      <Topbar
        title="User Management"
        subtitle="Manage who has access to HireFlow and their permissions"
        actions={
          <button className="btn btn-primary" onClick={openCreateModal}>
            <UserPlus size={15} /> Add User
          </button>
        }
      />
      <div className="page-content">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {users.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              No users yet. Click <strong>Add User</strong> to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                  <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>User</th>
                  <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Role</th>
                  <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-muted)',
                          color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                            {u.full_name || u.email.split('@')[0]}
                            {u.id === selfId && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 5 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '14px 20px' }}><ActiveBadge active={u.is_active} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(u)}>
                          <Pencil size={13} /> Edit
                        </button>
                        {u.id !== selfId && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: u.is_active ? '#d97706' : '#16a34a' }}
                              onClick={() => toggleActive(u)}
                            >
                              {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--color-error)' }}
                              onClick={() => deleteUser(u)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
