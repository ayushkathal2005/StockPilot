/**
 * Purchase Orders & Warehouse Receiving Client Logic
 */

let allSuppliers = [];
let allCatalog = [];
let createPoModalInstance = null;
let poDetailsModalInstance = null;
let currentPoDetails = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('purchase-orders');

  const createEl = document.getElementById('createPoModal');
  if (createEl) createPoModalInstance = new bootstrap.Modal(createEl);

  const detEl = document.getElementById('poDetailsModal');
  if (detEl) poDetailsModalInstance = new bootstrap.Modal(detEl);

  await loadSuppliers();
  await loadCatalogProducts();
  await loadPurchaseOrders();

  document.getElementById('create-po-form')?.addEventListener('submit', handleCreatePo);
});

async function loadSuppliers() {
  try {
    const res = await api.get('/suppliers');
    allSuppliers = res.data || [];

    const filterSelect = document.getElementById('po-supplier-filter');
    const inputSelect = document.getElementById('po-supplier-input');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Suppliers</option>' +
        allSuppliers.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('');
    }

    if (inputSelect) {
      inputSelect.innerHTML = '<option value="">Select a supplier...</option>' +
        allSuppliers.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load suppliers', err);
  }
}

async function loadCatalogProducts() {
  try {
    const res = await api.get('/products');
    allCatalog = res.data || [];
  } catch (err) {
    console.error('Failed to load catalog', err);
  }
}

