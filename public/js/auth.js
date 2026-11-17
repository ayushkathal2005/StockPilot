/**
 * StockPilot — Authentication & Enterprise Layout Shell Controller
 * Fulfills Modern Enterprise SaaS UI Standards (Sidebar, Header, Breadcrumbs, Mobile Drawer)
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
      // Ignore logout API failures and clear client state
    } finally {
      api.setToken(null);
      this.setUser(null);
      window.location.href = '/login.html';
    }
  },

  /**
   * Renders the unified sidebar, top header, and mobile drawer.
   * Can be mounted into #navbar-placeholder or #sidebar-placeholder.
   */
  renderNavbar(activePage = '') {
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (!navPlaceholder) return;

    const user = this.getUser() || { fullName: 'Demo User', role: 'Staff', email: 'user@stockpilot.io' };
    const isAdmin = user.role === 'Admin';
    const isManagerOrAdmin = user.role === 'Manager' || user.role === 'Admin';

    // Page titles mapping for breadcrumb display
    const titlesMap = {
      'overview': 'Executive Overview',
      'products': 'Products Catalog',
      'inventory': 'Inventory Ledger',
      'sales': 'Point of Sale',
      'purchase-orders': 'Purchase Orders',
      'recommendations': 'AI Replenishment Planning',
      'analytics': 'BI Analytics',
      'categories': 'Categories',
      'suppliers': 'Suppliers',
      'users': 'Users & Roles',
      'settings': 'System Settings'
    };

    const currentTitle = titlesMap[activePage] || 'Dashboard';
    const initials = (user.fullName || user.email || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    navPlaceholder.innerHTML = `
      <!-- Mobile Backdrop Overlay -->
      <div id="sidebar-backdrop" onclick="auth.toggleMobileSidebar(false)"></div>

      <!-- Left Fixed Sidebar -->
      <aside id="sidebar">
        <!-- Brand Header -->
        <div class="sidebar-brand">
          <a class="brand-link" href="/index.html">
            <div class="brand-logo">SP</div>
            <span class="brand-name">StockPilot</span>
          </a>
          <span class="brand-badge">v1.0.0</span>
        </div>

        <!-- Navigation Links -->
        <nav class="sidebar-nav">
          <div class="nav-section-title">Workspace</div>
          <a class="nav-link ${activePage === 'overview' ? 'active' : ''}" href="/index.html">
            <i data-lucide="layout-dashboard"></i>
            <span>Overview</span>
          </a>
          <a class="nav-link ${activePage === 'products' ? 'active' : ''}" href="/products.html">
            <i data-lucide="package"></i>
            <span>Products</span>
          </a>
          <a class="nav-link ${activePage === 'inventory' ? 'active' : ''}" href="/inventory.html">
            <i data-lucide="boxes"></i>
            <span>Inventory</span>
          </a>
          <a class="nav-link ${activePage === 'sales' ? 'active' : ''}" href="/sales.html">
            <i data-lucide="shopping-cart"></i>
            <span>Point of Sale</span>
          </a>
          <a class="nav-link ${activePage === 'purchase-orders' ? 'active' : ''}" href="/purchase-orders.html">
            <i data-lucide="truck"></i>
            <span>Purchase Orders</span>
          </a>
          <a class="nav-link ${activePage === 'recommendations' ? 'active' : ''}" href="/recommendations.html">
            <i data-lucide="sparkles"></i>
            <span>AI Replenishment</span>
          </a>
          <a class="nav-link ${activePage === 'analytics' ? 'active' : ''}" href="/analytics.html">
            <i data-lucide="bar-chart-3"></i>
            <span>BI Analytics</span>
          </a>

          <div class="nav-section-title mt-2">Management</div>
          <a class="nav-link ${activePage === 'categories' ? 'active' : ''}" href="/categories.html">
            <i data-lucide="folder-tree"></i>
            <span>Categories</span>
          </a>
          <a class="nav-link ${activePage === 'suppliers' ? 'active' : ''}" href="/suppliers.html">
            <i data-lucide="building-2"></i>
            <span>Suppliers</span>
          </a>
          <a class="nav-link ${activePage === 'users' ? 'active' : ''}" href="/users.html">
            <i data-lucide="users"></i>
            <span>Users & Roles</span>
          </a>
          <a class="nav-link ${activePage === 'settings' ? 'active' : ''}" href="/settings.html">
            <i data-lucide="settings"></i>
            <span>Settings</span>
          </a>
        </nav>

        <!-- User Profile Card -->
        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
              <div class="user-name" title="${user.fullName || user.email}">${user.fullName || user.email}</div>
              <div class="user-role-badge">${user.role}</div>
            </div>
            <button class="btn-sidebar-logout" onclick="auth.logout()" title="Log Out">
              <i data-lucide="log-out"></i>
            </button>
          </div>
        </div>
      </aside>
    `;

    // Render Sticky Top Header into #main-wrapper
    const headerHtml = `
      <header id="top-header">
        <div class="header-left">
          <button class="btn btn-sm btn-secondary d-lg-none" onclick="auth.toggleMobileSidebar(true)" aria-label="Toggle navigation">
            <i data-lucide="menu"></i>
          </button>
          <div class="header-breadcrumbs">
            <span>StockPilot</span>
            <span>/</span>
            <span class="crumb-active">${currentTitle}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="system-status-indicator d-none d-sm-inline-flex" title="Microsoft SQL Server Connection Status">
            <span class="status-dot"></span>
            <span>SQL Server 2022</span>
          </div>
          <a href="http://localhost:3001" target="_blank" class="btn btn-sm btn-secondary d-none d-md-inline-flex" title="Open Metabase BI Portal">
            <i data-lucide="external-link"></i>
            <span>Metabase BI</span>
          </a>
          <a href="/api/docs" target="_blank" class="btn btn-sm btn-secondary d-none d-md-inline-flex" title="Open Swagger OpenAPI Documentation">
            <i data-lucide="file-text"></i>
            <span>API Docs</span>
          </a>
        </div>
      </header>
    `;

    const existingHeader = document.getElementById('top-header');
    if (existingHeader) existingHeader.remove();

    const mainWrapper = document.getElementById('main-wrapper');
    if (mainWrapper) {
      mainWrapper.insertAdjacentHTML('afterbegin', headerHtml);
    } else {
      // Fallback if main-wrapper not present
      navPlaceholder.insertAdjacentHTML('beforeend', headerHtml);
    }

    // Instantiate Lucide icons if script is available
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  toggleMobileSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    if (show) {
      sidebar.classList.add('show');
      backdrop.classList.add('show');
    } else {
      sidebar.classList.remove('show');
      backdrop.classList.remove('show');
    }
  }
};

// Global helper for pages that call checkAuth()
async function checkAuth() {
  if (!auth.requireAuth()) return null;
  return auth.getUser();
}
