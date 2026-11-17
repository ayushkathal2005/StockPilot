const salesRepository = require('../repositories/salesRepository');
const auditRepository = require('../repositories/auditRepository');

class SalesService {
  async createSale({ userId, items, ipAddress }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('Sale must contain at least one line item');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'number') {
        const err = new Error('Each item must contain a valid productId');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        const err = new Error('Each item must contain a positive quantity');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    const sale = await salesRepository.createSale({ userId, items });

    await auditRepository.log({
      userId,
      actionType: 'CREATE_SALE',
      entityName: 'Sales',
      entityId: sale.saleId,
      details: {
        totalAmount: sale.totalAmount,
        itemCount: sale.items.length,
        status: sale.status
      }
    });

    return sale;
  }

  async getSales(filters) {
    return salesRepository.getSales(filters);
  }

  async getSaleById(saleId) {
    const sale = await salesRepository.getSaleById(saleId);
    if (!sale) {
      const err = new Error(`Sale with ID ${saleId} not found`);
      err.code = 'SALE_NOT_FOUND';
      throw err;
    }
    return sale;
  }
}

module.exports = new SalesService();
