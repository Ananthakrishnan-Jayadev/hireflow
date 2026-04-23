import { get, post, patch, del } from '../api.js';
import { showSuccess, showError } from '../components/toast.js';
import { escapeHtml } from '../utils/helpers.js';

const ROLES = ['admin', 'recruiter', 'viewer'];

const ROLE_BADGE = {
  admin:     { color: '#7c3aed', bg: '#f5f3ff' },
  recruiter: { color: '#0369a1', bg: '#e0f2fe' },
  viewer:    { color: '#374151', bg: '#f3f4f6' },
};

function roleBadge(role) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.viewer;
  return `<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;
    font-size:11px;font-weight:600;letter-spacing:0.02em;
    color:${s.color};background:${s.bg};">${escapeHtml(role)}</span>`;
}

function activeBadge(active) {
  return active
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#16a34a;">
         <span style="width:6px;height:6px;border-radius:50%;background:#16a34a;display:inline-block;"></span>Active
       </span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#9ca3af;">
         <span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block;"></span>Inactive
       </span>`;
}

// ── API helpers ───────────────────────────────────────────────────────────

async function fetchUsers()               { return get('/auth/users'); }
async function createUser(data)           { return post('/auth/users', data); }
async function updateUser(id, data)       { return patch(`/auth/users/${id}`, data); }
async function deleteUser(id)             { return del(`/auth/users/${id}`); }

// ── Render ────────────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
          <i data-lucide="shield-check" style="width:22px;height:22px;color:var(--accent);"></i>
          User Management
        </h1>
        <p class="page-subtitle">Manage who has access to HireFlow and their permissions.</p>
      </div>
      <button id="create-user-btn" class="btn btn-primary">
        <i data-lucide="user-plus" style="width:15px;height:15px;"></i>
        Add User
      </button>
    </div>

    <div class="card" style="margin-top:20px;padding:0;overflow:hidden;">
      <div id="users-table-wrap" style="min-height:200px;">
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted);">
          <i data-lucide="loader" style="width:20px;height:20px;animation:spin 1s linear infinite;"></i>
        </div>
      </div>
    </div>

    ${_createModal()}
    ${_editModal()}
    ${_confirmModal()}
  `;

  if (window.lucide) lucide.createIcons();

  await _loadUsers();
  _bindCreate();
}

// ── Load & render table ───────────────────────────────────────────────────

async function _loadUsers() {
  const wrap = document.getElementById('users-table-wrap');
  try {
    const users = await fetchUsers();
    _renderTable(users);
  } catch (err) {
    wrap.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--color-error);">
        <i data-lucide="alert-triangle" style="width:22px;height:22px;margin-bottom:8px;display:block;margin-inline:auto;"></i>
        <p style="margin-bottom:12px;">${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
}

function _renderTable(users) {
  const wrap = document.getElementById('users-table-wrap');
  if (!users.length) {
    wrap.innerHTML = `
      <div style="padding:60px;text-align:center;color:var(--text-muted);">
        <i data-lucide="users" style="width:32px;height:32px;display:block;margin:0 auto 12px;opacity:0.3;"></i>
        <p>No users yet. Click <strong>Add User</strong> to get started.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Decode current user id from JWT to disable self-action buttons
  const selfId = _getSelfId();

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);background:var(--bg-card-hover);">
          <th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">User</th>
          <th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Role</th>
          <th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Status</th>
          <th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => _userRow(u, selfId)).join('')}
      </tbody>
    </table>
  `;

  // Row action events
  wrap.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = users.find(x => x.id === parseInt(btn.dataset.editUser));
      if (u) _openEditModal(u);
    });
  });

  wrap.querySelectorAll('[data-toggle-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = users.find(x => x.id === parseInt(btn.dataset.toggleUser));
      if (u) _toggleActive(u);
    });
  });

  wrap.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = users.find(x => x.id === parseInt(btn.dataset.deleteUser));
      if (u) _openDeleteConfirm(u);
    });
  });

  if (window.lucide) lucide.createIcons();
}

