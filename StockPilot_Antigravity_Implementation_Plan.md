# StockPilot — Antigravity Implementation Plan

**Project title:** StockPilot: An Intelligent Inventory Management and Business Intelligence System for Small and Medium-Sized Businesses  
**Document purpose:** Implementation handoff and strict execution contract for Antigravity  
**Primary course alignment:** TPDS-III, Modules 1–4  
**Plan version:** 1.0  
**Execution rule:** Complete exactly one phase at a time. Do not begin the next phase until the current phase has passed every acceptance gate, been committed and pushed, and the user has explicitly approved continuation.

---

# PART A — INSTRUCTIONS TO THE IMPLEMENTATION AGENT

## 1. Your role

You are the lead software engineer implementing StockPilot. Work as a careful engineering agent, not as an autonomous code generator. Your responsibility is to build a reliable, testable, documented application in small verified increments.

You must follow this document as the project's implementation contract. Do not silently change the architecture, replace required course technologies, skip tests, fabricate test results, or claim a phase is complete when its acceptance criteria have not been met.

## 2. Non-negotiable execution rules

These rules override convenience and speed.

1. **Strict phase order:** Execute phases in numerical order: Phase 0, Phase 1, Phase 2, and so on. Never skip, combine, partially implement, or start a later phase early.
2. **One phase per approval:** At the start of a work session, inspect the repository and determine the last accepted phase. Work only on the next phase explicitly approved by the user. At the end of that phase, stop and request approval before proceeding.
3. **Phase 0 first:** On the first run, perform repository inspection and Phase 0 only. Do not start database implementation or application features in the first run.
4. **Acceptance gates are mandatory:** Every item under a phase's “Acceptance gate” must pass. A partially complete phase is not complete.
5. **Commit and push every phase:** A phase is not complete until its changes have been committed, the phase branch has been pushed, the integration branch has been updated and pushed, and the phase completion tag has been pushed. If the remote is unavailable or push fails, report the phase as BLOCKED—not complete.
6. **No false claims:** Report only commands actually run and results actually observed. Never invent test results, metrics, deployed URLs, screenshots, commits, or push confirmations.
7. **No destructive Git operations:** Never use `git push --force`, `git reset --hard`, `git clean -fd`, history rewriting, or overwrite another person's work. Never amend a published commit. Resolve conflicts conservatively and stop for user input if ownership or intent is unclear.
8. **Preserve existing work:** Before changing anything, inspect the current repository, branch, working tree, remotes, and existing files. Do not replace an existing project or delete files just because a generated structure would be easier.
9. **No secrets in source control:** Never commit `.env`, passwords, API keys, access tokens, certificates, private keys, production data, or database backups. Commit only `.env.example` with placeholder values.
10. **Do not over-engineer:** Build the required working system first. Do not add Kubernetes, microservices beyond the specified ML service, Redis, Kafka, paid APIs, LLMs, mobile applications, or unrelated frameworks unless the user explicitly approves a change request.
11. **Course technology priority:** Use the technologies named in the TPDS-III syllabus as the primary implementation stack. Additional technologies are allowed only where needed for ML, testing, security, or deployment, and their purpose must be documented.
12. **Document each phase:** Update the relevant documentation and create a phase report with changed files, commands, test outcomes, commit SHA, push result, known limitations, and remaining risks.
13. **Keep the project runnable:** At the end of each phase, the repository must remain in a coherent state. Do not leave the default branch or integration branch broken.
14. **No fabricated AI claims:** Do not call a rule-based calculation “AI”. Do not claim the ML model is accurate or better than a baseline until measured evaluation results support that statement.
15. **Manager approval is required:** Forecasts may create recommendations, but the system must never automatically place a real supplier order or execute a purchase without an authorized manager's explicit approval.

## 3. Required Git workflow

Use the following branch model unless the repository already has a documented, actively used branch strategy. If it does, inspect it and propose a compatible approach before changing it.

- `main`: stable release branch. Do not develop features directly on it.
- `develop`: integration branch containing all accepted phases.
- `phase/NN-short-description`: temporary branch for the phase currently being implemented.

### Required procedure for every phase

1. Confirm the working tree is clean. If it is not clean, identify the changes and do not discard or overwrite them.
2. Update from the latest `develop` branch.
3. Create the phase branch from `develop`, for example `phase/01-database-schema`.
4. Implement only the current phase.
5. Run all required tests, validation scripts, linting, and build checks applicable to that phase.
6. Review `git diff` and `git status`. Check for secrets, generated files, unrelated edits, and accidental data files.
7. Update documentation and write `docs/phase-reports/phase-NN-report.md`.
8. Create at least one meaningful phase completion commit, for example:
   - `feat(phase-01): add SQL Server schema and seed data`
   - `feat(phase-04): implement transactional sales and purchasing`
9. Push the phase branch to `origin` and verify that the push succeeded.
10. Merge the phase branch into `develop` using a non-fast-forward merge. Do not force-push or rewrite history.
11. Run the phase's smoke tests again on the merged `develop` branch.
12. Push `develop` to `origin` and verify success.
13. Create an annotated tag, for example `phase-01-complete`, on the accepted `develop` commit and push the tag.
14. Verify the remote branch and tag exist. Record the exact commit SHA and tag in the phase report.
15. Stop. Summarize the completed phase and wait for the user's explicit instruction: `APPROVE PHASE NN` or `Proceed to Phase NN`.

If GitHub authentication, `origin`, branch permissions, or network access prevents the required push, do not claim completion. Keep local changes safe, report the exact blocker, and ask the user to resolve it. Do not move to the next phase while blocked.

## 4. Required phase completion report

At the end of each phase, provide a concise report in this structure and save the full report in the repository:

