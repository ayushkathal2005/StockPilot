/**
 * StockPilot — Users & Role Access Controller
 */

let allUsers = [];
let userModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('users');

  const user = auth.getUser();
  if (!user || user.role !== 'Admin') {
    document.getElementById('users-access-denied')?.classList.remove('d-none');
    document.getElementById('users-card')?.classList.add('d-none');
    const addBtn = document.getElementById('btn-add-user');
    if (addBtn) addBtn.style.display = 'none';
    return;
  }

  const modalEl = document.getElementById('userModal');
  if (modalEl) userModalInstance = new bootstrap.Modal(modalEl);

  await loadUsers();

  document.getElementById('user-form')?.addEventListener('submit', handleCreateUser);
});

async function loadUsers() {
  const loading = document.getElementById('users-loading');
  const tbody = document.getElementById('users-tbody');
  loading?.classList.remove('d-none');

  try {
    const res = await api.get('/users');
    allUsers = res.data || [];

    tbody.innerHTML = '';
    if (allUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = allUsers.map(u => {
      const roleBadge = u.role === 'Admin' ? 'badge-primary' : u.role === 'Manager' ? 'badge-warning' : 'badge-neutral';
      const statusBadge = u.is_active ? 'badge-success' : 'badge-danger';
      const initials = (u.full_name || u.email || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="rounded-circle d-flex align-items-center justify-content-center text-white small fw-bold" style="width:28px;height:28px;background:var(--sp-primary);">
                ${initials}
              </div>
              <span class="fw-semibold">${u.full_name}</span>
            </div>
          </td>
          <td class="font-mono text-secondary">${u.email}</td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td><span class="badge ${statusBadge}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="small text-secondary">${new Date(u.created_at).toLocaleDateString()}</td>
          <td class="text-end">
            ${u.is_active ? `
              <button class="btn btn-sm btn-secondary p-1 text-danger" onclick="deactivateUser(${u.user_id}, '${u.email}')" title="Deactivate">
                <i data-lucide="user-x" style="width:14px;height:14px;"></i>
              </button>
            ` : '<span class="small text-muted">Archived</span>'}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (err) {
    api.showToast(err.message || 'Failed to load users', 'danger');
  } finally {
    loading?.classList.add('d-none');
  }
}

function openAddUserModal() {
  document.getElementById('user-form').reset();
  document.getElementById('user-error-alert').classList.add('d-none');
  userModalInstance.show();
}

async function handleCreateUser(e) {
  e.preventDefault();
  const alertEl = document.getElementById('user-error-alert');
  const saveBtn = document.getElementById('save-user-btn');
  alertEl.classList.add('d-none');
  saveBtn.disabled = true;

  const payload = {
    fullName: document.getElementById('user-fullname').value.trim(),
    email: document.getElementById('user-email').value.trim().toLowerCase(),
    password: document.getElementById('user-password').value,
    role: document.getElementById('user-role').value
  };

  try {
    await api.post('/users', payload);
    api.showToast(`User ${payload.fullName} created successfully!`, 'success');
    userModalInstance.hide();
    await loadUsers();
  } catch (err) {
    alertEl.textContent = err.message || 'Failed to create user';
    alertEl.classList.remove('d-none');
  } finally {
    saveBtn.disabled = false;
  }
}

async function deactivateUser(userId, email) {
  if (!confirm(`Are you sure you want to deactivate user account [${email}]?`)) return;

  try {
    await api.delete(`/users/${userId}`);
    api.showToast(`User account ${email} deactivated.`, 'success');
    await loadUsers();
  } catch (err) {
    api.showToast(err.message || 'Failed to deactivate user', 'danger');
  }
}