function _userRow(u, selfId) {
  const isSelf = u.id === selfId;
  const initials = (u.full_name || u.email).slice(0, 2).toUpperCase();
  const displayName = escapeHtml(u.full_name || u.email.split('@')[0]);
  const toggleLabel = u.is_active ? 'Deactivate' : 'Activate';
  const toggleIcon  = u.is_active ? 'user-x' : 'user-check';

  return `
    <tr style="border-bottom:1px solid var(--border-light);transition:background .1s;"
        onmouseover="this.style.background='var(--bg-card-hover)'"
        onmouseout="this.style.background=''">
      <td style="padding:14px 20px;">
        <div style="display:flex;align-items:center;gap:11px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-muted);
                      color:var(--accent);font-size:13px;font-weight:700;
                      display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${initials}
          </div>
          <div>
            <div style="font-weight:600;font-size:13.5px;color:var(--text-primary);">
              ${displayName}
              ${isSelf ? '<span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-left:5px;">(you)</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted);">${escapeHtml(u.email)}</div>
          </div>
        </div>
      </td>
      <td style="padding:14px 20px;">${roleBadge(u.role)}</td>
      <td style="padding:14px 20px;">${activeBadge(u.is_active)}</td>
      <td style="padding:14px 20px;">
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-secondary btn-sm" data-edit-user="${u.id}" title="Edit">
            <i data-lucide="pencil" style="width:13px;height:13px;"></i> Edit
          </button>
          ${!isSelf ? `
          <button class="btn btn-secondary btn-sm" data-toggle-user="${u.id}"
            title="${toggleLabel}"
            style="${u.is_active ? 'color:#d97706;' : 'color:#16a34a;'}">
            <i data-lucide="${toggleIcon}" style="width:13px;height:13px;"></i> ${toggleLabel}
          </button>
          <button class="btn btn-secondary btn-sm" data-delete-user="${u.id}" title="Delete"
            style="color:var(--color-error);">
            <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
          </button>
          ` : ''}
        </div>
      </td>
    </tr>`;
}

// ── Create modal ──────────────────────────────────────────────────────────

function _createModal() {
  return `
  <div id="create-user-modal" style="display:none;position:fixed;inset:0;z-index:1200;
       background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);" role="dialog" aria-modal="true">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:100%;max-width:460px;background:var(--bg-card);border-radius:14px;
                box-shadow:0 20px 50px rgba(0,0,0,0.25);padding:28px 28px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
        <h2 style="font-size:16px;font-weight:700;color:var(--text-primary);
                   display:flex;align-items:center;gap:8px;">
          <i data-lucide="user-plus" style="width:17px;height:17px;color:var(--accent);"></i>
          Add New User
        </h2>
        <button id="create-modal-close" style="background:none;border:none;cursor:pointer;
          padding:4px;color:var(--text-muted);border-radius:4px;">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>

      <form id="create-user-form" novalidate>
        <div style="display:grid;gap:14px;">
          ${_field('create-email',   'Email address', 'email',    'jane@company.com',  true)}
          ${_field('create-name',    'Full name',     'text',     'Jane Smith',         false)}
          ${_roleField('create-role')}
          ${_field('create-password','Password',      'password', 'Min 8 chars, 1 letter + 1 digit', true)}
        </div>
        <div id="create-error" style="display:none;margin-top:14px;padding:10px 12px;border-radius:8px;
             background:#fef2f2;color:#991b1b;font-size:12.5px;border:1px solid #fecaca;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
          <button type="button" class="btn btn-secondary" id="create-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="create-submit-btn">
            <i data-lucide="user-plus" style="width:14px;height:14px;"></i>
            Create User
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Edit modal ────────────────────────────────────────────────────────────

function _editModal() {
  return `
  <div id="edit-user-modal" style="display:none;position:fixed;inset:0;z-index:1200;
       background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);" role="dialog" aria-modal="true">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:100%;max-width:460px;background:var(--bg-card);border-radius:14px;
                box-shadow:0 20px 50px rgba(0,0,0,0.25);padding:28px 28px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
        <h2 style="font-size:16px;font-weight:700;color:var(--text-primary);
                   display:flex;align-items:center;gap:8px;">
          <i data-lucide="user-cog" style="width:17px;height:17px;color:var(--accent);"></i>
          Edit User
        </h2>
        <button id="edit-modal-close" style="background:none;border:none;cursor:pointer;
          padding:4px;color:var(--text-muted);border-radius:4px;">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>

      <form id="edit-user-form" novalidate>
        <input type="hidden" id="edit-user-id" />
        <div style="display:grid;gap:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:5px;">Email</label>
            <div id="edit-user-email" style="padding:9px 12px;background:var(--bg-card-hover);
              border:1px solid var(--border);border-radius:8px;font-size:13.5px;color:var(--text-muted);"></div>
          </div>
          ${_field('edit-name', 'Full name', 'text', 'Jane Smith', false)}
          ${_roleField('edit-role')}
        </div>
        <div id="edit-error" style="display:none;margin-top:14px;padding:10px 12px;border-radius:8px;
             background:#fef2f2;color:#991b1b;font-size:12.5px;border:1px solid #fecaca;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
          <button type="button" class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="edit-submit-btn">
            <i data-lucide="save" style="width:14px;height:14px;"></i>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Confirm delete modal ──────────────────────────────────────────────────

