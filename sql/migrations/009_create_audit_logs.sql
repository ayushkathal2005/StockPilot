-- ==============================================================================
-- Migration: 009_create_audit_logs.sql
-- Description: Creates AuditLogs table for security and compliance tracking.
-- ==============================================================================

USE [StockPilotDB];
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'AuditLogs' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[AuditLogs] (
        [audit_id] BIGINT IDENTITY(1,1) NOT NULL,
        [user_id] INT NULL,
        [action_type] NVARCHAR(50) NOT NULL,
        [entity_name] NVARCHAR(50) NOT NULL,
        [entity_id] INT NULL,
        [details_json] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2(7) NOT NULL CONSTRAINT [DF_AuditLogs_created_at] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED ([audit_id] ASC),
        CONSTRAINT [FK_AuditLogs_Users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE SET NULL
    );

    CREATE NONCLUSTERED INDEX [IX_AuditLogs_entity] 
        ON [dbo].[AuditLogs] ([entity_name], [entity_id]);
    CREATE NONCLUSTERED INDEX [IX_AuditLogs_created_at] 
        ON [dbo].[AuditLogs] ([created_at] DESC);

    PRINT 'Table [dbo].[AuditLogs] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[AuditLogs] already exists.';
END
GO
