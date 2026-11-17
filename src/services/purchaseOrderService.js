const purchaseOrderRepository = require('../repositories/purchaseOrderRepository');
const auditRepository = require('../repositories/auditRepository');

class PurchaseOrderService {
  async createPurchaseOrder({ supplierId, createdByUserId, expectedDeliveryDate, items, ipAddress }) {
    if (!supplierId || typeof supplierId !== 'number') {
      const err = new Error('Valid supplierId is required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('Purchase order must contain at least one item');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'number') {
        const err = new Error('Each item must contain a valid productId');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!item.orderedQuantity || typeof item.orderedQuantity !== 'number' || item.orderedQuantity <= 0) {
        const err = new Error('Each item must contain a positive orderedQuantity');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (item.unitCost === undefined || typeof item.unitCost !== 'number' || item.unitCost < 0) {
        const err = new Error('Each item must contain a non-negative unitCost');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    const po = await purchaseOrderRepository.createPurchaseOrder({
      supplierId,
      createdByUserId,
      expectedDeliveryDate,
      items
    });

    await auditRepository.log({
      userId: createdByUserId,
      actionType: 'CREATE_PURCHASE_ORDER',
      entityName: 'PurchaseOrders',
      entityId: po.po_id,
      details: { poNumber: po.po_number, supplierId, totalAmount: po.total_amount }
    });

    return po;
  }

  async submitPurchaseOrder(poId, approvedByUserId, ipAddress) {
    const po = await purchaseOrderRepository.submitPurchaseOrder(poId, approvedByUserId);

    await auditRepository.log({
      userId: approvedByUserId,
      actionType: 'SUBMIT_PURCHASE_ORDER',
      entityName: 'PurchaseOrders',
      entityId: poId,
      details: { status: 'SUBMITTED', approvedByUserId }
    });

    return po;
  }

  async receiveItems({ poId, userId, receipts, ipAddress }) {
    if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
      const err = new Error('Receipt must contain at least one item');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    for (const r of receipts) {
      if (!r.poItemId || typeof r.poItemId !== 'number') {
        const err = new Error('Valid poItemId is required for each receipt');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!r.quantityToReceive || typeof r.quantityToReceive !== 'number' || r.quantityToReceive <= 0) {
        const err = new Error('quantityToReceive must be greater than zero');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    const po = await purchaseOrderRepository.receiveItems({ poId, userId, receipts });

    await auditRepository.log({
      userId,
      actionType: 'RECEIVE_PURCHASE_ORDER_ITEMS',
      entityName: 'PurchaseOrders',
      entityId: poId,
      details: { status: po.status, receiptCount: receipts.length }
    });

    return po;
  }

  async cancelPurchaseOrder(poId, userId, ipAddress) {
    const po = await purchaseOrderRepository.cancelPurchaseOrder(poId, userId);

    await auditRepository.log({
      userId,
      actionType: 'CANCEL_PURCHASE_ORDER',
      entityName: 'PurchaseOrders',
      entityId: poId,
      details: { status: 'CANCELLED' }
    });

    return po;
  }

  async getPurchaseOrders(filters) {
    return purchaseOrderRepository.getPurchaseOrders(filters);
  }

  async getPurchaseOrderById(poId) {
    const po = await purchaseOrderRepository.getPurchaseOrderById(poId);
    if (!po) {
      const err = new Error(`Purchase order with ID ${poId} not found`);
      err.code = 'PO_NOT_FOUND';
      throw err;
    }
    return po;
  }
}

module.exports = new PurchaseOrderService();
