-- ==============================================================================
-- Seed Script: 04_seed_initial_transactions.sql
-- Description: Seeds initial sales transactions and purchase orders across
--              multiple lifecycle states (RECEIVED, PARTIALLY_RECEIVED, SUBMITTED, DRAFT).
-- Idempotent: Checks for existing seed PO numbers and seed sale markers.
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

DECLARE @StaffUserId INT, @ManagerUserId INT, @AdminUserId INT;
SELECT TOP 1 @StaffUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Staff';
SELECT TOP 1 @ManagerUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Manager';
SELECT TOP 1 @AdminUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Admin';

IF @StaffUserId IS NULL SET @StaffUserId = 1;
IF @ManagerUserId IS NULL SET @ManagerUserId = 1;
IF @AdminUserId IS NULL SET @AdminUserId = 1;

-- ==============================================================================
-- 1. Seed Initial Completed Sales Transactions
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM [dbo].[Sales] WHERE [sale_id] = 1)
BEGIN
    PRINT 'Seeding initial sales transactions...';

    -- Sale #1: Beverages and snacks
    DECLARE @SaleId1 INT, @Prod1 INT, @Prod2 INT;
    SELECT @Prod1 = product_id FROM [dbo].[Products] WHERE sku = 'BEV-COLA-330';
    SELECT @Prod2 = product_id FROM [dbo].[Products] WHERE sku = 'PKF-CHOC-150';

    IF @Prod1 IS NOT NULL AND @Prod2 IS NOT NULL
    BEGIN
        INSERT INTO [dbo].[Sales] ([user_id], [sale_date], [subtotal_amount], [tax_amount], [total_amount], [status])
        VALUES (@StaffUserId, DATEADD(DAY, -2, SYSUTCDATETIME()), 24.5700, 1.9600, 26.5300, 'COMPLETED');
        SET @SaleId1 = SCOPE_IDENTITY();

        -- Line item 1: 1 pack of cola (price 18.99, cost 9.50)
        INSERT INTO [dbo].[SaleItems] ([sale_id], [product_id], [quantity], [unit_selling_price], [unit_cost_at_sale], [subtotal])
        VALUES (@SaleId1, @Prod1, 1, 18.9900, 9.5000, 18.9900);
        UPDATE [dbo].[Inventory] SET [on_hand_quantity] = [on_hand_quantity] - 1 WHERE [product_id] = @Prod1;
        INSERT INTO [dbo].[StockMovements] ([product_id], [movement_type], [quantity_delta], [reference_type], [reference_id], [created_by_user_id], [created_at], [notes])
        VALUES (@Prod1, 'SALE', -1, 'Sales', @SaleId1, @StaffUserId, DATEADD(DAY, -2, SYSUTCDATETIME()), 'Sale POS #1');

        -- Line item 2: 2 chocolate almond bars (price 2.79, cost 1.20)
        INSERT INTO [dbo].[SaleItems] ([sale_id], [product_id], [quantity], [unit_selling_price], [unit_cost_at_sale], [subtotal])
        VALUES (@SaleId1, @Prod2, 2, 2.7900, 1.2000, 5.5800);
        UPDATE [dbo].[Inventory] SET [on_hand_quantity] = [on_hand_quantity] - 2 WHERE [product_id] = @Prod2;
        INSERT INTO [dbo].[StockMovements] ([product_id], [movement_type], [quantity_delta], [reference_type], [reference_id], [created_by_user_id], [created_at], [notes])
        VALUES (@Prod2, 'SALE', -2, 'Sales', @SaleId1, @StaffUserId, DATEADD(DAY, -2, SYSUTCDATETIME()), 'Sale POS #1');
    END

    -- Sale #2: Dairy essentials
    DECLARE @SaleId2 INT, @Prod3 INT, @Prod4 INT;
    SELECT @Prod3 = product_id FROM [dbo].[Products] WHERE sku = 'DRY-WMLK-100';
    SELECT @Prod4 = product_id FROM [dbo].[Products] WHERE sku = 'DRY-EGGS-012';

    IF @Prod3 IS NOT NULL AND @Prod4 IS NOT NULL
    BEGIN
        INSERT INTO [dbo].[Sales] ([user_id], [sale_date], [subtotal_amount], [tax_amount], [total_amount], [status])
        VALUES (@StaffUserId, DATEADD(DAY, -1, SYSUTCDATETIME()), 10.4700, 0.0000, 10.4700, 'COMPLETED');
        SET @SaleId2 = SCOPE_IDENTITY();

        -- 2 milk cartons (price 1.89, cost 0.90)
        INSERT INTO [dbo].[SaleItems] ([sale_id], [product_id], [quantity], [unit_selling_price], [unit_cost_at_sale], [subtotal])
        VALUES (@SaleId2, @Prod3, 2, 1.8900, 0.9000, 3.7800);
        UPDATE [dbo].[Inventory] SET [on_hand_quantity] = [on_hand_quantity] - 2 WHERE [product_id] = @Prod3;
        INSERT INTO [dbo].[StockMovements] ([product_id], [movement_type], [quantity_delta], [reference_type], [reference_id], [created_by_user_id], [created_at], [notes])
        VALUES (@Prod3, 'SALE', -2, 'Sales', @SaleId2, @StaffUserId, DATEADD(DAY, -1, SYSUTCDATETIME()), 'Sale POS #2');

        -- 1 egg pack (price 4.29, cost 2.00)
        INSERT INTO [dbo].[SaleItems] ([sale_id], [product_id], [quantity], [unit_selling_price], [unit_cost_at_sale], [subtotal])
        VALUES (@SaleId2, @Prod4, 1, 4.2900, 2.0000, 4.2900);
        UPDATE [dbo].[Inventory] SET [on_hand_quantity] = [on_hand_quantity] - 1 WHERE [product_id] = @Prod4;
        INSERT INTO [dbo].[StockMovements] ([product_id], [movement_type], [quantity_delta], [reference_type], [reference_id], [created_by_user_id], [created_at], [notes])
        VALUES (@Prod4, 'SALE', -1, 'Sales', @SaleId2, @StaffUserId, DATEADD(DAY, -1, SYSUTCDATETIME()), 'Sale POS #2');
    END
    PRINT 'Sales transactions seeded successfully.';
