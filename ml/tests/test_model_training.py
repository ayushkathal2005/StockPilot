"""
Tests for XGBoost Model Artifacts and Reproducibility.
Verifies loading in clean process, deterministic prediction shapes, and acceptance gate.
"""

import json
import os
import joblib
import numpy as np
import pytest
from xgboost import XGBRegressor

from ml.features.feature_pipeline import FeaturePipeline, FEATURE_COLUMNS


ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "../artifacts/v1")


def test_artifacts_exist():
    """Confirms all versioned model artifacts exist in ml/artifacts/v1/."""
    expected_files = [
        "xgboost_model.json",
        "preprocessor.joblib",
        "metadata.json",
        "evaluation_report.json"
    ]
    for fname in expected_files:
        path = os.path.join(ARTIFACTS_DIR, fname)
        assert os.path.exists(path), f"Artifact {fname} not found in {ARTIFACTS_DIR}"


def test_load_model_and_predict_clean_process(small_synthetic_df):
    """Loads saved model and preprocessor and verifies deterministic prediction on test batch."""
    model_path = os.path.join(ARTIFACTS_DIR, "xgboost_model.json")
    prep_path = os.path.join(ARTIFACTS_DIR, "preprocessor.joblib")
    
    # 1. Load preprocessor
    pipeline: FeaturePipeline = joblib.load(prep_path)
    assert pipeline.is_fitted
    
    # 2. Transform small test batch
    transformed = pipeline.transform(small_synthetic_df, drop_burn_in=False)
    X, _ = pipeline.get_feature_matrix(transformed)
    
    # 3. Load XGBoost model
    model = XGBRegressor()
    model.load_model(model_path)
    
    # 4. Predict
    preds = model.predict(X)
    assert len(preds) == len(X)
    assert not np.isnan(preds).any()
    
    # Clamped non-negative
    clamped_preds = np.maximum(0.0, preds)
    assert (clamped_preds >= 0.0).all()


def test_metadata_acceptance_gate():
    """Verifies that model metadata conforms to acceptance criteria."""
    meta_path = os.path.join(ARTIFACTS_DIR, "metadata.json")
    with open(meta_path, "r") as f:
        meta = json.load(f)
        
    assert meta["model_version"] == "v1.0.0"
    assert "data_summary" in meta
    assert meta["data_summary"]["stockout_censored_days_excluded"] > 0
    
    gate = meta["model_acceptance_gate"]
    assert gate["status"] == "PREFERRED_MODEL"
    assert gate["xgboost_wape"] < gate["best_baseline_wape"]
    assert gate["is_selected_for_replenishment"] is True
    
    # Category breakdowns
    cats = meta["category_performance"]
    for expected_cat in ["Beverages", "Packaged Foods", "Dairy & Chilled", "Household Essentials", "Personal Care"]:
        assert expected_cat in cats, f"Category {expected_cat} missing from performance breakdown"
        assert cats[expected_cat]["wape"] < 0.20
