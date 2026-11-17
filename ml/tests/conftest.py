"""
StockPilot ML Tests - Pytest configuration and shared fixtures.
"""

import os
import sys
import pytest
import pandas as pd

# Add repository root to sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.data.generate_dataset import generate_synthetic_demand


@pytest.fixture(scope="session")
def small_synthetic_df():
    """Generates a small 60-day deterministic dataset for fast unit testing."""
    return generate_synthetic_demand(
        start_date="2025-01-01",
        end_date="2025-03-01",
        seed=42
    )


@pytest.fixture(scope="session")
def full_synthetic_df():
    """Loads or generates the standard 18-month dataset."""
    csv_path = os.path.join(REPO_ROOT, "ml/data/daily_demand_synthetic.csv")
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    return generate_synthetic_demand(
        start_date="2025-01-01",
        end_date="2026-06-30",
        seed=42
    )
