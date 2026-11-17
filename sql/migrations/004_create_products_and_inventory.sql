-- ==============================================================================
-- Migration: 004_create_products_and_inventory.sql
-- Description: Creates Products master table and Inventory balance table.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. Products Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Products' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Products] (
        [product_id] INT IDENTITY(1,1) NOT NULL,
        [sku] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(200) NOT NULL,
        [category_id] INT NOT NULL,
        [preferred_supplier_id] INT NULL,
        [cost_price] DECIMAL(18,4) NOT NULL,
        [selling_price] DECIMAL(18,4) NOT NULL,
        [reorder_point_threshold] INT NOT NULL CONSTRAINT [DF_Products_reorder_point] DEFAULT (10),
        [target_safety_stock] INT NOT NULL CONSTRAINT [DF_Products_safety_stock] DEFAULT (15),
        [lead_time_days] INT NOT NULL CONSTRAINT [DF_Products_lead_time] DEFAULT (7),
        [is_active] BIT NOT NULL CONSTRAINT [DF_Products_is_active] DEFAULT (1),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Products_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Products_updated_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_Products] PRIMARY KEY CLUSTERED ([product_id] ASC),
        CONSTRAINT [UQ_Products_sku] UNIQUE NONCLUSTERED ([sku] ASC),
        CONSTRAINT [FK_Products_Categories] FOREIGN KEY ([category_id]) REFERENCES [dbo].[Categories] ([category_id]),
        CONSTRAINT [FK_Products_Suppliers] FOREIGN KEY ([preferred_supplier_id]) REFERENCES [dbo].[Suppliers] ([supplier_id]),
        CONSTRAINT [CK_Products_cost_price] CHECK ([cost_price] >= 0),
        CONSTRAINT [CK_Products_selling_price] CHECK ([selling_price] >= 0),
        CONSTRAINT [CK_Products_reorder_point] CHECK ([reorder_point_threshold] >= 0),
        CONSTRAINT [CK_Products_safety_stock] CHECK ([target_safety_stock] >= 0),
        CONSTRAINT [CK_Products_lead_time] CHECK ([lead_time_days] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_Products_category_id] 
        ON [dbo].[Products] ([category_id]);
    CREATE NONCLUSTERED INDEX [IX_Products_preferred_supplier_id] 
        ON [dbo].[Products] ([preferred_supplier_id]);
    CREATE NONCLUSTERED INDEX [IX_Products_sku_is_active] 
        ON [dbo].[Products] ([sku], [is_active]);

    PRINT 'Table [dbo].[Products] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Products] already exists.';
END
GO

-- 2. Inventory Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Inventory' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Inventory] (
        [product_id] INT NOT NULL,
        [on_hand_quantity] INT NOT NULL CONSTRAINT [DF_Inventory_on_hand] DEFAULT (0),
        [reserved_quantity] INT NOT NULL CONSTRAINT [DF_Inventory_reserved] DEFAULT (0),
        [updated_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Inventory_updated_at] DEFAULT (SYSUTCDATETIME()),
        [row_version] ROWVERSION NOT NULL,

        CONSTRAINT [PK_Inventory] PRIMARY KEY CLUSTERED ([product_id] ASC),
        CONSTRAINT [FK_Inventory_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]) ON DELETE CASCADE,
        CONSTRAINT [CK_Inventory_on_hand] CHECK ([on_hand_quantity] >= 0),
        CONSTRAINT [CK_Inventory_reserved] CHECK ([reserved_quantity] >= 0),
        CONSTRAINT [CK_Inventory_available_non_negative] CHECK ([on_hand_quantity] >= [reserved_quantity])
    );

    PRINT 'Table [dbo].[Inventory] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Inventory] already exists.';
END
GO
