-- ==============================================================================
-- Migration: 012_create_bi_reporting_views.sql
-- Description: Creates specialized business intelligence views for Metabase and 
--              in-app executive dashboards with documented KPI calculations.
--              Uses pre-aggregated subqueries to prevent line-item fan-out.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. Executive Summary KPIs View
IF OBJECT_ID('dbo.vw_BI_ExecutiveKPIs', 'V') IS NOT NULL
    DROP VIEW dbo.vw_BI_ExecutiveKPIs;
GO

CREATE VIEW dbo.vw_BI_ExecutiveKPIs AS
SELECT 
    -- Gross Revenue
    ISNULL(s_agg.total_revenue, 0) AS total_gross_revenue,
    ISNULL(s_agg.subtotal_revenue, 0) AS total_subtotal_revenue,
    ISNULL(s_agg.total_tax, 0) AS total_tax_collected,
    ISNULL(s_agg.total_sales_count, 0) AS total_transactions_count,
    ISNULL(si_agg.total_units_sold, 0) AS total_units_sold,

    -- Gross Profit & Margin
    ISNULL(si_agg.total_gross_profit, 0) AS total_gross_profit,
    CASE 
        WHEN ISNULL(s_agg.subtotal_revenue, 0) > 0 
        THEN ROUND((ISNULL(si_agg.total_gross_profit, 0) / s_agg.subtotal_revenue) * 100, 2)
        ELSE 0 
    END AS gross_margin_percentage,

    -- Inventory Valuation & SKU Counts
    ISNULL(inv_agg.total_active_skus, 0) AS total_active_skus,
    ISNULL(inv_agg.total_inventory_valuation, 0) AS total_inventory_valuation,
    ISNULL(inv_agg.low_stock_sku_count, 0) AS low_stock_sku_count,
    ISNULL(inv_agg.out_of_stock_sku_count, 0) AS out_of_stock_sku_count,

    -- Purchasing Metrics
    ISNULL(po_agg.total_po_spend, 0) AS total_po_spend,
    ISNULL(po_agg.open_po_count, 0) AS open_po_count
FROM 
    (
        SELECT 
            COUNT(s.sale_id) AS total_sales_count,
            SUM(s.total_amount) AS total_revenue,
            SUM(s.subtotal_amount) AS subtotal_revenue,
            SUM(s.tax_amount) AS total_tax
        FROM dbo.Sales s
        WHERE s.status = 'COMPLETED'
    ) s_agg
CROSS JOIN
    (
        SELECT 
            SUM(si.quantity) AS total_units_sold,
            SUM((si.unit_selling_price - si.unit_cost_at_sale) * si.quantity) AS total_gross_profit
        FROM dbo.SaleItems si
        INNER JOIN dbo.Sales s ON si.sale_id = s.sale_id
        WHERE s.status = 'COMPLETED'
    ) si_agg
