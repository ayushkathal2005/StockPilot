const productRepository = require('../repositories/productRepository');
const categoryRepository = require('../repositories/categoryRepository');
const supplierRepository = require('../repositories/supplierRepository');
const { AppError } = require('../middleware/errorHandler');

class ProductService {
  async getAll(options) {
    return productRepository.findAll(options);
  }

  async getById(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(`Product with ID ${id} not found.`, 404, 'NOT_FOUND');
    }
    return product;
  }

  async create(data, actorUserId) {
    // 1. Check duplicate SKU
    const existingSku = await productRepository.findBySku(data.sku);
    if (existingSku) {
      throw new AppError(`Product with SKU '${data.sku}' already exists.`, 409, 'DUPLICATE_SKU');
    }

    // 2. Validate category exists
    const category = await categoryRepository.findById(data.categoryId);
    if (!category) {
      throw new AppError(`Category with ID ${data.categoryId} does not exist.`, 400, 'INVALID_CATEGORY');
    }

    // 3. Validate supplier exists if provided
    if (data.preferredSupplierId) {
      const supplier = await supplierRepository.findById(data.preferredSupplierId);
      if (!supplier) {
        throw new AppError(`Supplier with ID ${data.preferredSupplierId} does not exist.`, 400, 'INVALID_SUPPLIER');
      }
    }

    return productRepository.create(data, actorUserId);
  }

  async update(id, data) {
    await this.getById(id);

    if (data.categoryId) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category) {
        throw new AppError(`Category with ID ${data.categoryId} does not exist.`, 400, 'INVALID_CATEGORY');
      }
    }

    if (data.preferredSupplierId) {
      const supplier = await supplierRepository.findById(data.preferredSupplierId);
      if (!supplier) {
        throw new AppError(`Supplier with ID ${data.preferredSupplierId} does not exist.`, 400, 'INVALID_SUPPLIER');
      }
    }

    return productRepository.update(id, data);
  }

  async deactivate(id) {
    await this.getById(id);
    return productRepository.deactivate(id);
  }
}

module.exports = new ProductService();
