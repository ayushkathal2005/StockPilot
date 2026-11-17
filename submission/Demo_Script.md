# StockPilot — Evaluator Demonstration Script & Live Walkthrough Guide

This script provides an exact step-by-step demonstration walkthrough for academic evaluators, reviewers, and faculty examining the **StockPilot** system across all four TPDS-III modules.

---

## 1. Environment & Service Access Endpoints

| Service / Interface | Local URL | Role / Purpose | Default Credentials |
|---|---|---|---|
| **StockPilot Web Application** | `http://localhost:3000` | Primary Bootstrap 5 UI shell | See table below |
| **Metabase BI Dashboards** | `http://localhost:3001` | Executive & Operational BI | `bi-admin@stockpilot.io` / `BiAdminPassword123!` |
| **Express Backend Health Probe** | `http://localhost:3000/api/health` | Live system & database health | Unauthenticated |
| **FastAPI ML Service Health Probe** | `http://localhost:8000/health` | ML model readiness check | Internal |
| **FastAPI Interactive API Docs** | `http://localhost:8000/docs` | Swagger OpenAPI ML test runner | Internal / Dev |

### Pre-Seeded Demonstration User Accounts

| Role | Email Address | Password | Permissions & Intended Demo Workflow |
|---|---|---|---|
| **Administrator** | `admin@stockpilot.io` | `Password123!` | Full system administration, user management, master data creation, and audit logging. |
| **Warehouse Manager** | `manager@stockpilot.io` | `Password123!` | PO submission, supplier negotiations, forecast generation, and replenishment PO approval. |
| **Store Staff** | `staff@stockpilot.io` | `Password123!` | Point-of-Sale checkout, catalog lookups, and warehouse inbound receiving. |

---

## 2. Step-by-Step Demonstration Sequence

### Step 1: System Health & Infrastructure Probe (Module 4)
1. Open browser to `http://localhost:3000/api/health`.
2. **Observe:** Clean JSON payload reporting `"status": "UP"` and `"database": { "status": "UP", "database": "StockPilotDB" }`.
3. Open terminal and run: `docker ps`.
4. **Observe:** All four containers running healthy: `stockpilot-backend`, `stockpilot-ml-service`, `stockpilot-mssql`, and `stockpilot-metabase`.

---

### Step 2: Role-Based Access Control & Security Boundaries (Module 3)
1. Navigate to `http://localhost:3000/login.html`.
2. Log in using Staff credentials: `staff@stockpilot.io` / `Password123!`.
3. **Observe:** The top navigation bar dynamically adapts: "Users" and "AI Replenishment" links are hidden.
4. Attempt to manually navigate to `http://localhost:3000/recommendations.html`.
5. **Observe:** The client-side guard redirects or the backend API returns HTTP 403 Forbidden with `{ "error": { "code": "FORBIDDEN" } }`.
6. Click "Logout" in the user menu.

---

### Step 3: Master Catalog Management & Inventory Ledger (Module 2 & 3)
1. Log in as Manager: `manager@stockpilot.io` / `Password123!`.
2. Navigate to **Products** (`http://localhost:3000/products.html`).
3. Click **"+ Add Product"** and create a demo item:
   - SKU: `DEMO-CHIPS-150`
   - Name: `Artisan Sea Salt Potato Chips 150g`
   - Category: `Packaged Foods`
   - Preferred Supplier: `Global FMCG Wholesalers`
   - Cost Price: `$1.80`
   - Selling Price: `$3.99`
   - Reorder Point: `20`
   - Target Safety Stock: `30`
   - Lead Time: `5 days`
   - Initial Stock: `15 units`
4. Submit form.
5. **Observe:** Product appears in the real-time table with on-hand quantity of 15, and stock health badge showing `LOW_STOCK` (since 15 < 20).
6. Click on **Inventory** (`http://localhost:3000/inventory.html`) and filter by `DEMO-CHIPS-150`.
7. **Observe:** Initial opening balance of 15 units is recorded in `dbo.Inventory` and logged as an opening `STOCK_ADJUSTMENT` in `dbo.StockMovements`.

---

### Step 4: Point-of-Sale (POS) Checkout & Atomic Inventory Deduction (Module 2 & 3)
1. Log in as Staff: `staff@stockpilot.io` / `Password123!`.
2. Navigate to **Sales** (`http://localhost:3000/sales.html`).
3. **Negative Stock Prevention Test:**
   - Select `DEMO-CHIPS-150`.
   - Enter Quantity: `25 units` (exceeds available 15 units).
   - Click "Complete Sale".
   - **Observe:** Red alert toast: `Insufficient stock for Artisan Sea Salt Potato Chips. Available: 15, Requested: 25`. Zero partial writes occur.
