const productService = require('../services/productService');

class ProductController {
  async listProducts(req, res, next) {
    try {
      const { search, categoryId, stockStatus, includeInactive } = req.query;
      const products = await productService.getAll({
        search: search || null,
        categoryId: categoryId ? parseInt(categoryId, 10) : null,
        stockStatus: stockStatus || null,
        includeInactive: includeInactive === 'true'
      });

      return res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (err) {
      next(err);
    }
  }

  async getProduct(req, res, next) {
    try {
      const product = await productService.getById(req.params.id);
      return res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req, res, next) {
    try {
      const product = await productService.create(req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await productService.update(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Product updated successfully.',
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateProduct(req, res, next) {
    try {
      const product = await productService.deactivate(req.params.id);
      return res.status(200).json({
        success: true,
        message: `Product with ID ${req.params.id} has been deactivated.`,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductController();