async function loadPurchaseOrders() {
  const loading = document.getElementById('po-loading');
  const tbody = document.getElementById('po-tbody');
  loading?.classList.remove('d-none');

  try {
    const status = document.getElementById('po-status-filter')?.value || '';
    const supplierId = document.getElementById('po-supplier-filter')?.value || '';

    let url = `/purchase-orders?limit=50`;
    if (status) url += `&status=${status}`;
    if (supplierId) url += `&supplierId=${supplierId}`;

    const res = await api.get(url);
    const orders = res.data || [];

    tbody.innerHTML = '';
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-muted">No purchase orders found matching criteria.</td></tr>`;
      return;
    }

    orders.forEach(po => {
      const statusBadge = {
        DRAFT: 'bg-secondary text-white',
        SUBMITTED: 'bg-primary text-white',
        PARTIALLY_RECEIVED: 'bg-warning text-dark',
        RECEIVED: 'bg-success text-white',
        CANCELLED: 'bg-danger text-white'
      }[po.status] || 'bg-light text-dark';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold font-monospace">${po.po_number}</td>
        <td>${po.supplier_name}</td>
        <td><span class="badge ${statusBadge}">${po.status}</span></td>
        <td class="small text-muted">${new Date(po.order_date).toLocaleDateString()}</td>
        <td class="text-center">${po.item_count}</td>
        <td class="text-center fw-semibold">${po.total_ordered_qty}</td>
        <td class="text-center fw-semibold ${po.total_received_qty > 0 ? 'text-success' : 'text-muted'}">${po.total_received_qty}</td>
        <td class="text-end fw-bold">$${parseFloat(po.total_amount).toFixed(2)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="viewPoDetails(${po.po_id})">Manage / View</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load purchase orders', 'danger');
  } finally {
    loading?.classList.add('d-none');
  }
}

function openCreatePoModal() {
  document.getElementById('create-po-form').reset();
  document.getElementById('po-items-tbody').innerHTML = '';
  document.getElementById('po-create-error').classList.add('d-none');
  document.getElementById('po-total-display').textContent = '$0.00';
  addPoItemRow();
  createPoModalInstance.show();
}

function addPoItemRow() {
  const tbody = document.getElementById('po-items-tbody');
  const rowId = `item-row-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML = `
    <td>
      <select class="form-select form-select-sm po-item-product" required onchange="handleProductSelected('${rowId}')">
        <option value="">Select product...</option>
        ${allCatalog.map(p => `<option value="${p.product_id}" data-cost="${p.cost_price}">${p.sku} - ${p.product_name}</option>`).join('')}
      </select>
    </td>
    <td>
      <input type="number" class="form-control form-select-sm text-center po-item-qty" min="1" step="1" value="10" required oninput="calculatePoTotal()">
    </td>
    <td>
      <input type="number" class="form-control form-select-sm text-end po-item-cost" min="0" step="0.01" value="0.00" required oninput="calculatePoTotal()">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm text-danger p-0 border-0" onclick="removePoRow('${rowId}')">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  calculatePoTotal();
}

function removePoRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  calculatePoTotal();
}

function handleProductSelected(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const select = row.querySelector('.po-item-product');
  const selectedOpt = select.options[select.selectedIndex];
  const cost = selectedOpt.getAttribute('data-cost');

  const costInput = row.querySelector('.po-item-cost');
  if (costInput && cost) {
    costInput.value = parseFloat(cost).toFixed(2);
  }

  calculatePoTotal();
}

function calculatePoTotal() {
  const rows = document.querySelectorAll('#po-items-tbody tr');
  let total = 0;

  rows.forEach(r => {
    const qty = parseInt(r.querySelector('.po-item-qty')?.value, 10) || 0;
    const cost = parseFloat(r.querySelector('.po-item-cost')?.value) || 0;
    total += (qty * cost);
  });

  const display = document.getElementById('po-total-display');
  if (display) display.textContent = `$${total.toFixed(2)}`;
}

async function handleCreatePo(e) {
  e.preventDefault();
  const errEl = document.getElementById('po-create-error');
  errEl.classList.add('d-none');

  const supplierId = parseInt(document.getElementById('po-supplier-input').value, 10);
  const expectedDeliveryDate = document.getElementById('po-expected-date').value || null;

  const rows = document.querySelectorAll('#po-items-tbody tr');
  const items = [];

  rows.forEach(r => {
    const productId = parseInt(r.querySelector('.po-item-product').value, 10);
    const orderedQuantity = parseInt(r.querySelector('.po-item-qty').value, 10);
    const unitCost = parseFloat(r.querySelector('.po-item-cost').value);

    if (productId && orderedQuantity > 0 && !isNaN(unitCost)) {
      items.push({ productId, orderedQuantity, unitCost });
    }
  });

  if (items.length === 0) {
    errEl.textContent = 'Please add at least one valid product line item.';
    errEl.classList.remove('d-none');
    return;
  }

  try {
    await api.post('/purchase-orders', {
      supplierId,
      expectedDeliveryDate,
      items
    });

    api.showToast('Purchase Order created successfully!', 'success');
    createPoModalInstance.hide();
    await loadPurchaseOrders();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create purchase order';
    errEl.classList.remove('d-none');
  }
}

async function viewPoDetails(poId) {
  try {
    const res = await api.get(`/purchase-orders/${poId}`);
    const po = res.data;
    currentPoDetails = po;

    document.getElementById('details-po-title').textContent = `Purchase Order ${po.po_number}`;
    const body = document.getElementById('details-po-body');

    const canSubmit = po.status === 'DRAFT';
    const canReceive = po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED';
    const canCancel = (po.status === 'DRAFT' || po.status === 'SUBMITTED') && po.items.every(i => i.received_quantity === 0);

    let itemsHtml = po.items.map(i => {
      const isComplete = i.received_quantity >= i.ordered_quantity;
      return `
        <tr>
          <td>
            <div class="fw-semibold">${i.product_name}</div>
            <small class="text-muted font-monospace">${i.sku}</small>
          </td>
          <td class="text-center">${i.ordered_quantity}</td>
          <td class="text-center fw-bold ${i.received_quantity > 0 ? 'text-success' : 'text-muted'}">${i.received_quantity}</td>
          <td class="text-center fw-bold ${i.remaining_quantity > 0 ? 'text-primary' : 'text-muted'}">${i.remaining_quantity}</td>
          <td class="text-end">$${parseFloat(i.unit_cost).toFixed(2)}</td>
          <td class="text-end fw-semibold">$${parseFloat(i.line_total).toFixed(2)}</td>
          ${canReceive ? `
            <td class="text-center" style="width: 150px;">
              ${!isComplete ? `
                <div class="input-group input-group-sm">
                  <input type="number" id="rec-input-${i.po_item_id}" class="form-control text-center" min="1" max="${i.remaining_quantity}" value="${i.remaining_quantity}">
                  <button class="btn btn-outline-success" onclick="receiveSingleItem(${po.po_id}, ${i.po_item_id})">Receive</button>
                </div>
              ` : `<span class="badge bg-success">Complete</span>`}
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="row g-3 mb-4 bg-light p-3 rounded">
        <div class="col-md-4">
          <small class="text-muted">Supplier:</small><br>
          <strong class="fs-6">${po.supplier_name}</strong><br>
          <small class="text-muted">${po.supplier_email || ''} ${po.supplier_phone || ''}</small>
        </div>
        <div class="col-md-4">
          <small class="text-muted">Status:</small><br>
          <span class="badge ${po.status === 'RECEIVED' ? 'bg-success' : po.status === 'SUBMITTED' ? 'bg-primary' : 'bg-secondary'} fs-6">${po.status}</span><br>
          <small class="text-muted">Created: ${new Date(po.created_at).toLocaleDateString()} by ${po.created_by_name}</small>
        </div>
        <div class="col-md-4 text-md-end">
          <small class="text-muted">Total Order Amount:</small><br>
          <span class="fs-4 fw-bold text-primary">$${parseFloat(po.total_amount).toFixed(2)}</span>
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0">Line Items & Receiving Status</h6>
        <div class="d-flex gap-2">
          ${canSubmit ? `<button class="btn btn-primary btn-sm fw-semibold" onclick="submitPo(${po.po_id})">✓ Submit / Authorize PO</button>` : ''}
          ${canReceive ? `<button class="btn btn-success btn-sm fw-semibold" onclick="receiveAllRemainingItems(${po.po_id})">📥 Receive All Remaining</button>` : ''}
          ${canCancel ? `<button class="btn btn-outline-danger btn-sm" onclick="cancelPo(${po.po_id})">✕ Cancel Order</button>` : ''}
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Product</th>
              <th class="text-center">Ordered</th>
              <th class="text-center">Received</th>
              <th class="text-center">Remaining</th>
              <th class="text-end">Unit Cost</th>
              <th class="text-end">Line Total</th>
              ${canReceive ? `<th class="text-center">Quick Receive</th>` : ''}
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    `;

    poDetailsModalInstance.show();
  } catch (err) {
    api.showToast(err.message || 'Failed to load PO details', 'danger');
  }
}

async function submitPo(poId) {
  if (!confirm('Submit and authorize this Purchase Order? It will become active and pending supplier delivery.')) return;
  try {
    await api.post(`/purchase-orders/${poId}/submit`, {});
    api.showToast('Purchase Order submitted and approved!', 'success');
    await viewPoDetails(poId);
    await loadPurchaseOrders();
  } catch (err) {
    api.showToast(err.message || 'Failed to submit PO', 'danger');
  }
}

async function receiveSingleItem(poId, poItemId) {
  const input = document.getElementById(`rec-input-${poItemId}`);
  const qty = parseInt(input?.value, 10);
  if (!qty || qty <= 0) {
    api.showToast('Please enter a valid positive quantity to receive', 'warning');
    return;
  }

  try {
    await api.post(`/purchase-orders/${poId}/receive`, {
      receipts: [{ poItemId, quantityToReceive: qty }]
    });

    api.showToast(`Successfully received ${qty} unit(s) into inventory!`, 'success');
    await viewPoDetails(poId);
    await loadPurchaseOrders();
  } catch (err) {
    api.showToast(err.message || 'Failed to receive item', 'danger');
  }
}

async function receiveAllRemainingItems(poId) {
  if (!currentPoDetails || !confirm('Receive all remaining unreceived items for this Purchase Order into warehouse stock?')) return;

  const receipts = currentPoDetails.items
    .filter(i => i.remaining_quantity > 0)
    .map(i => ({ poItemId: i.po_item_id, quantityToReceive: i.remaining_quantity }));

  if (receipts.length === 0) {
    api.showToast('All items are already fully received!', 'info');
    return;
  }

  try {
    await api.post(`/purchase-orders/${poId}/receive`, { receipts });
    api.showToast('All remaining items received successfully into inventory!', 'success');
    await viewPoDetails(poId);
    await loadPurchaseOrders();
  } catch (err) {
    api.showToast(err.message || 'Failed to receive items', 'danger');
  }
}

async function cancelPo(poId) {
  if (!confirm('Are you sure you want to cancel this Purchase Order? This action cannot be undone.')) return;
  try {
    await api.post(`/purchase-orders/${poId}/cancel`, {});
    api.showToast('Purchase Order has been cancelled.', 'warning');
    await viewPoDetails(poId);
    await loadPurchaseOrders();
  } catch (err) {
    api.showToast(err.message || 'Failed to cancel PO', 'danger');
  }
}