4. **Valid Sale Execution:**
   - Change Quantity to `5 units`.
   - Payment Method: `CASH`.
   - Notice real-time calculation: Subtotal = `$19.95`, Tax (5%) = `$1.00`, Total = `$20.95`.
   - Click "Complete Sale".
   - **Observe:** Sale receipt modal displays confirmed transaction with unique Sale ID and timestamp.
5. Return to **Inventory** (`http://localhost:3000/inventory.html`).
6. **Observe:** On-hand quantity is atomically decremented from 15 to 10 units. Stock movement ledger records a `SALE` entry with delta `-5` and frozen cost `$1.80`.

---

### Step 5: Procurement & Warehouse Inbound Receiving (Module 3 & 4)
1. Log in as Manager: `manager@stockpilot.io` / `Password123!`.
2. Navigate to **Purchase Orders** (`http://localhost:3000/purchase-orders.html`).
3. Click **"+ New Purchase Order"**:
   - Supplier: `Global FMCG Wholesalers`
   - Line Item: `DEMO-CHIPS-150`, Quantity Ordered: `50`, Unit Cost: `$1.80`.
   - Click "Create Purchase Order".
4. **Observe:** PO is created in `DRAFT` status. Invariant check: DRAFT orders do NOT count toward open inventory position.
5. Click **"Submit Order"**:
   - Status changes to `SUBMITTED`.
   - Open purchase quantity immediately reflects +50 units. Inventory position = $10 \text{ (on hand)} + 50 \text{ (open)} = 60$.
6. Click **"Receive Items"**:
   - Enter Quantity Received: `50`.
   - Submit receipt.
   - **Observe:** PO status changes to `RECEIVED`.
   - On-hand stock in `dbo.Inventory` increases from 10 to 60 units.
   - Movement ledger records `PO_RECEIPT` with delta `+50`.

---

### Step 6: AI Demand Forecasting & Replenishment Recommendations (ML Enhancement)
1. While logged in as Manager, navigate to **AI Replenishment** (`http://localhost:3000/recommendations.html`).
2. **Inspect Live Status Badge:** Shows `XGBoost v1.0.0 Online` (or fallback indicator if container offline).
3. Select Horizon: `14 days`. Click **"Run Demand Forecast"**.
4. **Observe:**
   - Progress spinner activates while Express calls FastAPI over Docker internal DNS (`http://stockpilot-ml-service:8000/forecast/run`).
   - Forecast completes in ~200ms.
   - Summary cards update: Pending Approvals count, Reorder Required SKUs count, and Total Suggested Order Units.
5. **Inspect Recommendations Table:**
   - Displays items with inventory position $\le$ reorder point.
   - Review columns: On-Hand, Open POs, Inventory Position, Predicted Lead-Time Demand, Dynamic Safety Stock ($0.25 \times \text{lead\_time\_demand}$), Target Stock, and Suggested Quantity.
6. **Manager Approval Workflow:**
   - Click **"Approve & Create PO"** on any pending recommendation.
   - Modal displays estimated order cost and supplier details.
   - Click "Confirm Approval".
   - **Observe:** Status updates to `APPROVED_TO_PO`. An official Purchase Order is created in SQL Server in `SUBMITTED` status.
   - Attempting to approve the same recommendation again is blocked with HTTP 400.

---

### Step 7: Business Intelligence & Reconciliation Auditing (Module 1)
1. Navigate to **Analytics** (`http://localhost:3000/analytics.html`).
2. **Observe:**
   - Real-time KPI summary: Total Gross Revenue, Total Inventory Valuation, Purchasing Spend, and Gross Margin %.
   - Daily Sales Trend chart rendering chronological turnover.
   - Category Performance and Top Products bar charts.
   - Supplier Fulfillment reliability metrics.
3. **Open Metabase BI Portal:**
   - Navigate to `http://localhost:3001`.
   - Open Executive Dashboard.
   - Demonstrate that numbers displayed in Metabase reconcile 100% with `dbo.vw_BI_ExecutiveKPIs` and raw transaction tables.
   - Explain least-privilege security: Metabase connects via `stockpilot_bi_readonly` which has `SELECT` privileges only on reporting views and is denied any write access.

---

## 3. Demonstration Wrap-Up Checklist
- [x] All 4 TPDS-III modules clearly demonstrated.
- [x] Zero negative stock invariant confirmed.
- [x] Strict RBAC security boundaries demonstrated.
- [x] ML demand prediction with human-in-the-loop PO generation verified.
- [x] BI metrics reconciliation verified against SQL Server.
- [x] Containerized multi-service Docker topology verified.
