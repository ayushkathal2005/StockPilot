-- ==============================================================================
-- Migration: 007_create_stock_movements_ledger.sql
-- Description: Creates the immutable StockMovements audit ledger.
-- ==============================================================================

USE [StockPilotDB];
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'StockMovements' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[StockMovements] (
        [movement_id] BIGINT IDENTITY(1,1) NOT NULL,
        [product_id] INT NOT NULL,
        [movement_type] NVARCHAR(25) NOT NULL,
        [quantity_delta] INT NOT NULL,
        [reference_type] NVARCHAR(30) NULL,
        [reference_id] INT NULL,
        [created_by_user_id] INT NOT NULL,
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_StockMovements_created_at] DEFAULT (SYSUTCDATETIME()),
        [notes] NVARCHAR(500) NULL,

        CONSTRAINT [PK_StockMovements] PRIMARY KEY CLUSTERED ([movement_id] ASC),
        CONSTRAINT [FK_StockMovements_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]),
        CONSTRAINT [FK_StockMovements_Users] FOREIGN KEY ([created_by_user_id]) REFERENCES [dbo].[Users] ([user_id]),
        CONSTRAINT [CK_StockMovements_type] CHECK ([movement_type] IN ('SALE', 'PO_RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN')),
        CONSTRAINT [CK_StockMovements_delta_nonzero] CHECK ([quantity_delta] <> 0)
    );

    CREATE NONCLUSTERED INDEX [IX_StockMovements_product_created] 
        ON [dbo].[StockMovements] ([product_id], [created_at] DESC);
    CREATE NONCLUSTERED INDEX [IX_StockMovements_type] 
        ON [dbo].[StockMovements] ([movement_type]);
    CREATE NONCLUSTERED INDEX [IX_StockMovements_ref] 
        ON [dbo].[StockMovements] ([reference_type], [reference_id]);

    PRINT 'Table [dbo].[StockMovements] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[StockMovements] already exists.';
END
GO
