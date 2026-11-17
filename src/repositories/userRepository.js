const { connectDB, sql } = require('../config/database');

class UserRepository {
  /**
   * Finds an active user by email address.
   */
  async findByEmail(email) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query(`
        SELECT [user_id], [email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at]
        FROM [dbo].[Users]
        WHERE [email] = @email;
      `);

    return result.recordset[0] || null;
  }

  /**
   * Finds a user by ID.
   */
  async findById(userId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT [user_id], [email], [full_name], [role], [is_active], [created_at], [updated_at]
        FROM [dbo].[Users]
        WHERE [user_id] = @userId;
      `);

    return result.recordset[0] || null;
  }

  /**
   * Retrieves all users (excluding password hashes).
   */
  async findAll({ includeInactive = false } = {}) {
    const pool = await connectDB();
    const request = pool.request();
    
    let query = `
      SELECT [user_id], [email], [full_name], [role], [is_active], [created_at], [updated_at]
      FROM [dbo].[Users]
    `;

    if (!includeInactive) {
      query += ` WHERE [is_active] = 1`;
    }

    query += ` ORDER BY [user_id] ASC;`;

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Creates a new user record.
   */
  async create({ email, passwordHash, fullName, role }) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('fullName', sql.NVarChar(100), fullName)
      .input('role', sql.NVarChar(20), role)
      .query(`
        INSERT INTO [dbo].[Users] ([email], [password_hash], [full_name], [role], [is_active], [created_at], [updated_at])
        OUTPUT INSERTED.[user_id], INSERTED.[email], INSERTED.[full_name], INSERTED.[role], INSERTED.[is_active], INSERTED.[created_at]
        VALUES (@email, @passwordHash, @fullName, @role, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
      `);

    return result.recordset[0];
  }

  /**
   * Deactivates a user (soft delete).
   */
  async deactivate(userId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE [dbo].[Users]
        SET [is_active] = 0, [updated_at] = SYSUTCDATETIME()
        OUTPUT INSERTED.[user_id], INSERTED.[email], INSERTED.[is_active]
        WHERE [user_id] = @userId;
      `);

    return result.recordset[0] || null;
  }
}

module.exports = new UserRepository();
