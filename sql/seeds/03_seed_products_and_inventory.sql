-- ==============================================================================
-- Seed Script: 03_seed_products_and_inventory.sql
-- Description: Seeds 35 sample products across categories with initial inventory
--              and opening stock movements ledger entries.
-- Idempotent: Uses MERGE based on unique SKU.
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

DECLARE @AdminUserId INT;
SELECT TOP 1 @AdminUserId = [user_id] FROM [dbo].[Users] WHERE [role] = 'Admin';
IF @AdminUserId IS NULL SET @AdminUserId = 1;

-- Product catalog staging table
DECLARE @ProductsSeed TABLE (
    sku NVARCHAR(50),
    product_name NVARCHAR(200),
    category_name NVARCHAR(100),
    supplier_name NVARCHAR(150),
    cost_price DECIMAL(18,4),
    selling_price DECIMAL(18,4),
    reorder_point INT,
    safety_stock INT,
    lead_time INT,
    opening_stock INT
);

INSERT INTO @ProductsSeed VALUES
-- Beverages (Cat: Beverages, Supplier: Apex Global Distributors / FreshValley)
('BEV-COLA-330', 'Classic Cola Can 330ml (Pack of 24)', 'Beverages', 'Apex Global Distributors', 9.5000, 18.9900, 20, 25, 5, 80),
('BEV-DIET-330', 'Diet Cola Can 330ml (Pack of 24)', 'Beverages', 'Apex Global Distributors', 9.5000, 18.9900, 15, 20, 5, 45),
('BEV-ORNG-100', 'Pure Squeezed Orange Juice 1L', 'Beverages', 'FreshValley Dairy & Foods', 1.6000, 3.4900, 25, 30, 3, 60),
('BEV-APPL-100', 'Cold Pressed Apple Cider 1L', 'Beverages', 'FreshValley Dairy & Foods', 1.8000, 3.8900, 15, 20, 3, 35),
('BEV-SPRK-500', 'Sparkling Mineral Water 500ml (Pack of 12)', 'Beverages', 'Apex Global Distributors', 4.2000, 8.4900, 18, 25, 5, 50),
('BEV-GRNT-050', 'Organic Japanese Green Tea Bags (50ct)', 'Beverages', 'Apex Global Distributors', 3.5000, 6.9900, 12, 15, 6, 40),
('BEV-ROST-250', 'Dark Roast Whole Bean Coffee 250g', 'Beverages', 'Apex Global Distributors', 4.0000, 8.9900, 14, 20, 5, 30),

-- Packaged Foods (Cat: Packaged Foods, Supplier: Pinnacle Wholesale Ltd)
('PKF-CHOC-150', 'Dark Chocolate Almond Bar 150g', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 1.2000, 2.7900, 30, 40, 7, 120),
('PKF-CRCK-200', 'Whole Grain Crackers Box 200g', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 1.1000, 2.4900, 25, 30, 7, 85),
('PKF-PSTA-500', 'Italian Durum Wheat Penne Pasta 500g', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 0.8500, 1.9900, 40, 50, 7, 150),
('PKF-TOMA-400', 'Organic Peeled Plum Tomatoes 400g Can', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 0.7000, 1.5900, 50, 60, 7, 200),
('PKF-OATS-100', 'Rolled Traditional Oats 1kg Tub', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 2.1000, 4.4900, 20, 25, 7, 65),
('PKF-CHIP-180', 'Sea Salt Kettle Potato Chips 180g', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 1.3000, 2.9900, 25, 35, 7, 75),
('PKF-ALMD-500', 'Roasted Unsalted Whole Almonds 500g', 'Packaged Foods', 'Pinnacle Wholesale Ltd', 5.5000, 10.9900, 15, 20, 7, 40),

-- Dairy & Chilled (Cat: Dairy & Chilled, Supplier: FreshValley Dairy & Foods)
('DRY-WMLK-100', 'Whole Pasteurized Fresh Milk 1L', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 0.9000, 1.8900, 35, 45, 3, 90),
('DRY-SMLK-100', 'Semi-Skimmed Fresh Milk 1L', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 0.9000, 1.8900, 30, 40, 3, 80),
('DRY-CHED-250', 'Aged Mature White Cheddar Block 250g', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 2.2000, 4.7900, 20, 25, 3, 55),
('DRY-YOGT-500', 'Natural Greek Strained Yogurt 500g', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 1.5000, 3.2900, 20, 25, 3, 50),
('DRY-BUTR-250', 'Salted Pure Creamery Butter 250g', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 1.6000, 3.4900, 25, 30, 3, 70),
('DRY-EGGS-012', 'Free Range Grade-A Eggs (12-pack)', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 2.0000, 4.2900, 30, 40, 2, 85),
('DRY-CRMT-200', 'Fresh Heavy Whipping Cream 200ml', 'Dairy & Chilled', 'FreshValley Dairy & Foods', 1.1000, 2.3900, 15, 20, 3, 40),

