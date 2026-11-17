# StockPilot — Technical Decisions & Version-Check Policy

**Document Version:** 1.0  
**Phase:** Phase 0 (Baseline Freeze)  
**Date Checked:** 2026-11-17  
**Author:** Lead Software Engineer  
**Status:** Approved for Phase 0 Baseline  

---

## 1. Core Technology Selection & Rationale

Every component in StockPilot was selected to satisfy the academic requirements of **TPDS-III (Modules 1–4)** while maintaining enterprise production standards for inventory management and transactional reliability.

### 1.1 Business Database: Microsoft SQL Server ONLY
- **Decision:** Microsoft SQL Server 2022 (Developer / Standard Edition on Linux container) is the sole business database for `StockPilotDB`.
- **Alternatives Considered & Rejected:**
  - *PostgreSQL / MySQL:* While popular open-source databases, they do not align with the TPDS-III course syllabus for Module 3 enterprise database management.
  - *MongoDB / Document DBs:* Document databases lack native multi-table transactional guarantees and schema-enforced relational integrity essential for inventory accounting ledgers.
  - *SQLite:* Inadequate for multi-user concurrent access, analytical BI queries, and production container deployment.
- **Justification:** SQL Server provides enterprise-grade ACID transactions, robust row-level concurrency control (`UPDLOCK`, `ROWLOCK`), strict constraint enforcement, and native compatibility with Metabase via supported JDBC connectors.
- **Database Boundary Rule:** All business entities (Users, Products, Inventory, Stock Movements, Sales, POs, Forecasts) reside in SQL Server. PostgreSQL is strictly optional and reserved exclusively for Metabase's internal metadata in production-like container deployments.

### 1.2 Primary Application Backend: Node.js & Express.js
- **Decision:** Node.js (LTS) with Express.js as the primary REST application server.
- **Justification:** Fulfills TPDS-III Module 3 (Back-End Development). Provides non-blocking asynchronous I/O, mature connection pooling for SQL Server via `mssql`/`tedious`, lightweight middleware architecture for authentication and RBAC, and clean separation of concerns.

### 1.3 Front-End Presentation: HTML5, CSS3, Bootstrap 5 & Vanilla JS
- **Decision:** Bootstrap 5 with Vanilla JavaScript (ES6+), avoiding heavy frontend frameworks (React, Angular, Vue).
- **Justification:** Fulfills TPDS-III Module 2 (Front-End Development). Ensures maximum transparency, direct DOM control, native Fetch API integration, zero build-step latency, and responsive rendering across desktop, tablet, and mobile browsers.

### 1.4 Business Intelligence: Metabase
- **Decision:** Self-hosted Metabase BI engine connected directly to SQL Server via read-only credentials.
- **Justification:** Fulfills TPDS-III Module 1 (Dashboard Designing). Provides an intuitive visual query builder alongside direct SQL editor capabilities, rich chart formatting, parameterized dashboard filters, and embeddable analytics without writing custom charting code from scratch.

### 1.5 Demand Forecasting Microservice: Python, FastAPI & XGBoost
- **Decision:** Python microservice running FastAPI and XGBoost Regressor (`XGBRegressor`).
- **Justification:** Tabular demand forecasting with time-series feature engineering (calendar signals, price, promotions, lags, and rolling averages) is ideally suited to gradient boosted decision trees. FastAPI provides high-speed internal REST endpoints. Isolating ML in a separate service ensures that model training or CPU spikes never impact operational transaction processing in the Express backend.

---

## 2. Host Environment & Platform Compatibility Check

An inspection of the deployment host environment was performed on **2026-11-17**:

| Environment Attribute | Detected Value | Compatibility Assessment | Action / Policy |
|---|---|---|---|
| **Host Operating System** | Windows 10/11 Pro (64-bit) | Supported | Native Windows development with Docker Desktop backend |
| **Processor Architecture** | `AMD64` (x86_64, Intel/AMD 64-bit) | **Fully Supported** | Meets Microsoft SQL Server Linux container mandate (x86_64 required; no ARM translation overhead) |
| **Docker Engine** | Docker version `29.7.2` | Supported | Compatible with modern Compose v2 specifications |
| **Node.js Runtime** | Node.js `v24.12.0` | Compatible | Development machine has Node 24; application container will pin Node 20 LTS for production stability |
| **Package Manager** | `npm` `11.6.2` | Compatible | Execute scripts via `npm.cmd` when on Windows PowerShell |
| **Python Environment** | Python `3.14.0` (local) | Caution on dependencies | Python 3.14 is very new; machine learning wheels (XGBoost, pyodbc) are tested and stable on Python 3.11/3.12. The ML Docker container will pin `python:3.11-slim` to ensure reproducible binary compatibility |
| **Git Version** | Git `2.45.1.windows.1` | Supported | Fully compatible with required phase-branching workflow |

---

## 3. Pinned Target Versions Policy

To ensure deterministic builds across developer machines and cloud deployment environments, versions must be explicitly pinned across package manifests and Docker images.

| Component / Dependency | Target Pinned Version | Image / Distribution | Verification Date |
|---|---|---|---|
| **Database Engine** | SQL Server 2022 CU14+ | `mcr.microsoft.com/mssql/server:2022-latest` | 2026-11-17 |
| **Backend Runtime** | Node.js 20 LTS | `node:20-alpine` | 2026-11-17 |
| **Node SQL Driver** | `mssql` ^10.0.0 | `tedious` ^18.0.0 | 2026-11-17 |
| **Node Request Validation** | `zod` ^3.23.0 or `express-validator` ^7.0.0 | Pinned in `package.json` | 2026-11-17 |
| **Node Auth & Security** | `bcryptjs` ^2.4.3, `cookie-session` / `express-session` | Pinned in `package.json` | 2026-11-17 |
| **Frontend Framework** | Bootstrap 5.3.3 | CDN / Vendored CSS & JS | 2026-11-17 |
| **BI Tool** | Metabase v0.49+ | `metabase/metabase:v0.49.13` | 2026-11-17 |
| **ML Runtime** | Python 3.11 | `python:3.11-slim` | 2026-11-17 |
| **ML Framework** | FastAPI ^0.110.0, Uvicorn ^0.28.0 | Pinned in `requirements.txt` | 2026-11-17 |
| **ML Algorithm** | XGBoost ^2.0.3 (`XGBRegressor`) | Pinned in `requirements.txt` | 2026-11-17 |
| **Data Processing** | Pandas ^2.2.0, NumPy ^1.26.4, Scikit-learn ^1.4.1 | Pinned in `requirements.txt` | 2026-11-17 |
| **Python SQL Driver** | `pyodbc` ^5.1.0 + Microsoft ODBC Driver 18 for SQL Server | Pinned in `requirements.txt` | 2026-11-17 |

---

## 4. Git Branching & Versioning Policy

### 4.1 Branch Model
- `main`: Release-ready code only. Commits to `main` occur solely via merges from `develop` upon completing major milestone releases.
- `develop`: Primary integration branch containing all completed and verified phases.
- `phase/NN-<short-name>`: Ephemeral working branch for the active phase (e.g. `phase/00-repo-charter-architecture-freeze`, `phase/01-database-schema`).

### 4.2 Commit & Tagging Protocol
- Commit messages follow Conventional Commits: `feat(phase-NN): ...`, `docs(phase-NN): ...`, `fix(phase-NN): ...`.
- Merges into `develop` are non-fast-forward: `git merge --no-ff phase/NN-<short-name>`.
- Annotated release tags mark each completed phase on `develop`: `phase-NN-complete`.
- No force pushes (`git push --force`) or destructive resets (`git reset --hard`) are permitted.
