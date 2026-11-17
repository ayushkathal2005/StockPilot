-- ==============================================================================
-- Migration: 011_create_database_users.sql
-- Description: Sets up least-privilege logins and users:
--              1. stockpilot_app (App user: Read/Write data, no DDL/DROP)
--              2. stockpilot_bi_readonly (BI Metabase user: db_datareader only)
-- Idempotent: Checks sys.server_principals and sys.database_principals.
-- ==============================================================================

USE [master];
GO

-- 1. Create Server Logins if they do not exist
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = N'stockpilot_app')
BEGIN
    CREATE LOGIN [stockpilot_app] WITH PASSWORD = N'YourStrong@Passw0rd', DEFAULT_DATABASE = [StockPilotDB], CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login [stockpilot_app] created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = N'stockpilot_bi_readonly')
BEGIN
    CREATE LOGIN [stockpilot_bi_readonly] WITH PASSWORD = N'YourStrong@Passw0rdBI!', DEFAULT_DATABASE = [StockPilotDB], CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login [stockpilot_bi_readonly] created.';
END
GO

USE [StockPilotDB];
GO

-- 2. Create Users in StockPilotDB
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'stockpilot_app')
BEGIN
    CREATE USER [stockpilot_app] FOR LOGIN [stockpilot_app];
    ALTER ROLE [db_datawriter] ADD MEMBER [stockpilot_app];
    ALTER ROLE [db_datareader] ADD MEMBER [stockpilot_app];
    PRINT 'User [stockpilot_app] mapped and granted db_datareader and db_datawriter.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'stockpilot_bi_readonly')
BEGIN
    CREATE USER [stockpilot_bi_readonly] FOR LOGIN [stockpilot_bi_readonly];
    ALTER ROLE [db_datareader] ADD MEMBER [stockpilot_bi_readonly];
    -- Deny any data modification
    DENY INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [stockpilot_bi_readonly];
    PRINT 'User [stockpilot_bi_readonly] mapped and granted db_datareader with DENY write.';
END
GO
