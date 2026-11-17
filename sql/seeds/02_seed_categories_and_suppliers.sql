-- ==============================================================================
-- Seed Script: 02_seed_categories_and_suppliers.sql
-- Description: Seeds initial product categories and commercial suppliers.
-- Idempotent: Uses IF NOT EXISTS per record.
-- ==============================================================================

USE [StockPilotDB];
GO

SET NOCOUNT ON;

-- 1. Seed Categories
DECLARE @Categories TABLE (name NVARCHAR(100), description NVARCHAR(500));
INSERT INTO @Categories (name, description) VALUES
('Beverages', 'Soft drinks, packaged juices, tea, coffee, and energy drinks'),
('Packaged Foods', 'Snacks, biscuits, canned goods, breakfast cereals, and dry pasta'),
('Dairy & Chilled', 'Milk, yogurt, cheese, butter, and perishable refrigerated goods'),
('Household Essentials', 'Cleaning agents, detergents, paper towels, and sanitary products'),
('Personal Care', 'Shampoo, soaps, oral hygiene, and skincare cosmetics');

MERGE [dbo].[Categories] AS target
USING @Categories AS source
ON target.[category_name] = source.name
WHEN NOT MATCHED THEN
    INSERT ([category_name], [description], [is_active], [created_at])
    VALUES (source.name, source.description, 1, SYSUTCDATETIME());

PRINT 'Categories seeded successfully.';
GO

-- 2. Seed Suppliers
DECLARE @Suppliers TABLE (
    name NVARCHAR(150), 
    email NVARCHAR(255), 
    phone NVARCHAR(50), 
    address NVARCHAR(300), 
    lead_time INT
);

INSERT INTO @Suppliers (name, email, phone, address, lead_time) VALUES
('Apex Global Distributors', 'orders@apexdistributors.com', '+1-800-555-0199', '100 Distribution Parkway, Chicago, IL 60601', 5),
('Pinnacle Wholesale Ltd', 'supply@pinnaclewholesale.com', '+1-800-555-0142', '45 Industrial Ave, Dallas, TX 75201', 7),
('FreshValley Dairy & Foods', 'procurement@freshvalley.com', '+1-800-555-0177', '12 Greenfield Way, Madison, WI 53703', 3),
('CleanHome Consumer Goods', 'sales@cleanhomegoods.com', '+1-800-555-0123', '88 Logistics Blvd, Atlanta, GA 30301', 10),
('NovaCare Personal Brands', 'vendor@novacarebrands.com', '+1-800-555-0188', '500 Harbor Dr, Jersey City, NJ 07302', 8);

MERGE [dbo].[Suppliers] AS target
USING @Suppliers AS source
ON target.[supplier_name] = source.name
WHEN NOT MATCHED THEN
    INSERT ([supplier_name], [contact_email], [contact_phone], [address], [default_lead_time_days], [is_active], [created_at])
    VALUES (source.name, source.email, source.phone, source.address, source.lead_time, 1, SYSUTCDATETIME());

PRINT 'Suppliers seeded successfully.';
GO
