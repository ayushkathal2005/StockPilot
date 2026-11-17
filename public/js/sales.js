/**
 * StockPilot — Point of Sale (POS) and Sales History Client Logic
 * Modern Enterprise Retail Operations Design (Two-Column Layout, Fast Cart, Payment Modal)
 */

let catalogProducts = [];
let cart = []; // Array of { product, quantity }
let checkoutModalInstance = null;
let receiptModalInstance = null;
let saleDetailsModalInstance = null;
let selectedPaymentMethod = 'CASH';

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('sales');

  const checkEl = document.getElementById('checkoutModal');
  if (checkEl) checkoutModalInstance = new bootstrap.Modal(checkEl);

  const recEl = document.getElementById('receiptModal');
  if (recEl) receiptModalInstance = new bootstrap.Modal(recEl);

  const detEl = document.getElementById('saleDetailsModal');
  if (detEl) saleDetailsModalInstance = new bootstrap.Modal(detEl);

  await loadCategories();
  await loadPosCatalog();

  // Keyboard navigation shortcuts
  document.addEventListener('keydown', (e) => {
    // Focus search on '/' key if not currently typing in an input
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('pos-search')?.focus();
    }
  });

  const tenderedInput = document.getElementById('cash-tendered-input');
  if (tenderedInput) {
    tenderedInput.addEventListener('input', calculateChangeDue);
  }
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
      select.innerHTML = '<option value="">All Categories</option>' + 
        res.data.map(cat => `<option value="${cat.category_id}">${cat.category_name}</option>`).join('');
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
    showNotification(err.message || 'Failed to load catalog', 'danger');
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
    const isLowStock = p.available_quantity <= (p.reorder_point || 10) && !isOutOfStock;
    const stockBadge = isOutOfStock
      ? `<span class="badge badge-danger">0 Out</span>`
      : isLowStock
      ? `<span class="badge badge-warning">${p.available_quantity} Low</span>`
      : `<span class="badge badge-success">${p.available_quantity} In Stock</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="fw-semibold text-truncate" style="max-width: 240px;">${p.product_name}</div>
        <code class="sku-code">${p.sku}</code>
      </td>
      <td><span class="text-secondary small">${p.category_name || '-'}</span></td>
      <td class="text-end fw-semibold num">$${parseFloat(p.selling_price).toFixed(2)}</td>
      <td class="text-center">${stockBadge}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-primary" onclick="addToCart(${p.product_id})" ${isOutOfStock ? 'disabled' : ''}>
          <i data-lucide="plus" style="width:13px;height:13px;"></i> Add
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function addToCart(productId) {
  const product = catalogProducts.find(p => p.product_id === productId);
  if (!product) return;

  const existing = cart.find(item => item.product.product_id === productId);
  if (existing) {
    if (existing.quantity + 1 > product.available_quantity) {
      showNotification(`Cannot add more than available stock (${product.available_quantity}) for SKU ${product.sku}`, 'warning');
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
    showNotification(`Cannot exceed available stock of ${item.product.available_quantity}`, 'warning');
    return;
  } else {
    item.quantity = newQty;
  }

  renderCart();
}

function removeCartItem(productId) {
  cart = cart.filter(i => i.product.product_id !== productId);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function getCartTotals() {
  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.quantity * parseFloat(item.product.selling_price);
  });
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const emptyEl = document.getElementById('cart-empty');
  const checkoutBtn = document.getElementById('btn-checkout');
  const errEl = document.getElementById('checkout-error');
  const cartCountEl = document.getElementById('cart-item-count');
  if (errEl) errEl.classList.add('d-none');

  if (!list || !emptyEl || !checkoutBtn) return;

  const totalItemsCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = `${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'}`;

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

  list.innerHTML = '';
  cart.forEach(item => {
    const lineTotal = item.quantity * parseFloat(item.product.selling_price);

    const div = document.createElement('div');
    div.className = 'cart-item-row';
    div.innerHTML = `
      <div class="cart-item-details">
        <div class="cart-item-title">${item.product.product_name}</div>
        <div class="cart-item-price">$${parseFloat(item.product.selling_price).toFixed(2)} ea</div>
      </div>
      <div class="cart-qty-control me-2">
        <button class="btn-qty" onclick="updateCartQuantity(${item.product.product_id}, -1)">−</button>
        <span class="qty-display">${item.quantity}</span>
        <button class="btn-qty" onclick="updateCartQuantity(${item.product.product_id}, 1)">+</button>
      </div>
      <div class="fw-semibold num text-end me-2" style="min-width: 55px;">$${lineTotal.toFixed(2)}</div>
      <button class="btn btn-sm btn-link text-muted p-0" onclick="removeCartItem(${item.product.product_id})" title="Remove item">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;
    list.appendChild(div);
  });

  const { subtotal, tax, total } = getCartTotals();

  document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Opens payment method and checkout confirmation modal
 */
function openCheckoutModal() {
  if (cart.length === 0) return;
  const { total } = getCartTotals();

  const modalTotal = document.getElementById('modal-total-amount');
  if (modalTotal) modalTotal.textContent = `$${total.toFixed(2)}`;

  const tendered = document.getElementById('cash-tendered-input');
  if (tendered) {
    tendered.value = total.toFixed(2);
  }
  calculateChangeDue();

  if (checkoutModalInstance) {
    checkoutModalInstance.show();
  } else {
    // Direct fallback if modal element is not present
    completeSale();
  }
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });

  const cashFields = document.getElementById('cash-payment-fields');
  if (cashFields) {
    cashFields.style.display = method === 'CASH' ? 'block' : 'none';
  }
}

function calculateChangeDue() {
  const { total } = getCartTotals();
  const tendered = parseFloat(document.getElementById('cash-tendered-input')?.value || 0);
  const changeEl = document.getElementById('cash-change-due');
  if (changeEl) {
    const change = Math.max(0, tendered - total);
    changeEl.textContent = `$${change.toFixed(2)}`;
  }
}

/**
 * Submits the confirmed sale to the backend API atomically.
 */
async function completeSale() {
  if (cart.length === 0) return;

  const btn = document.getElementById('btn-confirm-checkout') || document.getElementById('btn-checkout');
  const errEl = document.getElementById('checkout-error');
  if (btn) btn.disabled = true;
  if (errEl) errEl.classList.add('d-none');

  const payload = {
    items: cart.map(i => ({
      productId: i.product.product_id,
      quantity: i.quantity
    })),
    paymentMethod: selectedPaymentMethod || 'CASH'
  };

  try {
    const res = await api.post('/sales', payload);
    const sale = res.data;

    if (checkoutModalInstance) checkoutModalInstance.hide();

    // Display receipt
    displayReceipt(sale);
    clearCart();
    await loadPosCatalog(); // Refresh live stock counts
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Sale could not be processed';
      errEl.classList.remove('d-none');
    } else {
      showNotification(err.message || 'Sale failed', 'danger');
    }
    if (btn) btn.disabled = false;
  }
}

function displayReceipt(sale) {
  const content = document.getElementById('receipt-content');
  if (!content) return;

  const subtotal = parseFloat(sale.subtotal || sale.totalAmount / 1.05);
  const tax = parseFloat(sale.taxAmount || (sale.totalAmount - subtotal));
  const total = parseFloat(sale.totalAmount || sale.total_amount);
  const saleId = sale.saleId || sale.sale_id;
  const items = sale.items || [];

  content.innerHTML = `
    <div class="text-center pb-3 mb-3 border-bottom">
      <div class="brand-logo mx-auto mb-2" style="width:36px;height:36px;font-size:16px;">SP</div>
      <h5 class="fw-bold mb-1">StockPilot Retail Operations</h5>
      <div class="text-secondary small">Transaction Receipt #${saleId}</div>
      <div class="text-muted small">${new Date().toLocaleString()}</div>
    </div>

    <div class="mb-3">
      <div class="sp-table-wrapper" style="border:none;">
        <table class="w-100" style="font-size: 13px;">
          <thead>
            <tr class="border-bottom text-muted">
              <th class="py-1">Item</th>
              <th class="py-1 text-center">Qty</th>
              <th class="py-1 text-end">Price</th>
              <th class="py-1 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr class="border-bottom">
                <td class="py-1.5">${it.productName || 'Item #' + it.productId}</td>
                <td class="py-1.5 text-center num">${it.quantity}</td>
                <td class="py-1.5 text-end num">$${parseFloat(it.unitSellingPrice || it.unit_price).toFixed(2)}</td>
                <td class="py-1.5 text-end num fw-semibold">$${(it.quantity * parseFloat(it.unitSellingPrice || it.unit_price)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="border-top pt-2" style="font-size: 13px;">
      <div class="d-flex justify-content-between py-1">
        <span class="text-secondary">Subtotal</span>
        <span class="num">$${subtotal.toFixed(2)}</span>
      </div>
      <div class="d-flex justify-content-between py-1">
        <span class="text-secondary">Sales Tax (5%)</span>
        <span class="num">$${tax.toFixed(2)}</span>
      </div>
      <div class="d-flex justify-content-between py-1.5 fs-5 fw-bold border-top border-dark mt-1">
        <span>Total Paid (${selectedPaymentMethod})</span>
        <span class="num" style="color: var(--sp-primary);">$${total.toFixed(2)}</span>
      </div>
    </div>
  `;

  if (receiptModalInstance) {
    receiptModalInstance.show();
  }
}

async function loadSalesHistory() {
  const loading = document.getElementById('history-loading');
  const tbody = document.getElementById('history-tbody');
  loading?.classList.remove('d-none');

  try {
    const res = await api.get('/sales');
    const sales = res.data || [];

    if (!tbody) return;
    tbody.innerHTML = '';

    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-muted">No sales history found.</td></tr>`;
      return;
    }

    sales.forEach(s => {
      const date = new Date(s.sale_date || s.created_at);
      const sub = parseFloat(s.subtotal || 0);
      const tax = parseFloat(s.tax_amount || 0);
      const tot = parseFloat(s.total_amount || 0);
      const profit = parseFloat(s.gross_profit || 0);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code class="sku-code">#${s.sale_id}</code></td>
        <td class="small">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td class="small">${s.cashier_name || 'Staff User'}</td>
        <td><span class="badge badge-neutral">${s.payment_method || 'CASH'}</span></td>
        <td class="text-center num">${s.item_count || 1}</td>
        <td class="text-end num">$${sub.toFixed(2)}</td>
        <td class="text-end num">$${tax.toFixed(2)}</td>
        <td class="text-end num fw-bold">$${tot.toFixed(2)}</td>
        <td class="text-end num text-success fw-semibold">+$${profit.toFixed(2)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-secondary" onclick="viewSaleDetails(${s.sale_id})">
            Details
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showNotification(err.message || 'Failed to load sales history', 'danger');
  } finally {
    loading?.classList.add('d-none');
  }
}

async function viewSaleDetails(saleId) {
  try {
    const res = await api.get(`/sales/${saleId}`);
    const sale = res.data;
    const content = document.getElementById('details-sale-content');
    const title = document.getElementById('details-sale-title');

    if (title) title.textContent = `Sale Transaction #${sale.sale_id}`;
    if (content) {
      content.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-sm-4">
            <div class="text-secondary small">Date & Time</div>
            <div class="fw-semibold">${new Date(sale.sale_date).toLocaleString()}</div>
          </div>
          <div class="col-sm-4">
            <div class="text-secondary small">Payment Method</div>
            <div class="badge badge-neutral">${sale.payment_method || 'CASH'}</div>
          </div>
          <div class="col-sm-4">
            <div class="text-secondary small">Cashier</div>
            <div class="fw-semibold">${sale.cashier_name || 'Staff User'}</div>
          </div>
        </div>

        <h6 class="fw-semibold mt-3 mb-2">Purchased Items</h6>
        <div class="table-responsive">
          <table class="sp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th class="text-center">Quantity</th>
                <th class="text-end">Unit Price</th>
                <th class="text-end">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${(sale.items || []).map(i => `
                <tr>
                  <td>
                    <div class="fw-semibold">${i.product_name}</div>
                    <code class="sku-code">${i.sku}</code>
                  </td>
                  <td class="text-center num">${i.quantity}</td>
                  <td class="text-end num">$${parseFloat(i.unit_selling_price).toFixed(2)}</td>
                  <td class="text-end num fw-semibold">$${(i.quantity * parseFloat(i.unit_selling_price)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (saleDetailsModalInstance) saleDetailsModalInstance.show();
  } catch (err) {
    showNotification('Could not load sale details: ' + err.message, 'danger');
  }
}
