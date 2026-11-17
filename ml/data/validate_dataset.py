"""
StockPilot Demand Forecasting - Dataset Validation Pipeline
Phase 6: Comprehensive data quality checks and stockout filtering.

Checks:
- Duplicate (product_id, business_date) pairs
- Temporal continuity and date gaps per SKU
- Invariants: units_sold >= 0, selling_price > 0
- Boolean validity for promotional and stockout flags
- Stockout censoring identification and exclusion for model training
"""

import argparse
import sys
from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np


REQUIRED_COLUMNS = [
    "product_id",
    "business_date",
    "units_sold",
    "selling_price",
    "is_promotional_day",
    "is_stockout_day"
]


class DatasetValidationError(ValueError):
    """Raised when critical dataset validation checks fail."""
    pass


def validate_schema(df: pd.DataFrame) -> None:
    """Verifies that all required columns are present."""
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise DatasetValidationError(f"Missing required columns in dataset: {missing}")


def check_duplicates(df: pd.DataFrame) -> int:
    """Checks for duplicate (product_id, business_date) records."""
    duplicates = df.duplicated(subset=["product_id", "business_date"], keep=False)
    num_duplicates = int(duplicates.sum())
    if num_duplicates > 0:
        sample = df[duplicates].head(4)
        raise DatasetValidationError(
            f"Found {num_duplicates} duplicate (product_id, business_date) records. Sample:\n{sample}"
        )
    return 0


def check_date_continuity(df: pd.DataFrame) -> Dict[int, int]:
    """
    Checks for unexpected temporal gaps for each product_id.
    Returns a dict mapping product_id to number of missing days (if any).
    """
    gaps_by_product = {}
    temp_df = df.copy()
    temp_df["business_date"] = pd.to_datetime(temp_df["business_date"])
    
    for prod_id, group in temp_df.groupby("product_id"):
        min_date = group["business_date"].min()
        max_date = group["business_date"].max()
        expected_days = (max_date - min_date).days + 1
        actual_days = group["business_date"].nunique()
        if expected_days != actual_days:
            missing_count = expected_days - actual_days
            gaps_by_product[int(prod_id)] = missing_count
            
    if gaps_by_product:
        raise DatasetValidationError(
            f"Temporal discontinuity detected! Missing date gaps found in products: {gaps_by_product}"
        )
    return gaps_by_product


def check_value_invariants(df: pd.DataFrame) -> None:
    """Checks business invariants on values."""
    # Negative units sold
    negative_units = df[df["units_sold"] < 0]
    if len(negative_units) > 0:
        raise DatasetValidationError(
            f"Found {len(negative_units)} rows with negative units_sold!"
        )
        
    # Non-positive selling price
    invalid_prices = df[df["selling_price"] <= 0]
    if len(invalid_prices) > 0:
        raise DatasetValidationError(
            f"Found {len(invalid_prices)} rows with zero or negative selling_price!"
        )
        
    # Valid binary flags
    invalid_promo = df[~df["is_promotional_day"].isin([0, 1])]
    if len(invalid_promo) > 0:
        raise DatasetValidationError(
            f"Found {len(invalid_promo)} rows with invalid is_promotional_day flag (must be 0 or 1)!"
        )
        
    invalid_stockout = df[~df["is_stockout_day"].isin([0, 1])]
    if len(invalid_stockout) > 0:
        raise DatasetValidationError(
            f"Found {len(invalid_stockout)} rows with invalid is_stockout_day flag (must be 0 or 1)!"
        )


def filter_stockouts(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits dataset into uncensored training/evaluation data and censored stockout data.
    
    Per Implementation Plan Part E, Section 14:
    "Sales during a stockout period understate unconstrained demand.
     Mark stockout-affected product-days and exclude them from supervised model training/evaluation."
    """
    uncensored = df[df["is_stockout_day"] == 0].copy().reset_index(drop=True)
    stockouts = df[df["is_stockout_day"] == 1].copy().reset_index(drop=True)
    return uncensored, stockouts


def run_full_validation(df: pd.DataFrame) -> Dict[str, Any]:
    """Runs all validation rules and returns a summary report."""
    validate_schema(df)
    check_duplicates(df)
    check_date_continuity(df)
    check_value_invariants(df)
    
    uncensored, stockouts = filter_stockouts(df)
    
    report = {
        "status": "PASSED",
        "total_records": len(df),
        "unique_products": int(df["product_id"].nunique()),
        "min_date": str(df["business_date"].min()),
        "max_date": str(df["business_date"].max()),
        "total_days": int(pd.to_datetime(df["business_date"]).nunique()),
        "mean_daily_units": float(df["units_sold"].mean()),
        "max_daily_units": int(df["units_sold"].max()),
        "promo_records": int(df["is_promotional_day"].sum()),
        "promo_percentage": float(df["is_promotional_day"].mean() * 100),
        "stockout_records": int(df["is_stockout_day"].sum()),
        "stockout_percentage": float(df["is_stockout_day"].mean() * 100),
        "uncensored_records_for_training": len(uncensored),
        "censored_records_excluded": len(stockouts)
    }
    return report


def main():
    parser = argparse.ArgumentParser(description="StockPilot Dataset Validation Pipeline")
    parser.add_argument("--input", default="ml/data/daily_demand_synthetic.csv", help="Input CSV path")
    args = parser.parse_args()

    print(f"Validating dataset: {args.input}...")
    try:
        df = pd.read_csv(args.input)
        report = run_full_validation(df)
        print("\n================ DATASET VALIDATION REPORT ================")
        print(f"Status:                      {report['status']}")
        print(f"Total Records:               {report['total_records']:,}")
        print(f"SKUs Count:                  {report['unique_products']}")
        print(f"Date Horizon:                {report['min_date']} to {report['max_date']} ({report['total_days']} days)")
        print(f"Mean Daily Units:            {report['mean_daily_units']:.2f}")
        print(f"Max Daily Units:             {report['max_daily_units']}")
        print(f"Promotional Records:         {report['promo_records']:,} ({report['promo_percentage']:.2f}%)")
        print(f"Stockout Censored Days:      {report['stockout_records']:,} ({report['stockout_percentage']:.2f}%)")
        print(f"Uncensored for ML Training:  {report['uncensored_records_for_training']:,}")
        print("===========================================================")
        print("Dataset meets all quality gates and invariants.")
    except Exception as e:
        print(f"\n[VALIDATION FAILED] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
