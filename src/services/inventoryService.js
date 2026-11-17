const inventoryRepository = require('../repositories/inventoryRepository');
const auditRepository = require('../repositories/auditRepository');

class InventoryService {
  async getInventoryPositions(filters) {
    return inventoryRepository.getInventoryPositions(filters);
  }

  async getStockMovements(filters) {
    return inventoryRepository.getStockMovements(filters);
  }

  async adjustStock({ productId, quantityDelta, movementType, userId, notes, ipAddress }) {
    if (!productId || typeof productId !== 'number') {
      const err = new Error('Valid productId is required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!quantityDelta || typeof quantityDelta !== 'number' || quantityDelta === 0) {
      const err = new Error('Non-zero quantityDelta is required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const validTypes = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN'];
    if (!validTypes.includes(movementType)) {
      const err = new Error(`Movement type must be one of: ${validTypes.join(', ')}`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // Ensure sign of delta matches movement type
    let normalizedDelta = quantityDelta;
    if (movementType === 'ADJUSTMENT_OUT' && normalizedDelta > 0) {
      normalizedDelta = -normalizedDelta;
    } else if (movementType === 'ADJUSTMENT_IN' && normalizedDelta < 0) {
      normalizedDelta = Math.abs(normalizedDelta);
    }

    const result = await inventoryRepository.adjustStock({
      productId,
      quantityDelta: normalizedDelta,
      movementType,
      userId,
      notes
    });

    await auditRepository.log({
      userId,
      actionType: 'STOCK_ADJUSTMENT',
      entityName: 'Inventory',
      entityId: productId,
      details: { onHand: result.newOnHand, delta: normalizedDelta, movementType, notes }
    });

    return result;
  }

  async getReorderAlerts() {
    return inventoryRepository.getReorderAlerts();
  }
}

module.exports = new InventoryService();
