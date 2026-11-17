# StockPilot — TPDS-III Course Syllabus Mapping

**Document Version:** 1.0  
**Phase:** Phase 0 (Baseline Freeze)  
**Academic Program:** TPDS-III  
**Purpose:** Formal academic mapping of course syllabus modules to concrete architectural deliverables, codebase structures, and verification evidence.

---

## 1. Syllabus Overview & Architecture Alignment

StockPilot is structured specifically to provide clear, verifiable, and non-trivial demonstration of all four core modules of the **TPDS-III** curriculum. 

```mermaid
flowchart TD
    subgraph M1["Module 1: Dashboard Designing"]
        direction TB
        M1_Tool["Metabase Open-Source BI Tool"]
        M1_Dash["5 Operational Dashboards:<br>• Executive Overview<br>• Sales Analytics<br>• Inventory Analytics<br>• Supplier Analytics<br>• Forecast Analytics"]
        M1_Conn["Direct Read-Only SQL Connection to SQL Server"]
        M1_Tool --> M1_Conn --> M1_Dash
    end

    subgraph M2["Module 2: Front-End Development"]
        direction TB
        M2_Core["HTML5 & CSS3 Layout"]
        M2_BS["Bootstrap 5 Component Framework"]
        M2_JS["Vanilla JavaScript (ES6+)<br>• Fetch API Client<br>• DOM Manipulation<br>• Modal & Form Validation"]
        M2_Core --> M2_BS --> M2_JS
    end

    subgraph M3["Module 3: Back-End Development"]
        direction TB
        M3_Runtime["Node.js LTS & Express.js"]
        M3_Arch["Layered Architecture:<br>Routes -> Middleware -> Services -> Repositories"]
        M3_DB["Microsoft SQL Server (Transact-SQL)<br>• ACID Transactions<br>• Stock Movement Ledger<br>• Parametric Security"]
        M3_Runtime --> M3_Arch --> M3_DB
    end

    subgraph M4["Module 4: Git and Deployment"]
        direction TB
        M4_VCS["Git & GitHub Flow<br>(main, develop, phase branches, tags)"]
        M4_Dock["Docker & Docker Compose Multi-Container Orchestration"]
        M4_Host["Linux Cloud Virtual Machine (x86_64)"]
        M4_VCS --> M4_Dock --> M4_Host
    end

    M2 -->|User Interface & REST API Calls| M3
    M3 -->|Transactional Read/Write| M3_DB
    M1_Conn -.->|Read-Only Aggregations| M3_DB
    M4 -.->|Packages, Versions & Deploys| M1
    M4 -.->|Packages, Versions & Deploys| M2
    M4 -.->|Packages, Versions & Deploys| M3
```

---

## 2. Four-Module Deliverables Mapping Table

