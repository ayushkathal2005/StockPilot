const analyticsRepository = require('../repositories/analyticsRepository');

class AnalyticsService {
  async getExecutiveKPIs() {
    return analyticsRepository.getExecutiveKPIs();
  }

  async getDailySalesTrends(params) {
    return analyticsRepository.getDailySalesTrends(params);
  }

  async getCategoryPerformance() {
    return analyticsRepository.getCategoryPerformance();
  }

  async getTopProducts(params) {
    return analyticsRepository.getTopProducts(params);
  }

  async getSupplierPerformance() {
    return analyticsRepository.getSupplierPerformance();
  }
}

module.exports = new AnalyticsService();
