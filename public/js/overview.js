/**
 * StockPilot — Executive Overview Dashboard Controller
 * Modern Enterprise SaaS Financial & Operational Metrics
 */

let salesTrendChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  auth.renderNavbar('overview');

  await loadOverviewData();

  // Attach date range filter listener
  const filterSelect = document.getElementById('overview-date-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => loadOverviewData());
  }
});

async function loadOverviewData() {
  try {
    const [execRes, trendsRes, topProdsRes, recentSalesRes, pendingPosRes, invRes] = await Promise.all([
      api.get('/analytics/executive').catch(() => ({ data: {} })),
      api.get('/analytics/sales-trends').catch(() => ({ data: [] })),
      api.get('/analytics/top-products').catch(() => ({ data: [] })),
      api.get('/sales').catch(() => ({ data: [] })),
      api.get('/purchase-orders', { status: 'SUBMITTED' }).catch(() => ({ data: [] })),
      api.get('/inventory').catch(() => ({ data: [] }))
    ]);

    renderKPIs(execRes.data || {});
    renderSalesTrendChart(trendsRes.data || []);
    renderInventoryHealth(execRes.data || {}, invRes.data || []);
    renderTopProducts(topProdsRes.data || []);
    renderRecentSales(recentSalesRes.data || []);
    renderPendingPOs(pendingPosRes.data || []);
    renderLowStockAlerts(invRes.data || []);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading overview data:', err);
  }
}

function renderKPIs(data) {
  const rev = parseFloat(data.total_gross_revenue || 0);
  const profit = parseFloat(data.total_gross_profit || 0);
  const margin = parseFloat(data.gross_margin_percentage || 0);
  const invVal = parseFloat(data.total_inventory_valuation || 0);
  const spend = parseFloat(data.total_po_spend || 0);
  const activeSkus = data.total_active_skus || 0;
  const txCount = data.total_transactions_count || 0;
  const openPos = data.open_po_count || 0;

  const elRev = document.getElementById('kpi-revenue');
  const elRevSub = document.getElementById('kpi-revenue-sub');
  if (elRev) elRev.textContent = `$${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elRevSub) elRevSub.textContent = `${txCount} completed sales orders`;

  const elProfit = document.getElementById('kpi-profit');
  const elProfitSub = document.getElementById('kpi-profit-sub');
  if (elProfit) elProfit.textContent = `$${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elProfitSub) elProfitSub.textContent = `${margin.toFixed(1)}% gross margin`;

  const elInv = document.getElementById('kpi-inv-val');
  const elInvSub = document.getElementById('kpi-inv-sub');
  if (elInv) elInv.textContent = `$${invVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elInvSub) elInvSub.textContent = `${activeSkus} active catalog items`;

  const elSpend = document.getElementById('kpi-spend');
  const elSpendSub = document.getElementById('kpi-spend-sub');
  if (elSpend) elSpend.textContent = `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elSpendSub) elSpendSub.textContent = `${openPos} open POs awaiting intake`;
}

function renderSalesTrendChart(trends) {
  const ctx = document.getElementById('salesTrendChart');
  if (!ctx || !window.Chart) return;

  // Use last 14 data points
  const recentTrends = (trends || []).slice(-14);
  const labels = recentTrends.map(t => {
    const rawDate = t.sale_business_date || t.sale_date;
    if (!rawDate) return 'Day';
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? String(rawDate).slice(0, 10) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });
  const revenues = recentTrends.map(t => parseFloat(t.daily_total_revenue || t.daily_revenue || 0));

  if (salesTrendChartInstance) {
    salesTrendChartInstance.destroy();
  }

  salesTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
      datasets: [{
        label: 'Daily Gross Revenue ($)',
        data: revenues.length ? revenues : [120, 240, 180, 320, 290],
        borderColor: '#365C50',
        backgroundColor: 'rgba(54, 92, 80, 0.06)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#365C50',
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#202A36',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `Revenue: $${parseFloat(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 11 }, color: '#68737D' }
        },
        y: {
          grid: { color: '#EEF2EE' },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: '#68737D',
            callback: (v) => `$${v}`
          }
        }
      }
    }
  });
}

function renderInventoryHealth(execData, inventory) {
  const activeSkus = execData.total_active_skus || inventory.length || 0;
  const lowStock = execData.low_stock_sku_count || inventory.filter(i => (i.on_hand_quantity || 0) <= (i.reorder_point || 0) && (i.on_hand_quantity || 0) > 0).length;
  const outOfStock = execData.out_of_stock_sku_count || inventory.filter(i => (i.on_hand_quantity || 0) === 0).length;
  const optimal = Math.max(0, activeSkus - lowStock - outOfStock);

  const elOptCount = document.getElementById('health-optimal-count');
  const elLowCount = document.getElementById('health-low-count');
  const elOutCount = document.getElementById('health-out-count');

  if (elOptCount) elOptCount.textContent = `${optimal} SKUs`;
  if (elLowCount) elLowCount.textContent = `${lowStock} SKUs`;
  if (elOutCount) elOutCount.textContent = `${outOfStock} SKUs`;

  // Update progress bar segments
  const total = activeSkus || 1;
  const barOpt = document.getElementById('bar-optimal');
  const barLow = document.getElementById('bar-low');
  const barOut = document.getElementById('bar-out');

  if (barOpt) barOpt.style.width = `${(optimal / total) * 100}%`;
  if (barLow) barLow.style.width = `${(lowStock / total) * 100}%`;
  if (barOut) barOut.style.width = `${(outOfStock / total) * 100}%`;
}

