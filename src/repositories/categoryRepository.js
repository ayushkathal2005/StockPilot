const { connectDB, sql } = require('../config/database');

class CategoryRepository {
  async findAll({ includeInactive = false } = {}) {
    const pool = await connectDB();
    let query = `
      SELECT [category_id], [category_name], [description], [is_active], [created_at]
      FROM [dbo].[Categories]
    `;
    if (!includeInactive) {
      query += ` WHERE [is_active] = 1`;
    }
    query += ` ORDER BY [category_name] ASC;`;

    const result = await pool.request().query(query);
    return result.recordset;
  }

  async findById(categoryId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query(`
        SELECT [category_id], [category_name], [description], [is_active], [created_at]
        FROM [dbo].[Categories]
        WHERE [category_id] = @categoryId;
      `);

    return result.recordset[0] || null;
  }

  async findByName(categoryName) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('categoryName', sql.NVarChar(100), categoryName)
      .query(`
        SELECT [category_id], [category_name], [description], [is_active]
        FROM [dbo].[Categories]
        WHERE [category_name] = @categoryName;
      `);

    return result.recordset[0] || null;
  }

  async create({ categoryName, description = null }) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('categoryName', sql.NVarChar(100), categoryName)
      .input('description', sql.NVarChar(500), description)
      .query(`
        INSERT INTO [dbo].[Categories] ([category_name], [description], [is_active], [created_at])
        OUTPUT INSERTED.[category_id], INSERTED.[category_name], INSERTED.[description], INSERTED.[is_active], INSERTED.[created_at]
        VALUES (@categoryName, @description, 1, SYSUTCDATETIME());
      `);

    return result.recordset[0];
  }

  async update(categoryId, { categoryName, description, isActive }) {
    const pool = await connectDB();
    const request = pool.request().input('categoryId', sql.Int, categoryId);

    const updates = [];
    if (categoryName !== undefined) {
      request.input('categoryName', sql.NVarChar(100), categoryName);
      updates.push('[category_name] = @categoryName');
    }
    if (description !== undefined) {
      request.input('description', sql.NVarChar(500), description);
      updates.push('[description] = @description');
    }
    if (isActive !== undefined) {
      request.input('isActive', sql.Bit, isActive ? 1 : 0);
      updates.push('[is_active] = @isActive');
    }

    if (updates.length === 0) return this.findById(categoryId);

    const query = `
      UPDATE [dbo].[Categories]
      SET ${updates.join(', ')}
      OUTPUT INSERTED.[category_id], INSERTED.[category_name], INSERTED.[description], INSERTED.[is_active]
      WHERE [category_id] = @categoryId;
    `;

    const result = await request.query(query);
    return result.recordset[0] || null;
  }
}

module.exports = new CategoryRepository();
