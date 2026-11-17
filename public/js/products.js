/**
 * Products & Inventory Page Controller
 */

let allProducts = [];
let allCategories = [];
let allSuppliers = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;

  currentUser = auth.getUser();
  auth.renderNavbar('products');

  // Role permissions check: hide manager/admin action buttons from Staff
  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';
  if (!isManagerOrAdmin) {
    const addBtn = document.getElementById('btn-add-product');
    if (addBtn) addBtn.style.display = 'none';
  }

  await loadFilterData();
  await loadProducts();

  // Attach search & filter event listeners
  document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('category-filter').addEventListener('change', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);

  // Attach form submit handler
  document.getElementById('product-form').addEventListener('submit', handleProductFormSubmit);
});

async function loadFilterData() {
  try {
    const [catRes, supRes] = await Promise.all([
      api.get('/categories'),
      api.get('/suppliers')
    ]);

    allCategories = catRes.data || [];
    allSuppliers = supRes.data || [];

    // Populate category filter dropdown
    const catFilter = document.getElementById('category-filter');
    const modalCatSelect = document.getElementById('prod-category');

    catFilter.innerHTML = '<option value="">All Categories</option>';
    modalCatSelect.innerHTML = '<option value="">Select Category...</option>';

    allCategories.forEach(cat => {
      catFilter.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
      modalCatSelect.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
    });

    // Populate supplier select in modal
    const modalSupSelect = document.getElementById('prod-supplier');
    modalSupSelect.innerHTML = '<option value="">Select Preferred Supplier...</option>';
    allSuppliers.forEach(sup => {
      modalSupSelect.innerHTML += `<option value="${sup.supplier_id}">${sup.supplier_name}</option>`;
    });
  } catch (err) {
    showNotification('Failed to load filter metadata: ' + err.message, 'danger');
  }
}