```text
PHASE NN — COMPLETE / BLOCKED

Scope delivered:
- ...

Files/modules changed:
- ...

Commands executed:
- ...

Tests and results:
- [PASS/FAIL] ...

Acceptance gate:
- [PASS/FAIL] each criterion

Git:
- Branch: phase/NN-...
- Phase commit: <SHA>
- Push: <confirmed/not confirmed>
- Develop merge commit: <SHA>
- Tag: phase-NN-complete
- Tag push: <confirmed/not confirmed>

Known limitations / risks:
- ...

Next phase (not started): Phase NN+1 — ...

Waiting for user approval before proceeding.
```

Do not start the next phase in the same run after producing this report.

---

# PART B — PRODUCT DEFINITION

## 5. Product overview

StockPilot is a web-based inventory operations and business intelligence platform for small and medium-sized retailers, wholesalers, and distributors.

It combines:

1. **Inventory operations:** Products, categories, stock levels, stock movements, suppliers, purchase orders, and sales.
2. **Business intelligence:** Revenue, gross profit, sales trends, inventory health, product performance, supplier performance, and operational KPIs.
3. **Demand forecasting:** A machine learning model estimates future product demand and helps calculate replenishment recommendations.

StockPilot must be useful even when the ML model is unavailable. The core inventory workflows and a deterministic rule-based reorder fallback must continue to work.

## 6. Users and roles

Implement role-based access control with these roles:

- **Admin:** Manage users, roles, products, categories, suppliers, business settings, and all reports.
- **Manager:** Manage inventory, sales, purchase orders, forecasts, and replenishment recommendations; approve or reject recommendations.
- **Staff:** Record sales and view permitted product/inventory information. Staff must not manage users or approve purchase orders.

Enforce permissions in the Express backend. Hiding a button in the frontend is not authorization.

## 7. Core product modules

### 7.1 Product and category management
- Create, list, view, update, and deactivate products.
- Maintain SKU, product name, category, supplier relationship, cost price, selling price, reorder settings, supplier lead time, and status.
- Prevent duplicate SKUs.
- Validate non-negative prices and valid category/supplier references.

### 7.2 Inventory management
- Show on-hand, reserved (if implemented), available, and on-order quantities.
- Maintain a stock movement ledger for every stock increase or decrease.
- Display low-stock and out-of-stock products.
- Never permit an ordinary sale to reduce available stock below zero.
- Do not update stock by directly editing a number without recording the corresponding stock movement.

### 7.3 Sales management
- Record a sale containing one or more sale items.
- Capture quantity, sale price, and the product cost at the time of sale (`unit_cost_at_sale`).
- Recalculate totals on the server; never trust totals sent by the browser.
- Deduct stock and record stock movements in the same SQL transaction.
- Reject the complete sale if any item lacks sufficient stock; do not partially commit a sale.

### 7.4 Supplier and purchasing management
- Maintain supplier contact information and typical lead time.
- Create purchase orders with one or more items.
- Support at least Draft, Submitted, Partially Received, Received, and Cancelled states.
- Receiving an order increases inventory only for the quantity actually received.
- Support partial receiving and prevent duplicate receipt processing.
- Record every receipt in the stock movement ledger.
- Only an authorized manager/admin can approve or submit a purchase order.

### 7.5 Business intelligence
Create dashboards in Metabase using the SQL Server business database:

1. **Executive Overview:** Revenue, order count, gross profit, inventory value, low-stock count.
2. **Sales Analytics:** Daily/monthly sales, category revenue, top products, and sales trends.
3. **Inventory Analytics:** Stock by category, stock valuation, fast/slow movers, stockout history, and inventory turnover where data supports it.
4. **Supplier Analytics:** Purchase value, supplier delivery performance, delayed orders, and recorded defects if defect tracking is implemented.
5. **Forecast Analytics:** Actual vs predicted demand, model evaluation metrics, forecast horizon and replenishment recommendations.

Do not fabricate KPIs. Document the SQL definition of each metric and make sure dashboard totals reconcile with the source tables.

### 7.6 Demand forecasting and replenishment
- Forecast product-level daily demand for a configurable horizon (default 14 days; allow 7–30 days).
- Use XGBoost regression as the primary ML candidate.
- Compare the model to simple time-series baselines.
- Use forecast error to estimate safety stock where sufficient backtest data exists.
- Calculate a reorder recommendation using forecast demand, lead time, review period, current inventory position, and outstanding purchase quantities.
- Display whether a recommendation came from ML or the rule-based fallback.
- Store forecast runs and recommendations for auditing.
- Do not automatically place real purchase orders.

---

# PART C — COURSE MAPPING AND TECHNOLOGY DECISIONS

## 8. TPDS-III module mapping

The implementation must visibly demonstrate the four syllabus modules.

| Syllabus module | Required application in StockPilot | Main technologies |
|---|---|---|
| **Module 1 — Dashboard designing** | Connect to data, create charts, map data, build and deploy interactive dashboards. | Metabase, SQL Server, SQL |
| **Module 2 — Front-end development** | Responsive web pages, screen/UI design, forms, dialogs, tables, navigation and reusable interface patterns. | HTML5, CSS3, Bootstrap 5, JavaScript |
| **Module 3 — Back-end development** | Web server, HTTP requests, SQL database, REST endpoints and business logic. | Node.js, Express.js, Microsoft SQL Server |
| **Module 4 — Git and deployment** | Version control, branches, push/pull, Dockerization and cloud deployment. | Git, GitHub, Docker, Docker Compose, Linux cloud VM |

The final report and PPT must include a table mapping each module to actual files, routes, dashboards, screenshots, and implementation evidence.

## 9. Technology stack — freeze this unless a change is approved

### Main application
- Frontend: HTML5, CSS3, Bootstrap 5, vanilla JavaScript.
- Main backend: Node.js LTS and Express.js.
- API style: REST over HTTP, JSON request/response bodies.
- Main business database: **Microsoft SQL Server only**.
- Node SQL connection: `mssql` package or another maintained SQL Server driver after compatibility is checked.
- Validation: a maintained request validation library (for example, Zod or express-validator); select one and use it consistently.
- Authentication: secure password hashing and server-enforced role authorization. Use secure, HTTP-only cookies or another documented secure session approach. Do not store plaintext passwords or long-lived tokens in browser local storage.

