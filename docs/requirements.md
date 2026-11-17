# StockPilot — System Requirements Specification (SRS)

**Document Version:** 1.0  
**Phase:** Phase 0 (Baseline Freeze)  
**Author:** Lead Software Engineer  
**Status:** Approved for Phase 0 Baseline  

---

## 1. Project Purpose & Scope

StockPilot is an intelligent inventory operations and business intelligence platform designed specifically for small and medium-sized enterprises (retailers, wholesalers, and distributors). It bridges the gap between basic, error-prone manual spreadsheet tracking and cost-prohibitive enterprise ERPs. 

### 1.1 In-Scope Capabilities
- End-to-end product catalog and category taxonomy management.
- Multi-status supplier relationship and purchase order (PO) lifecycle management.
- Double-entry stock movement ledger ensuring 100% auditability of inventory changes.
- Transactional point-of-sale recording with strict inventory deduction and historical unit cost capture.
- Real-time stock valuation and inventory health monitoring (low-stock, stockout alerts).
- Self-hosted business intelligence dashboards delivering operational and financial KPIs via Metabase.
- Supervised machine learning demand forecasting (XGBoost Regressor) combined with safety-stock calculations and manager-authorized replenishment recommendations.
- Rule-based fallback mechanisms ensuring core operational continuity during ML service outages.

### 1.2 Explicit Non-Goals (Out of Scope for Initial Release)
To prevent scope creep and maintain architectural reliability, the following features are strictly excluded from the baseline release:
- Automatic live purchasing or autonomous supplier order transmission via EDI/API.
- Payment gateway integration (e.g., Stripe/Razorpay credit card processing).
- Physical barcode scanner or hardware POS integration (standard keyboard/touch inputs only).
- Multi-warehouse/inter-facility stock transfers.
- Native mobile applications (iOS/Android) — responsive web layout is used instead.
- Generative AI, natural language chatbots, or LLM-driven interfaces.
- Deep learning sequence networks (such as LSTM/RNN).
- Distributed orchestration (Kubernetes) or distributed event streaming (Kafka/RabbitMQ).
- Multi-tenant SaaS billing, tiering, or subscription licensing.

---

## 2. User Roles & Access Control Matrix

StockPilot enforces server-side Role-Based Access Control (RBAC). Permissions are strictly validated in Express middleware; UI element visibility is a convenience, not a security boundary.

| Capability / Resource | Staff | Manager | Admin |
|---|:---:|:---:|:---:|
| **Authentication & Profile** |
| Log in / Log out | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes |
| **Catalog & Suppliers** |
| View products & categories | Yes | Yes | Yes |
| Create / edit / deactivate products | No | Yes | Yes |
| Create / edit suppliers | No | Yes | Yes |
| **Inventory Ledger** |
| View current stock levels | Yes | Yes | Yes |
| View detailed stock movement ledger | No | Yes | Yes |
| Record manual stock adjustments | No | Yes | Yes |
| **Sales Operations** |
| Record sale transactions | Yes | Yes | Yes |
| View sales history | Limited (Own/Daily) | Yes | Yes |
| Void / Return sales (with reversal ledger) | No | Yes | Yes |
| **Purchasing Operations** |
| View purchase orders | No | Yes | Yes |
| Create draft purchase orders | No | Yes | Yes |
| Approve / Submit purchase orders to suppliers | No | Yes | Yes |
| Receive shipments (partial / full receipt) | No | Yes | Yes |
| Cancel purchase orders | No | Yes | Yes |
| **Business Intelligence & Dashboards** |
| Access Metabase operational dashboards | No | Yes | Yes |
| View gross profit / financial margins | No | Yes | Yes |
| **Forecasting & Replenishment** |
| Trigger demand forecast runs | No | Yes | Yes |
| View replenishment recommendations | No | Yes | Yes |
| Approve replenishment recommendation to PO | No | Yes | Yes |
| **Administration** |
| Manage user accounts and assign roles | No | No | Yes |
| View system audit logs | No | No | Yes |
| Configure system settings | No | No | Yes |

---

## 3. Functional Requirements

### 3.1 Product and Category Management
- **FR-1.1:** System shall allow creation, modification, viewing, and soft-deactivation of products.
- **FR-1.2:** Every product must have a unique SKU (Stock Keeping Unit), non-empty name, valid category reference, valid preferred supplier reference, non-negative cost price, and non-negative selling price.
- **FR-1.3:** System shall track supplier lead time (in days), reorder point threshold, and target safety stock configuration per product.
- **FR-1.4:** Deleting a product with transaction history is forbidden; products can only be marked `is_active = 0`.
- **FR-1.5:** Categories must have unique names and support hierarchical grouping or active status flags.

### 3.2 Inventory Operations & Ledger Invariants
- **FR-2.1:** System shall compute `available_quantity = on_hand_quantity - reserved_quantity`. (Where reservation is unconfigured, `reserved_quantity = 0`).
- **FR-2.2:** System shall compute `open_purchase_quantity` as the sum of unreceived items on approved and submitted purchase orders.
- **FR-2.3:** System shall compute `inventory_position = available_quantity + open_purchase_quantity`.
- **FR-2.4:** Direct modification of stock quantities without an associated stock movement record is strictly forbidden.
- **FR-2.5:** Every stock modification must append an immutable record to `StockMovements` capturing: `product_id`, `movement_type` (SALE, PO_RECEIPT, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN), `quantity_delta`, `reference_id`, `created_by`, and timestamp.
- **FR-2.6:** Ordinary sales must never drive `available_quantity` below zero. Transactions violating this condition must be aborted.

