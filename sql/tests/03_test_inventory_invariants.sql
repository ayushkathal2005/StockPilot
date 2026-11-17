-- ==============================================================================
-- Test Script: 03_test_inventory_invariants.sql
-- Description: Tests inventory invariants from Section 11 of the specification:
--              1. available = on_hand - reserved
--              2. open_purchase_quantity counts only SUBMITTED and PARTIALLY_RECEIVED POs
--              3. DRAFT and CANCELLED POs are excluded from open_purchase_quantity
--              4. inventory_position = available + open_purchase_quantity
--              5. Every stock adjustment has a ledger entry
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

PRINT '==================================================';
PRINT 'Starting Inventory Invariant Tests...';
PRINT '==================================================';

DECLARE @PassedTests INT = 0;
DECLARE @FailedTests INT = 0;

-- Test 1: Verify available_quantity = on_hand_quantity - reserved_quantity for all products
DECLARE @AvailableMismatchCount INT;
SELECT @AvailableMismatchCount = COUNT(*)
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE available_quantity <> (on_hand_quantity - reserved_quantity);

IF @AvailableMismatchCount = 0
BEGIN
    PRINT '[PASS] Test 1: Invariant verified: available_quantity = on_hand_quantity - reserved_quantity across all products.';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 1: Found ' + CAST(@AvailableMismatchCount AS NVARCHAR(10)) + ' products with available_quantity mismatches.';
    SET @FailedTests = @FailedTests + 1;
END;

-- Test 2: Verify DRAFT purchase orders do NOT contribute to open_purchase_quantity
-- HSE-LDET-200 is in PO-2026-0004 (DRAFT for 25 units). Its open_purchase_quantity must be 0!
DECLARE @DraftOpenQty INT;
SELECT @DraftOpenQty = open_purchase_quantity
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE sku = 'HSE-LDET-200';

IF @DraftOpenQty = 0
BEGIN
    PRINT '[PASS] Test 2: Invariant verified: DRAFT purchase order is excluded from open_purchase_quantity (HSE-LDET-200 open_po = 0).';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 2: DRAFT purchase order incorrectly contributed to open_purchase_quantity (expected 0, got ' + CAST(@DraftOpenQty AS NVARCHAR(10)) + ').';
    SET @FailedTests = @FailedTests + 1;
END;

-- Test 3: Verify PARTIALLY_RECEIVED purchase orders contribute strictly remaining units
-- PKF-CHOC-150 in PO-2026-0002 has ordered=50, received=30. Remaining open units must be 20!
DECLARE @PartialOpenQty INT;
SELECT @PartialOpenQty = open_purchase_quantity
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE sku = 'PKF-CHOC-150';

IF @PartialOpenQty = 20
BEGIN
    PRINT '[PASS] Test 3: Invariant verified: PARTIALLY_RECEIVED purchase order correctly reflects unreceived balance (PKF-CHOC-150 open_po = 20).';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 3: PARTIALLY_RECEIVED open quantity mismatch (expected 20, got ' + CAST(@PartialOpenQty AS NVARCHAR(10)) + ').';
    SET @FailedTests = @FailedTests + 1;
END;

-- Test 4: Verify SUBMITTED purchase orders contribute full unreceived units
-- DRY-WMLK-100 in PO-2026-0003 has ordered=40, received=0. Remaining open units must be 40!
DECLARE @SubmittedOpenQty INT;
SELECT @SubmittedOpenQty = open_purchase_quantity
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE sku = 'DRY-WMLK-100';

IF @SubmittedOpenQty = 40
BEGIN
    PRINT '[PASS] Test 4: Invariant verified: SUBMITTED purchase order reflects full ordered units (DRY-WMLK-100 open_po = 40).';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 4: SUBMITTED open quantity mismatch (expected 40, got ' + CAST(@SubmittedOpenQty AS NVARCHAR(10)) + ').';
    SET @FailedTests = @FailedTests + 1;
END;

-- Test 5: Verify inventory_position = available_quantity + open_purchase_quantity
DECLARE @PositionMismatchCount INT;
SELECT @PositionMismatchCount = COUNT(*)
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE inventory_position <> (available_quantity + open_purchase_quantity);

IF @PositionMismatchCount = 0
BEGIN
    PRINT '[PASS] Test 5: Invariant verified: inventory_position = available_quantity + open_purchase_quantity across all records.';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 5: Found ' + CAST(@PositionMismatchCount AS NVARCHAR(10)) + ' products with inventory_position mismatches.';
    SET @FailedTests = @FailedTests + 1;
END;

-- Test 6: Verify StockMovements sum matches net inventory adjustments
-- For each product, sum of quantity_delta in StockMovements should match current on_hand_quantity
DECLARE @MovementLedgerDiscrepancies INT;
SELECT @MovementLedgerDiscrepancies = COUNT(*)
FROM (
    SELECT 
        sm.product_id,
        SUM(sm.quantity_delta) AS ledger_total,
        i.on_hand_quantity
    FROM [dbo].[StockMovements] sm
    INNER JOIN [dbo].[Inventory] i ON sm.product_id = i.product_id
    GROUP BY sm.product_id, i.on_hand_quantity
    HAVING SUM(sm.quantity_delta) <> i.on_hand_quantity
) AS DiscrepantProducts;

IF @MovementLedgerDiscrepancies = 0
BEGIN
    PRINT '[PASS] Test 6: Invariant verified: StockMovements ledger delta sum precisely equals on_hand_quantity for all products.';
    SET @PassedTests = @PassedTests + 1;
END
ELSE
BEGIN
    PRINT '[FAIL] Test 6: Found ' + CAST(@MovementLedgerDiscrepancies AS NVARCHAR(10)) + ' products where ledger sum diverges from on_hand_quantity.';
    SET @FailedTests = @FailedTests + 1;
END;

PRINT '==================================================';
PRINT 'Inventory Invariant Test Summary:';
PRINT 'Passed: ' + CAST(@PassedTests AS NVARCHAR(10));
PRINT 'Failed: ' + CAST(@FailedTests AS NVARCHAR(10));
PRINT '==================================================';

IF @FailedTests > 0
    THROW 51000, 'Inventory invariant tests failed.', 1;
GO
