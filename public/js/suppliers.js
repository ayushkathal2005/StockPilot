/**
 * Suppliers Page Controller
 */

let allSuppliers = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;

  currentUser = auth.getUser();
  auth.renderNavbar('suppliers');

  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';
  if (!isManagerOrAdmin) {
    const addBtn = document.getElementById('btn-add-supplier');
    if (addBtn) addBtn.style.display = 'none';
  }

  await loadSuppliers();

  document.getElementById('supplier-form').addEventListener('submit', handleSupplierSubmit);
});

async function loadSuppliers() {
  const loadingEl = document.getElementById('suppliers-loading');
  const tableEl = document.getElementById('suppliers-table');
  loadingEl.classList.remove('d-none');
  tableEl.classList.add('d-none');

  try {
    const response = await api.get('/suppliers');
    allSuppliers = response.data || [];
    renderSuppliersTable(allSuppliers);
  } catch (err) {
    showNotification('Failed to load suppliers: ' + err.message, 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    tableEl.classList.remove('d-none');
  }
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliers-tbody');
  const emptyEl = document.getElementById('suppliers-empty');
  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';

  if (!suppliers || suppliers.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }

  emptyEl.classList.add('d-none');
  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td>
        <div class="fw-bold fs-6">${s.supplier_name}</div>
        <small class="text-muted">ID: ${s.supplier_id}</small>
      </td>
      <td>
        ${s.contact_email ? `<a href="mailto:${s.contact_email}">${s.contact_email}</a>` : '<span class="text-muted">—</span>'}
      </td>
      <td>${s.contact_phone || '<span class="text-muted">—</span>'}</td>
      <td class="small text-muted">${s.address || '—'}</td>
      <td class="text-center">
        <span class="badge bg-secondary">${s.default_lead_time_days} days</span>
      </td>
      <td class="text-end">
        ${isManagerOrAdmin ? `
          <button class="btn btn-outline-primary btn-sm" onclick="openEditSupplierModal(${s.supplier_id})">
            ✏️ Edit
          </button>
        ` : '<span class="text-muted small">Read-only</span>'}
      </td>
    </tr>
  `).join('');
}

function openAddSupplierModal() {
  document.getElementById('supplier-modal-title').textContent = 'Add Commercial Supplier';
  document.getElementById('supplier-id').value = '';
  document.getElementById('supplier-form').reset();
  document.getElementById('sup-lead').value = 7;
  document.getElementById('supplier-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('supplierModal'));
  modal.show();
}

function openEditSupplierModal(supplierId) {
  const s = allSuppliers.find(item => item.supplier_id === supplierId);
  if (!s) return;

  document.getElementById('supplier-modal-title').textContent = 'Edit Supplier: ' + s.supplier_name;
  document.getElementById('supplier-id').value = s.supplier_id;
  document.getElementById('sup-name').value = s.supplier_name;
  document.getElementById('sup-email').value = s.contact_email || '';
  document.getElementById('sup-phone').value = s.contact_phone || '';
  document.getElementById('sup-address').value = s.address || '';
  document.getElementById('sup-lead').value = s.default_lead_time_days;
  document.getElementById('supplier-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('supplierModal'));
  modal.show();
}

async function handleSupplierSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('supplier-error-alert');
  const saveBtn = document.getElementById('save-supplier-btn');
  alertEl.classList.add('d-none');
  saveBtn.disabled = true;

  const supplierId = document.getElementById('supplier-id').value;
  const isEdit = !!supplierId;

  const payload = {
    supplierName: document.getElementById('sup-name').value.trim(),
    contactEmail: document.getElementById('sup-email').value.trim() || null,
    contactPhone: document.getElementById('sup-phone').value.trim() || null,
    address: document.getElementById('sup-address').value.trim() || null,
    defaultLeadTimeDays: parseInt(document.getElementById('sup-lead').value, 10)
  };

  try {
    if (isEdit) {
      await api.put(`/suppliers/${supplierId}`, payload);
      showNotification(`Supplier ${payload.supplierName} updated successfully!`, 'success');
    } else {
      await api.post('/suppliers', payload);
      showNotification(`Supplier ${payload.supplierName} created successfully!`, 'success');
    }

    const modalEl = document.getElementById('supplierModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    await loadSuppliers();
  } catch (err) {
    alertEl.textContent = err.message || 'Operation failed.';
    alertEl.classList.remove('d-none');
  } finally {
    saveBtn.disabled = false;
  }
}
