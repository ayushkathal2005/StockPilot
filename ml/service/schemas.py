"""
StockPilot FastAPI Service - Pydantic Request and Response Schemas
Phase 7: Strong validation for forecasting API contracts.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service status: ok, degraded, or not_ready")
    service: str = Field("stockpilot-ml-service", description="Service identifier")
    model_loaded: bool = Field(..., description="True if XGBoost model and preprocessor are loaded")
    model_version: Optional[str] = Field(None, description="Active model version tag")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")


class ModelInfoResponse(BaseModel):
    model_version: str
    model_type: str
    training_timestamp: str
    data_summary: Dict[str, Any]
    feature_list: List[str]
    model_comparison: Dict[str, Any]
    model_acceptance_gate: Dict[str, Any]
    category_performance: Dict[str, Any]


class ForecastRunRequest(BaseModel):
    horizon_days: int = Field(14, ge=7, le=30, description="Forecast horizon in days (7 to 30, default 14)")
    product_ids: Optional[List[int]] = Field(None, description="Optional subset of product IDs. None = all active products.")


class ProductDailyPrediction(BaseModel):
    forecast_date: str
    predicted_units: float = Field(..., ge=0.0)


class ProductForecastResult(BaseModel):
    product_id: int
    sku: str
    forecast_source: str = Field("xgboost", description="'xgboost' or 'moving_average_fallback'")
    lead_time_days: int
    lead_time_demand: float = Field(..., ge=0.0)
    total_horizon_demand: float = Field(..., ge=0.0)
    daily_predictions: List[ProductDailyPrediction]
    fallback_reason: Optional[str] = None


class ForecastRunResponse(BaseModel):
    run_id: Optional[int] = None
    model_version: str
    horizon_days: int
    created_at: str
    products_count: int
    total_forecast_units: float
    forecasts: List[ProductForecastResult]
