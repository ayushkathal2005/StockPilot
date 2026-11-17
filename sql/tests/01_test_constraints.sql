-- ==============================================================================
-- Test Script: 01_test_constraints.sql
-- Description: Tests constraint enforcement (unique SKU, unique email, 
--              non-negative price/cost/qty, valid roles).
-- Expected: Every test case inside a TRY block is expected to fail with a constraint
--           violation, which CATCH captures and marks as [PASS].
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

PRINT '==================================================';
PRINT 'Starting Constraint Validation Tests...';
PRINT '==================================================';

DECLARE @PassedTests INT = 0;
DECLARE @FailedTests INT = 0;

-- Test 1: Duplicate Email should be rejected by UQ_Users_email
BEGIN TRY
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role])
    VALUES ('admin@stockpilot.io', 'hash', 'Duplicate Admin', 'Admin');

    PRINT '[FAIL] Test 1: Duplicate user email was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 1: Duplicate user email was correctly rejected (UQ_Users_email).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 2: Invalid Role should be rejected by CK_Users_role
BEGIN TRY
    INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role])
    VALUES ('invalid_role@stockpilot.io', 'hash', 'Invalid Role User', 'SuperAdmin');

    PRINT '[FAIL] Test 2: Invalid role was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 2: Invalid role was correctly rejected (CK_Users_role).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 3: Duplicate SKU should be rejected by UQ_Products_sku
BEGIN TRY
    INSERT INTO [dbo].[Products] ([sku], [product_name], [category_id], [cost_price], [selling_price])
    VALUES ('BEV-COLA-330', 'Duplicate Cola', 1, 5.00, 10.00);

    PRINT '[FAIL] Test 3: Duplicate product SKU was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 3: Duplicate product SKU was correctly rejected (UQ_Products_sku).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 4: Negative Product Selling Price should be rejected by CK_Products_selling_price
BEGIN TRY
    INSERT INTO [dbo].[Products] ([sku], [product_name], [category_id], [cost_price], [selling_price])
    VALUES ('TEST-NEG-PRICE', 'Negative Price SKU', 1, 5.00, -10.00);

    PRINT '[FAIL] Test 4: Negative product selling price was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 4: Negative product selling price was correctly rejected (CK_Products_selling_price).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 5: Negative Inventory Quantity should be rejected by CK_Inventory_on_hand
BEGIN TRY
    DECLARE @TestProdId INT;
    SELECT TOP 1 @TestProdId = product_id FROM [dbo].[Products];

    -- Attempt to set on_hand_quantity to negative
    UPDATE [dbo].[Inventory] SET [on_hand_quantity] = -5 WHERE [product_id] = @TestProdId;

    PRINT '[FAIL] Test 5: Negative on_hand inventory was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 5: Negative on_hand inventory was correctly rejected (CK_Inventory_on_hand).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 6: PO received quantity greater than ordered quantity should be rejected
BEGIN TRY
    DECLARE @TestPoId INT, @TestProdId2 INT;
    SELECT TOP 1 @TestPoId = po_id FROM [dbo].[PurchaseOrders] WHERE status = 'DRAFT';
    SELECT TOP 1 @TestProdId2 = product_id FROM [dbo].[Products];

    INSERT INTO [dbo].[PurchaseOrderItems] ([po_id], [product_id], [ordered_quantity], [received_quantity], [unit_cost])
    VALUES (@TestPoId, @TestProdId2, 10, 15, 5.00);

    PRINT '[FAIL] Test 6: Received quantity > ordered quantity was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 6: Received quantity > ordered quantity was correctly rejected (CK_POItems_received_le_ordered).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 7: Stock movement with zero delta should be rejected
BEGIN TRY
    DECLARE @TestProdId3 INT, @TestUserId INT;
    SELECT TOP 1 @TestProdId3 = product_id FROM [dbo].[Products];
    SELECT TOP 1 @TestUserId = user_id FROM [dbo].[Users];

    INSERT INTO [dbo].[StockMovements] ([product_id], [movement_type], [quantity_delta], [created_by_user_id])
    VALUES (@TestProdId3, 'ADJUSTMENT_IN', 0, @TestUserId);

    PRINT '[FAIL] Test 7: Zero quantity delta stock movement was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 7: Zero quantity delta stock movement was correctly rejected (CK_StockMovements_delta_nonzero).';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

PRINT '==================================================';
PRINT 'Constraint Test Summary:';
PRINT 'Passed: ' + CAST(@PassedTests AS NVARCHAR(10));
PRINT 'Failed: ' + CAST(@FailedTests AS NVARCHAR(10));
PRINT '==================================================';

IF @FailedTests > 0
    THROW 51000, 'Constraint tests failed.', 1;
GO
