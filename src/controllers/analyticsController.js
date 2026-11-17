const analyticsService = require('../services/analyticsService');

class AnalyticsController {
  async getExecutiveKPIs(req, res, next) {
    try {
      const data = await analyticsService.getExecutiveKPIs();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDailySalesTrends(req, res, next) {
    try {
      const { limit } = req.query;
      const data = await analyticsService.getDailySalesTrends({
        limit: limit ? parseInt(limit, 10) : 30
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getCategoryPerformance(req, res, next) {
    try {
      const data = await analyticsService.getCategoryPerformance();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getTopProducts(req, res, next) {
    try {
      const { limit } = req.query;
      const data = await analyticsService.getTopProducts({
        limit: limit ? parseInt(limit, 10) : 10
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getSupplierPerformance(req, res, next) {
    try {
      const data = await analyticsService.getSupplierPerformance();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
