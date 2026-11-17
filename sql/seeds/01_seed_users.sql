-- ==============================================================================
-- Seed Script: 01_seed_users.sql
-- Description: Seeds initial Admin, Manager, and Staff accounts.
-- Passwords: All default seeded users have password: "Password123!"
-- BCrypt Hash ($2a$10$): $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- Idempotent: Can be safely re-run without duplicate key errors.
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

-- 1. Admin User
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [email] = 'admin@stockpilot.io')
BEGIN
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
    VALUES (
        'admin@stockpilot.io',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Administrator User',
        'Admin',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    PRINT 'Seeded user: admin@stockpilot.io (Role: Admin)';
END
ELSE
BEGIN
    PRINT 'User admin@stockpilot.io already exists.';
END
GO

-- 2. Manager User
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [email] = 'manager@stockpilot.io')
BEGIN
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
    VALUES (
        'manager@stockpilot.io',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Warehouse Manager',
        'Manager',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    PRINT 'Seeded user: manager@stockpilot.io (Role: Manager)';
END
ELSE
BEGIN
    PRINT 'User manager@stockpilot.io already exists.';
END
GO

-- 3. Staff User
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [email] = 'staff@stockpilot.io')
BEGIN
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
    VALUES (
        'staff@stockpilot.io',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Sales Staff Associate',
        'Staff',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    PRINT 'Seeded user: staff@stockpilot.io (Role: Staff)';
END
ELSE
BEGIN
    PRINT 'User staff@stockpilot.io already exists.';
END
GO
