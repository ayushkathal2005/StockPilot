-- ==============================================================================
-- Migration: 002_create_users_table.sql
-- Description: Creates the Users table with RBAC roles and constraints.
-- ==============================================================================

USE [StockPilotDB];
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Users' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Users] (
        [user_id] INT IDENTITY(1,1) NOT NULL,
        [email] NVARCHAR(255) NOT NULL,
        [password_hash] NVARCHAR(255) NOT NULL,
        [full_name] NVARCHAR(100) NOT NULL,
        [role] NVARCHAR(20) NOT NULL,
        [is_active] BIT NOT NULL CONSTRAINT [DF_Users_is_active] DEFAULT (1),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Users_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Users_updated_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([user_id] ASC),
        CONSTRAINT [UQ_Users_email] UNIQUE NONCLUSTERED ([email] ASC),
        CONSTRAINT [CK_Users_role] CHECK ([role] IN ('Admin', 'Manager', 'Staff'))
    );

    CREATE NONCLUSTERED INDEX [IX_Users_role_is_active] 
        ON [dbo].[Users] ([role], [is_active]);

    PRINT 'Table [dbo].[Users] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Users] already exists.';
END
GO
