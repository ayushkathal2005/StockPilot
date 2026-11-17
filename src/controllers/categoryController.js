const categoryService = require('../services/categoryService');

class CategoryController {
  async listCategories(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await categoryService.getAll({ includeInactive });
      return res.status(200).json({
        success: true,
        count: categories.length,
        data: categories
      });
    } catch (err) {
      next(err);
    }
  }

  async getCategory(req, res, next) {
    try {
      const category = await categoryService.getById(req.params.id);
      return res.status(200).json({
        success: true,
        data: category
      });
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req, res, next) {
    try {
      const category = await categoryService.create(req.body);
      return res.status(201).json({
        success: true,
        message: 'Category created successfully.',
        data: category
      });
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await categoryService.update(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Category updated successfully.',
        data: category
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CategoryController();
