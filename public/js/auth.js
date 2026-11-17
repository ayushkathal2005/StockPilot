/**
 * StockPilot Authentication & Navbar State Manager
 */

const auth = {
  getUser() {
    const raw = localStorage.getItem('user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },

  isAuthenticated() {
    return !!api.getToken() && !!this.getUser();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  async logout() {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore logout errors
    } finally {
      api.setToken(null);
      this.setUser(null);
      window.location.href = '/login.html';
    }
  },

  renderNavbar(activePage = '') {
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (!navPlaceholder) return;

    const user = this.getUser();
    if (!user) return;

    const isStaff = user.role === 'Staff';
    const isManagerOrAdmin = user.role === 'Manager' || user.role === 'Admin';
    const isAdmin = user.role === 'Admin';

    navPlaceholder.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div class="container-fluid">
          <a class="navbar-brand d-flex align-items-center" href="/products.html">
            <span class="fs-4 me-2">📦</span>
            <span>StockPilot</span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#stockpilotNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          
          <div class="collapse navbar-collapse" id="stockpilotNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
              <li class="nav-item">
                <a class="nav-link ${activePage === 'products' ? 'active' : ''}" href="/products.html">Products & Inventory</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'categories' ? 'active' : ''}" href="/categories.html">Categories</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'suppliers' ? 'active' : ''}" href="/suppliers.html">Suppliers</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="/api/docs" target="_blank">API Docs</a>
              </li>
            </ul>

            <div class="d-flex align-items-center text-white">
              <div class="me-3 text-end d-none d-sm-block">
                <div class="fw-semibold">${user.fullName || user.email}</div>
                <small class="badge ${isAdmin ? 'bg-danger' : isManagerOrAdmin ? 'bg-primary' : 'bg-secondary'}">${user.role}</small>
              </div>
              <button class="btn btn-outline-light btn-sm" id="logout-btn" onclick="auth.logout()">Log Out</button>
            </div>
          </div>
        </div>
      </nav>
    `;
  }
};