### Analytics
- Metabase for dashboards.
- Connect Metabase to the StockPilot SQL Server database with a dedicated read-only SQL Server login.
- Metabase's internal application database is separate from StockPilot business data. For local development, its embedded H2 option may be used with persistent storage. For a deployed/production-like setup, use PostgreSQL for Metabase metadata only if required by the chosen deployment. **Do not store StockPilot products, sales, inventory, or supplier records in PostgreSQL. Those remain in Microsoft SQL Server.** Metabase recommends PostgreSQL for its production application database and describes H2 as a local-demo default: https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database
- Metabase supports SQL Server as a connected data source: https://www.metabase.com/docs/latest/databases/connecting

### ML service
- Python 3.x in a separately containerized forecasting service.
- FastAPI for internal ML HTTP endpoints.
- Pandas and NumPy for preparation and feature engineering.
- XGBoost `XGBRegressor` as the main supervised regression model.
- Scikit-learn for preprocessing and time-aware evaluation utilities.
- `pyodbc` plus Microsoft ODBC Driver 18, or Microsoft's maintained `mssql-python` driver after verifying deployment compatibility, for read access to SQL Server.
- `joblib` only where needed to persist preprocessing objects; save the XGBoost booster in its native JSON format as well.

The main product backend remains Node.js/Express. FastAPI is a narrowly scoped supporting service for ML only; it must not replace Express as the application's primary backend.

### Infrastructure and quality
- Git and GitHub.
- Docker and Docker Compose.
- Linux cloud VM for deployment.
- Postman or an equivalent HTTP client for API verification.
- Node test runner plus Supertest (or a consistent maintained test stack) for backend tests.
- Pytest for ML service tests.
- Browser-based responsive testing for frontend workflows.

### Version policy
Do not blindly install `latest` tags. Before implementation, check the currently supported stable versions and compatibility of Node.js, SQL Server, Metabase, Python, XGBoost, Docker images, and database drivers. Pin versions in package manifests, Python dependency files, and Docker images. Record selected versions and the date they were checked in `docs/technical-decisions.md`.

### SQL Server container platform warning
Microsoft documents SQL Server Linux container support for Intel/AMD x86-64 Linux hosts and warns that emulation/translation environments are not tested or supported. Verify the host architecture before choosing the SQL Server container route. If the developer machine is ARM-based or cannot run the supported SQL Server image, use a supported SQL Server installation/remote SQL Server instance; **do not silently replace SQL Server with PostgreSQL or SQLite**. Reference: https://learn.microsoft.com/en-us/sql/linux/install-upgrade/setup

---

# PART D — DATA AND BUSINESS LOGIC SPECIFICATION

## 10. Core relational data model

Design and document a normalized SQL Server schema. The exact columns can be refined during Phase 1, but the following entities and relationships are required.

| Entity | Purpose / important fields |
|---|---|
| `Users` | User ID, full name, email, password hash, role, active status, timestamps. |
| `Categories` | Category ID, category name, description, active status. |
| `Suppliers` | Supplier ID, name, contact fields, address, default lead time, active status. |
| `Products` | Product ID, SKU, name, category ID, preferred supplier ID, cost price, selling price, lead time, reorder configuration, active status. |
| `Inventory` | Product ID, on-hand quantity, reserved quantity if reservation is supported, row version or concurrency token, updated timestamp. |
| `Sales` | Sale ID, user ID, sale timestamp, status, subtotal, total and audit fields. |
| `SaleItems` | Sale item ID, sale ID, product ID, quantity, unit selling price, unit cost at sale. |
| `PurchaseOrders` | Purchase order ID, supplier ID, creator/approver, dates, status, totals and receipt state. |
| `PurchaseOrderItems` | PO item ID, PO ID, product ID, ordered quantity, received quantity, unit cost. |
| `StockMovements` | Movement ID, product ID, movement type, quantity delta, reference type/ID, actor, timestamp, notes. |
| `DailyProductDemand` | Product ID, business date, units sold, selling price, promotion flag, stockout-day flag and data source. Used for demand forecasting. |
| `ForecastRuns` | Run ID, model version, created timestamp, training data window, forecast horizon, evaluation metadata and status. |
| `DemandForecasts` | Forecast run ID, product ID, forecast date, predicted units, lower/upper interval if implemented. |
| `ReplenishmentRecommendations` | Recommendation ID, product ID, run ID, inventory position, lead-time demand, safety stock, target stock, suggested quantity, source (ML/fallback), status, created timestamp. |
| `AuditLogs` | Actor, action, entity, entity ID, timestamp and safe before/after metadata for important actions. |

Required database rules:

- Primary keys and foreign keys on all relevant entities.
- Unique constraint on product SKU and user email.
- Check constraints for non-negative quantities/prices where appropriate.
- Decimal types for money; do not use floating-point types for currency.
- Appropriate indexes on SKU, foreign keys, transaction dates, product/date demand keys and order status.
- Use UTC timestamps internally and format dates for the user's local display.
- Use SQL Server transactions for sale posting, purchase receiving, and stock adjustments.
- Use parameterized SQL; never concatenate user input into SQL statements.
- Provide versioned/idempotent migration scripts. Do not rely on a developer manually creating tables without a reproducible script.

## 11. Inventory invariants

These are business-critical acceptance rules.

1. `available_quantity = on_hand_quantity - reserved_quantity` (if reservation is supported; otherwise reserved is always zero and this is documented).
2. `open_purchase_quantity` is the unreceived quantity on submitted/approved/partially received purchase orders. Draft and cancelled orders do not count as incoming stock.
3. `inventory_position = on_hand_quantity - reserved_quantity + open_purchase_quantity`.
4. A sale may be posted only if available stock covers every requested line item.
5. Sale header, sale items, inventory deduction, and stock movement records must commit in a single transaction.
6. A purchase receipt may increase stock only by the newly received quantity. Replaying the same receipt request must not add the stock twice.
7. A purchase order can be partially received. Received quantity cannot exceed ordered quantity.
8. Every stock quantity change must have a corresponding stock movement row.
9. A sale cancellation/return must use an explicit reversal/return movement; never delete historical stock movement rows.
10. Inventory updates must handle concurrent sales safely using transactions and suitable locking/concurrency control.

