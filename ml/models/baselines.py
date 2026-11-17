"""
StockPilot Demand Forecasting - Baseline Models & Evaluation Metrics
Phase 6: Heuristic benchmark models (7-day MA, 28-day MA, Seasonal Naive) and standard metrics.

Evaluation Metrics:
- MAE: Mean Absolute Error
- RMSE: Root Mean Squared Error
- WAPE: Weighted Absolute Percentage Error = sum(|y - y_hat|) / sum(y)
  with explicit zero-denominator handling.
"""

from typing import Dict, Any, Union, Tuple
import numpy as np
import pandas as pd


def calculate_metrics(y_true: Union[np.ndarray, pd.Series], y_pred: Union[np.ndarray, pd.Series]) -> Dict[str, float]:
    """
    Calculates MAE, RMSE, and WAPE with non-negative clamping and zero-denominator safety.
    
    Zero-Denominator Policy for WAPE:
    If sum(y_true) == 0, returns 0.0 if sum(y_pred) == 0 else 1.0.
    """
    y_true = np.asarray(y_true, dtype=np.float64)
    # Business requirement: clamp predictions to non-negative
    y_pred = np.maximum(0.0, np.asarray(y_pred, dtype=np.float64))
    
    if len(y_true) == 0:
        return {"mae": 0.0, "rmse": 0.0, "wape": 0.0, "count": 0}
        
    abs_errors = np.abs(y_true - y_pred)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    
    sum_true = float(np.sum(y_true))
    sum_abs_err = float(np.sum(abs_errors))
    
    if sum_true > 0:
        wape = float(sum_abs_err / sum_true)
    else:
        wape = 0.0 if sum_abs_err == 0 else 1.0
        
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": round(wape, 4),
        "count": len(y_true)
    }


class MovingAverageBaseline:
    """
    N-day Historical Moving Average Baseline.
    Predicts demand as the mean of the prior N shifted days.
    """
    def __init__(self, window: int = 7):
        self.window = window
        self.name = f"{window}d_moving_average"

    def predict(self, df_transformed: pd.DataFrame) -> np.ndarray:
        """
        Uses precomputed rolling_N_mean from FeaturePipeline if window is 7 or 28,
        guaranteeing zero leakage.
        """
        col = f"rolling_{self.window}_mean"
        if col in df_transformed.columns:
            preds = df_transformed[col].values
        else:
            raise KeyError(f"Feature column '{col}' not found in transformed dataset.")
        return np.maximum(0.0, preds)


class SeasonalNaiveBaseline:
    """
    Seasonal Naive (7-day lag) Baseline.
    Predicts demand on day t as the observed demand from day t-7 (same day of week).
    """
    def __init__(self, lag: int = 7):
        self.lag = lag
        self.name = f"seasonal_naive_lag_{lag}"

    def predict(self, df_transformed: pd.DataFrame) -> np.ndarray:
        """Uses precomputed lag_7 from FeaturePipeline."""
        col = f"lag_{self.lag}"
        if col in df_transformed.columns:
            preds = df_transformed[col].values
        else:
            raise KeyError(f"Feature column '{col}' not found in transformed dataset.")
        return np.maximum(0.0, preds)


def evaluate_all_baselines(df_test_transformed: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Evaluates 7-day MA, 28-day MA, and Seasonal Naive on the test partition."""
    y_test = df_test_transformed["units_sold"].values
    
    models = [
        MovingAverageBaseline(window=7),
        MovingAverageBaseline(window=28),
        SeasonalNaiveBaseline(lag=7)
    ]
    
    results = {}
    for model in models:
        y_pred = model.predict(df_test_transformed)
        metrics = calculate_metrics(y_test, y_pred)
        results[model.name] = metrics
        
    return results
