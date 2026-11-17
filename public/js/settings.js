/**
 * StockPilot — Settings & System Diagnostics Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('settings');

  const user = auth.getUser() || { fullName: 'Demo User', role: 'Staff', email: 'user@stockpilot.io' };
  
  // Populate User Profile
  const initials = (user.fullName || user.email || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById('profile-avatar');
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const roleEl = document.getElementById('profile-role');
  const permsEl = document.getElementById('profile-perms');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = user.fullName || user.email;
  if (emailEl) emailEl.textContent = user.email || '-';
  if (roleEl) roleEl.textContent = user.role || 'Staff';

  if (permsEl) {
    if (user.role === 'Admin') {
      permsEl.textContent = 'Full System Administrator: User provisioning, DB diagnostics, and policy controls';
    } else if (user.role === 'Manager') {
      permsEl.textContent = 'Store Manager: Inventory approvals, purchasing authorization, and forecasting execution';
    } else {
      permsEl.textContent = 'Store Staff: POS counter checkout and inventory lookup';
    }
  }

  // Probe ML service status
  try {
    const res = await api.get('/forecast/ml-status');
    const badge = document.getElementById('diag-ml-status');
    if (badge && res.data && res.data.isAvailable) {
      badge.textContent = `Online (${res.data.health?.model_version || 'v1.0.0'})`;
      badge.className = 'badge badge-success';
    }
  } catch (err) {
    const badge = document.getElementById('diag-ml-status');
    if (badge) {
      badge.textContent = 'Offline (Rule-based fallback active)';
      badge.className = 'badge badge-warning';
    }
  }
});
