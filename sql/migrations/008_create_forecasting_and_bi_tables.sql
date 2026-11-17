-- ==============================================================================
-- Migration: 008_create_forecasting_and_bi_tables.sql
-- Description: Creates Demand Forecasting, Runs, and Replenishment Recommendations tables.
-- ==============================================================================

USE [StockPilotDB];
GO

-- 1. DailyProductDemand Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'DailyProductDemand' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[DailyProductDemand] (
        [product_id] INT NOT NULL,
        [business_date] DATE NOT NULL,
        [units_sold] INT NOT NULL CONSTRAINT [DF_DailyDemand_units] DEFAULT (0),
        [selling_price] DECIMAL(18,4) NOT NULL,
        [is_promotional_day] BIT NOT NULL CONSTRAINT [DF_DailyDemand_promo] DEFAULT (0),
        [is_stockout_day] BIT NOT NULL CONSTRAINT [DF_DailyDemand_stockout] DEFAULT (0),
        [data_source] NVARCHAR(50) NOT NULL CONSTRAINT [DF_DailyDemand_source] DEFAULT ('POS_AGGREGATION'),

        CONSTRAINT [PK_DailyProductDemand] PRIMARY KEY CLUSTERED ([product_id] ASC, [business_date] ASC),
        CONSTRAINT [FK_DailyDemand_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]) ON DELETE CASCADE,
        CONSTRAINT [CK_DailyDemand_units] CHECK ([units_sold] >= 0),
        CONSTRAINT [CK_DailyDemand_price] CHECK ([selling_price] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_DailyDemand_business_date] 
        ON [dbo].[DailyProductDemand] ([business_date] ASC);

    PRINT 'Table [dbo].[DailyProductDemand] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[DailyProductDemand] already exists.';
END
GO

-- 2. ForecastRuns Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'ForecastRuns' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[ForecastRuns] (
        [run_id] INT IDENTITY(1,1) NOT NULL,
        [model_version] NVARCHAR(50) NOT NULL,
        [run_timestamp] DATETIME2(7) NOT NULL CONSTRAINT [DF_ForecastRuns_timestamp] DEFAULT (SYSUTCDATETIME()),
        [horizon_days] INT NOT NULL CONSTRAINT [DF_ForecastRuns_horizon] DEFAULT (14),
        [train_start_date] DATE NULL,
        [train_end_date] DATE NULL,
        [test_wape] DECIMAL(8,4) NULL,
        [test_mae] DECIMAL(8,4) NULL,
        [test_rmse] DECIMAL(8,4) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ForecastRuns_status] DEFAULT ('COMPLETED'),

        CONSTRAINT [PK_ForecastRuns] PRIMARY KEY CLUSTERED ([run_id] ASC),
        CONSTRAINT [CK_ForecastRuns_horizon] CHECK ([horizon_days] >= 7 AND [horizon_days] <= 30),
        CONSTRAINT [CK_ForecastRuns_status] CHECK ([status] IN ('RUNNING', 'COMPLETED', 'FAILED'))
    );

    CREATE NONCLUSTERED INDEX [IX_ForecastRuns_timestamp] 
        ON [dbo].[ForecastRuns] ([run_timestamp] DESC);

    PRINT 'Table [dbo].[ForecastRuns] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[ForecastRuns] already exists.';
END
GO

-- 3. DemandForecasts Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'DemandForecasts' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[DemandForecasts] (
        [forecast_id] INT IDENTITY(1,1) NOT NULL,
        [run_id] INT NOT NULL,
        [product_id] INT NOT NULL,
        [forecast_date] DATE NOT NULL,
        [predicted_units] DECIMAL(10,2) NOT NULL,
        [forecast_source] NVARCHAR(30) NOT NULL CONSTRAINT [DF_DemandForecasts_source] DEFAULT ('xgboost'),

        CONSTRAINT [PK_DemandForecasts] PRIMARY KEY CLUSTERED ([forecast_id] ASC),
        CONSTRAINT [FK_DemandForecasts_Runs] FOREIGN KEY ([run_id]) REFERENCES [dbo].[ForecastRuns] ([run_id]) ON DELETE CASCADE,
        CONSTRAINT [FK_DemandForecasts_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]),
        CONSTRAINT [CK_DemandForecasts_predicted_units] CHECK ([predicted_units] >= 0)
    );

    CREATE NONCLUSTERED INDEX [IX_DemandForecasts_run_product] 
        ON [dbo].[DemandForecasts] ([run_id], [product_id]);
    CREATE NONCLUSTERED INDEX [IX_DemandForecasts_product_date] 
        ON [dbo].[DemandForecasts] ([product_id], [forecast_date]);

    PRINT 'Table [dbo].[DemandForecasts] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[DemandForecasts] already exists.';
END
GO

-- 4. ReplenishmentRecommendations Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'ReplenishmentRecommendations' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[ReplenishmentRecommendations] (
        [recommendation_id] INT IDENTITY(1,1) NOT NULL,
        [product_id] INT NOT NULL,
        [run_id] INT NULL,
        [current_on_hand] INT NOT NULL,
        [open_purchase_quantity] INT NOT NULL CONSTRAINT [DF_Replenish_open_po] DEFAULT (0),
        [inventory_position] INT NOT NULL,
        [lead_time_demand] DECIMAL(10,2) NOT NULL,
        [target_horizon_demand] DECIMAL(10,2) NOT NULL,
        [safety_stock] DECIMAL(10,2) NOT NULL,
        [target_stock] DECIMAL(10,2) NOT NULL,
        [suggested_quantity] INT NOT NULL,
        [recommendation_source] NVARCHAR(30) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Replenish_status] DEFAULT ('PENDING'),
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_Replenish_created_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_ReplenishmentRecommendations] PRIMARY KEY CLUSTERED ([recommendation_id] ASC),
        CONSTRAINT [FK_Replenish_Products] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Products] ([product_id]),
        CONSTRAINT [FK_Replenish_ForecastRuns] FOREIGN KEY ([run_id]) REFERENCES [dbo].[ForecastRuns] ([run_id]),
        CONSTRAINT [CK_Replenish_suggested_qty] CHECK ([suggested_quantity] >= 0),
        CONSTRAINT [CK_Replenish_status] CHECK ([status] IN ('PENDING', 'APPROVED_TO_PO', 'REJECTED'))
    );

    CREATE NONCLUSTERED INDEX [IX_Replenish_product_status] 
        ON [dbo].[ReplenishmentRecommendations] ([product_id], [status]);

    PRINT 'Table [dbo].[ReplenishmentRecommendations] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[ReplenishmentRecommendations] already exists.';
END
GO