## 12. Demand data requirements and data quality

The forecasting target is **daily product demand**, represented by units sold per product per business date when the item was available.

- Build a reproducible synthetic dataset covering approximately 18 months for a modest catalogue (for example, 30–50 SKUs) to support a credible prototype. Use a fixed random seed.
- Synthetic history should include realistic weekday patterns, trend, category differences, occasional promotions, price changes and seasonal variation. Do not make every product's data a simple copy of another product's data.
- Clearly label generated records as synthetic in the application, documentation, report, and presentation.
- A missing product/date row must not automatically be interpreted as zero demand. Only create zero-demand rows when the business was open and the product was available for sale.
- Sales during a stockout period understate unconstrained demand. Mark stockout-affected product-days and exclude them from supervised model training/evaluation unless a documented correction method is implemented.
- Validate gaps, duplicates, negative sales, invalid prices, impossible timestamps and extreme outliers before training.
- Keep raw source facts separate from derived features. Recompute features from source data rather than storing stale rolling averages as truth.

---

# PART E — MACHINE LEARNING DESIGN

## 13. Model decision

Use **XGBoost Regressor (`XGBRegressor`)** as the primary candidate for product-level daily demand forecasting.

Why this is selected:
- The initial data is structured tabular business data.
- Calendar, price, promotion, product, lag and rolling-window features can be represented as tabular predictors.
- One pooled model can learn shared patterns across products while using product/category features.
- It is easier to train, explain and evaluate within this project's scope than a deep learning sequence model.

Do not assume XGBoost will always outperform a baseline. The model must earn deployment through chronological evaluation. XGBoost's scikit-learn estimator interface is documented here: https://xgboost.readthedocs.io/en/stable/python/python_api.html

## 14. Forecasting formulation

Create a supervised learning table with one row per product and date.

Suggested input features:

- Product/category identifier features (encoded consistently; fit encoders only on training data).
- Day of week, day of month, month, week of year, weekend flag.
- Known promotion flag and known selling price for the forecast date, when available.
- Lagged demand: `lag_1`, `lag_7`, `lag_14`, and optionally `lag_28`.
- Rolling demand statistics: prior 7-day and 28-day means and standard deviations.
- Optional trend features if they are generated using information available at prediction time only.

Target:
- `units_sold` for that product/date, excluding stockout-censored days from training/evaluation.

Feature engineering rules:
- Sort each product's rows by date before computing lags/rolling statistics.
- Shift target values before calculating rolling features. A row for date D must never include sales from date D or any future date in its features.
- Avoid target leakage from future prices, promotions, stock movements, or aggregates.
- Fit encoders/preprocessors on the training set only and persist them with the model.
- Use a consistent product/category unknown-value strategy for new products.

## 15. Forecast strategy

Start with a one-day-ahead global model and generate a multi-day forecast recursively:

1. Build the feature row for the next date using observed historical values.
2. Predict demand for that product/date.
3. Clamp negative predictions to zero for business use, while keeping the raw prediction available for diagnostics.
4. Add the prediction to the temporary history used to build the next day's lag/rolling features.
5. Repeat for each date in the selected forecast horizon (default 14 days, configurable 7–30 days).

If the recursive strategy proves unstable in tests, document the issue and compare a direct multi-horizon strategy before changing the design. Do not silently change the target definition.

## 16. Baselines and evaluation

Compare at least these methods:

1. **7-day moving-average baseline** or seasonal-naive baseline (same weekday from the previous week).
2. **28-day moving-average baseline**.
3. **XGBoost Regressor**.

Use chronological train/validation/test windows. Never randomly shuffle time-series rows. Prefer rolling-origin evaluation or time-aware splits across unique dates so that every training date precedes its validation/test dates. Scikit-learn explains why ordinary shuffled cross-validation is inappropriate for time-series observations and documents `TimeSeriesSplit`: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html

Report at minimum:
- MAE (units per product-day).
- RMSE (units per product-day).
- WAPE, with an explicit zero-denominator policy.
- Results overall and, where sample size permits, by category/product group.
- Test date range, training date range, data row counts, products included and excluded, and stockout-day handling.

ML acceptance rule:
- Do not claim the model is better merely because it trained successfully.
- XGBoost may be selected as the preferred model only if chronological held-out results are at least competitive with the strongest baseline on the agreed primary metric (WAPE) and do not materially worsen MAE/RMSE. If it does not meet this gate, keep the baseline as the active recommendation engine, show the XGBoost result transparently as experimental, and document the limitation. Do not falsify or tune against the test set.

## 17. Safety stock and replenishment formula

Keep demand forecasting and replenishment policy as separate, testable components.

Let:
- `L` = supplier lead time in days.
- `R` = review period in days (initial default: 7).
- `forecast[d]` = predicted product demand on future day d.
- `inventory_position` = on-hand − reserved + unreceived quantity on open purchase orders.

Calculate forecast lead-time demand:

`lead_time_demand = sum(forecast[1..L])`

Calculate target horizon demand:

`target_horizon_demand = sum(forecast[1..L+R])`

Calculate safety stock using chronological backtest errors where sufficient samples exist:

- For each historical backtest origin, calculate predicted cumulative lead-time demand and actual cumulative lead-time demand.
- Calculate positive under-forecast error: `actual_lead_time_demand - predicted_lead_time_demand`.
- Safety stock = a selected service-level quantile (initially 95th percentile) of positive lead-time errors, not an arbitrary hard-coded constant.
- If there is insufficient backtest history for a product, use a clearly documented category-level fallback or a configurable rule-based safety-stock-days fallback. Show which fallback was used.

Then:

`reorder_point = lead_time_demand + safety_stock`

`target_stock = target_horizon_demand + safety_stock`

`recommended_quantity = ceil(max(0, target_stock - inventory_position))`

