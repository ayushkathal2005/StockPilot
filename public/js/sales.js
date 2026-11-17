/**
 * Point of Sale (POS) and Sales History Client Logic
 */

let catalogProducts = [];
let cart = []; // Array of { product, quantity }
let receiptModalInstance = null;
let saleDetailsModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('sales');

  const recEl = document.getElementById('receiptModal');
  if (recEl) receiptModalInstance = new bootstrap.Modal(recEl);

  const detEl = document.getElementById('saleDetailsModal');
  if (detEl) saleDetailsModalInstance = new bootstrap.Modal(detEl);

  await loadCategories();
  await loadPosCatalog();
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function loadCategories() {
  try {
    const res = await api.get('/categories');
    const select = document.getElementById('pos-category-filter');
    if (select && res.data) {
      res.data.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.category_id;
        opt.textContent = cat.category_name;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

async function loadPosCatalog() {
  const loading = document.getElementById('pos-loading');
  loading?.classList.remove('d-none');

  try {
    const res = await api.get('/products');
    catalogProducts = res.data || [];
    filterPosCatalog();
  } catch (err) {
    api.showToast(err.message || 'Failed to load catalog', 'danger');
  } finally {
    loading?.classList.add('d-none');
  }
}

function filterPosCatalog() {
  const search = document.getElementById('pos-search')?.value.toLowerCase().trim() || '';
  const catId = document.getElementById('pos-category-filter')?.value || '';
  const tbody = document.getElementById('pos-catalog-tbody');
  if (!tbody) return;

  const filtered = catalogProducts.filter(p => {
    const matchSearch = p.sku.toLowerCase().includes(search) || p.product_name.toLowerCase().includes(search);
    const matchCat = catId ? p.category_id === parseInt(catId, 10) : true;
    return matchSearch && matchCat;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">No products found matching criteria.</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const isOutOfStock = p.available_quantity <= 0;
    const stockBadge = isOutOfStock
      ? `<span class="badge bg-danger">0 Out</span>`
      : `<span class="badge bg-success">${p.available_quantity} Avail</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="fw-semibold">${p.product_name}</div>
        <small class="text-muted font-monospace">${p.sku}</small>
      </td>
      <td><small class="text-muted">${p.category_name}</small></td>
      <td class="text-end fw-bold">$${parseFloat(p.selling_price).toFixed(2)}</td>
      <td class="text-center">${stockBadge}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary fw-semibold" onclick="addToCart(${p.product_id})" ${isOutOfStock ? 'disabled' : ''}>
          + Add
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addToCart(productId) {
  const product = catalogProducts.find(p => p.product_id === productId);
  if (!product) return;

  const existing = cart.find(item => item.product.product_id === productId);
  if (existing) {
    if (existing.quantity + 1 > product.available_quantity) {
      api.showToast(`Cannot add more than available stock (${product.available_quantity}) for SKU ${product.sku}`, 'warning');
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1 });
  }

  renderCart();
}

function updateCartQuantity(productId, delta) {
  const item = cart.find(i => i.product.product_id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    cart = cart.filter(i => i.product.product_id !== productId);
  } else if (newQty > item.product.available_quantity) {
    api.showToast(`Cannot exceed available stock of ${item.product.available_quantity}`, 'warning');
    return;
  } else {
    item.quantity = newQty;
  }

  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const emptyEl = document.getElementById('cart-empty');
  const checkoutBtn = document.getElementById('btn-checkout');
  const errEl = document.getElementById('checkout-error');
  if (errEl) errEl.classList.add('d-none');

  if (!list || !emptyEl || !checkoutBtn) return;

  if (cart.length === 0) {
    emptyEl.classList.remove('d-none');
    list.innerHTML = '';
    checkoutBtn.disabled = true;
    document.getElementById('cart-subtotal').textContent = '$0.00';
    document.getElementById('cart-tax').textContent = '$0.00';
    document.getElementById('cart-total').textContent = '$0.00';
    return;
  }

  emptyEl.classList.add('d-none');
  checkoutBtn.disabled = false;

  let subtotal = 0;
  list.innerHTML = '';

  cart.forEach(item => {
    const lineTotal = item.quantity * parseFloat(item.product.selling_price);
    subtotal += lineTotal;

    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
    li.innerHTML = `
      <div class="me-auto">
        <div class="fw-semibold text-truncate" style="max-width: 170px;">${item.product.product_name}</div>
        <small class="text-muted">$${parseFloat(item.product.selling_price).toFixed(2)} ea</small>
      </div>
      <div class="d-flex align-items-center gap-1 me-3">
        <button class="btn btn-outline-secondary btn-sm py-0 px-2" onclick="updateCartQuantity(${item.product.product_id}, -1)">-</button>
        <span class="fw-bold px-1">${item.quantity}</span>
        <button class="btn btn-outline-secondary btn-sm py-0 px-2" onclick="updateCartQuantity(${item.product.product_id}, 1)">+</button>
      </div>
      <div class="fw-bold text-end" style="min-width: 60px;">$${lineTotal.toFixed(2)}</div>
    `;
    list.appendChild(li);
  });

  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
}

async function completeSale() {
  if (cart.length === 0) return;

  const btn = document.getElementById('btn-checkout');
  const errEl = document.getElementById('checkout-error');
  btn.disabled = true;
  errEl.classList.add('d-none');

  const payload = {
    items: cart.map(i => ({
      productId: i.product.product_id,
      quantity: i.quantity
    }))
  };

  try {
    const res = await api.post('/sales', payload);
    const sale = res.data;

    // Show receipt
    displayReceipt(sale);
    clearCart();
    await loadPosCatalog(); // Refresh available stocks
  } catch (err) {
    errEl.textContent = err.message || 'Sale could not be processed';
    errEl.classList.remove('d-none');
    btn.disabled = false;
  }
}

function displayReceipt(sale) {
  const content = document.getElementById('receipt-content');
  if (!content) return;

  let itemsHtml = sale.items.map(i => `
    <tr>
      <td>${i.productName} <br><small class="text-muted">${i.sku}</small></td>
      <td class="text-center">${i.quantity}</td>
      <td class="text-end">$${parseFloat(i.unitSellingPrice).toFixed(2)}</td>
      <td class="text-end fw-semibold">$${parseFloat(i.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="text-center mb-3">
      <h5 class="fw-bold mb-0">StockPilot Retail</h5>
      <small class="text-muted">Transaction ID: #${sale.saleId}</small><br>
      <small class="text-muted">${new Date(sale.saleDate).toLocaleString()}</small>
    </div>
    <table class="table table-sm align-middle">
      <thead>
        <tr>
          <th>Item</th>
          <th class="text-center">Qty</th>
          <th class="text-end">Price</th>
          <th class="text-end">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="border-top pt-2">
      <div class="d-flex justify-content-between"><small>Subtotal:</small><small class="fw-semibold">$${parseFloat(sale.subtotalAmount).toFixed(2)}</small></div>
      <div class="d-flex justify-content-between"><small>Tax (5%):</small><small class="fw-semibold">$${parseFloat(sale.taxAmount).toFixed(2)}</small></div>
      <div class="d-flex justify-content-between fs-5 fw-bold mt-1"><span>Total Paid:</span><span class="text-success">$${parseFloat(sale.totalAmount).toFixed(2)}</span></div>
    </div>
  `;

  receiptModalInstance.show();
}

async function loadSalesHistory() {
  const loading = document.getElementById('history-loading');
  const tbody = document.getElementById('history-tbody');
  loading.classList.remove('d-none');

  try {
    const res = await api.get('/sales?limit=50');
    const sales = res.data || [];

    tbody.innerHTML = '';
    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-muted">No sales transactions recorded yet.</td></tr>`;
      return;
    }

    sales.forEach(s => {
      const profit = parseFloat(s.estimated_gross_profit || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold font-monospace">#${s.sale_id}</td>
        <td class="small text-muted">${new Date(s.sale_date).toLocaleString()}</td>
        <td>${s.cashier_name}</td>
        <td class="text-center">${s.item_count}</td>
        <td class="text-center fw-semibold">${s.total_units_sold}</td>
        <td class="text-end">$${parseFloat(s.subtotal_amount).toFixed(2)}</td>
        <td class="text-end">$${parseFloat(s.tax_amount).toFixed(2)}</td>
        <td class="text-end fw-bold text-primary">$${parseFloat(s.total_amount).toFixed(2)}</td>
        <td class="text-end fw-semibold text-success">+$${profit.toFixed(2)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-secondary" onclick="viewSaleDetails(${s.sale_id})">View Items</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load sales history', 'danger');
  } finally {
    loading.classList.add('d-none');
  }
}

async function viewSaleDetails(saleId) {
  try {
    const res = await api.get(`/sales/${saleId}`);
    const sale = res.data;

    document.getElementById('details-sale-title').textContent = `Sale Receipt #${sale.sale_id}`;
    const content = document.getElementById('details-sale-content');

    let itemsHtml = sale.items.map(i => `
      <tr>
        <td>
          <div class="fw-semibold">${i.product_name}</div>
          <small class="text-muted font-monospace">${i.sku}</small>
        </td>
        <td class="text-center">${i.quantity}</td>
        <td class="text-end">$${parseFloat(i.unit_selling_price).toFixed(2)}</td>
        <td class="text-end text-muted small">$${parseFloat(i.unit_cost_at_sale).toFixed(2)}</td>
        <td class="text-end fw-semibold">$${parseFloat(i.subtotal).toFixed(2)}</td>
        <td class="text-end text-success fw-bold">+$${parseFloat(i.item_gross_profit).toFixed(2)}</td>
      </tr>
    `).join('');

    content.innerHTML = `
      <div class="row mb-3 bg-light p-3 rounded">
        <div class="col-sm-6">
          <small class="text-muted">Cashier:</small> <strong>${sale.cashier_name}</strong> (${sale.cashier_email})<br>
          <small class="text-muted">Date:</small> <strong>${new Date(sale.sale_date).toLocaleString()}</strong>
        </div>
        <div class="col-sm-6 text-sm-end">
          <small class="text-muted">Total Amount:</small> <span class="fs-5 fw-bold text-primary">$${parseFloat(sale.total_amount).toFixed(2)}</span><br>
          <small class="text-muted">Calculated Gross Profit:</small> <span class="fw-bold text-success">+$${parseFloat(sale.grossProfit).toFixed(2)}</span>
        </div>
      </div>
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Product</th>
            <th class="text-center">Qty</th>
            <th class="text-end">Sold At</th>
            <th class="text-end">Cost Frozen At Sale</th>
            <th class="text-end">Subtotal</th>
            <th class="text-end">Line Profit</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    `;

    saleDetailsModalInstance.show();
  } catch (err) {
    api.showToast(err.message || 'Failed to load sale details', 'danger');
  }
}
