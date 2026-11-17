const { connectDB, sql } = require('../config/database');

class SupplierRepository {
  async findAll({ includeInactive = false } = {}) {
    const pool = await connectDB();
    let query = `
      SELECT [supplier_id], [supplier_name], [contact_email], [contact_phone], [address], [default_lead_time_days], [is_active], [created_at]
      FROM [dbo].[Suppliers]
    `;
    if (!includeInactive) {
      query += ` WHERE [is_active] = 1`;
    }
    query += ` ORDER BY [supplier_name] ASC;`;

    const result = await pool.request().query(query);
    return result.recordset;
  }

  async findById(supplierId) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('supplierId', sql.Int, supplierId)
      .query(`
        SELECT [supplier_id], [supplier_name], [contact_email], [contact_phone], [address], [default_lead_time_days], [is_active], [created_at]
        FROM [dbo].[Suppliers]
        WHERE [supplier_id] = @supplierId;
      `);

    return result.recordset[0] || null;
  }

  async create({ supplierName, contactEmail = null, contactPhone = null, address = null, defaultLeadTimeDays = 7 }) {
    const pool = await connectDB();
    const result = await pool.request()
      .input('supplierName', sql.NVarChar(150), supplierName)
      .input('contactEmail', sql.NVarChar(255), contactEmail)
      .input('contactPhone', sql.NVarChar(50), contactPhone)
      .input('address', sql.NVarChar(300), address)
      .input('defaultLeadTimeDays', sql.Int, defaultLeadTimeDays)
      .query(`
        INSERT INTO [dbo].[Suppliers] (
          [supplier_name], [contact_email], [contact_phone], [address], [default_lead_time_days], [is_active], [created_at]
        )
        OUTPUT INSERTED.[supplier_id], INSERTED.[supplier_name], INSERTED.[contact_email], INSERTED.[contact_phone], INSERTED.[address], INSERTED.[default_lead_time_days], INSERTED.[is_active]
        VALUES (@supplierName, @contactEmail, @contactPhone, @address, @defaultLeadTimeDays, 1, SYSUTCDATETIME());
      `);

    return result.recordset[0];
  }

  async update(supplierId, { supplierName, contactEmail, contactPhone, address, defaultLeadTimeDays, isActive }) {
    const pool = await connectDB();
    const request = pool.request().input('supplierId', sql.Int, supplierId);

    const updates = [];
    if (supplierName !== undefined) {
      request.input('supplierName', sql.NVarChar(150), supplierName);
      updates.push('[supplier_name] = @supplierName');
    }
    if (contactEmail !== undefined) {
      request.input('contactEmail', sql.NVarChar(255), contactEmail);
      updates.push('[contact_email] = @contactEmail');
    }
    if (contactPhone !== undefined) {
      request.input('contactPhone', sql.NVarChar(50), contactPhone);
      updates.push('[contact_phone] = @contactPhone');
    }
    if (address !== undefined) {
      request.input('address', sql.NVarChar(300), address);
      updates.push('[address] = @address');
    }
    if (defaultLeadTimeDays !== undefined) {
      request.input('defaultLeadTimeDays', sql.Int, defaultLeadTimeDays);
      updates.push('[default_lead_time_days] = @defaultLeadTimeDays');
    }
    if (isActive !== undefined) {
      request.input('isActive', sql.Bit, isActive ? 1 : 0);
      updates.push('[is_active] = @isActive');
    }

    if (updates.length === 0) return this.findById(supplierId);

    const query = `
      UPDATE [dbo].[Suppliers]
      SET ${updates.join(', ')}
      OUTPUT INSERTED.[supplier_id], INSERTED.[supplier_name], INSERTED.[contact_email], INSERTED.[contact_phone], INSERTED.[address], INSERTED.[default_lead_time_days], INSERTED.[is_active]
      WHERE [supplier_id] = @supplierId;
    `;

    const result = await request.query(query);
    return result.recordset[0] || null;
  }
}

module.exports = new SupplierRepository();
