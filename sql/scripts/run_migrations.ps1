# ==============================================================================
# Script: run_migrations.ps1
# Description: Executes all StockPilotDB migrations, seeds, and test suites
#              in sequence against Microsoft SQL Server.
# Usage: .\sql\scripts\run_migrations.ps1 [-ContainerName "stockpilot-mssql"]
# ==============================================================================

param (
    [string]$ContainerName = "stockpilot-mssql",
    [string]$SaPassword = "YourStrong@Passw0rd123!",
    [switch]$SkipTests = $false,
    [switch]$SkipSeeds = $false
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " StockPilot Database Migration & Test Runner" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

function Run-SqlFileOnContainer {
    param (
        [string]$FilePath
    )
    $fileName = Split-Path -Leaf $FilePath
    Write-Host "[RUNNING] $fileName ... " -NoNewline -ForegroundColor Yellow

    # Copy script into container temporary directory
    docker cp $FilePath "$($ContainerName):/tmp/$fileName"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED (docker cp)" -ForegroundColor Red
        exit 1
    }

    # Execute via sqlcmd inside container
    $output = docker exec -i $ContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SaPassword -C -i "/tmp/$fileName" -b
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host $output -ForegroundColor DarkRed
        exit 1
    } else {
        Write-Host "OK" -ForegroundColor Green
        if ($output) {
            Write-Host $output -ForegroundColor DarkGray
        }
    }
}

# 1. Run Migrations in strict numerical sequence
$migrationFiles = Get-ChildItem -Path "$PSScriptRoot\..\migrations\*.sql" | Sort-Object Name
Write-Host "`n--- Executing Schema Migrations ---" -ForegroundColor Cyan
foreach ($file in $migrationFiles) {
    Run-SqlFileOnContainer -FilePath $file.FullName
}

# 2. Run Seed Scripts in strict numerical sequence
if (-not $SkipSeeds) {
    $seedFiles = Get-ChildItem -Path "$PSScriptRoot\..\seeds\*.sql" | Sort-Object Name
    Write-Host "`n--- Executing Seed Scripts ---" -ForegroundColor Cyan
    foreach ($file in $seedFiles) {
        Run-SqlFileOnContainer -FilePath $file.FullName
    }
}

# 3. Run Test Scripts
if (-not $SkipTests) {
    $testFiles = Get-ChildItem -Path "$PSScriptRoot\..\tests\*.sql" | Sort-Object Name
    Write-Host "`n--- Executing SQL Test Suites ---" -ForegroundColor Cyan
    foreach ($file in $testFiles) {
        Run-SqlFileOnContainer -FilePath $file.FullName
    }
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " All Migrations, Seeds, and Validation Tests Passed!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
