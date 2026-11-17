"""
StockPilot Demand Forecasting - Multi-Horizon Recursive Forecast Engine
Phase 7: Production inference engine with XGBoost execution & heuristic fallbacks.

Rules:
- Loads XGBoost booster and FeaturePipeline from versioned artifacts.
- Recursive multi-step generation: day d's prediction updates the historical lag buffer for day d+1.
- Clamps predictions to non-negative: max(0.0, round(y_pred, 2)).
- Fallback to 7-day moving average if model fails or product history is insufficient.
- Returns explicit forecast_source ('xgboost' or 'moving_average_fallback') with fallback_reason.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

# Ensure repository root is in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.features.feature_pipeline import FeaturePipeline, FEATURE_COLUMNS
from ml.data.generate_dataset import CORE_PRODUCTS
from ml.service.schemas import (
    ProductDailyPrediction,
    ProductForecastResult,
    ForecastRunResponse
)


class ForecastEngine:
    """
    Inference & Recursive Forecasting Engine for StockPilot.
    """

    def __init__(self, artifacts_dir: Optional[str] = None):
        if artifacts_dir is None:
            artifacts_dir = os.path.join(REPO_ROOT, "ml/artifacts/v1")
        self.artifacts_dir = artifacts_dir
        self.model: Optional[XGBRegressor] = None
        self.pipeline: Optional[FeaturePipeline] = None
        self.metadata: Optional[Dict[str, Any]] = None
        self.is_loaded: bool = False
        self.model_version: str = "unknown"
        
        self.load_artifacts()

    def load_artifacts(self) -> bool:
        """Loads versioned model artifacts from disk."""
        model_path = os.path.join(self.artifacts_dir, "xgboost_model.json")
        prep_path = os.path.join(self.artifacts_dir, "preprocessor.joblib")
        meta_path = os.path.join(self.artifacts_dir, "metadata.json")

        if not (os.path.exists(model_path) and os.path.exists(prep_path) and os.path.exists(meta_path)):
            print(f"[ForecastEngine WARNING] Missing model artifacts in {self.artifacts_dir}")
            self.is_loaded = False
            return False

        try:
            self.model = XGBRegressor()
            self.model.load_model(model_path)
            self.pipeline = joblib.load(prep_path)
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)
            self.model_version = self.metadata.get("model_version", "v1.0.0")
            self.is_loaded = True
            print(f"[ForecastEngine] Successfully loaded model {self.model_version} from {self.artifacts_dir}")
            return True
        except Exception as e:
            print(f"[ForecastEngine ERROR] Failed to load artifacts: {e}", file=sys.stderr)
            self.is_loaded = False
            return False

    def load_demand_history(self, csv_path: Optional[str] = None) -> pd.DataFrame:
        """Loads historical demand. Defaults to synthetic CSV."""
        if csv_path is None:
            csv_path = os.path.join(REPO_ROOT, "ml/data/daily_demand_synthetic.csv")
            
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        else:
            # Fallback generate minimal history
            from ml.data.generate_dataset import generate_synthetic_demand
            df = generate_synthetic_demand(start_date="2026-01-01", end_date="2026-06-30", seed=42)
            
        return df

    def forecast_product(
        self,
        product_meta: Dict[str, Any],
        history_df: pd.DataFrame,
        horizon_days: int = 14
    ) -> ProductForecastResult:
        """
        Generates recursive daily demand forecast for a single product.
        """
        prod_id = int(product_meta["product_id"])
        sku = str(product_meta["sku"])
        cat_id = int(product_meta["category_id"])
        lead_time = int(product_meta.get("lead_time_days", product_meta.get("lead_time", 5)))
        base_price = float(product_meta.get("selling_price", product_meta.get("base_price", 10.0)))

        # Filter product history
        prod_history = history_df[history_df["product_id"] == prod_id].sort_values("business_date").copy()
        
        # Check sufficient history
        min_history_required = 28
        use_fallback = (not self.is_loaded) or (len(prod_history) < min_history_required)
        fallback_reason = None
        if not self.is_loaded:
            fallback_reason = "ML model artifact not loaded"
        elif len(prod_history) < min_history_required:
            fallback_reason = f"Insufficient history: {len(prod_history)} days < {min_history_required}"

        # Determine start date
        if len(prod_history) > 0:
            last_date = pd.to_datetime(prod_history["business_date"].max())
        else:
            last_date = pd.to_datetime("2026-06-30")
            
        # Recursive history working buffer: list of (date, units_sold)
        buffer = [
            (pd.to_datetime(row["business_date"]), float(row["units_sold"]))
            for _, row in prod_history.tail(60).iterrows()
        ]
        
        # If empty buffer, seed with default demand
        if not buffer:
            for d in range(30, 0, -1):
                buffer.append((last_date - timedelta(days=d), 15.0))

        daily_predictions: List[ProductDailyPrediction] = []
        source = "moving_average_fallback" if use_fallback else "xgboost"

        for step in range(1, horizon_days + 1):
            target_date = last_date + timedelta(days=step)
            date_str = target_date.strftime("%Y-%m-%d")
            
            # Autoregressive lags from buffer
            # buffer[-1] is day t-1, buffer[-7] is day t-7, etc.
            lag_1 = buffer[-1][1] if len(buffer) >= 1 else 10.0
            lag_7 = buffer[-7][1] if len(buffer) >= 7 else lag_1
            lag_14 = buffer[-14][1] if len(buffer) >= 14 else lag_7
            lag_28 = buffer[-28][1] if len(buffer) >= 28 else lag_14

            # Rolling stats over last 7 and 28 entries in buffer
            last_7_units = [b[1] for b in buffer[-7:]]
            rolling_7_mean = float(np.mean(last_7_units))
            rolling_7_std = float(np.std(last_7_units)) if len(last_7_units) > 1 else 0.0

            last_28_units = [b[1] for b in buffer[-28:]]
            rolling_28_mean = float(np.mean(last_28_units))
            rolling_28_std = float(np.std(last_28_units)) if len(last_28_units) > 1 else 0.0

            if not use_fallback:
                # Build feature vector
                prod_enc = self.pipeline.product_to_idx.get(prod_id, 0)
                cat_enc = self.pipeline.category_to_idx.get(cat_id, 0)
                base_ref_price = self.pipeline.product_base_prices.get(prod_id, self.pipeline.global_median_price)
                price_ratio = round(base_price / max(0.01, base_ref_price), 4)

                dow = target_date.day_of_week
                is_weekend = int(dow in [5, 6])
                day_of_month = target_date.day
                month = target_date.month
                week_of_year = int(target_date.isocalendar().week)

                feature_dict = {
                    "product_encoded": prod_enc,
                    "category_encoded": cat_enc,
                    "day_of_week": dow,
                    "day_of_month": day_of_month,
                    "month": month,
                    "week_of_year": week_of_year,
                    "is_weekend": is_weekend,
                    "selling_price": base_price,
                    "is_promotional_day": 0,
                    "price_ratio": price_ratio,
                    "lag_1": lag_1,
                    "lag_7": lag_7,
                    "lag_14": lag_14,
                    "lag_28": lag_28,
                    "rolling_7_mean": rolling_7_mean,
                    "rolling_7_std": rolling_7_std,
                    "rolling_28_mean": rolling_28_mean,
                    "rolling_28_std": rolling_28_std
                }

                feat_df = pd.DataFrame([feature_dict])[FEATURE_COLUMNS]
                try:
                    pred_val = float(self.model.predict(feat_df)[0])
                except Exception as e:
                    pred_val = rolling_7_mean
                    source = "moving_average_fallback"
                    fallback_reason = f"Prediction error: {str(e)}"
            else:
                # Heuristic 7-day moving average fallback
                pred_val = rolling_7_mean

            # Non-negative clamping
            pred_clamped = max(0.0, round(pred_val, 2))
            daily_predictions.append(ProductDailyPrediction(
                forecast_date=date_str,
                predicted_units=pred_clamped
            ))
            
            # Update recursive buffer with this prediction
            buffer.append((target_date, pred_clamped))

        # Metrics
        lead_time_units = sum(p.predicted_units for p in daily_predictions[:min(lead_time, horizon_days)])
        total_horizon_units = sum(p.predicted_units for p in daily_predictions)

        return ProductForecastResult(
            product_id=prod_id,
            sku=sku,
            forecast_source=source,
            lead_time_days=lead_time,
            lead_time_demand=round(lead_time_units, 2),
            total_horizon_demand=round(total_horizon_units, 2),
            daily_predictions=daily_predictions,
            fallback_reason=fallback_reason
        )

    def run_multi_product_forecast(
        self,
        horizon_days: int = 14,
        product_ids: Optional[List[int]] = None,
        history_df: Optional[pd.DataFrame] = None
    ) -> ForecastRunResponse:
        """
        Runs batch forecast across requested or all catalog products.
        """
        if history_df is None:
            history_df = self.load_demand_history()

        # Target products catalogue
        products = list(CORE_PRODUCTS)
        if product_ids is not None and len(product_ids) > 0:
            target_ids = set(product_ids)
            products = [p for p in products if p["product_id"] in target_ids]

        forecasts: List[ProductForecastResult] = []
        total_units = 0.0

        for prod in products:
            res = self.forecast_product(prod, history_df, horizon_days=horizon_days)
            forecasts.append(res)
            total_units += res.total_horizon_demand

        return ForecastRunResponse(
            run_id=None,
            model_version=self.model_version,
            horizon_days=horizon_days,
            created_at=datetime.now(timezone.utc).isoformat(),
            products_count=len(forecasts),
            total_forecast_units=round(total_units, 2),
            forecasts=forecasts
        )
