-- ==============================================================================
-- Migration: 010_create_views_and_indexes.sql
-- Description: Creates operational and analytical views for reporting and ML.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. View: vw_InventoryCurrentPosition
-- Computes Available Stock and Inventory Position adhering strictly to Part D invariants.
IF OBJECT_ID(N'[dbo].[vw_InventoryCurrentPosition]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vw_InventoryCurrentPosition];
GO

CREATE VIEW [dbo].[vw_InventoryCurrentPosition]
AS
WITH OpenPOQuantities AS (
    SELECT 
        poi.product_id,
        ISNULL(SUM(poi.ordered_quantity - poi.received_quantity), 0) AS open_purchase_quantity
    FROM [dbo].[PurchaseOrderItems] poi
    INNER JOIN [dbo].[PurchaseOrders] po ON poi.po_id = po.po_id
    WHERE po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
    GROUP BY poi.product_id
)
SELECT 
    p.[product_id],
    p.[sku],
    p.[product_name],
    p.[category_id],
    c.[category_name],
    p.[preferred_supplier_id],
    s.[supplier_name],
    p.[cost_price],
    p.[selling_price],
    p.[reorder_point_threshold],
    p.[target_safety_stock],
    p.[lead_time_days],
    p.[is_active],
    ISNULL(i.[on_hand_quantity], 0) AS [on_hand_quantity],
    ISNULL(i.[reserved_quantity], 0) AS [reserved_quantity],
    (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) AS [available_quantity],
    ISNULL(opo.[open_purchase_quantity], 0) AS [open_purchase_quantity],
    ((ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) + ISNULL(opo.[open_purchase_quantity], 0)) AS [inventory_position],
    CASE 
        WHEN (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= 0 THEN 'OUT_OF_STOCK'
        WHEN (ISNULL(i.[on_hand_quantity], 0) - ISNULL(i.[reserved_quantity], 0)) <= p.[reorder_point_threshold] THEN 'LOW_STOCK'
        ELSE 'OPTIMAL'
    END AS [stock_health_status],
    i.[updated_at] AS [inventory_updated_at]
FROM [dbo].[Products] p
INNER JOIN [dbo].[Categories] c ON p.category_id = c.category_id
LEFT JOIN [dbo].[Suppliers] s ON p.preferred_supplier_id = s.supplier_id
LEFT JOIN [dbo].[Inventory] i ON p.product_id = i.product_id
LEFT JOIN OpenPOQuantities opo ON p.product_id = opo.product_id;
GO

PRINT 'View [dbo].[vw_InventoryCurrentPosition] created successfully.';
GO

-- 2. View: vw_ProductDailyDemand
-- Aggregates completed sales by product and calendar business date.
IF OBJECT_ID(N'[dbo].[vw_ProductDailyDemand]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vw_ProductDailyDemand];
GO

CREATE VIEW [dbo].[vw_ProductDailyDemand]
AS
SELECT 
    si.[product_id],
    p.[sku],
    p.[product_name],
    p.[category_id],
    CAST(s.[sale_date] AS DATE) AS [business_date],
    SUM(si.[quantity]) AS [units_sold],
    CAST(SUM(si.[subtotal]) / NULLIF(SUM(si.[quantity]), 0) AS DECIMAL(18,4)) AS [average_selling_price],
    SUM(si.[subtotal]) AS [total_revenue],
    SUM(si.[quantity] * si.[unit_cost_at_sale]) AS [total_cost_at_sale],
    (SUM(si.[subtotal]) - SUM(si.[quantity] * si.[unit_cost_at_sale])) AS [gross_profit]
FROM [dbo].[SaleItems] si
INNER JOIN [dbo].[Sales] s ON si.sale_id = s.sale_id
INNER JOIN [dbo].[Products] p ON si.product_id = p.product_id
WHERE s.status = 'COMPLETED'
GROUP BY 
    si.[product_id],
    p.[sku],
    p.[product_name],
    p.[category_id],
    CAST(s.[sale_date] AS DATE);
GO

PRINT 'View [dbo].[vw_ProductDailyDemand] created successfully.';
GO

-- 3. View: vw_LowStockAlerts
IF OBJECT_ID(N'[dbo].[vw_LowStockAlerts]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vw_LowStockAlerts];
GO

CREATE VIEW [dbo].[vw_LowStockAlerts]
AS
SELECT 
    [product_id],
    [sku],
    [product_name],
    [category_name],
    [supplier_name],
    [on_hand_quantity],
    [available_quantity],
    [open_purchase_quantity],
    [inventory_position],
    [reorder_point_threshold],
    [target_safety_stock],
    [stock_health_status]
FROM [dbo].[vw_InventoryCurrentPosition]
WHERE [is_active] = 1 
  AND [stock_health_status] IN ('LOW_STOCK', 'OUT_OF_STOCK');
GO

PRINT 'View [dbo].[vw_LowStockAlerts] created successfully.';
GO
