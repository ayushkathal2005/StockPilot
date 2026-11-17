"""
StockPilot FastAPI Demand Forecasting Microservice
Phase 7: Separate Python service for ML inference and forecast serving.

Internal Endpoints:
- GET  /health                      Service & model readiness probe
- GET  /model/info                  Model version, feature schema, & test metrics
- POST /forecast/run                Generate multi-horizon forecast (7-30 days)
- GET  /forecast/runs/{run_id}      Retrieve run details
- GET  /forecast/runs/{run_id}/products/{product_id}
"""

import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure repository root is in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.service.schemas import (
    HealthResponse,
    ModelInfoResponse,
    ForecastRunRequest,
    ForecastRunResponse,
    ProductForecastResult
)
from ml.service.forecast_engine import ForecastEngine

app = FastAPI(
    title="StockPilot ML Demand Forecasting Service",
    description="Dedicated microservice serving XGBoost demand forecasts and baseline fallback predictions.",
    version="1.0.0"
)

# CORS middleware for internal service integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine instance
forecast_engine = ForecastEngine()

# In-memory store for recent runs
recent_runs_store: Dict[int, ForecastRunResponse] = {}
next_run_id = 1


@app.get("/health", response_model=HealthResponse)
def get_health():
    """
    Health and readiness probe endpoint.
    Reports whether the model artifacts and preprocessors are loaded.
    """
    is_ready = forecast_engine.is_loaded
    status_str = "ok" if is_ready else "degraded"
    
    return HealthResponse(
        status=status_str,
        service="stockpilot-ml-service",
        model_loaded=is_ready,
        model_version=forecast_engine.model_version if is_ready else None,
        timestamp=datetime.now(timezone.utc).isoformat()
    )


@app.get("/model/info", response_model=ModelInfoResponse)
def get_model_info():
    """
    Returns active model architecture, features, hyperparameters, and test evaluation metrics.
    """
    if not forecast_engine.is_loaded or forecast_engine.metadata is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model metadata is unavailable because artifacts have not been loaded."
        )

    meta = forecast_engine.metadata
    return ModelInfoResponse(
        model_version=meta.get("model_version", "unknown"),
        model_type=meta.get("model_type", "XGBRegressor"),
        training_timestamp=meta.get("training_timestamp", ""),
        data_summary=meta.get("data_summary", {}),
        feature_list=meta.get("feature_list", []),
        model_comparison=meta.get("model_comparison", {}),
        model_acceptance_gate=meta.get("model_acceptance_gate", {}),
        category_performance=meta.get("category_performance", {})
    )


@app.post("/forecast/run", response_model=ForecastRunResponse)
def run_forecast(request: ForecastRunRequest):
    """
    Executes a multi-horizon forecast across selected or all active catalog products.
    Validates that horizon_days is within [7, 30].
    """
    global next_run_id
    
    if request.horizon_days < 7 or request.horizon_days > 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Horizon days must be between 7 and 30. Received: {request.horizon_days}"
        )

    try:
        response = forecast_engine.run_multi_product_forecast(
            horizon_days=request.horizon_days,
            product_ids=request.product_ids
        )
        
        assigned_id = next_run_id
        next_run_id += 1
        response.run_id = assigned_id
        recent_runs_store[assigned_id] = response
        
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecast execution failed: {str(e)}"
        )


@app.get("/forecast/runs/{run_id}", response_model=ForecastRunResponse)
def get_forecast_run(run_id: int):
    """Retrieves a previously computed forecast run from memory."""
    if run_id not in recent_runs_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forecast run ID {run_id} not found."
        )
    return recent_runs_store[run_id]


@app.get("/forecast/runs/{run_id}/products/{product_id}", response_model=ProductForecastResult)
def get_forecast_run_product(run_id: int, product_id: int):
    """Retrieves forecast details for a specific product within a run."""
    if run_id not in recent_runs_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forecast run ID {run_id} not found."
        )
        
    run = recent_runs_store[run_id]
    for prod_forecast in run.forecasts:
        if prod_forecast.product_id == product_id:
            return prod_forecast

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Product ID {product_id} not found in forecast run {run_id}."
    )


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 8000))
    print(f"Starting StockPilot ML Service on http://0.0.0.0:{port}...")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
