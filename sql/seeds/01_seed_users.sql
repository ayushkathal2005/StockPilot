-- ==============================================================================
-- Seed Script: 01_seed_users.sql
-- Description: Seeds initial Admin, Manager, and Staff accounts.
-- Passwords: All default seeded users have password: "Password123!"
-- BCrypt Hash ($2a$10$): $2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne
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
        '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne',
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
    UPDATE [dbo].[Users] 
    SET [password_hash] = '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne'
    WHERE [email] = 'admin@stockpilot.io';
    PRINT 'User admin@stockpilot.io updated with verified password hash.';
END
GO

-- 2. Manager User
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [email] = 'manager@stockpilot.io')
BEGIN
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
    VALUES (
        'manager@stockpilot.io',
        '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne',
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
    UPDATE [dbo].[Users] 
    SET [password_hash] = '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne'
    WHERE [email] = 'manager@stockpilot.io';
    PRINT 'User manager@stockpilot.io updated with verified password hash.';
END
GO

-- 3. Staff User
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [email] = 'staff@stockpilot.io')
BEGIN
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
    VALUES (
        'staff@stockpilot.io',
        '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne',
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
    UPDATE [dbo].[Users] 
    SET [password_hash] = '$2a$10$u2GPz2cU6DK0NMnRBrTlJeCOdvomwab2kOY3rvbVWesIeAAbj6Yne'
    WHERE [email] = 'staff@stockpilot.io';
    PRINT 'User staff@stockpilot.io updated with verified password hash.';
END
GO