function _confirmModal() {
  return `
  <div id="confirm-delete-modal" style="display:none;position:fixed;inset:0;z-index:1300;
       background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);" role="dialog" aria-modal="true">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:100%;max-width:380px;background:var(--bg-card);border-radius:14px;
                box-shadow:0 20px 50px rgba(0,0,0,0.25);padding:28px;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#fee2e2;display:inline-flex;
                    align-items:center;justify-content:center;margin-bottom:12px;">
          <i data-lucide="trash-2" style="width:20px;height:20px;color:#ef4444;"></i>
        </div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">Delete User?</h3>
        <p id="confirm-delete-msg" style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;"></p>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-secondary" id="confirm-cancel-btn" style="flex:1;">Cancel</button>
        <button class="btn btn-primary" id="confirm-delete-btn"
          style="flex:1;background:#ef4444;border-color:#ef4444;">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          Delete
        </button>
      </div>
    </div>
  </div>`;
}

// ── Form field helpers ────────────────────────────────────────────────────

function _field(id, label, type, placeholder, required) {
  return `
    <div>
      <label for="${id}" style="display:block;font-size:12px;font-weight:600;
        color:var(--text-secondary);margin-bottom:5px;">
        ${label}${required ? ' <span style="color:var(--color-error);">*</span>' : ''}
      </label>
      <input id="${id}" type="${type}" placeholder="${placeholder}"
        class="form-input" style="font-size:13.5px;"
        ${required ? 'required' : ''} />
    </div>`;
}

function _roleField(id) {
  return `
    <div>
      <label for="${id}" style="display:block;font-size:12px;font-weight:600;
        color:var(--text-secondary);margin-bottom:5px;">
        Role <span style="color:var(--color-error);">*</span>
      </label>
      <select id="${id}" class="form-input" style="font-size:13.5px;">
        <option value="recruiter">Recruiter — can manage jobs & candidates</option>
        <option value="viewer">Viewer — read-only access</option>
        <option value="admin">Admin — full access + user management</option>
      </select>
    </div>`;
}

// ── Create logic ──────────────────────────────────────────────────────────

function _bindCreate() {
  document.getElementById('create-user-btn')?.addEventListener('click', () => _openCreateModal());
  document.getElementById('create-modal-close')?.addEventListener('click', () => _closeModal('create-user-modal'));
  document.getElementById('create-cancel-btn')?.addEventListener('click', () => _closeModal('create-user-modal'));
  document.getElementById('create-user-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'create-user-modal') _closeModal('create-user-modal');
  });

  document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl  = document.getElementById('create-error');
    const btn    = document.getElementById('create-submit-btn');
    const email  = document.getElementById('create-email').value.trim();
    const name   = document.getElementById('create-name').value.trim();
    const role   = document.getElementById('create-role').value;
    const pass   = document.getElementById('create-password').value;

    errEl.style.display = 'none';
    if (!email || !pass) { _showFormError(errEl, 'Email and password are required.'); return; }
    if (pass.length < 8) { _showFormError(errEl, 'Password must be at least 8 characters.'); return; }
    if (!/[A-Za-z]/.test(pass)) { _showFormError(errEl, 'Password must include at least one letter.'); return; }
    if (!/\d/.test(pass)) { _showFormError(errEl, 'Password must include at least one digit.'); return; }

    _setLoading(btn, true);
    try {
      await createUser({ email, full_name: name || undefined, role, password: pass });
      _closeModal('create-user-modal');
      showSuccess('User created successfully.');
      await _loadUsers();
    } catch (err) {
      _showFormError(errEl, err.message);
    } finally {
      _setLoading(btn, false);
    }
  });
}

