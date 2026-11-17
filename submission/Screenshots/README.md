# StockPilot — Visual Demonstration & Screenshot Verification Guide

This directory contains visual walkthrough references and instructions for evaluators inspecting the **StockPilot** user interface and Metabase BI dashboards.

---

## 1. UI Screen Inventory & Component Mapping

| Screen / View | File Path | Access URL | Target Role | Key Visual Features & Controls |
|---|---|---|---|---|
| **Login Screen** | `public/login.html` | `http://localhost:3000/login.html` | All | Responsive card layout, pre-filled demo role shortcuts, credential validation, error toast notifications. |
| **Products & Catalog** | `public/products.html` | `http://localhost:3000/products.html` | Staff, Manager, Admin | Live search, category badges, real-time stock health badges (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), modal creation dialog. |
| **Inventory & Movements** | `public/inventory.html` | `http://localhost:3000/inventory.html` | Staff, Manager, Admin | On-hand quantity, available quantity, open PO quantity, inventory position, drill-down stock movement history modal. |
| **Point of Sale (POS)** | `public/sales.html` | `http://localhost:3000/sales.html` | Staff, Manager, Admin | Interactive line item cart, instant total and 5% tax calculation, negative stock rejection toasts, confirmed printable receipt modal. |
| **Purchase Orders** | `public/purchase-orders.html` | `http://localhost:3000/purchase-orders.html` | Manager, Admin | PO lifecycle badges (`DRAFT`, `SUBMITTED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`), order submission, warehouse receiving modal. |
| **AI Replenishment** | `public/recommendations.html` | `http://localhost:3000/recommendations.html` | Manager, Admin | Live ML service status indicator (`XGBoost v1.0.0 Online`), horizon selector (7-30d), lead-time demand, safety stock math, "Approve & Create PO" button. |
| **In-App Analytics** | `public/analytics.html` | `http://localhost:3000/analytics.html` | Manager, Admin | Executive KPI summary cards, daily turnover trendline, category share bar charts, top selling products ranking, supplier fulfillment rate gauges. |
| **Metabase BI Portal** | External Port 3001 | `http://localhost:3001` | Executive / Manager | 5 production dashboards connected to SQL Server via `stockpilot_bi_readonly` with zero operational write permissions. |

---

## 2. Screenshot Capture Procedure for Academic Submission

To capture fresh screenshots for the final submission report or PowerPoint deck:

1. **Start System:**
   ```powershell
   docker compose up -d
   ```
2. **Open Browser:**
   - Navigate to `http://localhost:3000/login.html`.
   - Log in as Manager: `manager@stockpilot.io` / `Password123!`.
3. **Capture Core Operational Screens:**
   - **Login Screen:** `Screenshots/01_login.png`
   - **Catalog & Inventory:** `Screenshots/02_products_inventory.png`
   - **Sales Terminal & Receipt:** `Screenshots/03_pos_sales.png`
   - **Purchase Orders & Intake:** `Screenshots/04_purchase_orders.png`
   - **AI Replenishment Engine:** `Screenshots/05_ai_recommendations.png`
   - **Executive BI Analytics:** `Screenshots/06_metabase_bi_dashboard.png`
