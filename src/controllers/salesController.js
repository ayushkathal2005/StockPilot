const salesService = require('../services/salesService');

class SalesController {
  async createSale(req, res, next) {
    try {
      const { items } = req.body;
      const sale = await salesService.createSale({
        userId: req.user.userId || req.user.user_id,
        items,
        ipAddress: req.ip
      });
      res.status(201).json({ success: true, message: 'Sale completed successfully', data: sale });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_STOCK') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: err.message,
            details: err.details
          }
        });
      }
      if (err.code === 'PRODUCT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: err.message } });
      }
      if (err.code === 'PRODUCT_INACTIVE') {
        return res.status(400).json({ success: false, error: { code: 'PRODUCT_INACTIVE', message: err.message } });
      }
      next(err);
    }
  }

  async getSales(req, res, next) {
    try {
      const { limit, offset, startDate, endDate, userId } = req.query;
      const sales = await salesService.getSales({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        startDate,
        endDate,
        userId: userId ? parseInt(userId, 10) : undefined
      });
      res.json({ success: true, data: sales });
    } catch (err) {
      next(err);
    }
  }

  async getSaleById(req, res, next) {
    try {
      const sale = await salesService.getSaleById(parseInt(req.params.id, 10));
      res.json({ success: true, data: sale });
    } catch (err) {
      if (err.code === 'SALE_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'SALE_NOT_FOUND', message: err.message } });
      }
      next(err);
    }
  }
}

module.exports = new SalesController();
