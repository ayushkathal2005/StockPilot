const supplierService = require('../services/supplierService');

class SupplierController {
  async listSuppliers(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const suppliers = await supplierService.getAll({ includeInactive });
      return res.status(200).json({
        success: true,
        count: suppliers.length,
        data: suppliers
      });
    } catch (err) {
      next(err);
    }
  }

  async getSupplier(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      return res.status(200).json({
        success: true,
        data: supplier
      });
    } catch (err) {
      next(err);
    }
  }

  async createSupplier(req, res, next) {
    try {
      const supplier = await supplierService.create(req.body);
      return res.status(201).json({
        success: true,
        message: 'Supplier created successfully.',
        data: supplier
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSupplier(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Supplier updated successfully.',
        data: supplier
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SupplierController();