| Syllabus Module | Syllabus Concepts & Requirements | StockPilot Concrete Deliverables | Codebase Paths / Target Artifacts | Verification Evidence |
|---|---|---|---|---|
| **Module 1:<br>Dashboard Designing** | • Connecting to relational data sources<br>• Creating visual charts, bars, lines, gauges<br>• Applying filters (date ranges, categories)<br>• Building interactive business dashboards<br>• Dashboard deployment and access control | **Metabase Business Intelligence Suite**<br>• Direct connection to `StockPilotDB` via dedicated read-only account<br>• Executive Overview Dashboard<br>• Sales Trend & Category Performance Dashboard<br>• Inventory Health & Aging Dashboard<br>• Supplier Fulfillment & Lead-Time Variance Dashboard<br>• Forecast Accuracy & Replenishment Pipeline Dashboard | `metabase/`<br>`docs/dashboards/`<br>`sql/bi-queries/`<br>`sql/bi-views/` | • Dashboard screenshots with active filters<br>• SQL source query files matching KPI totals<br>• Database reconciliation test scripts<br>• Live Metabase dashboard presentation |
| **Module 2:<br>Front-End Development** | • Responsive web design for mobile/tablet/desktop<br>• Modern HTML5 semantic structures<br>• CSS3 styling and grid layouts<br>• Bootstrap 5 components (navbars, cards, modals, alerts, tables)<br>• JavaScript DOM manipulation, event handling, and asynchronous API integration (Fetch API) | **Responsive Web Client Shell & Workflow Screens**<br>• Universal responsive navigation bar with RBAC-aware menu items<br>• Product catalog grid with search, filter, and modal edit dialogs<br>• Point-of-Sale interface with dynamic multi-line item entry and live subtotal calculations<br>• Purchase Order lifecycle interface with partial receiving controls<br>• Inventory ledger viewer and low-stock indicator widgets<br>• Forecast review and recommendation authorization UI | `public/`<br>`public/css/`<br>`public/js/`<br>`public/screens/`<br>`views/` | • Cross-device screenshots (desktop, tablet, mobile)<br>• Browser interaction test scripts<br>• Form validation and error state captures<br>• Network tab inspection proving client Fetch calls |
| **Module 3:<br>Back-End Development** | • Web server setup and HTTP protocol handling<br>• RESTful API architecture (GET, POST, PUT, DELETE)<br>• Relational database management with SQL Server<br>• SQL queries, joins, constraints, and stored procedures/transactions<br>• Middleware design (authentication, authorization, error handling, logging) | **Node.js & Express RESTful Core Platform**<br>• Express server with structured routes, controllers, services, repositories<br>• Parameterized SQL queries using `mssql` connection pool<br>• Multi-statement ACID transactions for sales, stock deductions, and PO receiving<br>• Immutable stock movement ledger<br>• Role-Based Access Control (Admin, Manager, Staff) with bcrypt hashing and secure session cookies<br>• Request validation middleware and centralized exception handling | `src/controllers/`<br>`src/services/`<br>`src/repositories/`<br>`src/middleware/`<br>`src/routes/`<br>`src/db/`<br>`sql/migrations/`<br>`sql/seeds/` | • Supertest API automated test suites<br>• SQL Server transactional rollback verification scripts<br>• Concurrency oversell test logs<br>• Postman collection & OpenAPI / Swagger spec |
| **Module 4:<br>Git and Deployment** | • Version control fundamentals (init, commit, push, pull, branch, merge, tag)<br>• Strict collaborative branching strategies<br>• Containerization with Dockerfiles<br>• Multi-container orchestration using Docker Compose<br>• Deployment to cloud Linux environments | **Enterprise Git Workflow & Docker Infrastructure**<br>• Phase-wise branch flow (`main`, `develop`, `phase/NN-*`)<br>• Non-fast-forward merge strategy and release tagging (`phase-NN-complete`)<br>• Multi-stage Dockerfile for Node.js Express service<br>• Dockerfile for Python ML forecasting service<br>• `docker-compose.yml` orchestrating App, SQL Server, Metabase, and ML service on private network<br>• Persistent volume management for database survival<br>• Deployment runbooks for Linux host | `.git/`<br>`Dockerfile`<br>`docker-compose.yml`<br>`deploy/`<br>`docs/deployment-guide.md`<br>`docs/phase-reports/` | • Complete Git commit and tag tree on GitHub<br>• Verified clean `docker compose up` run log<br>• Persistent volume restart test verification<br>• Public / cloud deployment URL or demonstration video |

---

## 3. Specialized Enhancement: ML Decision-Support Service

While the four modules above fulfill and exceed the core TPDS-III requirements, StockPilot incorporates a **Machine Learning Demand Forecasting Service** as an advanced decision-support capability.

- **Role:** An isolated, containerized Python/FastAPI microservice executing offline training and scheduled inference using an **XGBoost Regressor (`XGBRegressor`)**.
- **Architectural Scope:** The ML service does not replace the primary Express backend or SQL Server database. It reads historical daily demand, computes recursive multi-step forecasts, and estimates safety-stock buffers based on empirical error distributions.
- **Resilience Policy:** The core inventory system remains fully functional if the ML service is offline. A deterministic moving-average and rule-based reorder point fallback activates automatically, preserving operational continuity.
