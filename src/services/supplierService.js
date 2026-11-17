const supplierRepository = require('../repositories/supplierRepository');
const { AppError } = require('../middleware/errorHandler');

class SupplierService {
  async getAll(options) {
    return supplierRepository.findAll(options);
  }

  async getById(id) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new AppError(`Supplier with ID ${id} not found.`, 404, 'NOT_FOUND');
    }
    return supplier;
  }

  async create(data) {
    return supplierRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id);
    return supplierRepository.update(id, data);
  }
}

module.exports = new SupplierService();