A recommendation is triggered when inventory position is at or below the reorder point, or when another documented risk rule applies.

Rules:
- Respect supplier minimum order quantity or pack size only if those fields are implemented and validated.
- Do not recommend negative quantities.
- Do not include draft/cancelled purchase orders in inventory position.
- Persist the formula inputs and model/run identifier with each recommendation so that the suggestion is explainable.
- The manager must approve the recommendation before a purchase order is created/submitted.

## 18. ML service contract

Expose the following internal FastAPI endpoints:

- `GET /health` — service and model readiness.
- `GET /model/info` — model version, training timestamp, data window, features and evaluation metrics.
- `POST /forecast/run` — request forecast generation for selected products/horizon; validate requested horizon.
- `GET /forecast/runs/{run_id}` — status and metadata for a run.
- `GET /forecast/runs/{run_id}/products/{product_id}` — forecast values for a product.

Keep training as an internal CLI command or controlled admin operation, not an unauthenticated public endpoint. Validate all request inputs. The ML service must not be exposed directly to the public internet; Express should call it over the private Docker network.

The service should read the required sales/demand data from SQL Server using a dedicated least-privilege database account. It may write forecast results only to the designated forecasting tables or return them to Express for persistence. Document the exact ownership of writes and avoid duplicate write paths.

Fallback behavior:
- If model artifact is missing, stale, incompatible or fails to load, mark ML unavailable and use the deterministic fallback.
- If a product has insufficient history or unseen category/product encoding, use a documented baseline fallback.
- Every forecast response must include `forecast_source` (`xgboost`, `moving_average_fallback`, or another explicit value), model version if applicable, and fallback reason if applicable.

---

# PART F — PHASED IMPLEMENTATION PLAN

## 19. Phase 0 — Repository inspection, project charter and architecture freeze

**Goal:** Establish a safe repository baseline and freeze the architecture before application coding begins.

### Tasks
- Inspect repository root, current code, branch, Git status, remotes, existing README, and existing development conventions.
- Identify any user-created files and preserve them.
- Confirm GitHub remote and authentication are configured. If not, stop and ask the user to configure/provide the remote; do not invent a URL.
- Establish `main`/`develop`/phase branch strategy where compatible with the repository.
- Create/update project charter and scope.
- Create the TPDS-III four-module mapping table.
- Document system architecture and component responsibilities.
- Create initial ER diagram draft and data dictionary draft.
- Write technical decisions and version-check policy.
- Add `.gitignore` and `.env.example` only if needed; ensure `.env` is ignored.
- Create `docs/phase-reports/` and this plan in the repository if the user has provided the plan file to Antigravity.

### Deliverables
- `README.md` project overview (no claims of implemented features).
- `docs/requirements.md` functional/non-functional requirements.
- `docs/module-mapping.md` syllabus mapping.
- `docs/architecture.md` architecture and data flow.
- `docs/technical-decisions.md` technology decisions and compatibility notes.
- `docs/data-dictionary.md` initial entity definitions.
- `docs/phase-reports/phase-00-report.md`.

### Acceptance gate
- Repository was inspected and existing work preserved.
- Git remote is present and push authentication is verified, or phase is explicitly BLOCKED.
- Project scope and technology stack are documented.
- Four syllabus modules are mapped to real application deliverables.
- Architecture and initial ER diagram are reviewed for consistency.
- No application implementation for later phases has been started.
- All Phase 0 docs pass Markdown/link/path sanity checks.
- Required phase branch commit, push, merge, develop push and tag are completed.

**STOP after Phase 0. Wait for explicit approval.**

## 20. Phase 1 — SQL Server schema, migrations and reproducible seed data

**Goal:** Build the complete relational database foundation.

### Tasks
- Select and pin the SQL Server version after host/platform compatibility check.
- Create database `StockPilotDB`.
- Implement versioned migration scripts for the core entities in Part D.
- Implement foreign keys, unique constraints, checks, indexes and sensible defaults.
- Create a `vw_ProductDailyDemand` or documented equivalent for daily demand extraction where appropriate.
- Create seed scripts for users, roles, categories, suppliers, products and a small set of opening inventory records.
- Ensure seed scripts can be rerun safely or clearly document one-time behavior.
- Use deterministic synthetic seed data only for initial catalogue/transactions; the longer historical demand dataset is prepared in the ML phase.
- Create a database setup guide and a schema/ER diagram from the actual schema.

### Acceptance gate
- Fresh database can be built from scripts without manual undocumented steps.
- Migrations are ordered, repeatable/idempotent where intended, and versioned.
- All expected tables, constraints, foreign keys and indexes exist.
- Seed data loads and can be queried.
- Invalid foreign keys, duplicate SKU/email and negative quantity/price cases are rejected by database or application boundary as appropriate.
- SQL tests verify all key relationships.
- ER diagram matches the implemented schema.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 1. Wait for explicit approval.**

## 21. Phase 2 — Express backend foundation, database access and authentication

**Goal:** Establish a secure and testable primary application backend.

### Tasks
- Initialize Node.js LTS project and pin dependencies.
- Configure Express application structure: routes, controllers, services, repositories/data access, middleware, config and tests.
- Configure environment-based SQL Server connection pool.
- Implement `/api/health` and database readiness checks.
- Implement centralized error handling and request validation.
- Implement authentication, password hashing, session/token handling and logout.
- Implement server-side role authorization for Admin, Manager and Staff.
- Add request logging that does not leak passwords, tokens or sensitive data.
- Add API documentation (OpenAPI or a maintained API specification file).
- Add automated tests for authentication, authorization, configuration errors and database connection behavior.

### Acceptance gate
- Backend starts from documented commands.
- Health endpoint reports app status and database readiness accurately.
- SQL connections use parameterized queries and a connection pool.
- Passwords are hashed; no plaintext password is stored or logged.
- Unauthenticated requests are rejected where required.
- Staff cannot access manager/admin operations by calling the API directly.
- Invalid payloads produce consistent 4xx responses; unexpected errors do not expose stack traces/secrets.
- Automated tests pass.
- `.env` and credentials are not committed.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 2. Wait for explicit approval.**

