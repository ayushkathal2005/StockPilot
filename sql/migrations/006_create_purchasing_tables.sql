-- ==============================================================================
-- Migration: 006_create_purchasing_tables.sql
-- Description: Creates PurchaseOrders header and PurchaseOrderItems line tables.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. PurchaseOrders Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'PurchaseOrders' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[PurchaseOrders] (
        [po_id] INT IDENTITY(1,1) NOT NULL,
        [po_number] NVARCHAR(30) NOT NULL,
        [supplier_id] INT NOT NULL,
        [created_by_user_id] INT NOT NULL,
        [approved_by_user_id] INT NULL,
        [status] NVARCHAR(25) NOT NULL CONSTRAINT [DF_PurchaseOrders_status] DEFAULT ('DRAFT'),
        [order_date] DATETIME2(7) NOT NULL CONSTRAINT [DF_PurchaseOrders_order_date] DEFAULT (SYSUTCDATETIME()),
        [expected_delivery_date] DATETIME2(7) NULL,
        [total_amount] DECIMAL(18,4) NOT NULL CONSTRAINT [DF_PurchaseOrders_total_amount] DEFAULT (0),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_PurchaseOrders_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_PurchaseOrders_updated_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_PurchaseOrders] PRIMARY KEY CLUSTERED ([po_id] ASC),
        CONSTRAINT [UQ_PurchaseOrders_po_number] UNIQUE NONCLUSTERED ([po_number] ASC),
        CONSTRAINT [FK_PurchaseOrders_Suppliers] FOREIGN KEY ([supplier_id]) REFERENCES [dbo].[Suppliers] ([supplier_id]),
        CONSTRAINT [FK_PurchaseOrders_CreatedBy] FOREIGN KEY ([created_by_user_id]) REFERENCES [dbo].[Users] ([user_id]),
        CONSTRAINT [FK_PurchaseOrders_ApprovedBy] FOREIGN KEY ([approved_by_user_id]) REFERENCES [dbo].[Users] ([user_id]),
        CONSTRAINT [CK_PurchaseOrders_status] CHECK ([status] IN ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
        CONSTRAINT [CK_PurchaseOrders_total_amount] CHECK ([total_amount] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_PurchaseOrders_supplier_id] 
        ON [dbo].[PurchaseOrders] ([supplier_id]);
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrders_status] 
        ON [dbo].[PurchaseOrders] ([status]);
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrders_order_date] 
        ON [dbo].[PurchaseOrders] ([order_date] DESC);

    PRINT 'Table [dbo].[PurchaseOrders] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[PurchaseOrders] already exists.';
END
GO

-- 2. PurchaseOrderItems Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'PurchaseOrderItems' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[PurchaseOrderItems] (
        [po_item_id] INT IDENTITY(1,1) NOT NULL,
        [po_id] INT NOT NULL,
        [product_id] INT NOT NULL,
        [ordered_quantity] INT NOT NULL,
        [received_quantity] INT NOT NULL CONSTRAINT [DF_POItems_received_qty] DEFAULT (0),
        [unit_cost] DECIMAL(18,4) NOT NULL,

        CONSTRAINT [PK_PurchaseOrderItems] PRIMARY KEY CLUSTERED ([po_item_id] ASC),
        CONSTRAINT [FK_PurchaseOrderItems_PurchaseOrders] FOREIGN KEY ([po_id]) REFERENCES [dbo].[PurchaseOrders] ([po_id]) ON DELETE CASCADE,
        CONSTRAINT [FK_PurchaseOrderItems_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]),
        CONSTRAINT [CK_PurchaseOrderItems_ordered_qty] CHECK ([ordered_quantity] > 0),
        CONSTRAINT [CK_PurchaseOrderItems_received_qty] CHECK ([received_quantity] >= 0),
        CONSTRAINT [CK_PurchaseOrderItems_received_le_ordered] CHECK ([received_quantity] <= [ordered_quantity]),
        CONSTRAINT [CK_PurchaseOrderItems_unit_cost] CHECK ([unit_cost] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_PurchaseOrderItems_po_id] 
        ON [dbo].[PurchaseOrderItems] ([po_id]);
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrderItems_product_id] 
        ON [dbo].[PurchaseOrderItems] ([product_id]);

    PRINT 'Table [dbo].[PurchaseOrderItems] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[PurchaseOrderItems] already exists.';
END
GO
