/**
 * Business Intelligence Dashboards Client Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('analytics');

  const user = auth.getUser();
  if (!user || (user.role !== 'Admin' && user.role !== 'Manager')) {
    api.showToast('Access restricted: BI Analytics requires Manager or Admin permissions.', 'danger');
    window.location.href = '/products.html';
    return;
  }

  await loadExecutiveKPIs();
});

async function loadExecutiveKPIs() {
  try {
    const res = await api.get('/analytics/executive');
    const d = res.data;

    const rev = parseFloat(d.total_gross_revenue || 0);
    const sub = parseFloat(d.total_subtotal_revenue || 0);
    const tax = parseFloat(d.total_tax_collected || 0);
    const profit = parseFloat(d.total_gross_profit || 0);
    const margin = parseFloat(d.gross_margin_percentage || 0);
    const invVal = parseFloat(d.total_inventory_valuation || 0);
    const spend = parseFloat(d.total_po_spend || 0);
    const cogs = sub - profit;

    document.getElementById('kpi-revenue').textContent = `$${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('kpi-tx-count').textContent = `${d.total_transactions_count || 0} completed transactions`;

    document.getElementById('kpi-profit').textContent = `$${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('kpi-margin').textContent = `${margin.toFixed(2)}% gross margin`;

    document.getElementById('kpi-inv-val').textContent = `$${invVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('kpi-active-skus').textContent = `${d.total_active_skus || 0} active SKUs`;

    document.getElementById('kpi-spend').textContent = `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('kpi-open-pos').textContent = `${d.open_po_count || 0} open PO(s)`;

    // Health breakdown
    const healthyCount = (d.total_active_skus || 0) - (d.low_stock_sku_count || 0) - (d.out_of_stock_sku_count || 0);
    document.getElementById('health-healthy').textContent = `${healthyCount} SKUs`;
    document.getElementById('health-low').textContent = `${d.low_stock_sku_count || 0} SKUs`;
    document.getElementById('health-out').textContent = `${d.out_of_stock_sku_count || 0} SKUs`;

    // Reconciliation
    document.getElementById('rec-subtotal').textContent = `$${sub.toFixed(2)}`;
    document.getElementById('rec-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('rec-total').textContent = `$${rev.toFixed(2)}`;
    document.getElementById('rec-cogs').textContent = `$${cogs.toFixed(2)}`;
    document.getElementById('rec-margin').textContent = `${margin.toFixed(2)}% ($${profit.toFixed(2)})`;
  } catch (err) {
    api.showToast(err.message || 'Failed to load executive KPIs', 'danger');
  }
}

async function loadSalesTrends() {
  const tbody = document.getElementById('sales-trends-tbody');
  try {
    const res = await api.get('/analytics/sales-trends?limit=30');
    const trends = res.data || [];

    tbody.innerHTML = '';
    if (trends.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">No historical sales trends found.</td></tr>`;
      return;
    }

    trends.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold font-monospace">${new Date(t.sale_business_date).toISOString().slice(0, 10)}</td>
        <td class="text-center">${t.daily_transactions_count}</td>
        <td class="text-center fw-semibold">${t.daily_units_sold}</td>
        <td class="text-end">$${parseFloat(t.daily_subtotal).toFixed(2)}</td>
        <td class="text-end">$${parseFloat(t.daily_tax).toFixed(2)}</td>
        <td class="text-end fw-bold text-primary">$${parseFloat(t.daily_total_revenue).toFixed(2)}</td>
        <td class="text-end text-success fw-bold">+$${parseFloat(t.daily_gross_profit).toFixed(2)}</td>
        <td class="text-end">${parseFloat(t.daily_gross_margin_pct).toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load sales trends', 'danger');
  }
}

async function loadCategoryPerformance() {
  const tbody = document.getElementById('cat-tbody');
  try {
    const res = await api.get('/analytics/category-performance');
    const cats = res.data || [];

    tbody.innerHTML = '';
    if (cats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">No category performance records found.</td></tr>`;
      return;
    }

    cats.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold">${c.category_name}</td>
        <td class="text-center">${c.active_products_count}</td>
        <td class="text-center fw-semibold">${c.total_units_sold}</td>
        <td class="text-end fw-bold">$${parseFloat(c.total_category_revenue).toFixed(2)}</td>
        <td class="text-end text-success fw-semibold">+$${parseFloat(c.category_gross_profit).toFixed(2)}</td>
        <td class="text-end fw-bold text-primary">$${parseFloat(c.category_inventory_valuation).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load category performance', 'danger');
  }
}

async function loadTopProducts() {
  const tbody = document.getElementById('top-tbody');
  try {
    const res = await api.get('/analytics/top-products?limit=15');
    const prods = res.data || [];

    tbody.innerHTML = '';
    if (prods.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">No product ranking records found.</td></tr>`;
      return;
    }

    prods.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${p.product_name}</div>
          <small class="text-muted font-monospace">${p.sku}</small>
        </td>
        <td><span class="badge bg-light text-dark border">${p.category_name}</span></td>
        <td class="text-end">$${parseFloat(p.selling_price).toFixed(2)}</td>
        <td class="text-end text-muted small">$${parseFloat(p.cost_price).toFixed(2)}</td>
        <td class="text-center fw-bold">${p.total_units_sold}</td>
        <td class="text-end fw-bold text-primary">$${parseFloat(p.total_sales_revenue).toFixed(2)}</td>
        <td class="text-end text-success fw-bold">+$${parseFloat(p.total_gross_profit).toFixed(2)}</td>
        <td class="text-center fw-semibold">${p.current_on_hand_stock}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load top products', 'danger');
  }
}

async function loadSupplierPerformance() {
  const tbody = document.getElementById('sup-tbody');
  try {
    const res = await api.get('/analytics/supplier-performance');
    const sups = res.data || [];

    tbody.innerHTML = '';
    if (sups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">No supplier analytics records found.</td></tr>`;
      return;
    }

    sups.forEach(s => {
      const tr = document.createElement('tr');
      const rate = parseFloat(s.fulfillment_rate_pct || 0);
      const rateBadge = rate >= 90 ? 'bg-success' : rate >= 50 ? 'bg-warning text-dark' : 'bg-secondary';

      tr.innerHTML = `
        <td class="fw-bold">${s.supplier_name}</td>
        <td class="small text-muted">${s.contact_email || '-'}</td>
        <td class="text-center">${s.default_lead_time_days} days</td>
        <td class="text-center">${s.total_purchase_orders}</td>
        <td class="text-end fw-bold text-primary">$${parseFloat(s.total_po_spend).toFixed(2)}</td>
        <td class="text-center">${s.total_units_ordered}</td>
        <td class="text-center">${s.total_units_received}</td>
        <td class="text-center"><span class="badge ${rateBadge}">${rate.toFixed(1)}%</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    api.showToast(err.message || 'Failed to load supplier performance', 'danger');
  }
}