## 22. Phase 3 — Bootstrap frontend shell and core catalog screens

**Goal:** Build the responsive UI and connect it to the backend's basic APIs.

### Tasks
- Build a consistent Bootstrap 5 application shell with responsive navigation and layout.
- Implement login/logout UI and role-aware navigation.
- Implement product list, product details, add/edit product forms and category management.
- Implement supplier list and supplier create/edit/detail screens.
- Implement loading, empty, validation, success and error states.
- Use JavaScript Fetch API for backend calls; do not hardcode mock data into production pages.
- Ensure forms submit validated structured data and display server-side validation errors.
- Check mobile, tablet and desktop layouts.

### Acceptance gate
- All listed screens work against the real backend/API and SQL Server.
- Product and supplier CRUD operations persist after page reload.
- Duplicate SKU, invalid price, missing fields and invalid references show understandable errors.
- UI is usable at common mobile, tablet and desktop widths.
- Navigation and controls work; no decorative/inert buttons remain.
- No secrets or SQL credentials are exposed to browser code.
- Browser smoke tests and relevant frontend checks pass.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 3. Wait for explicit approval.**

## 23. Phase 4 — Inventory ledger, sales and purchase order workflows

**Goal:** Implement the core business operations with correct transactional stock behavior.

### Tasks
- Implement inventory view and stock movement history.
- Implement sales creation, line items, totals, server-side pricing rules and receipt/confirmation view.
- Capture `unit_cost_at_sale` to support historical gross profit calculations.
- Implement atomic SQL transaction for sale header, items, inventory deductions and stock movement records.
- Implement purchase order creation, submission/approval, partial receiving, complete receiving and cancellation.
- Implement atomic receiving transaction for PO status/received quantities, inventory additions and movement records.
- Implement low-stock rules and basic moving-average/rule-based reorder fallback.
- Add audit logs for important inventory and purchase approval actions.
- Implement concurrency and duplicate-submit/idempotency protections where needed.

### Acceptance gate
- A sale reduces inventory and creates stock movements atomically.
- A sale with insufficient stock is rejected without partial writes.
- Two concurrent sales cannot oversell stock.
- Receiving a PO increases stock by only the newly received quantity.
- Partial receiving works and cannot exceed ordered quantity.
- Repeated receipt requests do not duplicate stock.
- Draft/cancelled POs are not counted as on-order inventory.
- Stock changes are traceable to movement records.
- Rule-based recommendation works without the ML service.
- Integration tests cover normal, invalid and boundary cases.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 4. Wait for explicit approval.**

## 24. Phase 5 — Metabase and SQL Server business intelligence dashboards

**Goal:** Demonstrate TPDS-III Module 1 using the actual StockPilot business data.

### Tasks
- Create a dedicated read-only SQL Server account for Metabase.
- Connect Metabase to `StockPilotDB` using the supported SQL Server connector.
- Do not give Metabase write access to operational tables.
- Create saved questions/SQL queries for the executive, sales, inventory and supplier KPIs.
- Build dashboards with relevant charts, date filters, product/category filters and readable labels.
- Document KPI definitions and calculation queries.
- Validate dashboards against independent SQL aggregation queries.
- Embed or link dashboards in the StockPilot UI using a documented, secure approach. Do not expose admin credentials or unrestricted public dashboards.
- Keep Metabase application metadata separate from StockPilot business data.

### Acceptance gate
- Metabase connects to the SQL Server business database successfully.
- Dedicated BI account is read-only and least-privileged.
- Required dashboards and filters work.
- Dashboard numbers reconcile with independent SQL queries for selected test periods.
- No metric is displayed without a documented definition.
- Metabase access is restricted appropriately; no secrets are exposed in frontend source.
- Dashboard screenshots and setup instructions are saved for final submission.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 5. Wait for explicit approval.**

## 25. Phase 6 — ML dataset engineering, baseline models and XGBoost training

**Goal:** Build and evaluate the demand forecasting model offline before integrating it into the live workflow.

### Tasks
- Generate or load approximately 18 months of deterministic synthetic daily demand for the sample product catalogue. Clearly label it synthetic.
- Create data validation and feature engineering pipeline.
- Exclude stockout-censored product-days from model training/evaluation unless a documented correction is implemented.
- Build 7-day and 28-day moving-average/seasonal-naive baselines.
- Train a pooled XGBoost Regressor using product/category, calendar, price/promotion and lag/rolling features.
- Ensure rolling features use shifted historical values only.
- Use chronological holdout and rolling-origin validation; never random-shuffle time series.
- Evaluate MAE, RMSE and WAPE overall and by product/category where sample counts allow.
- Save the model in a versioned artifacts directory; record training date, data range, feature list, preprocessing version, code commit and metrics.
- Provide a deterministic training CLI command and a reproducible evaluation report.
- Add fallback logic for insufficient history, new products, missing model artifact or model load error.

### Acceptance gate
- Synthetic data generator is deterministic with a fixed seed and its generated nature is disclosed.
- Dataset validation catches duplicates, gaps, invalid values and stockout-day records.
- Feature engineering tests prove no current-day/future target leakage.
- Baselines and XGBoost are evaluated on chronological future data.
- Metrics are generated from actual test predictions, not manually entered.
- Model artifact can be loaded in a clean process and produces deterministic-shape predictions.
- Selection of XGBoost vs baseline follows the model acceptance rule in Part E. If XGBoost does not outperform/compete, the system must retain the baseline as active and disclose this.
- No unsupported claim of model accuracy or business savings is made.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 6. Wait for explicit approval.**

## 26. Phase 7 — FastAPI ML service and replenishment recommendation integration

**Goal:** Connect the tested model to StockPilot while keeping the core application safe if ML is unavailable.

