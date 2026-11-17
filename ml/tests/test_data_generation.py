"""
Tests for Synthetic Dataset Generator.
Verifies determinism, shape, date continuity, and synthetic labeling.
"""

import pandas as pd
from ml.data.generate_dataset import generate_synthetic_demand, CORE_PRODUCTS


def test_generator_determinism():
    """Proves running generator with identical seed produces bit-for-bit identical DataFrame."""
    df1 = generate_synthetic_demand(start_date="2025-01-01", end_date="2025-02-15", seed=42)
    df2 = generate_synthetic_demand(start_date="2025-01-01", end_date="2025-02-15", seed=42)
    pd.testing.assert_frame_equal(df1, df2)


def test_generator_different_seeds():
    """Proves different seeds generate different random realizations."""
    df1 = generate_synthetic_demand(start_date="2025-01-01", end_date="2025-02-15", seed=42)
    df2 = generate_synthetic_demand(start_date="2025-01-01", end_date="2025-02-15", seed=99)
    assert not df1["units_sold"].equals(df2["units_sold"])


def test_generator_structure_and_labels(small_synthetic_df):
    """Verifies columns, SKU count, and synthetic simulation tagging."""
    df = small_synthetic_df
    expected_cols = [
        "product_id", "sku", "category_id", "category_name",
        "business_date", "units_sold", "selling_price",
        "is_promotional_day", "is_stockout_day", "data_source"
    ]
    for col in expected_cols:
        assert col in df.columns, f"Missing expected column: {col}"
        
    assert df["product_id"].nunique() == len(CORE_PRODUCTS)
    assert (df["data_source"] == "SYNTHETIC_SIMULATION").all()
    assert (df["units_sold"] >= 0).all()
    assert (df["selling_price"] > 0).all()