### 3.3 Sales Transactions & Financial Tracking
- **FR-3.1:** A sale may include one or more line items with quantities and selling prices.
- **FR-3.2:** System must capture `unit_cost_at_sale` at the time of sale, frozen from the product's active cost price, ensuring reliable historical gross profit reporting regardless of future price fluctuations.
- **FR-3.3:** Total price, tax, and line subtotals must be computed authoritatively on the server; client-submitted totals are ignored.
- **FR-3.4:** The sale header, line items, inventory reduction, and stock movement ledger entries must commit within a single atomic database transaction. If any item has insufficient inventory, the entire sale rolls back.

### 3.4 Supplier & Purchase Order Lifecycle
- **FR-4.1:** System shall support supplier profiles including primary contact, phone, email, address, and default lead time.
- **FR-4.2:** Purchase orders must traverse defined states: `DRAFT` -> `SUBMITTED` -> `PARTIALLY_RECEIVED` -> `RECEIVED` (or `CANCELLED`).
- **FR-4.3:** Only users with `Manager` or `Admin` privileges may submit or approve purchase orders.
- **FR-4.4:** Receiving an order increases inventory strictly by the incremental quantity received, with corresponding stock ledger entries.
- **FR-4.5:** Total received quantity per line item cannot exceed the ordered quantity.
- **FR-4.6:** Duplicate receipt submissions (e.g. repeated button clicks) must be rejected idempotently.

### 3.5 Business Intelligence & Analytics (Metabase)
- **FR-5.1:** Metabase shall connect directly to Microsoft SQL Server using a dedicated read-only account (`stockpilot_bi_readonly`).
- **FR-5.2:** Deliver five core operational dashboards:
  1. *Executive Overview:* Total revenue, orders, gross profit, inventory valuation, stockout metrics.
  2. *Sales Analytics:* Revenue trends, category breakdowns, top-selling SKUs.
  3. *Inventory Analytics:* Turnover rate, stock distribution, aging analysis, low-stock warnings.
  4. *Supplier Analytics:* Supplier fulfillment times, lead-time variance, purchase order volume.
  5. *Forecast Analytics:* Actual demand vs. predicted demand, forecast error margins, replenishment pipelines.
- **FR-5.3:** All dashboard metrics must reconcile precisely with SQL Server transactional source queries.

### 3.6 Machine Learning Demand Forecasting & Replenishment
- **FR-6.1:** System shall maintain daily product-level demand history (`units_sold` per product per date).
- **FR-6.2:** Days affected by stockouts must be flagged (`is_stockout = 1`) and excluded from training to prevent negative bias in unconstrained demand estimation.
- **FR-6.3:** The ML service (FastAPI) shall provide daily demand predictions across a configurable 7–30 day horizon (default 14 days) using an XGBoost Regressor model.
- **FR-6.4:** Multi-day predictions must recursively feed one-day-ahead predictions into rolling feature vectors, clamping negative predictions to zero for business recommendations.
- **FR-6.5:** The replenishment engine shall calculate:
  - `lead_time_demand = sum(forecast[1..L])`
  - `target_horizon_demand = sum(forecast[1..L+R])`
  - `safety_stock = quantile_95(positive_lead_time_errors)` (with fallback to rule-based safety stock days where backtest data is insufficient).
  - `reorder_point = lead_time_demand + safety_stock`
  - `recommended_quantity = ceil(max(0, target_stock - inventory_position))`
- **FR-6.6:** Fallback Protection: If the ML service is unreachable or a model artifact is unready, the system must seamlessly fall back to a 7/28-day moving-average calculation and clearly label the source as `moving_average_fallback`.
- **FR-6.7:** Human-in-the-Loop Mandate: Recommendations must never trigger automated supplier purchasing; a manager must explicitly review and approve a recommendation before generating a purchase order.

---

## 4. Non-Functional Requirements

### 4.1 Data Integrity & Concurrency
- **NFR-1.1:** All state changes involving stock levels must execute within SQL Server `TRANSACTION` blocks with appropriate concurrency isolation (e.g. `UPDLOCK`, `ROWLOCK` or optimistic rowversion checks).
- **NFR-1.2:** Database schema must strictly enforce foreign keys, check constraints, non-nullable required attributes, and unique constraints.

### 4.2 Security & Authentication
- **NFR-2.1:** Passwords must be hashed using `bcrypt` (work factor >= 10). Plaintext passwords must never be stored, logged, or transmitted in responses.
- **NFR-2.2:** User sessions must be secured with HTTP-only, secure, `SameSite=Lax` cookies. Sensitive tokens must not reside in browser `localStorage`.
- **NFR-2.3:** All SQL queries must use parameterized inputs to prevent SQL Injection vulnerabilities.
- **NFR-2.4:** Internal services (FastAPI ML service, SQL Server, Metabase internal DB) must reside within an isolated Docker network and not be exposed directly to the public internet.

### 4.3 Performance & Availability
- **NFR-3.1:** Typical operational API responses (sales creation, catalog queries, stock lookups) must complete within 200 ms under standard load.
- **NFR-3.2:** Analytical queries must be optimized with composite nonclustered indexes on transaction dates, SKU, and status codes.
- **NFR-3.3:** The Express backend must remain responsive even during heavy ML batch training or forecast generation.

### 4.4 Maintainability & Compliance
- **NFR-4.1:** Clean, layered architectural design: Controllers -> Services -> Repositories/Data Access.
- **NFR-4.2:** Detailed audit logging for high-value operations (user role edits, manual stock adjustments, purchase order authorizations).
