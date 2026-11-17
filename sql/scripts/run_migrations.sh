#!/usr/bin/env bash
# ==============================================================================
# Script: run_migrations.sh
# Description: Executes all StockPilotDB migrations, seeds, and tests
#              against SQL Server using docker exec / sqlcmd.
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="${1:-stockpilot-mssql}"
SA_PASSWORD="${2:-YourStrong@Passw0rd123!}"

echo "============================================================"
echo " StockPilot Database Migration & Test Runner (Bash)"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

run_sql_file() {
    local file_path="$1"
    local file_name
    file_name="$(basename "${file_path}")"
    echo -n "[RUNNING] ${file_name} ... "
    docker cp "${file_path}" "${CONTAINER_NAME}:/tmp/${file_name}"
    docker exec -i "${CONTAINER_NAME}" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -C -i "/tmp/${file_name}" -b
    echo "OK"
}

echo ""
echo "--- Executing Schema Migrations ---"
for f in $(ls -1 "${SQL_DIR}/migrations/"*.sql | sort); do
    run_sql_file "$f"
done

echo ""
echo "--- Executing Seed Scripts ---"
for f in $(ls -1 "${SQL_DIR}/seeds/"*.sql | sort); do
    run_sql_file "$f"
done

echo ""
echo "--- Executing SQL Test Suites ---"
for f in $(ls -1 "${SQL_DIR}/tests/"*.sql | sort); do
    run_sql_file "$f"
done

echo ""
echo "============================================================"
echo " All Migrations, Seeds, and Validation Tests Passed!"
echo "============================================================"
