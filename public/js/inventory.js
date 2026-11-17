/**
 * Inventory Ledger, Health Tracking, and Reorder Alerts Client Logic
 */

let allProducts = [];
let adjustModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('inventory');

  const user = auth.getUser();
  if (user && (user.role === 'Manager' || user.role === 'Admin')) {
    const btn = document.getElementById('btn-adjust-stock');
    if (btn) btn.classList.remove('d-none');
  }

  const modalEl = document.getElementById('adjustModal');
  if (modalEl) adjustModalInstance = new bootstrap.Modal(modalEl);

  await loadCategoriesFilter();
  await loadInventory();
  await loadReorderAlerts();

  document.getElementById('adjust-form')?.addEventListener('submit', handleStockAdjustment);
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function loadCategoriesFilter() {
  try {
    const res = await api.get('/categories');
    const select = document.getElementById('inv-category-filter');
    if (select && res.data) {
      res.data.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.category_id;
        opt.textContent = cat.category_name;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load categories for filter', err);
  }
}

async function loadInventory() {
  const loading = document.getElementById('inv-loading');
  const tbody = document.getElementById('inv-tbody');
  loading.classList.remove('d-none');

  try {
    const catId = document.getElementById('inv-category-filter').value;
    const health = document.getElementById('inv-health-filter').value;
    const search = document.getElementById('inv-search').value.trim();

    let url = `/inventory?`;
    if (catId) url += `categoryId=${catId}&`;
    if (health) url += `stockHealth=${health}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const res = await api.get(url);
    const items = res.data || [];
    allProducts = items;

    // Populate adjust dropdown
    const adjSelect = document.getElementById('adj-product');
    if (adjSelect) {
      adjSelect.innerHTML = items.map(p => `<option value="${p.product_id}">${p.sku} - ${p.product_name} (Current: ${p.on_hand_quantity})</option>`).join('');
    }

    // Update KPI summary
    let totalVal = 0;
    let lowCount = 0;
    let outCount = 0;

    items.forEach(p => {
      totalVal += (p.on_hand_quantity * p.cost_price);
      if (p.stock_health_status === 'OUT_OF_STOCK') outCount++;
      else if (p.stock_health_status === 'LOW_STOCK') lowCount++;
    });

    document.getElementById('stat-total-skus').textContent = items.length;
    document.getElementById('stat-total-value').textContent = `$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('stat-low-stock').textContent = lowCount;
    document.getElementById('stat-out-of-stock').textContent = outCount;

    tbody.innerHTML = '';
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-muted">No inventory records found matching your filters.</td></tr>`;
      return;
    }

    items.forEach(item => {
      const healthBadge = item.stock_health_status === 'HEALTHY'
        ? `<span class="badge bg-success-subtle text-success border border-success">Healthy</span>`
        : item.stock_health_status === 'LOW_STOCK'
        ? `<span class="badge bg-warning-subtle text-warning border border-warning">Low Stock</span>`
        : `<span class="badge bg-danger-subtle text-danger border border-danger">Out of Stock</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold font-monospace">${item.sku}</td>
        <td>${item.product_name}</td>
        <td><span class="badge bg-light text-dark border">${item.category_name}</span></td>
        <td class="text-end">$${parseFloat(item.cost_price).toFixed(2)}</td>
        <td class="text-center fw-bold ${item.on_hand_quantity <= 0 ? 'text-danger' : ''}">${item.on_hand_quantity}</td>
        <td class="text-center text-muted">${item.open_purchase_quantity}</td>
        <td class="text-center fw-semibold text-primary">${item.inventory_position}</td>
        <td class="text-end fw-semibold">$${parseFloat(item.inventory_valuation).toFixed(2)}</td>
        <td>${healthBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load inventory', 'danger');
  } finally {
    loading.classList.add('d-none');
  }
}

async function loadReorderAlerts() {
  const tbody = document.getElementById('reorder-tbody');
  const badge = document.getElementById('reorder-badge');

  try {
    const res = await api.get('/inventory/reorder-alerts');
    const alerts = res.data || [];
    badge.textContent = alerts.length;

    tbody.innerHTML = '';
    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">All active SKUs are currently sufficiently stocked above reorder thresholds!</td></tr>`;
      return;
    }

    alerts.forEach(a => {
      const urgencyBadge = a.alert_level === 'CRITICAL_STOCKOUT'
        ? `<span class="badge bg-danger">Critical Out of Stock</span>`
        : `<span class="badge bg-warning text-dark">Reorder Required</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-bold">${a.product_name}</div>
          <small class="text-muted font-monospace">${a.sku}</small>
        </td>
        <td>${a.preferred_supplier_name || '<em class="text-muted">None assigned</em>'}</td>
        <td class="text-center fw-bold ${a.on_hand_quantity <= 0 ? 'text-danger' : ''}">${a.on_hand_quantity}</td>
        <td class="text-center text-muted">${a.open_purchase_quantity}</td>
        <td class="text-center fw-semibold">${a.inventory_position}</td>
        <td class="text-center">${a.reorder_point_threshold}</td>
        <td class="text-center fs-6 fw-bold text-primary">+${a.suggested_reorder_quantity}</td>
        <td>${urgencyBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load reorder alerts', err);
  }
}

async function loadMovements() {
  const loading = document.getElementById('mov-loading');
  const tbody = document.getElementById('mov-tbody');
  loading.classList.remove('d-none');

  try {
    const movType = document.getElementById('mov-type-filter').value;
    let url = `/inventory/movements?limit=100`;
    if (movType) url += `&movementType=${movType}`;

    const res = await api.get(url);
    const movements = res.data || [];

    tbody.innerHTML = '';
    if (movements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted">No stock movement records found.</td></tr>`;
      return;
    }

    movements.forEach(m => {
      const deltaClass = m.quantity_delta > 0 ? 'text-success' : 'text-danger';
      const deltaSign = m.quantity_delta > 0 ? `+${m.quantity_delta}` : `${m.quantity_delta}`;
      const dateFormatted = new Date(m.created_at).toLocaleString();

      const typeBadge = {
        SALE: 'bg-danger-subtle text-danger border border-danger',
        PO_RECEIPT: 'bg-success-subtle text-success border border-success',
        ADJUSTMENT_IN: 'bg-primary-subtle text-primary border border-primary',
        ADJUSTMENT_OUT: 'bg-warning-subtle text-warning border border-warning',
        RETURN: 'bg-info-subtle text-info border border-info'
      }[m.movement_type] || 'bg-light text-dark';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="small text-muted">${dateFormatted}</td>
        <td>
          <div class="fw-semibold">${m.product_name}</div>
          <small class="text-muted font-monospace">${m.sku}</small>
        </td>
        <td><span class="badge ${typeBadge}">${m.movement_type}</span></td>
        <td class="text-center fw-bold ${deltaClass}">${deltaSign}</td>
        <td class="small">${m.reference_type ? `${m.reference_type} #${m.reference_id || ''}` : '-'}</td>
        <td class="small">${m.created_by_name}</td>
        <td class="small text-muted">${m.notes || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load stock movements', 'danger');
  } finally {
    loading.classList.add('d-none');
  }
}

function openAdjustModal() {
  document.getElementById('adjust-form').reset();
  document.getElementById('adjust-error-alert').classList.add('d-none');
  adjustModalInstance.show();
}

async function handleStockAdjustment(e) {
  e.preventDefault();
  const alertEl = document.getElementById('adjust-error-alert');
  alertEl.classList.add('d-none');

  const productId = parseInt(document.getElementById('adj-product').value, 10);
  const movementType = document.getElementById('adj-type').value;
  const quantity = parseInt(document.getElementById('adj-qty').value, 10);
  const notes = document.getElementById('adj-notes').value.trim();

  try {
    await api.post('/inventory/adjust', {
      productId,
      movementType,
      quantityDelta: quantity,
      notes
    });

    api.showToast('Inventory adjusted successfully!', 'success');
    adjustModalInstance.hide();
    await loadInventory();
    await loadReorderAlerts();
    if (document.getElementById('movements-tab').classList.contains('active')) {
      await loadMovements();
    }
  } catch (err) {
    alertEl.textContent = err.message || 'Failed to adjust inventory';
    alertEl.classList.remove('d-none');
  }
}