END
ELSE
BEGIN
    PRINT 'Sales transactions already exist.';
END
GO

-- ==============================================================================
-- 2. Seed Purchase Orders across states
-- ==============================================================================
DECLARE @StaffUserId INT, @ManagerUserId INT, @AdminUserId INT;
SELECT TOP 1 @StaffUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Staff';
SELECT TOP 1 @ManagerUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Manager';
SELECT TOP 1 @AdminUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Admin';
IF @StaffUserId IS NULL SET @StaffUserId = 1;
IF @ManagerUserId IS NULL SET @ManagerUserId = 1;
IF @AdminUserId IS NULL SET @AdminUserId = 1;

-- PO 1: RECEIVED (Apex Global Distributors)
IF NOT EXISTS (SELECT 1 FROM [dbo].[PurchaseOrders] WHERE [po_number] = 'PO-2026-0001')
BEGIN
    DECLARE @Sup1 INT, @P1 INT, @PoId1 INT;
    SELECT @Sup1 = supplier_id FROM [dbo].[Suppliers] WHERE supplier_name = 'Apex Global Distributors';
    SELECT @P1 = product_id FROM [dbo].[Products] WHERE sku = 'BEV-COLA-330';

    INSERT INTO [dbo].[PurchaseOrders] (
        [po_number], [supplier_id], [created_by_user_id], [approved_by_user_id],
        [status], [order_date], [expected_delivery_date], [total_amount], [created_at], [updated_at]
    ) VALUES (
        'PO-2026-0001', @Sup1, @ManagerUserId, @AdminUserId,
        'RECEIVED', DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, -5, SYSUTCDATETIME()), 190.0000,
        DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, -5, SYSUTCDATETIME())
    );
    SET @PoId1 = SCOPE_IDENTITY();

    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@PoId1, @P1, 20, 20, 9.5000);

    PRINT 'Seeded Purchase Order: PO-2026-0001 (Status: RECEIVED)';
END

