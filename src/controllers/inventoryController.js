const inventoryService = require('../services/inventoryService');

class InventoryController {
  async getInventory(req, res, next) {
    try {
      const { categoryId, stockHealth, search } = req.query;
      const data = await inventoryService.getInventoryPositions({
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        stockHealth,
        search
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req, res, next) {
    try {
      const { productId, movementType, limit, offset } = req.query;
      const data = await inventoryService.getStockMovements({
        productId: productId ? parseInt(productId, 10) : undefined,
        movementType,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { productId, quantityDelta, movementType, notes } = req.body;
      const data = await inventoryService.adjustStock({
        productId,
        quantityDelta,
        movementType,
        userId: req.user.userId || req.user.user_id,
        notes,
        ipAddress: req.ip
      });
      res.status(200).json({ success: true, message: 'Stock adjusted successfully', data });
    } catch (err) {
      if (err.message === 'PRODUCT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
      }
      if (err.message === 'NEGATIVE_STOCK_NOT_ALLOWED') {
        return res.status(400).json({ success: false, error: { code: 'NEGATIVE_STOCK_NOT_ALLOWED', message: 'Adjustment would result in negative on-hand inventory' } });
      }
      next(err);
    }
  }

  async getReorderAlerts(req, res, next) {
    try {
      const data = await inventoryService.getReorderAlerts();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InventoryController();
