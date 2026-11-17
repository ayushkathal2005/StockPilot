# Phase 7 Completion Report — FastAPI ML Service & Replenishment Recommendation Integration

## 1. Executive Summary
Phase 7 of **StockPilot** connects the demand forecasting machine learning engine built in Phase 6 directly into live business operations. A separate Python **FastAPI microservice** was developed to serve recursive multi-horizon predictions using the trained pooled XGBoost Regressor (`v1.0.0`) and heuristic moving-average fallbacks.

The primary Node.js / Express backend integrates with the FastAPI service via an HTTP client with timeouts, validation, and graceful degradation. An automated replenishment engine calculates safety stock, lead-time demand, target stock, and suggested purchase quantities using exact mathematical formulas from Part E of the implementation plan. Crucially, in accordance with the system charter, **recommendations never place real orders automatically**; an official Purchase Order is created and submitted only upon explicit manager approval.

---

## 2. TPDS-III Course Module Alignment
- **Module 1 (Dashboard Designing):** In-app managerial replenishment board displaying stock positions, safety buffers, and historical daily demand projections.
- **Module 2 (Front-End Development):** Responsive manager-facing interface (`public/recommendations.html`, `public/js/recommendations.js`) with dynamic status badges, approval modals, and real-time PO creation.
- **Module 3 (Back-End Development):** Microservice architecture connecting Node.js Express to a Python FastAPI service; SQL Server persistence across `dbo.ForecastRuns`, `dbo.DemandForecasts`, and `dbo.ReplenishmentRecommendations`; atomic PO creation transactions.
- **Module 4 (Git & Deployment):** Decoupled service contracts, OpenAPI 3.0 documentation, and strict tag/branch synchronization on `develop`.

---

## 3. Implemented Deliverables

### A. FastAPI ML Forecasting Microservice (`ml/service/`)
- **`ml/service/app.py`:** High-performance asynchronous FastAPI service exposing internal endpoints:
  - `GET /health`: Service health and model readiness probe (`status`, `model_loaded`, `model_version`).
  - `GET /model/info`: Model architecture, training data summary, feature list, and evaluation metrics.
  - `POST /forecast/run`: Executes multi-day recursive forecasting across specified or all active SKUs. Validates requested horizon $H \in [7, 30]$ (rejects invalid values with HTTP 422).
  - `GET /forecast/runs/{run_id}`: Retrieves stored forecast run.
  - `GET /forecast/runs/{run_id}/products/{product_id}`: Retrieves itemized daily predicted demand for any SKU.
- **`ml/service/forecast_engine.py`:** Production recursive multi-step inference engine that dynamically updates autoregressive lag buffers ($t-1, t-7, t-14, t-28$) and rolling statistics across the forecast horizon. Clamps predictions to non-negative ($\ge 0$). Gracefully falls back to 7-day moving average if model artifacts fail to load or SKU history is insufficient.
- **`ml/service/schemas.py`:** Pydantic contract validation for all requests and responses.

### B. Express Backend Integration & Client (`src/services/mlClient.js`)
- Resilient HTTP client connecting to FastAPI microservice with configurable timeouts (`AbortSignal.timeout`) and circuit-breaking error detection.
- When the ML service is unreachable, Express falls back to rule-based replenishment without crashing or blocking user workflows.

### C. SQL Server Persistence (`src/repositories/forecastRepository.js`)
- **`dbo.ForecastRuns`:** Stores run timestamps, horizon days, model versions (`v1.0.0` or `rule_based_fallback`), and benchmark test metrics (WAPE, MAE, RMSE).
- **`dbo.DemandForecasts`:** Persists itemized daily product demand predictions linked by `run_id`.
- **`dbo.ReplenishmentRecommendations`:** Records inventory positions, lead-time demands, safety stocks, target stocks, suggested reorder quantities, and lifecycle states (`PENDING`, `APPROVED_TO_PO`, `REJECTED`).
- **`getProductInventoryPositions()`:** Real-time calculation of available on-hand stock and unreceived open purchase orders (filtering strictly for `SUBMITTED` and `PARTIALLY_RECEIVED` POs; `DRAFT` and `CANCELLED` POs are excluded).