async function loadProducts() {
  const loadingEl = document.getElementById('products-loading');
  const tableEl = document.getElementById('products-table');

  loadingEl.classList.remove('d-none');
  tableEl.classList.add('d-none');

  try {
    const response = await api.get('/products');
    allProducts = response.data || [];
    updateSummaryCards(allProducts);
    renderProductsTable(allProducts);
  } catch (err) {
    showNotification('Failed to load products: ' + err.message, 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    tableEl.classList.remove('d-none');
  }
}

function updateSummaryCards(products) {
  const totalCount = products.length;
  const lowStockCount = products.filter(p => p.stock_health_status === 'LOW_STOCK').length;
  const outOfStockCount = products.filter(p => p.stock_health_status === 'OUT_OF_STOCK').length;

  document.getElementById('metric-total-products').textContent = totalCount;
  document.getElementById('metric-low-stock').textContent = lowStockCount;
  document.getElementById('metric-out-of-stock').textContent = outOfStockCount;
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const categoryId = document.getElementById('category-filter').value;
  const status = document.getElementById('status-filter').value;

  const filtered = allProducts.filter(p => {
    const matchesSearch = !search || 
      p.sku.toLowerCase().includes(search) || 
      p.product_name.toLowerCase().includes(search);

    const matchesCategory = !categoryId || p.category_id === parseInt(categoryId, 10);
    const matchesStatus = !status || p.stock_health_status === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  renderProductsTable(filtered);
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  const emptyEl = document.getElementById('products-empty');
  const isManagerOrAdmin = currentUser.role === 'Manager' || currentUser.role === 'Admin';

  if (!products || products.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }

  emptyEl.classList.add('d-none');
  tbody.innerHTML = products.map(p => {
    const badgeClass = p.stock_health_status === 'OPTIMAL' ? 'badge-success' :
                       p.stock_health_status === 'LOW_STOCK' ? 'badge-warning' : 'badge-danger';
    const statusLabel = p.stock_health_status === 'OPTIMAL' ? 'In Stock' :
                        p.stock_health_status === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock';

    return `
      <tr>
        <td class="fw-semibold font-mono text-primary">${p.sku}</td>
        <td>
          <div class="fw-semibold">${p.product_name}</div>
          <small class="text-secondary">${p.supplier_name || 'No preferred supplier'}</small>
        </td>
        <td><span class="badge badge-neutral">${p.category_name}</span></td>
        <td class="text-end num">$${parseFloat(p.cost_price).toFixed(2)}</td>
        <td class="text-end num fw-semibold">$${parseFloat(p.selling_price).toFixed(2)}</td>
        <td class="text-center num">
          <span class="fw-bold">${p.on_hand_quantity}</span>
        </td>
        <td>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-secondary p-1 me-1" onclick="viewProductDetails(${p.product_id})" title="Details">
            <i data-lucide="eye" style="width:14px;height:14px;"></i>
          </button>
          ${isManagerOrAdmin ? `
            <button class="btn btn-sm btn-secondary p-1 me-1" onclick="openEditProductModal(${p.product_id})" title="Edit">
              <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-sm btn-secondary p-1 text-danger" onclick="deactivateProduct(${p.product_id}, '${p.sku}')" title="Deactivate">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function openAddProductModal() {
  document.getElementById('product-modal-title').textContent = 'Add New Product';
  document.getElementById('product-id').value = '';
  document.getElementById('product-form').reset();
  document.getElementById('prod-sku').disabled = false;
  document.getElementById('initial-stock-group').style.display = 'block';
  document.getElementById('modal-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  modal.show();
}

function openEditProductModal(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) return;

  document.getElementById('product-modal-title').textContent = 'Edit Product: ' + product.sku;
  document.getElementById('product-id').value = product.product_id;
  document.getElementById('prod-sku').value = product.sku;
  document.getElementById('prod-sku').disabled = true; // SKU immutable once created
  document.getElementById('prod-name').value = product.product_name;
  document.getElementById('prod-category').value = product.category_id;
  document.getElementById('prod-supplier').value = product.preferred_supplier_id || '';
  document.getElementById('prod-cost').value = product.cost_price;
  document.getElementById('prod-selling').value = product.selling_price;
  document.getElementById('prod-reorder').value = product.reorder_point_threshold;
  document.getElementById('prod-safety').value = product.target_safety_stock;
  document.getElementById('prod-lead').value = product.lead_time_days;
  document.getElementById('initial-stock-group').style.display = 'none'; // Stock is adjusted through movements only
  document.getElementById('modal-error-alert').classList.add('d-none');

  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  modal.show();
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('modal-error-alert');
  const saveBtn = document.getElementById('save-product-btn');
  alertEl.classList.add('d-none');
  saveBtn.disabled = true;

  const productId = document.getElementById('product-id').value;
  const isEdit = !!productId;

  const payload = {
    productName: document.getElementById('prod-name').value.trim(),
    categoryId: parseInt(document.getElementById('prod-category').value, 10),
    preferredSupplierId: document.getElementById('prod-supplier').value ? parseInt(document.getElementById('prod-supplier').value, 10) : null,
    costPrice: parseFloat(document.getElementById('prod-cost').value),
    sellingPrice: parseFloat(document.getElementById('prod-selling').value),
    reorderPointThreshold: parseInt(document.getElementById('prod-reorder').value, 10),
    targetSafetyStock: parseInt(document.getElementById('prod-safety').value, 10),
    leadTimeDays: parseInt(document.getElementById('prod-lead').value, 10)
  };

  if (!isEdit) {
    payload.sku = document.getElementById('prod-sku').value.trim().toUpperCase();
    payload.initialStock = parseInt(document.getElementById('prod-initial-stock').value || '0', 10);
  }

  try {
    if (isEdit) {
      await api.put(`/products/${productId}`, payload);
      showNotification(`Product ${payload.productName} updated successfully!`, 'success');
    } else {
      await api.post('/products', payload);
      showNotification(`Product ${payload.sku} created successfully!`, 'success');
    }

    const modalEl = document.getElementById('productModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    await loadProducts();
  } catch (err) {
    alertEl.textContent = err.message || 'Operation failed.';
    alertEl.classList.remove('d-none');
  } finally {
    saveBtn.disabled = false;
  }
}

function viewProductDetails(productId) {
  const p = allProducts.find(item => item.product_id === productId);
  if (!p) return;

  document.getElementById('detail-sku').textContent = p.sku;
  document.getElementById('detail-name').textContent = p.product_name;
  document.getElementById('detail-category').textContent = p.category_name;
  document.getElementById('detail-supplier').textContent = p.supplier_name || 'None';
  document.getElementById('detail-cost').textContent = '$' + parseFloat(p.cost_price).toFixed(2);
  document.getElementById('detail-selling').textContent = '$' + parseFloat(p.selling_price).toFixed(2);
  document.getElementById('detail-on-hand').textContent = p.on_hand_quantity;
  document.getElementById('detail-available').textContent = p.available_quantity;
  document.getElementById('detail-open-po').textContent = p.open_purchase_quantity;
  document.getElementById('detail-inv-pos').textContent = p.inventory_position;
  document.getElementById('detail-reorder').textContent = p.reorder_point_threshold;
  document.getElementById('detail-safety').textContent = p.target_safety_stock;
  document.getElementById('detail-lead').textContent = p.lead_time_days + ' days';

  const modal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
  modal.show();
}

async function deactivateProduct(productId, sku) {
  if (!confirm(`Are you sure you want to deactivate product [${sku}]? It will be archived from active catalogs.`)) {
    return;
  }

  try {
    await api.delete(`/products/${productId}`);
    showNotification(`Product ${sku} has been deactivated.`, 'success');
    await loadProducts();
  } catch (err) {
    showNotification('Deactivation failed: ' + err.message, 'danger');
  }
}

function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}