function _openCreateModal() {
  document.getElementById('create-user-form').reset();
  document.getElementById('create-error').style.display = 'none';
  document.getElementById('create-role').value = 'recruiter';
  _openModal('create-user-modal');
}

// ── Edit logic ────────────────────────────────────────────────────────────

function _openEditModal(user) {
  document.getElementById('edit-user-id').value  = user.id;
  document.getElementById('edit-user-email').textContent = user.email;
  document.getElementById('edit-name').value     = user.full_name || '';
  document.getElementById('edit-role').value     = user.role;
  document.getElementById('edit-error').style.display = 'none';

  document.getElementById('edit-modal-close').onclick = () => _closeModal('edit-user-modal');
  document.getElementById('edit-cancel-btn').onclick  = () => _closeModal('edit-user-modal');
  document.getElementById('edit-user-modal').onclick  = (e) => {
    if (e.target.id === 'edit-user-modal') _closeModal('edit-user-modal');
  };

  document.getElementById('edit-user-form').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('edit-error');
    const btn   = document.getElementById('edit-submit-btn');
    const id    = parseInt(document.getElementById('edit-user-id').value);
    const name  = document.getElementById('edit-name').value.trim();
    const role  = document.getElementById('edit-role').value;

    errEl.style.display = 'none';
    _setLoading(btn, true);
    try {
      await updateUser(id, { full_name: name || null, role });
      _closeModal('edit-user-modal');
      showSuccess('User updated.');
      await _loadUsers();
    } catch (err) {
      _showFormError(errEl, err.message);
    } finally {
      _setLoading(btn, false);
    }
  };

  _openModal('edit-user-modal');
  document.getElementById('edit-name').focus();
}

// ── Toggle active ─────────────────────────────────────────────────────────

async function _toggleActive(user) {
  try {
    await updateUser(user.id, { is_active: !user.is_active });
    showSuccess(user.is_active ? `${user.email} deactivated.` : `${user.email} activated.`);
    await _loadUsers();
  } catch (err) {
    showError(err.message);
  }
}

// ── Delete logic ──────────────────────────────────────────────────────────

function _openDeleteConfirm(user) {
  document.getElementById('confirm-delete-msg').innerHTML =
    `This will permanently delete <strong>${escapeHtml(user.email)}</strong>. This action cannot be undone.`;

  document.getElementById('confirm-cancel-btn').onclick = () => _closeModal('confirm-delete-modal');
  document.getElementById('confirm-delete-modal').onclick = (e) => {
    if (e.target.id === 'confirm-delete-modal') _closeModal('confirm-delete-modal');
  };

  const delBtn = document.getElementById('confirm-delete-btn');
  const newBtn = delBtn.cloneNode(true); // Remove previous listener
  delBtn.parentNode.replaceChild(newBtn, delBtn);
  if (window.lucide) lucide.createIcons({ nodes: [newBtn.parentNode] });

  newBtn.addEventListener('click', async () => {
    _setLoading(newBtn, true, 'Deleting…');
    try {
      await deleteUser(user.id);
      _closeModal('confirm-delete-modal');
      showSuccess(`User ${user.email} deleted.`);
      await _loadUsers();
    } catch (err) {
      showError(err.message);
      _setLoading(newBtn, false);
    }
  });

  _openModal('confirm-delete-modal');
}

// ── Utilities ─────────────────────────────────────────────────────────────

function _openModal(id) {
  document.getElementById(id).style.display = 'block';
  if (window.lucide) lucide.createIcons();
}

function _closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function _showFormError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function _setLoading(btn, on, loadingText) {
  btn.disabled = on;
  if (on) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = `<span style="opacity:.6;">${loadingText || 'Saving…'}</span>`;
  } else {
    btn.innerHTML = btn.dataset.origHtml || btn.innerHTML;
  }
}

function _getSelfId() {
  const token = sessionStorage.getItem('shyfthatch_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return parseInt(payload.sub);
  } catch { return null; }
}