-- Household Essentials (Cat: Household Essentials, Supplier: CleanHome Consumer Goods)
('HSE-LDET-200', 'Concentrated Liquid Laundry Detergent 2L', 'Household Essentials', 'CleanHome Consumer Goods', 5.0000, 11.4900, 15, 20, 10, 45),
('HSE-DWSH-750', 'Antibacterial Dishwashing Liquid 750ml', 'Household Essentials', 'CleanHome Consumer Goods', 1.2000, 2.7900, 30, 35, 10, 95),
('HSE-PTOW-004', 'Ultra Absorbent Paper Towels (4 Rolls)', 'Household Essentials', 'CleanHome Consumer Goods', 2.8000, 5.9900, 20, 25, 10, 60),
('HSE-TLTP-012', 'Soft 3-Ply Toilet Tissue (12 Rolls)', 'Household Essentials', 'CleanHome Consumer Goods', 4.5000, 9.4900, 25, 30, 10, 75),
('HSE-TRSH-030', 'Heavy Duty Drawstring Trash Bags 30L (30ct)', 'Household Essentials', 'CleanHome Consumer Goods', 2.0000, 4.4900, 20, 25, 10, 65),
('HSE-CLNR-500', 'Multi-Surface Disinfectant Spray 500ml', 'Household Essentials', 'CleanHome Consumer Goods', 1.5000, 3.4900, 25, 30, 10, 80),
('HSE-SPNG-006', 'Heavy Duty Scrub Sponges (6-pack)', 'Household Essentials', 'CleanHome Consumer Goods', 1.4000, 3.1900, 20, 25, 10, 55),

-- Personal Care (Cat: Personal Care, Supplier: NovaCare Personal Brands)
('PER-SHMP-400', 'Nourishing Moisture Shampoo 400ml', 'Personal Care', 'NovaCare Personal Brands', 3.0000, 6.7900, 15, 20, 8, 45),
('PER-COND-400', 'Nourishing Moisture Conditioner 400ml', 'Personal Care', 'NovaCare Personal Brands', 3.0000, 6.7900, 15, 20, 8, 40),
('PER-BWSH-500', 'Hydrating Body Wash Gel 500ml', 'Personal Care', 'NovaCare Personal Brands', 2.6000, 5.8900, 20, 25, 8, 60),
('PER-SOAP-004', 'Gentle Cleansing Soap Bars (4-pack)', 'Personal Care', 'NovaCare Personal Brands', 1.8000, 3.9900, 25, 30, 8, 70),
('PER-TPST-100', 'Fluoride Total Protection Toothpaste 100ml', 'Personal Care', 'NovaCare Personal Brands', 1.2000, 2.6900, 30, 35, 8, 90),
('PER-TBRS-002', 'Medium Bristle Toothbrush Duo (2-pack)', 'Personal Care', 'NovaCare Personal Brands', 1.4000, 3.1900, 20, 25, 8, 50),
('PER-HDLT-250', 'Soothing Aloe Vera Hand Lotion 250ml', 'Personal Care', 'NovaCare Personal Brands', 2.2000, 4.9900, 15, 20, 8, 40);

-- Insert / Merge Products
DECLARE @sku NVARCHAR(50), @pname NVARCHAR(200), @cname NVARCHAR(100), @sname NVARCHAR(150);
DECLARE @cost DECIMAL(18,4), @price DECIMAL(18,4), @reorder INT, @safety INT, @lead INT, @stock INT;
DECLARE @catId INT, @supId INT, @prodId INT;

DECLARE prod_cursor CURSOR FOR
SELECT sku, product_name, category_name, supplier_name, cost_price, selling_price, reorder_point, safety_stock, lead_time, opening_stock
FROM @ProductsSeed;

OPEN prod_cursor;
FETCH NEXT FROM prod_cursor INTO @sku, @pname, @cname, @sname, @cost, @price, @reorder, @safety, @lead, @stock;

WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @catId = category_id FROM [dbo].[Categories] WHERE category_name = @cname;
    SELECT @supId = supplier_id FROM [dbo].[Suppliers] WHERE supplier_name = @sname;

    IF NOT EXISTS (SELECT 1 FROM [dbo].[Products] WHERE [sku] = @sku)
    BEGIN
        INSERT INTO [dbo].[Products] (
            [sku], [product_name], [category_id], [preferred_supplier_id],
            [cost_price], [selling_price], [reorder_point_threshold],
            [target_safety_stock], [lead_time_days], [is_active], [created_at], [updated_at]
        ) VALUES (
            @sku, @pname, @catId, @supId,
            @cost, @price, @reorder,
            @safety, @lead, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
        );

        SET @prodId = SCOPE_IDENTITY();

        -- Initialize Inventory record
        INSERT INTO [dbo].[Inventory] ([product_id], [on_hand_quantity], [reserved_quantity], [updated_at])
        VALUES (@prodId, @stock, 0, SYSUTCDATETIME());

        -- Record opening stock movement in ledger
        INSERT INTO [dbo].[StockMovements] (
            [product_id], [movement_type], [quantity_delta],
            [reference_type], [reference_id], [created_by_user_id], [created_at], [notes]
        ) VALUES (
            @prodId, 'ADJUSTMENT_IN', @stock,
            'InitialOpeningBalance', @prodId, @AdminUserId, SYSUTCDATETIME(), 'Initial catalogue seed opening stock balance'
        );
    END

    FETCH NEXT FROM prod_cursor INTO @sku, @pname, @cname, @sname, @cost, @price, @reorder, @safety, @lead, @stock;
END

CLOSE prod_cursor;
DEALLOCATE prod_cursor;

PRINT 'Products, Inventory, and Opening Stock Movements seeded successfully.';
GO
