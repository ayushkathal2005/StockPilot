/**
 * StockPilot - AI Replenishment & Demand Forecasting Frontend Controller
 * Phase 7: Interactive manager interface for forecasts, approvals, and PO generation.
 */

let allRecommendations = [];
let currentApproveRec = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and permissions
  if (typeof checkAuth === 'function') {
    const user = await checkAuth();
    if (!user) return;
    if (user.role === 'Staff') {
      showAlert('Access restricted. Replenishment management requires Manager or Admin role.', 'warning');
      document.getElementById('btn-generate-forecast').disabled = true;
    }
  }

  // Load initial data
  await loadMLStatus();
  await loadRecommendations();
  await loadForecastRuns();

  // Attach event handlers
  document.getElementById('btn-submit-forecast').addEventListener('click', handleExecuteForecast);
  document.getElementById('btn-confirm-approve').addEventListener('click', handleConfirmApprove);
  document.getElementById('btn-refresh-recs').addEventListener('click', loadRecommendations);
  document.getElementById('btn-refresh-runs').addEventListener('click', loadForecastRuns);
  document.getElementById('status-filter').addEventListener('change', filterAndRenderRecommendations);
  document.getElementById('search-input').addEventListener('input', filterAndRenderRecommendations);
});

function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container');
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      <i class="bi bi-info-circle-fill me-2"></i>${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

/**
 * Loads and displays ML microservice availability status.
 */
async function loadMLStatus() {
  const badge = document.getElementById('ml-status-badge');
  try {
    const res = await fetch('/api/forecast/ml-status');
    const data = await res.json();

    if (data.success && data.data.isAvailable) {
      const version = data.data.health?.model_version || 'v1.0.0';
      badge.className = 'badge bg-success p-2';
      badge.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>XGBoost ${version} (Online)`;
      document.getElementById('kpi-model-version').textContent = version;
    } else {
      badge.className = 'badge bg-warning text-dark p-2';
      badge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>ML Offline (Rule Fallback Active)';
      document.getElementById('kpi-model-version').textContent = 'Rule Fallback';
    }
  } catch (err) {
    badge.className = 'badge bg-secondary p-2';
    badge.innerHTML = '<i class="bi bi-cloud-slash me-1"></i>ML Service Offline';
  }
}

/**
 * Loads recommendations from the backend.
 */
async function loadRecommendations() {
  const tbody = document.getElementById('recommendations-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading recommendations...</td></tr>';

  try {
    const res = await fetch('/api/forecast/recommendations');
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to fetch recommendations');
    }

    allRecommendations = json.data || [];
    updateKPICards(allRecommendations);
    filterAndRenderRecommendations();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${err.message}</td></tr>`;
  }
}

/**
 * Updates top KPI summary metrics.
 */
function updateKPICards(recs) {
  const pending = recs.filter(r => r.status === 'PENDING');
  const reorderReq = pending.filter(r => r.suggested_quantity > 0);
  const totalSuggested = reorderReq.reduce((sum, r) => sum + r.suggested_quantity, 0);

  document.getElementById('kpi-pending-count').textContent = pending.length;
  document.getElementById('kpi-reorder-count').textContent = reorderReq.length;
  document.getElementById('kpi-suggested-qty').textContent = totalSuggested.toLocaleString();
}

/**
 * Filters and renders recommendation rows.
 */
function filterAndRenderRecommendations() {
  const statusFilter = document.getElementById('status-filter').value;
  const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
  const tbody = document.getElementById('recommendations-tbody');

  let filtered = allRecommendations;

  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }

  if (searchTerm) {
    filtered = filtered.filter(r => 
      (r.sku && r.sku.toLowerCase().includes(searchTerm)) ||
      (r.product_name && r.product_name.toLowerCase().includes(searchTerm)) ||
      (r.category_name && r.category_name.toLowerCase().includes(searchTerm))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">No recommendations found matching filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    // Source badge
    let sourceBadge = `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="bi bi-lightning-charge me-1"></i>XGBoost</span>`;
    if (r.recommendation_source !== 'xgboost') {
      sourceBadge = `<span class="badge bg-secondary bg-opacity-10 text-secondary border"><i class="bi bi-gear me-1"></i>Rule Fallback</span>`;
    }

    // Status badge
    let statusBadge = `<span class="badge bg-warning text-dark">PENDING</span>`;
    if (r.status === 'APPROVED_TO_PO') {
      statusBadge = `<span class="badge bg-success"><i class="bi bi-check2-circle me-1"></i>APPROVED</span>`;
    } else if (r.status === 'REJECTED') {
      statusBadge = `<span class="badge bg-danger">REJECTED</span>`;
    }

    // Action buttons
    let actionButtons = '-';
    if (r.status === 'PENDING') {
      const isEligible = r.suggested_quantity > 0 && r.preferred_supplier_id;
      actionButtons = `
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-success" onclick="openApproveModal(${r.recommendation_id})" title="${isEligible ? 'Approve & Create PO' : 'No supplier or zero qty'}" ${!isEligible ? 'disabled' : ''}>
            <i class="bi bi-check-lg"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="handleRejectRec(${r.recommendation_id})" title="Reject">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      `;
    }

    const qtyClass = r.suggested_quantity > 0 ? 'fw-bold text-danger fs-6' : 'text-muted';

    return `
      <tr>
        <td>
          <div class="fw-bold text-dark">${r.product_name}</div>
          <small class="text-muted">${r.sku}</small>
        </td>
        <td>
          <small class="fw-semibold">${r.supplier_name || '<span class="text-warning">No Supplier</span>'}</small>
          <div class="text-muted small">${r.category_name}</div>
        </td>
        <td class="text-center">${r.lead_time_days || 5}d</td>
        <td class="text-center">
          <span class="badge bg-light text-dark border">${r.inventory_position}</span>
          <div class="text-muted" style="font-size: 0.75rem;">(OH: ${r.current_on_hand}, PO: ${r.open_purchase_quantity})</div>
        </td>
        <td class="text-center">${Math.round(r.lead_time_demand)}</td>
        <td class="text-center text-info fw-semibold">${Math.round(r.safety_stock)}</td>
        <td class="text-center fw-semibold">${Math.round(r.target_stock)}</td>
        <td class="text-center ${qtyClass}">
          ${r.suggested_quantity > 0 ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger px-2 py-1">+${r.suggested_quantity}</span>` : '0'}
        </td>
        <td>${sourceBadge}</td>
        <td>${statusBadge}</td>
        <td class="text-center">${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Triggers forecast execution via API.
 */
async function handleExecuteForecast() {
  const horizon = parseInt(document.getElementById('horizon-select').value, 10);
  const btn = document.getElementById('btn-submit-forecast');
  const spinner = document.getElementById('forecast-spinner');

  btn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    const res = await fetch('/api/forecast/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizonDays: horizon })
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Forecast generation failed.');
    }

    // Close modal
    const modalEl = document.getElementById('modal-generate-forecast');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showAlert(`Forecast generated successfully for ${horizon} days (${json.data.recommendationsCount} recommendations updated).`, 'success');
    await loadRecommendations();
    await loadForecastRuns();
  } catch (err) {
    alert(`Forecast failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    spinner.classList.add('d-none');
  }
}

/**
 * Opens approval modal for a given recommendation.
 */
function openApproveModal(recommendationId) {
  const rec = allRecommendations.find(r => r.recommendation_id === recommendationId);
  if (!rec) return;

  currentApproveRec = rec;
  document.getElementById('modal-appr-rec-id').value = rec.recommendation_id;
  document.getElementById('modal-appr-product').textContent = `${rec.product_name} (${rec.sku})`;
  document.getElementById('modal-appr-supplier').textContent = rec.supplier_name || 'Standard Supplier';
  document.getElementById('modal-appr-onhand').textContent = `${rec.current_on_hand} units (Position: ${rec.inventory_position})`;
  document.getElementById('modal-appr-qty').textContent = `${rec.suggested_quantity} units`;

  const estCost = ((rec.cost_price || 10.0) * rec.suggested_quantity).toFixed(2);
  document.getElementById('modal-appr-cost').textContent = `$${estCost}`;

  const modal = new bootstrap.Modal(document.getElementById('modal-approve-rec'));
  modal.show();
}

/**
 * Submits recommendation approval -> Creates Purchase Order.
 */
async function handleConfirmApprove() {
  const recId = document.getElementById('modal-appr-rec-id').value;
  const btn = document.getElementById('btn-confirm-approve');
  const spinner = document.getElementById('approve-spinner');

  btn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    const res = await fetch(`/api/forecast/recommendations/${recId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Approval failed.');
    }

    const modalEl = document.getElementById('modal-approve-rec');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showAlert(`Purchase Order <strong>${json.data.purchaseOrder.po_number}</strong> created and submitted successfully!`, 'success');
    await loadRecommendations();
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    spinner.classList.add('d-none');
  }
}

/**
 * Rejects recommendation.
 */
async function handleRejectRec(recommendationId) {
  const reason = prompt('Please enter a brief rejection reason (optional):', 'Manager decision');
  if (reason === null) return;

  try {
    const res = await fetch(`/api/forecast/recommendations/${recommendationId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Rejection failed.');
    }

    showAlert('Recommendation marked as REJECTED.', 'info');
    await loadRecommendations();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

/**
 * Loads forecast runs history.
 */
async function loadForecastRuns() {
  const tbody = document.getElementById('runs-tbody');
  try {
    const res = await fetch('/api/forecast/runs');
    const json = await res.json();

    if (!json.success) return;
    const runs = json.data || [];

    if (runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-3 text-muted">No forecast runs logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = runs.map(run => {
      const dateFormatted = new Date(run.run_timestamp).toLocaleString();
      const wapePct = run.test_wape ? `${(run.test_wape * 100).toFixed(2)}%` : '-';
      const maeFormatted = run.test_mae ? Number(run.test_mae).toFixed(2) : '-';

      return `
        <tr>
          <td class="fw-bold">#${run.run_id}</td>
          <td><span class="badge bg-light text-dark border">${run.model_version}</span></td>
          <td>${dateFormatted}</td>
          <td class="text-center">${run.horizon_days} days</td>
          <td class="text-center text-success fw-semibold">${wapePct}</td>
          <td class="text-center">${maeFormatted}</td>
          <td><span class="badge bg-success">${run.status}</span></td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary" onclick="viewRunForecasts(${run.run_id})">
              <i class="bi bi-eye me-1"></i>View Forecasts
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-3 text-danger">Failed to load runs: ${err.message}</td></tr>`;
  }
}

/**
 * Views daily forecast details for a run.
 */
async function viewRunForecasts(runId) {
  const tbody = document.getElementById('run-details-tbody');
  document.getElementById('run-modal-title').textContent = `Forecast Run #${runId} - Daily Projections`;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Loading daily projections...</td></tr>';

  const modal = new bootstrap.Modal(document.getElementById('modal-view-run'));
  modal.show();

  try {
    const res = await fetch(`/api/forecast/runs/${runId}`);
    const json = await res.json();

    if (!json.success || !json.data.forecasts || json.data.forecasts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No product forecasts recorded for this run.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.forecasts.slice(0, 100).map(f => `
      <tr>
        <td><strong>${f.product_name}</strong> <small class="text-muted">(${f.sku})</small></td>
        <td>${f.forecast_date}</td>
        <td class="text-end fw-bold text-primary">${Number(f.predicted_units).toFixed(1)}</td>
        <td><span class="badge bg-light text-dark border">${f.forecast_source}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-danger">Error: ${err.message}</td></tr>`;
  }
}