-- PO 2: PARTIALLY_RECEIVED (Pinnacle Wholesale Ltd)
IF NOT EXISTS (SELECT 1 FROM [dbo].[PurchaseOrders] WHERE [po_number] = 'PO-2026-0002')
BEGIN
    DECLARE @Sup2 INT, @P2 INT, @P3 INT, @PoId2 INT;
    SELECT @Sup2 = supplier_id FROM [dbo].[Suppliers] WHERE supplier_name = 'Pinnacle Wholesale Ltd';
    SELECT @P2 = product_id FROM [dbo].[Products] WHERE sku = 'PKF-CHOC-150';
    SELECT @P3 = product_id FROM [dbo].[Products] WHERE sku = 'PKF-PSTA-500';

    INSERT INTO [dbo].[PurchaseOrders] (
        [po_number], [supplier_id], [created_by_user_id], [approved_by_user_id],
        [status], [order_date], [expected_delivery_date], [total_amount], [created_at], [updated_at]
    ) VALUES (
        'PO-2026-0002', @Sup2, @ManagerUserId, @AdminUserId,
        'PARTIALLY_RECEIVED', DATEADD(DAY, -4, SYSUTCDATETIME()), DATEADD(DAY, 3, SYSUTCDATETIME()), 102.5000,
        DATEADD(DAY, -4, SYSUTCDATETIME()), SYSUTCDATETIME()
    );
    SET @PoId2 = SCOPE_IDENTITY();

    -- Item 1: 50 ordered, 30 received (20 open)
    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@PoId2, @P2, 50, 30, 1.2000);

    -- Item 2: 50 ordered, 0 received (50 open)
    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@PoId2, @P3, 50, 0, 0.8500);

    PRINT 'Seeded Purchase Order: PO-2026-0002 (Status: PARTIALLY_RECEIVED)';
END

-- PO 3: SUBMITTED (FreshValley Dairy & Foods)
IF NOT EXISTS (SELECT 1 FROM [dbo].[PurchaseOrders] WHERE [po_number] = 'PO-2026-0003')
BEGIN
    DECLARE @Sup3 INT, @P4 INT, @PoId3 INT;
    SELECT @Sup3 = supplier_id FROM [dbo].[Suppliers] WHERE supplier_name = 'FreshValley Dairy & Foods';
    SELECT @P4 = product_id FROM [dbo].[Products] WHERE sku = 'DRY-WMLK-100';

    INSERT INTO [dbo].[PurchaseOrders] (
        [po_number], [supplier_id], [created_by_user_id], [approved_by_user_id],
        [status], [order_date], [expected_delivery_date], [total_amount], [created_at], [updated_at]
    ) VALUES (
        'PO-2026-0003', @Sup3, @ManagerUserId, @AdminUserId,
        'SUBMITTED', DATEADD(DAY, -1, SYSUTCDATETIME()), DATEADD(DAY, 2, SYSUTCDATETIME()), 36.0000,
        DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME()
    );
    SET @PoId3 = SCOPE_IDENTITY();

    -- 40 ordered, 0 received (40 open)
    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@PoId3, @P4, 40, 0, 0.9000);

    PRINT 'Seeded Purchase Order: PO-2026-0003 (Status: SUBMITTED)';
END

-- PO 4: DRAFT (CleanHome Consumer Goods - Does not count as on-order inventory)
IF NOT EXISTS (SELECT 1 FROM [dbo].[PurchaseOrders] WHERE [po_number] = 'PO-2026-0004')
BEGIN
    DECLARE @Sup4 INT, @P5 INT, @PoId4 INT;
    SELECT @Sup4 = supplier_id FROM [dbo].[Suppliers] WHERE supplier_name = 'CleanHome Consumer Goods';
    SELECT @P5 = product_id FROM [dbo].[Products] WHERE sku = 'HSE-LDET-200';

    INSERT INTO [dbo].[PurchaseOrders] (
        [po_number], [supplier_id], [created_by_user_id], [approved_by_user_id],
        [status], [order_date], [expected_delivery_date], [total_amount], [created_at], [updated_at]
    ) VALUES (
        'PO-2026-0004', @Sup4, @ManagerUserId, NULL,
        'DRAFT', SYSUTCDATETIME(), DATEADD(DAY, 10, SYSUTCDATETIME()), 125.0000,
        SYSUTCDATETIME(), SYSUTCDATETIME()
    );
    SET @PoId4 = SCOPE_IDENTITY();

    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@PoId4, @P5, 25, 0, 5.0000);

    PRINT 'Seeded Purchase Order: PO-2026-0004 (Status: DRAFT)';
END
GO
