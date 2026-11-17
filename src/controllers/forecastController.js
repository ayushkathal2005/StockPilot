/**
 * StockPilot Forecast & Replenishment Controller
 * Phase 7: REST API handlers for ML status, forecast runs, and replenishment recommendations.
 */

const replenishmentService = require('../services/replenishmentService');
const mlClient = require('../services/mlClient');

class ForecastController {
  async getMLStatus(req, res, next) {
    try {
      const health = await mlClient.getHealth();
      let modelInfo = null;
      if (health.ok) {
        const infoRes = await mlClient.getModelInfo();
        if (infoRes.ok) modelInfo = infoRes.data;
      }

      res.status(200).json({
        success: true,
        data: {
          isAvailable: health.ok,
          health: health.data || { status: 'offline', error: health.error },
          modelInfo
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async generateForecast(req, res, next) {
    try {
      const horizonDays = parseInt(req.body.horizonDays || 14, 10);
      const userId = req.user?.userId || req.user?.user_id;

      const result = await replenishmentService.generateForecastAndRecommendations({
        horizonDays,
        userId
      });

      res.status(201).json({
        success: true,
        message: `Successfully generated forecast for ${horizonDays}-day horizon`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getRecommendations(req, res, next) {
    try {
      const { status, productId, limit } = req.query;
      const recommendations = await replenishmentService.getRecommendations({
        status: status || null,
        productId: productId ? parseInt(productId, 10) : null,
        limit: limit ? parseInt(limit, 10) : 100
      });

      res.status(200).json({
        success: true,
        count: recommendations.length,
        data: recommendations
      });
    } catch (err) {
      next(err);
    }
  }

  async getRecommendationById(req, res, next) {
    try {
      const rec = await replenishmentService.getRecommendationById(parseInt(req.params.id, 10));
      res.status(200).json({
        success: true,
        data: rec
      });
    } catch (err) {
      next(err);
    }
  }

  async approveRecommendation(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.user_id;
      const result = await replenishmentService.approveRecommendation(
        parseInt(req.params.id, 10),
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Recommendation approved and Purchase Order created successfully.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectRecommendation(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.user_id;
      const result = await replenishmentService.rejectRecommendation(
        parseInt(req.params.id, 10),
        userId,
        req.body.reason
      );

      res.status(200).json({
        success: true,
        message: 'Recommendation rejected.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getForecastRuns(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const runs = await replenishmentService.getForecastRuns(limit);

      res.status(200).json({
        success: true,
        count: runs.length,
        data: runs
      });
    } catch (err) {
      next(err);
    }
  }

  async getForecastRunById(req, res, next) {
    try {
      const run = await replenishmentService.getForecastRunById(parseInt(req.params.id, 10));
      res.status(200).json({
        success: true,
        data: run
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ForecastController();