CROSS JOIN
    (
        SELECT 
            COUNT(p.product_id) AS total_active_skus,
            SUM(i.on_hand_quantity * p.cost_price) AS total_inventory_valuation,
            SUM(CASE WHEN i.on_hand_quantity > 0 AND i.on_hand_quantity <= p.reorder_point_threshold THEN 1 ELSE 0 END) AS low_stock_sku_count,
            SUM(CASE WHEN i.on_hand_quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock_sku_count
        FROM dbo.Products p
        INNER JOIN dbo.Inventory i ON p.product_id = i.product_id
        WHERE p.is_active = 1
    ) inv_agg
CROSS JOIN
    (
        SELECT 
            SUM(po.total_amount) AS total_po_spend,
            SUM(CASE WHEN po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED') THEN 1 ELSE 0 END) AS open_po_count
        FROM dbo.PurchaseOrders po
        WHERE po.status <> 'CANCELLED'
    ) po_agg;
GO

-- 2. Daily Sales & Revenue Trends View
IF OBJECT_ID('dbo.vw_BI_DailySalesTrends', 'V') IS NOT NULL
    DROP VIEW dbo.vw_BI_DailySalesTrends;
GO

CREATE VIEW dbo.vw_BI_DailySalesTrends AS
SELECT 
    CAST(s.sale_date AS DATE) AS sale_business_date,
    COUNT(s.sale_id) AS daily_transactions_count,
    SUM(s.subtotal_amount) AS daily_subtotal,
    SUM(s.tax_amount) AS daily_tax,
    SUM(s.total_amount) AS daily_total_revenue,
    SUM(si_agg.units_sold) AS daily_units_sold,
    SUM(si_agg.gross_profit) AS daily_gross_profit,
    CASE 
        WHEN SUM(s.subtotal_amount) > 0 
        THEN ROUND((SUM(si_agg.gross_profit) / SUM(s.subtotal_amount)) * 100, 2)
        ELSE 0 
    END AS daily_gross_margin_pct
FROM dbo.Sales s
INNER JOIN (
    SELECT 
        sale_id,
        SUM(quantity) AS units_sold,
        SUM((unit_selling_price - unit_cost_at_sale) * quantity) AS gross_profit
    FROM dbo.SaleItems
    GROUP BY sale_id
) si_agg ON s.sale_id = si_agg.sale_id
WHERE s.status = 'COMPLETED'
GROUP BY CAST(s.sale_date AS DATE);
GO

-- 3. Category Performance View
IF OBJECT_ID('dbo.vw_BI_CategoryPerformance', 'V') IS NOT NULL
    DROP VIEW dbo.vw_BI_CategoryPerformance;
GO

CREATE VIEW dbo.vw_BI_CategoryPerformance AS
SELECT 
    c.category_id,
    c.category_name,
    COUNT(DISTINCT p.product_id) AS active_products_count,
    ISNULL(SUM(prod_sales.units_sold), 0) AS total_units_sold,
    ISNULL(SUM(prod_sales.revenue), 0) AS total_category_revenue,
    ISNULL(SUM(prod_sales.gross_profit), 0) AS category_gross_profit,
    ISNULL(SUM(i.on_hand_quantity * p.cost_price), 0) AS category_inventory_valuation
FROM dbo.Categories c
INNER JOIN dbo.Products p ON c.category_id = p.category_id
INNER JOIN dbo.Inventory i ON p.product_id = i.product_id
LEFT JOIN (
    SELECT 
        si.product_id,
        SUM(si.quantity) AS units_sold,
        SUM(si.subtotal) AS revenue,
        SUM((si.unit_selling_price - si.unit_cost_at_sale) * si.quantity) AS gross_profit
    FROM dbo.SaleItems si
    INNER JOIN dbo.Sales s ON si.sale_id = s.sale_id
    WHERE s.status = 'COMPLETED'
    GROUP BY si.product_id
) prod_sales ON p.product_id = prod_sales.product_id
WHERE p.is_active = 1
GROUP BY c.category_id, c.category_name;
GO

-- 4. Top Selling Products View
IF OBJECT_ID('dbo.vw_BI_TopProducts', 'V') IS NOT NULL
    DROP VIEW dbo.vw_BI_TopProducts;
GO

CREATE VIEW dbo.vw_BI_TopProducts AS
SELECT 
    p.product_id,
    p.sku,
    p.product_name,
    c.category_name,
    p.selling_price,
    p.cost_price,
    ISNULL(prod_sales.units_sold, 0) AS total_units_sold,
    ISNULL(prod_sales.revenue, 0) AS total_sales_revenue,
    ISNULL(prod_sales.gross_profit, 0) AS total_gross_profit,
    i.on_hand_quantity AS current_on_hand_stock
FROM dbo.Products p
INNER JOIN dbo.Categories c ON p.category_id = c.category_id
INNER JOIN dbo.Inventory i ON p.product_id = i.product_id
LEFT JOIN (
    SELECT 
        si.product_id,
        SUM(si.quantity) AS units_sold,
        SUM(si.subtotal) AS revenue,
        SUM((si.unit_selling_price - si.unit_cost_at_sale) * si.quantity) AS gross_profit
    FROM dbo.SaleItems si
    INNER JOIN dbo.Sales s ON si.sale_id = s.sale_id
    WHERE s.status = 'COMPLETED'
    GROUP BY si.product_id
) prod_sales ON p.product_id = prod_sales.product_id
WHERE p.is_active = 1;
GO

-- 5. Supplier Performance & Spend View
IF OBJECT_ID('dbo.vw_BI_SupplierPerformance', 'V') IS NOT NULL
    DROP VIEW dbo.vw_BI_SupplierPerformance;
GO

CREATE VIEW dbo.vw_BI_SupplierPerformance AS
SELECT 
    s.supplier_id,
    s.supplier_name,
    s.contact_email,
    s.default_lead_time_days,
    ISNULL(po_sum.total_pos, 0) AS total_purchase_orders,
    ISNULL(po_sum.total_spend, 0) AS total_po_spend,
    ISNULL(po_sum.units_ordered, 0) AS total_units_ordered,
    ISNULL(po_sum.units_received, 0) AS total_units_received,
    CASE 
        WHEN ISNULL(po_sum.units_ordered, 0) > 0 
        THEN ROUND((CAST(po_sum.units_received AS FLOAT) / CAST(po_sum.units_ordered AS FLOAT)) * 100, 2)
        ELSE 0 
    END AS fulfillment_rate_pct,
    COUNT(DISTINCT p.product_id) AS catalog_skus_supplied
FROM dbo.Suppliers s
LEFT JOIN dbo.Products p ON s.supplier_id = p.preferred_supplier_id AND p.is_active = 1
LEFT JOIN (
    SELECT 
        po.supplier_id,
        COUNT(po.po_id) AS total_pos,
        SUM(po.total_amount) AS total_spend,
        SUM(poi_agg.ordered_qty) AS units_ordered,
        SUM(poi_agg.received_qty) AS units_received
    FROM dbo.PurchaseOrders po
    LEFT JOIN (
        SELECT 
            po_id,
            SUM(ordered_quantity) AS ordered_qty,
            SUM(received_quantity) AS received_qty
        FROM dbo.PurchaseOrderItems
        GROUP BY po_id
    ) poi_agg ON po.po_id = poi_agg.po_id
    WHERE po.status <> 'CANCELLED'
    GROUP BY po.supplier_id
) po_sum ON s.supplier_id = po_sum.supplier_id
WHERE s.is_active = 1
GROUP BY s.supplier_id, s.supplier_name, s.contact_email, s.default_lead_time_days,
         po_sum.total_pos, po_sum.total_spend, po_sum.units_ordered, po_sum.units_received;
GO

-- 6. Grant read access to the read-only BI user
GRANT SELECT ON dbo.vw_BI_ExecutiveKPIs TO [stockpilot_bi_readonly];
GRANT SELECT ON dbo.vw_BI_DailySalesTrends TO [stockpilot_bi_readonly];
GRANT SELECT ON dbo.vw_BI_CategoryPerformance TO [stockpilot_bi_readonly];
GRANT SELECT ON dbo.vw_BI_TopProducts TO [stockpilot_bi_readonly];
GRANT SELECT ON dbo.vw_BI_SupplierPerformance TO [stockpilot_bi_readonly];
GO

PRINT 'Migration 012_create_bi_reporting_views.sql completed successfully.';
GO
