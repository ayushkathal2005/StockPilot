# StockPilot Security Audit, Defense-in-Depth & Governance Review

## 1. Security Architecture Summary
StockPilot implements defense-in-depth principles across all platform tiers to guarantee data integrity, authorization enforcement, and protection against common OWASP Top 10 vulnerabilities.

---

## 2. Security Controls & Implementations

### A. Authentication & Session Management
- **Password Protection:** Passwords are cryptographically salted and hashed using `bcrypt` (10 rounds). Plaintext passwords are never stored in SQL Server and never logged to console or files.
- **Session Tokens:** JSON Web Tokens (JWT) signed with HMAC-SHA256. Tokens are transmitted in `httpOnly`, `sameSite=strict` cookies to prevent Cross-Site Scripting (XSS) extraction.
- **Session Termination:** Logout endpoint (`POST /api/auth/logout`) explicitly clears the session cookie on the client.

### B. Role-Based Access Control (RBAC)
- Three distinct operational roles enforced via Express middleware (`src/middleware/rbac.js`):
  - **Admin:** System administration, user provisioning, role assignments, audit logs.
  - **Manager:** Catalog master data, purchase order approval, AI forecast triggers, replenishment approval.
  - **Staff:** POS sales ringing, inventory lookups, inbound warehouse intake.
- Direct API invocation tests confirm unauthorized role actions are rejected with `403 FORBIDDEN`.

### C. SQL Injection Mitigation
- 100% of database queries execute via parameterized queries using the official `mssql` connection pool:
  - Input types are strictly declared (`sql.Int`, `sql.NVarChar`, `sql.Decimal`, `sql.DateTime2`).
  - No raw user input is concatenated into SQL query strings.
- Automated tests verify SQL injection strings in search, pagination, and filter parameters are treated as literal text.

### D. Input Validation & Defense-in-Depth
- Incoming request bodies are validated using `zod` schemas (`src/middleware/validate.js`).
- Malformed payloads, unexpected data types, or missing required attributes return uniform `400 VALIDATION_ERROR` responses before reaching database controllers.
- Sensitive internal stack traces and server internals are suppressed in production mode (`NODE_ENV=production`).

### E. Least-Privilege Database Accounts
- **Application Pool (`sa` / `stockpilot_app`):** Granted read/write permissions on `dbo` operational tables required for transactions.
- **Business Intelligence Account (`stockpilot_bi_readonly`):** Dedicated account restricted to `SELECT` permissions on the 5 reporting views only. Automated integration tests verify that attempted `INSERT`, `UPDATE`, or `DELETE` statements from this account are rejected by SQL Server with permission denied errors.

### F. Container & Network Security
- Application Docker containers (`stockpilot-backend`, `stockpilot-ml-service`) run as unprivileged non-root user `stockpilot:stockpilot` (`UID 1000:GID 1000`).
- Container communication is confined to a private Docker bridge network (`stockpilot-net`).
- SQL Server and ML service ports are bound internally; external clients communicate solely through the application frontend/backend.
- Environment variables and credentials are segregated in `.env` (strictly excluded by `.gitignore` and `.dockerignore`). Safe placeholders are maintained in `.env.example`.
