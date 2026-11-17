const { connectDB, sql } = require('../config/database');

class AuditRepository {
  /**
   * Logs an action into the AuditLogs table.
   */
  async log({ userId, actionType, entityName, entityId = null, details = null }) {
    try {
      const pool = await connectDB();
      const detailsJson = details ? JSON.stringify(details) : null;

      await pool.request()
        .input('userId', sql.Int, userId || null)
        .input('actionType', sql.NVarChar(50), actionType)
        .input('entityName', sql.NVarChar(50), entityName)
        .input('entityId', sql.Int, entityId)
        .input('detailsJson', sql.NVarChar(sql.MAX), detailsJson)
        .query(`
          INSERT INTO [dbo].[AuditLogs] ([user_id], [action_type], [entity_name], [entity_id], [details_json], [created_at])
          VALUES (@userId, @actionType, @entityName, @entityId, @detailsJson, SYSUTCDATETIME());
        `);
    } catch (err) {
      console.error('[AuditLog Error]: Failed to write audit log:', err.message);
      // Non-blocking for the primary operation
    }
  }
}

module.exports = new AuditRepository();
