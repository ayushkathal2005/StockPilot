-- ==============================================================================
-- Migration: 001_create_database_and_schemas.sql
-- Description: Ensures StockPilotDB exists with appropriate collation.
-- Idempotent: Can be safely executed multiple times.
-- ==============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'StockPilotDB')
BEGIN
    CREATE DATABASE [StockPilotDB]
    COLLATE Latin1_General_100_CI_AS_SC_UTF8;
    PRINT 'Database StockPilotDB created successfully.';
END
ELSE
BEGIN
    PRINT 'Database StockPilotDB already exists.';
END
GO