### Tasks
- Build a separate FastAPI service with internal health, model info, forecast run and forecast retrieval endpoints.
- Load the model artifact and preprocessing pipeline on service startup; report not-ready if artifacts are missing/incompatible.
- Connect the ML service to SQL Server with a least-privilege account.
- Implement forecast generation for a configurable 7–30 day horizon (default 14).
- Persist forecast runs and daily product predictions in SQL Server.
- Implement replenishment logic separately from model prediction.
- Calculate inventory position, forecast lead-time demand, target stock, safety stock and recommended quantity using the formulas in Part E.
- Provide category-level or rule-based safety-stock fallback when per-product backtest history is insufficient.
- Add internal Express-to-FastAPI integration with timeouts, validation and graceful failure handling.
- Add manager-facing forecast/recommendation screens with forecast source, horizon, model version, assumptions, suggested quantity and approve/reject actions.
- Only on manager approval may a recommendation create a purchase order; no automatic real order placement.

### Acceptance gate
- ML service health and readiness are observable.
- Forecast output is stored and linked to a forecast run/model version.
- Prediction horizon validation rejects invalid values.
- Forecasts never contain negative business demand values.
- Replenishment quantities match independently calculated test cases.
- Inventory position counts only eligible open purchase quantities.
- ML outage/model failure/insufficient history triggers a visible fallback, not application failure.
- Manager approval is required to create a purchase order.
- API integration and business logic tests pass.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 7. Wait for explicit approval.**

## 27. Phase 8 — Dockerization and complete local environment

**Goal:** Make the full application reproducible using Docker Compose.

### Tasks
- Create a Dockerfile for the Express application.
- Create a Dockerfile for the FastAPI ML service.
- Create Compose services for the application, SQL Server, ML service, and Metabase.
- Add a persistent volume for SQL Server data and required persistent storage for Metabase application metadata.
- If production-like Metabase persistence is required, add PostgreSQL only for Metabase's own application metadata; keep business data in SQL Server. Label this clearly in architecture documentation.
- Add health checks and readiness handling; do not rely only on container startup order.
- Configure private container networking and avoid exposing SQL Server or ML service publicly.
- Use `.env` for local secrets and `.env.example` for safe placeholders.
- Add startup, migration, seed, backup and shutdown documentation.
- Pin image versions and set resource guidance for local development.

### Acceptance gate
- A clean developer environment can follow the README and start the required services using Docker Compose.
- Containers become healthy in the required dependency order.
- SQL Server data survives container recreation through persistent storage.
- The app, SQL Server, ML service and Metabase can communicate over the private network.
- SQL Server is not publicly exposed in the deployment configuration.
- No credentials are hardcoded in Dockerfiles, committed Compose files or frontend bundles.
- `docker compose config` and service health checks pass.
- Phase commit, push, merge to develop, develop push and tag are verified.

**STOP after Phase 8. Wait for explicit approval.**

## 28. Phase 9 — End-to-end QA, security review and final submission package

**Goal:** Verify the complete application and prepare the academic deliverables.

### Tasks
- Execute end-to-end workflows: login, create product, record sale, verify stock movement, create purchase order, receive stock, run forecast, approve recommendation and verify dashboards.
- Test invalid inputs, boundary values, unauthorized access, insufficient stock, duplicate receipt, partial receipt and model-unavailable fallback.
- Reconcile Metabase metrics with SQL queries.
- Review password hashing, authorization, parameterized SQL, input validation, error handling, secret management, CORS/cookie settings and container exposure.
- Check responsive UI on desktop, tablet and mobile sizes.
- Check accessible labels, clear errors, empty states and loading states.
- Document known limitations and future work honestly.
- Prepare user setup guide, architecture, ER diagram, data dictionary, API documentation, ML methodology, evaluation results and test report.
- Prepare the required short PPT with exactly the 9-slide structure in Part G.
- Prepare the four-module mapping evidence table.
- Capture genuine screenshots from the running application and dashboards.
- Prepare final demo script and individual team contribution notes if team member details are provided.

### Acceptance gate
- All critical end-to-end workflows pass.
- All required invalid and boundary tests pass or have documented, non-blocking known limitations approved by the user.
- No critical security issue remains unresolved.
- Dashboard numbers reconcile with SQL.
- ML report includes actual chronological evaluation and baseline comparison.
- Synthetic data and limitations are disclosed.
- README setup instructions work from a clean environment.
- 9-slide PPT, report, module mapping table, screenshots and demo instructions are present.
- Final release is merged to `main` only after the user approves the release.
- Final release commit/tag is pushed and verified.

**STOP and present the final handover. Do not claim production readiness; describe the tested project scope and any remaining limitations accurately.**

---

# PART G — FINAL ACADEMIC DELIVERABLES

## 29. Required submission package

The TPDS-III project guidelines require a short PPT, a four-module mapping table, a final report, and a working demonstration. Prepare all four.

Suggested repository submission folder:

```text
submission/
├── StockPilot_Project_Presentation.pptx
├── StockPilot_Final_Report.pdf
├── Four_Module_Mapping.xlsx        # or PDF/table in the report if preferred by faculty
├── Demo_Script.md
├── Screenshots/
│   ├── login.png
│   ├── inventory.png
│   ├── sales.png
│   ├── purchase-orders.png
│   ├── executive-dashboard.png
│   └── demand-forecast.png
└── Test_Evidence/
    ├── api-test-results.md
    ├── database-test-results.md
    └── ml-evaluation.md
```

Do not create fake screenshots or screenshots of unfinished features. Use actual screenshots from the final running build.

## 30. Required 9-slide PPT structure

Follow the faculty's specified order:

1. **Project Title:** StockPilot name, team members, roll numbers, subject and guide.
2. **Problem Statement:** Inventory/business problem, intended users and why it matters.
3. **Objectives and Scope:** Objectives, expected outcomes, included/excluded boundaries.
4. **Existing Solutions:** Current approaches and limitations; proposed improvement.
5. **Proposed System:** Overall architecture/workflow showing all four modules.
6. **Implementation and Demonstration:** Technologies, actual screenshots and short working demo.
7. **Testing and Results:** Test cases, measured outcomes, model evaluation and objective achievement.
8. **Application of Project:** How retailers, wholesalers or distributors could use the platform.
9. **Conclusion and Future Scope:** Achievements, limitations, future improvements and references.

