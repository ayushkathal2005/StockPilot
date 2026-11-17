# StockPilot Database Infrastructure Guide

**Database System:** Microsoft SQL Server 2022 (Developer Edition)  
**Database Name:** `StockPilotDB`  
**Collation:** `Latin1_General_100_CI_AS_SC_UTF8`  
**Container Target:** `mcr.microsoft.com/mssql/server:2022-latest`  

---

## 1. Directory Structure

```text
sql/
├── migrations/
│   ├── 001_create_database_and_schemas.sql
│   ├── 002_create_users_table.sql
│   ├── 003_create_categories_and_suppliers.sql
│   ├── 004_create_products_and_inventory.sql
│   ├── 005_create_sales_and_sale_items.sql
│   ├── 006_create_purchasing_tables.sql
│   ├── 007_create_stock_movements_ledger.sql
│   ├── 008_create_forecasting_and_bi_tables.sql
│   ├── 009_create_audit_logs.sql
│   ├── 010_create_views_and_indexes.sql
│   └── 011_create_database_users.sql
├── seeds/
│   ├── 01_seed_users.sql
│   ├── 02_seed_categories_and_suppliers.sql
│   ├── 03_seed_products_and_inventory.sql
│   └── 04_seed_initial_transactions.sql
├── tests/
│   ├── 01_test_constraints.sql
│   ├── 02_test_relationships.sql
│   └── 03_test_inventory_invariants.sql
├── scripts/
│   ├── run_migrations.ps1
│   └── run_migrations.sh
└── README.md
```

---

## 2. Quickstart: Running SQL Server in Docker

```powershell
docker run -e "ACCEPT_EULA=Y" `
  -e "MSSQL_SA_PASSWORD=YourStrong@Passw0rd123!" `
  -p 1433:1433 `
  --name stockpilot-mssql `
  -d mcr.microsoft.com/mssql/server:2022-latest
```

---

## 3. Running Migrations, Seeds, and Tests

### PowerShell (Windows)
```powershell
.\sql\scripts\run_migrations.ps1
```

### Bash (Linux / macOS / WSL)
```bash
chmod +x ./sql/scripts/run_migrations.sh
./sql/scripts/run_migrations.sh
```

---

## 4. Database Logins & Roles

| Username | Role / Permissions | Usage |
|---|---|---|
| `sa` | System Administrator (Full sysadmin) | Initial migration and maintenance only |
| `stockpilot_app` | `db_datareader`, `db_datawriter` | Node.js Express backend application |
| `stockpilot_bi_readonly` | `db_datareader` (DENY INSERT, UPDATE, DELETE) | Metabase BI dashboard queries |

---

## 5. Verification Queries

```sql
USE StockPilotDB;
GO

-- 1. Check current inventory health
SELECT sku, product_name, on_hand_quantity, available_quantity, open_purchase_quantity, inventory_position, stock_health_status
FROM vw_InventoryCurrentPosition;

-- 2. Check stock movements audit ledger
SELECT TOP 10 movement_id, product_id, movement_type, quantity_delta, reference_type, created_at
FROM StockMovements
ORDER BY created_at DESC;

-- 3. Check low-stock alerts
SELECT * FROM vw_LowStockAlerts;
```
