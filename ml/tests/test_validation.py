"""
Tests for Dataset Validation Pipeline.
Verifies duplicate detection, invariant enforcement, gap detection, and stockout filtering.
"""

import pytest
import pandas as pd
from ml.data.validate_dataset import (
    run_full_validation,
    filter_stockouts,
    DatasetValidationError,
    check_duplicates,
    check_date_continuity,
    check_value_invariants
)


def test_clean_dataset_validation(small_synthetic_df):
    """Clean synthetic data must pass all validation checks without error."""
    report = run_full_validation(small_synthetic_df)
    assert report["status"] == "PASSED"
    assert report["unique_products"] == 35
    assert report["uncensored_records_for_training"] > 0


def test_detect_duplicates(small_synthetic_df):
    """Validation must raise DatasetValidationError if duplicate (product_id, date) is present."""
    corrupted = pd.concat([small_synthetic_df, small_synthetic_df.head(2)], ignore_index=True)
    with pytest.raises(DatasetValidationError, match="duplicate"):
        check_duplicates(corrupted)


def test_detect_negative_demand(small_synthetic_df):
    """Validation must reject negative units_sold."""
    corrupted = small_synthetic_df.copy()
    corrupted.loc[0, "units_sold"] = -5
    with pytest.raises(DatasetValidationError, match="negative units_sold"):
        check_value_invariants(corrupted)


def test_detect_invalid_price(small_synthetic_df):
    """Validation must reject zero or negative selling prices."""
    corrupted = small_synthetic_df.copy()
    corrupted.loc[1, "selling_price"] = 0.0
    with pytest.raises(DatasetValidationError, match="zero or negative selling_price"):
        check_value_invariants(corrupted)


def test_detect_date_gaps(small_synthetic_df):
    """Validation must detect temporal gaps in product date sequence."""
    corrupted = small_synthetic_df.copy()
    # Drop single date for product_id 1
    p1_indices = corrupted[corrupted["product_id"] == 1].index
    if len(p1_indices) > 5:
        corrupted = corrupted.drop(index=p1_indices[3])
    with pytest.raises(DatasetValidationError, match="Temporal discontinuity"):
        check_date_continuity(corrupted)


def test_stockout_filtering(small_synthetic_df):
    """Verifies that filter_stockouts separates censored from uncensored rows cleanly."""
    uncensored, stockouts = filter_stockouts(small_synthetic_df)
    assert len(uncensored) + len(stockouts) == len(small_synthetic_df)
    assert (uncensored["is_stockout_day"] == 0).all()
    assert (stockouts["is_stockout_day"] == 1).all()
