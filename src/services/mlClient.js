/**
 * StockPilot ML Service HTTP Client
 * Phase 7: Express-to-FastAPI integration with timeout and graceful error handling.
 */

const config = require('../config/env');

class MLClient {
  constructor(baseUrl = config.mlServiceUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = 5000;
  }

  async getHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) {
        return { ok: false, status: response.status, error: `ML Service returned HTTP ${response.status}` };
      }
      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message, isOffline: true };
    }
  }

  async getModelInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/model/info`, {
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) {
        return { ok: false, status: response.status, error: `ML Service returned HTTP ${response.status}` };
      }
      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message, isOffline: true };
    }
  }

  async generateForecast({ horizonDays = 14, productIds = null } = {}) {
    try {
      const payload = {
        horizon_days: horizonDays,
        product_ids: productIds
      };

      const response = await fetch(`${this.baseUrl}/forecast/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          status: response.status,
          error: `ML Service failed (${response.status}): ${errorBody}`
        };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message, isOffline: true };
    }
  }
}

module.exports = new MLClient();
