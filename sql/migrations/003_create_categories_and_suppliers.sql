-- ==============================================================================
-- Migration: 003_create_categories_and_suppliers.sql
-- Description: Creates Categories and Suppliers catalog tables.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. Categories Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Categories' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Categories] (
        [category_id] INT IDENTITY(1,1) NOT NULL,
        [category_name] NVARCHAR(100) NOT NULL,
        [description] NVARCHAR(500) NULL,
        [is_active] BIT NOT NULL CONSTRAINT [DF_Categories_is_active] DEFAULT (1),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Categories_created_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED ([category_id] ASC),
        CONSTRAINT [UQ_Categories_category_name] UNIQUE NONCLUSTERED ([category_name] ASC)
    );

    PRINT 'Table [dbo].[Categories] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Categories] already exists.';
END
GO

-- 2. Suppliers Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Suppliers' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Suppliers] (
        [supplier_id] INT IDENTITY(1,1) NOT NULL,
        [supplier_name] NVARCHAR(150) NOT NULL,
        [contact_email] NVARCHAR(255) NULL,
        [contact_phone] NVARCHAR(50) NULL,
        [address] NVARCHAR(300) NULL,
        [default_lead_time_days] INT NOT NULL CONSTRAINT [DF_Suppliers_lead_time] DEFAULT (7),
        [is_active] BIT NOT NULL CONSTRAINT [DF_Suppliers_is_active] DEFAULT (1),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Suppliers_created_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_Suppliers] PRIMARY KEY CLUSTERED ([supplier_id] ASC),
        CONSTRAINT [CK_Suppliers_lead_time] CHECK ([default_lead_time_days] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_Suppliers_is_active] 
        ON [dbo].[Suppliers] ([is_active]);

    PRINT 'Table [dbo].[Suppliers] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Suppliers] already exists.';
END
GO