function renderTopProducts(products) {
  const tbody = document.getElementById('top-products-tbody');
  if (!tbody) return;

  const topItems = (products || []).slice(0, 5);
  if (topItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No sales data recorded yet</td></tr>`;
    return;
  }

  tbody.innerHTML = topItems.map((p, idx) => {
    const rev = parseFloat(p.gross_revenue || p.total_revenue || 0);
    const units = parseInt(p.total_units_sold || 0, 10);
    return `
      <tr>
        <td class="text-muted fw-semibold" style="width: 36px;">#${idx + 1}</td>
        <td>
          <div class="fw-semibold text-truncate" style="max-width: 180px;">${p.product_name}</div>
          <code class="sku-code">${p.sku}</code>
        </td>
        <td class="num text-end">${units.toLocaleString()}</td>
        <td class="num text-end fw-semibold">$${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-center">
          <span class="badge badge-success"><i data-lucide="trending-up" style="width:12px;height:12px;"></i> Active</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecentSales(sales) {
  const tbody = document.getElementById('recent-sales-tbody');
  if (!tbody) return;

  const recent = (sales || []).slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No sales transactions yet</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(s => {
    const date = new Date(s.sale_date || s.created_at);
    const amount = parseFloat(s.total_amount || 0);
    return `
      <tr>
        <td>
          <div class="fw-semibold font-mono">#${s.sale_id || s.saleId}</div>
          <small class="text-muted">${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        </td>
        <td><span class="badge badge-neutral">${s.payment_method || 'CASH'}</span></td>
        <td class="num text-end fw-semibold">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">
          <span class="badge badge-success">Completed</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPendingPOs(pos) {
  const container = document.getElementById('pending-pos-container');
  if (!container) return;

  const activePos = (pos || []).filter(p => p.status === 'SUBMITTED' || p.status === 'PARTIALLY_RECEIVED').slice(0, 4);
  if (activePos.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-3 small">
        <i data-lucide="check-circle-2" class="mb-1 text-success" style="width:20px;height:20px;"></i>
        <div>No purchase orders awaiting delivery.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = activePos.map(p => {
    const amount = parseFloat(p.total_amount || 0);
    const eta = p.expected_delivery_date ? new Date(p.expected_delivery_date).toLocaleDateString() : 'N/A';
    return `
      <div class="d-flex align-items-center justify-content-between p-2 mb-2 border rounded-2 bg-light">
        <div>
          <div class="fw-semibold small">${p.po_number || '#' + p.po_id}</div>
          <div class="text-muted" style="font-size: 11.5px;">${p.supplier_name || 'Vendor'} • ETA: ${eta}</div>
        </div>
        <div class="text-end">
          <div class="fw-semibold num small">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <a href="/purchase-orders.html" class="small text-primary" style="font-size: 11px;">Intake ↗</a>
        </div>
      </div>
    `;
  }).join('');
}

function renderLowStockAlerts(inventory) {
  const container = document.getElementById('low-stock-container');
  if (!container) return;

  const lowItems = (inventory || []).filter(i => {
    const onHand = i.on_hand_quantity || 0;
    const reorder = i.reorder_point || 0;
    return onHand <= reorder;
  }).slice(0, 4);

  if (lowItems.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-3 small">
        <i data-lucide="shield-check" class="mb-1 text-success" style="width:20px;height:20px;"></i>
        <div>All SKU stock balances are optimal.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = lowItems.map(i => {
    const onHand = i.on_hand_quantity || 0;
    const isOut = onHand === 0;
    return `
      <div class="d-flex align-items-center justify-content-between p-2 mb-2 border rounded-2 ${isOut ? 'border-danger-subtle bg-danger-subtle text-danger' : 'border-warning-subtle bg-warning-subtle'}">
        <div class="me-2" style="max-width: 170px;">
          <div class="fw-semibold text-truncate small">${i.product_name || i.name}</div>
          <small class="text-muted" style="font-size: 11px;">${i.sku} • On Hand: <strong>${onHand}</strong></small>
        </div>
        <a href="/recommendations.html" class="btn btn-sm ${isOut ? 'btn-danger' : 'btn-warning'} py-0 px-2" style="font-size: 11px;">
          Restock
        </a>
      </div>
    `;
  }).join('');
}