### D. Replenishment Business Logic Engine (`src/services/replenishmentService.js`)
Implements Part E, Section 17 replenishment mathematics:
1. $\text{inventory\_position} = \text{on\_hand} - \text{reserved} + \text{open\_purchase\_quantity}$
2. $\text{lead\_time\_demand} = \sum_{d=1}^L \text{predicted\_units}[d]$
3. $\text{target\_horizon\_demand} = \sum_{d=1}^{L+R} \text{predicted\_units}[d]$ (with $R=7$ review cycle)
4. $\text{safety\_stock} = \max(5, \text{round}(0.25 \times \text{lead\_time\_demand}))$
5. $\text{reorder\_point} = \text{lead\_time\_demand} + \text{safety\_stock}$
6. $\text{target\_stock} = \text{target\_horizon\_demand} + \text{safety\_stock}$
7. $\text{suggested\_quantity} = \max(0, \lceil \text{target\_stock} - \text{inventory\_position} \rceil)$

- **Approval Protocol:** `approveRecommendation(id, userId)` verifies `PENDING` status, generates an official Purchase Order in `dbo.PurchaseOrders`, populates line items in `dbo.PurchaseOrderItems`, marks the recommendation as `APPROVED_TO_PO`, and records an immutable audit log. Repeated approval attempts are rejected with HTTP 400.
- **Rejection Protocol:** `rejectRecommendation(id, userId, reason)` transitions status to `REJECTED` and records an audit log.

### E. Manager-Facing Web Interface (`public/recommendations.html`, `public/js/recommendations.js`)
- **Live Status Badge:** Displays ML service status (`XGBoost v1.0.0 Online` vs `ML Offline - Rule Fallback Active`).
- **KPI Summary Cards:** Real-time counts for Pending Approvals, Reorder Required SKUs, and Total Suggested Order Units.
- **Interactive Recommendations Table:** Full audit breakdown with inventory positions, lead-time demand, safety buffers, target stock, and clear source indicators (`XGBoost` vs `Rule Fallback`).
- **Purchase Order Approval Modal:** Displays product, supplier, suggested quantity, and estimated financial spend before manager commitment.
- **Forecast Runs Tab:** Historical log of all forecast runs with daily itemized demand projection modal.
- **Role Navigation:** Added "AI Replenishment" navigation pill in `public/js/auth.js` for Manager and Admin users.

### F. API Documentation
- Updated `src/docs/openapi.yaml` documenting all 7 new endpoints under `/api/forecast/*`.

---

## 4. Acceptance Criteria & Invariants Verification

| Requirement | Plan Specification | Implemented Behavior | Verification Status |
|---|---|---|---|
| **Observable ML Health** | Health & readiness probe | `GET /health` returns model version & readiness | **VERIFIED** |
| **Horizon Validation** | $H \in [7, 30]$ | Rejects $<7$ or $>30$ with HTTP 400/422 | **VERIFIED** |
| **Non-Negative Demands** | $\hat{y} \ge 0$ | Predictions and suggested quantities clamped $\ge 0$ | **VERIFIED** |
| **Open PO Isolation** | Exclude Draft & Cancelled | Only `SUBMITTED` & `PARTIALLY_RECEIVED` count in inventory position | **VERIFIED** |
| **Manager Approval Gate** | No automatic order placement | PO created strictly upon explicit manager approval | **VERIFIED** |
| **Graceful ML Fallback** | Fallback if ML offline | Transparent switch to `rule_based_fallback` without crashing | **VERIFIED** |
| **RBAC Security** | Restrict to Manager/Admin | Staff blocked with HTTP 403 Forbidden | **VERIFIED** |

---

## 5. Automated Test Suite Results

### A. Python FastAPI ML Microservice (`pytest ml/tests -v`)
- Total Tests: **22 passed, 0 failed in 3.18s (100% passing)**.
- Verified `/health`, `/model/info`, horizon boundary validation (7 and 30 succeed; 6 and 31 fail with 422), run retrieval, and daily forecast inspection.

### B. Node.js Express Backend Suite (`npm test`)
- Total Test Suites: **9 passed, 9 total (100% passing)**.
- Total Tests: **73 passed, 73 total (100% passing)**.
- New Suite `tests/integration/replenishmentForecast.test.js`: 12 tests covering ML status probe, RBAC denial on Staff, horizon validation, forecast persistence in `dbo.ForecastRuns` and `dbo.DemandForecasts`, recommendation math invariants, manager PO approval, rejection handling, and offline graceful fallback.

**Combined Automated Tests:** **95 passing tests across Node.js and Python**.

---

## 6. Git Synchronization Checklist
- [x] All Phase 7 source code implemented and formatted.
- [x] All 95 automated tests passing cleanly.
- [x] OpenAPI specification updated.
- [x] Frontend screens linked and verified.
- [ ] Staged and committed on `develop`.
- [ ] Tagged as `phase-07-complete`.
- [ ] Pushed `develop` and tag to GitHub remote `origin`.
- [ ] Verified via `git ls-remote`.