## 31. Four-module evidence table

The final report must contain a concrete mapping, not just a list of technology names.

| Module | Concept from syllabus | Implemented component | Evidence to include |
|---|---|---|---|
| 1 | Open-source dashboard tool, data connection, chart creation, mapping, deployment | Metabase dashboards connected to SQL Server | Dashboard screenshot, saved question/SQL definition, connection setup and reconciliation test |
| 2 | Responsive interface, UI controls/dialogs, Bootstrap | Login, product, inventory, sales, supplier and PO screens | Responsive screenshots, UI flow and form/modal validation tests |
| 3 | Web server, HTTP requests, SQL database, Node.js and Express.js | Express REST API with SQL Server persistence and transactional workflows | API endpoint table, request/response examples, schema/ERD and integration tests |
| 4 | Git, push/pull, Dockerization and cloud deployment | GitHub phase history, Dockerfiles, Compose deployment and cloud VM | Commit/branch history, Compose config, deployment evidence and live demo |

Add a short explanation of the supporting ML service as an enhancement. Do not imply that Python/FastAPI/XGBoost are required by the four course modules; the principal Module 3 application backend remains Node.js/Express and SQL Server.

---

# PART H — GLOBAL QUALITY GATES

## 32. Definition of done for any feature

A feature is not done merely because a screen or endpoint exists. It is done only when:

- The intended behavior is documented.
- The backend validates input and enforces authorization.
- SQL changes preserve database constraints and transaction invariants.
- Success, empty, loading and error states are handled in the UI where relevant.
- Automated or reproducible manual tests cover normal, invalid and boundary cases.
- Relevant documentation is updated.
- No secrets, test credentials or personal data are committed.
- The feature works with the preceding accepted phases.

## 33. Global coding standards

- Prefer readable, modular, maintainable code over clever abstractions.
- Keep routes/controllers thin; place business rules in services.
- Keep SQL access in repository/data-access modules, not scattered across frontend or route files.
- Use parameterized queries.
- Use consistent naming and formatting.
- Validate all external input at API boundaries.
- Return consistent JSON error structures and appropriate HTTP status codes.
- Do not expose SQL errors, stack traces, credentials or internal paths to end users.
- Keep dependencies minimal and explain each non-obvious dependency.
- Do not add decorative UI controls that do nothing.
- Avoid hardcoded sample records in live screens; use database seed scripts for demo data.
- Do not use real customer or business personal data without explicit authorization.

## 34. Global test expectations

Cover at least:

- Valid login and invalid login.
- Role permissions for Admin, Manager and Staff.
- Create/update/deactivate product.
- Duplicate SKU and invalid price.
- Sale with sufficient stock.
- Sale with insufficient stock.
- Multi-item sale where one line fails (entire transaction must roll back).
- Concurrent sales attempting to consume the same limited stock.
- Purchase order creation, partial receipt, full receipt and cancellation.
- Duplicate receipt request.
- Inventory position with and without open purchase orders.
- Forecast with adequate history.
- Forecast with insufficient history.
- Model unavailable fallback.
- ML output with negative raw predictions (business output must clamp appropriately).
- Forecast horizon minimum/maximum and invalid values.
- Manager approval and unauthorized purchase order approval.
- Dashboard reconciliation against independent SQL queries.
- Database persistence after container restart.

## 35. Explicit non-goals for the initial release

Do not implement these unless the user later approves a scope change:

- Automatic live purchasing or supplier API integration.
- Payment gateway integration.
- Barcode scanner or physical POS hardware integration.
- Multi-warehouse transfers.
- Mobile native app.
- LLM chatbot or generative AI features.
- Deep learning sequence models such as LSTM.
- Kubernetes or complex cloud-native orchestration.
- Real-time IoT sensors.
- Multi-tenant SaaS billing/subscription infrastructure.

These can be listed as future scope, not as implemented features.

---

# PART I — FIRST ACTION REQUIRED FROM ANTIGRAVITY

## 36. Start instruction

**Begin with Phase 0 only.**

Your first response/action must:

1. Inspect the repository and Git state.
2. Identify existing files and preserve them.
3. Confirm the remote and push access.
4. Report any blockers before editing.
5. Complete only the Phase 0 project charter/architecture documentation.
6. Run the Phase 0 checks.
7. Commit and push Phase 0 using the required Git workflow.
8. Produce the Phase 0 report.
9. Stop and wait for explicit user approval.

Do not implement SQL tables, backend APIs, frontend pages, dashboards, ML training, Docker services, or later-phase features during Phase 0.

If you need a product or architecture decision not covered here, make the smallest reasonable assumption, record it in `docs/technical-decisions.md`, and ask the user before making a decision that changes the approved stack, scope, data model, security model, or deployment architecture.

**The project advances only when the current phase is fully accepted, committed, pushed, merged into `develop`, tagged, and explicitly approved by the user.**

---

# REFERENCE DOCUMENTATION

Use these official references to verify current behavior and compatibility. Do not copy obsolete version numbers from examples; check current stable releases before pinning.

- Metabase application database configuration: https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database
- Metabase supported database connections (includes SQL Server): https://www.metabase.com/docs/latest/databases/connecting
- Metabase Docker deployment: https://www.metabase.com/docs/latest/installation-and-operation/running-metabase-on-docker
- Microsoft SQL Server Linux installation/platform requirements: https://learn.microsoft.com/en-us/sql/linux/install-upgrade/setup
- Microsoft SQL Server Docker containers: https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment
- XGBoost Python API (`XGBRegressor`): https://xgboost.readthedocs.io/en/stable/python/python_api.html
- Scikit-learn `TimeSeriesSplit`: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
- Docker Compose: https://docs.docker.com/compose/
- Bootstrap documentation: https://getbootstrap.com/docs/5.3/
- Express documentation: https://expressjs.com/en/guide/

