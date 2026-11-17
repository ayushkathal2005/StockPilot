"""
Tests for Baseline Models & Metric Utilities.
"""

import numpy as np
import pytest
from ml.models.baselines import (
    calculate_metrics,
    MovingAverageBaseline,
    SeasonalNaiveBaseline
)


def test_calculate_metrics_basic():
    """Verifies MAE, RMSE, and WAPE calculation with known vectors."""
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([12.0, 18.0, 33.0, 35.0])
    
    # errors: [2, 2, 3, 5], sum_err = 12, sum_true = 100
    # MAE = 12 / 4 = 3.0
    # squared: [4, 4, 9, 25], sum_sq = 42, RMSE = sqrt(42/4) = sqrt(10.5) ~ 3.2404
    # WAPE = 12 / 100 = 0.12
    metrics = calculate_metrics(y_true, y_pred)
    assert metrics["mae"] == 3.0
    assert abs(metrics["rmse"] - 3.2404) < 1e-3
    assert metrics["wape"] == 0.12
    assert metrics["count"] == 4


def test_calculate_metrics_zero_denominator():
    """Verifies zero-denominator policy returns safe bounded floats."""
    y_true = np.array([0.0, 0.0, 0.0])
    y_pred = np.array([0.0, 0.0, 0.0])
    metrics = calculate_metrics(y_true, y_pred)
    assert metrics["wape"] == 0.0
    assert metrics["mae"] == 0.0

    # Non-zero pred with zero true
    y_pred_nonzero = np.array([5.0, 0.0, 0.0])
    metrics2 = calculate_metrics(y_true, y_pred_nonzero)
    assert metrics2["wape"] == 1.0


def test_clamped_non_negative_predictions():
    """Negative predictions must be clamped to 0.0 for business logic."""
    y_true = np.array([10.0, 10.0])
    y_pred_neg = np.array([-5.0, -10.0])
    metrics = calculate_metrics(y_true, y_pred_neg)
    # Clamped to [0.0, 0.0] -> abs errors are [10.0, 10.0]
    assert metrics["mae"] == 10.0
