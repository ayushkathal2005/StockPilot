const purchaseOrderService = require('../services/purchaseOrderService');

class PurchaseOrderController {
  async createPurchaseOrder(req, res, next) {
    try {
      const { supplierId, expectedDeliveryDate, items } = req.body;
      const po = await purchaseOrderService.createPurchaseOrder({
        supplierId,
        createdByUserId: req.user.userId || req.user.user_id,
        expectedDeliveryDate,
        items,
        ipAddress: req.ip
      });
      res.status(201).json({ success: true, message: 'Purchase order created successfully', data: po });
    } catch (err) {
      if (err.code === 'INVALID_SUPPLIER' || err.code === 'INVALID_PRODUCT') {
        return res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
      }
      next(err);
    }
  }

  async submitPurchaseOrder(req, res, next) {
    try {
      const poId = parseInt(req.params.id, 10);
      const po = await purchaseOrderService.submitPurchaseOrder(poId, req.user.userId || req.user.user_id, req.ip);
      res.json({ success: true, message: 'Purchase order submitted successfully', data: po });
    } catch (err) {
      if (err.code === 'PO_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'PO_NOT_FOUND', message: err.message } });
      }
      if (err.code === 'INVALID_PO_STATE') {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PO_STATE', message: err.message } });
      }
      next(err);
    }
  }

  async receiveItems(req, res, next) {
    try {
      const poId = parseInt(req.params.id, 10);
      const { receipts } = req.body;
      const po = await purchaseOrderService.receiveItems({
        poId,
        userId: req.user.userId || req.user.user_id,
        receipts,
        ipAddress: req.ip
      });
      res.json({ success: true, message: 'Items received successfully', data: po });
    } catch (err) {
      if (err.code === 'PO_NOT_FOUND' || err.code === 'PO_ITEM_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: err.code, message: err.message } });
      }
      if (err.code === 'INVALID_PO_STATUS' || err.code === 'EXCEEDS_ORDERED_QUANTITY' || err.code === 'INVALID_RECEIVE_QUANTITY') {
        return res.status(400).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details
          }
        });
      }
      next(err);
    }
  }

  async cancelPurchaseOrder(req, res, next) {
    try {
      const poId = parseInt(req.params.id, 10);
      const po = await purchaseOrderService.cancelPurchaseOrder(poId, req.user.userId || req.user.user_id, req.ip);
      res.json({ success: true, message: 'Purchase order cancelled successfully', data: po });
    } catch (err) {
      if (err.code === 'PO_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'PO_NOT_FOUND', message: err.message } });
      }
      if (err.code === 'CANNOT_CANCEL_PO' || err.code === 'CANNOT_CANCEL_PARTIAL_PO') {
        return res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
      }
      next(err);
    }
  }

  async getPurchaseOrders(req, res, next) {
    try {
      const { limit, offset, status, supplierId } = req.query;
      const orders = await purchaseOrderService.getPurchaseOrders({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status,
        supplierId: supplierId ? parseInt(supplierId, 10) : undefined
      });
      res.json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseOrderById(req, res, next) {
    try {
      const poId = parseInt(req.params.id, 10);
      const po = await purchaseOrderService.getPurchaseOrderById(poId);
      res.json({ success: true, data: po });
    } catch (err) {
      if (err.code === 'PO_NOT_FOUND') {
        return res.status(404).json({ success: false, error: { code: 'PO_NOT_FOUND', message: err.message } });
      }
      next(err);
    }
  }
}

module.exports = new PurchaseOrderController();
