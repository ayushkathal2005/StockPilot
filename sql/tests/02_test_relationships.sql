-- ==============================================================================
-- Test Script: 02_test_relationships.sql
-- Description: Tests relational integrity (foreign key constraints across all entities).
-- Expected: Foreign key violations are expected when inserting invalid references.
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

PRINT '==================================================';
PRINT 'Starting Relational Integrity Tests...';
PRINT '==================================================';

DECLARE @PassedTests INT = 0;
DECLARE @FailedTests INT = 0;

-- Test 1: Insert product with non-existent category_id should fail
BEGIN TRY
    INSERT INTO [dbo].[Products] ([sku], [product_name], [category_id], [cost_price], [selling_price])
    VALUES ('TEST-INVALID-CAT', 'Invalid Category Product', 999999, 10.00, 20.00);

    PRINT '[FAIL] Test 1: Product with invalid category_id was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 1: Foreign key FK_Products_Categories correctly blocked invalid category.';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 2: Insert product with non-existent preferred_supplier_id should fail
BEGIN TRY
    INSERT INTO [dbo].[Products] ([sku], [product_name], [category_id], [preferred_supplier_id], [cost_price], [selling_price])
    VALUES ('TEST-INVALID-SUP', 'Invalid Supplier Product', 1, 999999, 10.00, 20.00);

    PRINT '[FAIL] Test 2: Product with invalid supplier_id was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 2: Foreign key FK_Products_Suppliers correctly blocked invalid supplier.';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 3: Insert SaleItem with non-existent product_id should fail
BEGIN TRY
    DECLARE @TestSaleId INT;
    SELECT TOP 1 @TestSaleId = sale_id FROM [dbo].[Sales];

    INSERT INTO [dbo].[SaleItems] ([sale_id], [product_id], [quantity], [unit_selling_price], [unit_cost_at_sale], [subtotal])
    VALUES (@TestSaleId, 999999, 1, 10.00, 5.00, 10.00);

    PRINT '[FAIL] Test 3: SaleItem with invalid product_id was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 3: Foreign key FK_SaleItems_Products correctly blocked invalid product.';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 4: Insert PO with non-existent supplier_id should fail
BEGIN TRY
    DECLARE @TestUserId INT;
    SELECT TOP 1 @TestUserId = user_id FROM [dbo].[Users];

    INSERT INTO [dbo].[PurchaseOrders] ([po_number], [supplier_id], [created_by_user_id], [status])
    VALUES ('PO-TEST-FAILS', 999999, @TestUserId, 'DRAFT');

    PRINT '[FAIL] Test 4: PO with invalid supplier_id was unexpectedly allowed.';
    SET @FailedTests = @FailedTests + 1;
END TRY
BEGIN CATCH
    PRINT '[PASS] Test 4: Foreign key FK_PurchaseOrders_Suppliers correctly blocked invalid supplier.';
    SET @PassedTests = @PassedTests + 1;
END CATCH;

-- Test 5: Verify all seeded products have valid 1:1 inventory records
DECLARE @OrphanedProductsCount INT;
SELECT @OrphanedProductsCount = COUNT(*)
FROM [dbo].[Products] p
LEFT JOIN [dbo].[Inventory] i ON p.product_id = i.product_id
WHERE i.product_id IS NULL;

IF @OrphanedProductsCount = 0
BEGIN
    PRINT '[PASS] Test 5: Every seeded product has a corresponding Inventory record.';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 5: Found ' + CAST(@OrphanedProductsCount AS NVARCHAR(10)) + ' products without Inventory records.';
    SET @FailedTests = @FailedTests + 1;
END;

PRINT '==================================================';
PRINT 'Relational Integrity Test Summary:';
PRINT 'Passed: ' + CAST(@PassedTests AS NVARCHAR(10));
PRINT 'Failed: ' + CAST(@FailedTests AS NVARCHAR(10));
PRINT '==================================================';

IF @FailedTests > 0
    THROW 51000, 'Relational integrity tests failed.', 1;
GO
