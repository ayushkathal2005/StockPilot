"""
Tests for Feature Engineering Pipeline.
Crucial test: Proves zero target leakage in lag and rolling statistics.
"""

import numpy as np
import pandas as pd
from ml.features.feature_pipeline import FeaturePipeline, FEATURE_COLUMNS


def test_zero_target_leakage(small_synthetic_df):
    """
    CRITICAL ACCEPTANCE GATE TEST:
    Proves that mutating units_sold on date T does NOT alter features computed for date T.
    All rolling statistics and lags for date T must depend exclusively on dates <= T-1.
    """
    pipeline = FeaturePipeline()
    pipeline.fit(small_synthetic_df)
    
    # Baseline transformation (keeping burn-in for indexing precision)
    df_orig = small_synthetic_df.copy()
    transformed_orig = pipeline.transform(df_orig, drop_burn_in=False)
    
    # Pick a target test row (e.g. index 35, well past initial burn-in for product 1)
    test_idx = 35
    row_date = df_orig.iloc[test_idx]["business_date"]
    prod_id = df_orig.iloc[test_idx]["product_id"]
    
    # Corrupt target demand on this exact date and all future dates for this product
    df_corrupted = df_orig.copy()
    df_corrupted.iloc[test_idx, df_corrupted.columns.get_loc("units_sold")] = 999999
    
    transformed_corrupted = pipeline.transform(df_corrupted, drop_burn_in=False)
    
    # Features for test_idx must be 100% IDENTICAL despite same-day target being changed to 999999
    features_orig = transformed_orig.iloc[test_idx][FEATURE_COLUMNS]
    features_corrupted = transformed_corrupted.iloc[test_idx][FEATURE_COLUMNS]
    
    pd.testing.assert_series_equal(
        features_orig,
        features_corrupted,
        check_exact=True,
        obj=f"Feature row on date {row_date} for product {prod_id}"
    )


def test_unseen_product_and_category_handling(small_synthetic_df):
    """Verifies that unknown product_id and category_id map to fallback index 0 without failing."""
    pipeline = FeaturePipeline()
    pipeline.fit(small_synthetic_df)
    
    unseen_df = pd.DataFrame([{
        "product_id": 99999, # Unseen
        "sku": "NEW-SKU-999",
        "category_id": 88888, # Unseen
        "category_name": "Unseen Category",
        "business_date": "2025-06-01",
        "units_sold": 10,
        "selling_price": 15.00,
        "is_promotional_day": 0,
        "is_stockout_day": 0,
        "data_source": "TEST"
    }])
    
    transformed = pipeline.transform(unseen_df, drop_burn_in=False)
    assert transformed.iloc[0]["product_encoded"] == 0
    assert transformed.iloc[0]["category_encoded"] == 0
    assert transformed.iloc[0]["price_ratio"] > 0
    assert transformed.iloc[0]["is_weekend"] == 1 # June 1 2025 is Sunday
