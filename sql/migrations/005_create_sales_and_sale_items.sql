-- ==============================================================================
-- Migration: 005_create_sales_and_sale_items.sql
-- Description: Creates Sales transaction header and SaleItems line tables.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. Sales Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'Sales' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Sales] (
        [sale_id] INT IDENTITY(1,1) NOT NULL,
        [user_id] INT NOT NULL,
        [sale_date] DATETIME2(7) NOT NULL CONSTRAINT [DF_Sales_sale_date] DEFAULT (SYSUTCDATETIME()),
        [subtotal_amount] DECIMAL(18,4) NOT NULL,
        [tax_amount] DECIMAL(18,4) NOT NULL CONSTRAINT [DF_Sales_tax_amount] DEFAULT (0),
        [total_amount] DECIMAL(18,4) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Sales_status] DEFAULT ('COMPLETED'),

        CONSTRAINT [PK_Sales] PRIMARY KEY CLUSTERED ([sale_id] ASC),
        CONSTRAINT [FK_Sales_Users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]),
        CONSTRAINT [CK_Sales_subtotal] CHECK ([subtotal_amount] >= 0),
        CONSTRAINT [CK_Sales_tax] CHECK ([tax_amount] >= 0),
        CONSTRAINT [CK_Sales_total] CHECK ([total_amount] >= 0),
        CONSTRAINT [CK_Sales_status] CHECK ([status] IN ('COMPLETED', 'VOIDED', 'RETURNED'))
    );

    CREATE NONCLUSTERED INDEX [IX_Sales_sale_date] 
        ON [dbo].[Sales] ([sale_date] DESC);
    CREATE NONCLUSTERED INDEX [IX_Sales_user_id] 
        ON [dbo].[Sales] ([user_id]);
    CREATE NONCLUSTERED INDEX [IX_Sales_status] 
        ON [dbo].[Sales] ([status]);

    PRINT 'Table [dbo].[Sales] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Sales] already exists.';
END
GO

-- 2. SaleItems Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'SaleItems' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[SaleItems] (
        [sale_item_id] INT IDENTITY(1,1) NOT NULL,
        [sale_id] INT NOT NULL,
        [product_id] INT NOT NULL,
        [quantity] INT NOT NULL,
        [unit_selling_price] DECIMAL(18,4) NOT NULL,
        [unit_cost_at_sale] DECIMAL(18,4) NOT NULL,
        [subtotal] DECIMAL(18,4) NOT NULL,

        CONSTRAINT [PK_SaleItems] PRIMARY KEY CLUSTERED ([sale_item_id] ASC),
        CONSTRAINT [FK_SaleItems_Sales] FOREIGN KEY ([sale_id]) REFERENCES [dbo].[Sales] ([sale_id]) ON DELETE CASCADE,
        CONSTRAINT [FK_SaleItems_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]),
        CONSTRAINT [CK_SaleItems_quantity] CHECK ([quantity] > 0),
        CONSTRAINT [CK_SaleItems_unit_price] CHECK ([unit_selling_price] >= 0),
        CONSTRAINT [CK_SaleItems_unit_cost] CHECK ([unit_cost_at_sale] >= 0),
        CONSTRAINT [CK_SaleItems_subtotal] CHECK ([subtotal] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_SaleItems_sale_id] 
        ON [dbo].[SaleItems] ([sale_id]);
    CREATE NONCLUSTERED INDEX [IX_SaleItems_product_id] 
        ON [dbo].[SaleItems] ([product_id]);

    PRINT 'Table [dbo].[SaleItems] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[SaleItems] already exists.';
END
GO
