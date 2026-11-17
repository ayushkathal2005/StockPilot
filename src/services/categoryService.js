const categoryRepository = require('../repositories/categoryRepository');
const { AppError } = require('../middleware/errorHandler');

class CategoryService {
  async getAll(options) {
    return categoryRepository.findAll(options);
  }

  async getById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new AppError(`Category with ID ${id} not found.`, 404, 'NOT_FOUND');
    }
    return category;
  }

  async create({ categoryName, description }) {
    const existing = await categoryRepository.findByName(categoryName);
    if (existing) {
      throw new AppError(`A category named '${categoryName}' already exists.`, 409, 'DUPLICATE_CATEGORY');
    }
    return categoryRepository.create({ categoryName, description });
  }

  async update(id, data) {
    await this.getById(id);
    if (data.categoryName) {
      const existing = await categoryRepository.findByName(data.categoryName);
      if (existing && existing.category_id !== parseInt(id, 10)) {
        throw new AppError(`A category named '${data.categoryName}' already exists.`, 409, 'DUPLICATE_CATEGORY');
      }
    }
    return categoryRepository.update(id, data);
  }
}

module.exports = new CategoryService();
