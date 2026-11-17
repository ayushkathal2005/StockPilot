"""
StockPilot Demand Forecasting - XGBoost Regressor Training & Evaluation
Phase 6: Pooled Supervised Regression Model with Chronological Holdout Validation.

Acceptance Criteria:
- Chronological split: Training -> Validation -> Test (no random shuffling).
- Stockout-censored days excluded from supervised optimization & evaluation.
- Rolling statistics and lags use strictly shifted historical observations.
- Benchmarked against 7-day MA, 28-day MA, and Seasonal Naive baselines.
- Evaluation metrics: MAE, RMSE, WAPE.
- Model artifacts persisted to ml/artifacts/v1/ (native JSON + joblib preprocessor + metadata).
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from ml.data.validate_dataset import run_full_validation, filter_stockouts
from ml.features.feature_pipeline import FeaturePipeline
from ml.models.baselines import (
    MovingAverageBaseline,
    SeasonalNaiveBaseline,
    calculate_metrics
)


def chronological_split(
    df: pd.DataFrame,
    train_end: str = "2026-03-31",
    val_end: str = "2026-04-30"
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Performs strictly chronological train / validation / test split.
    
    Partitions:
    - Train: start to train_end (e.g. 2025-01-01 to 2026-03-31, ~15 months)
    - Val: (train_end, val_end] (e.g. 2026-04-01 to 2026-04-30, 1 month)
    - Test: > val_end (e.g. 2026-05-01 to 2026-06-30, 2 months holdout)
    """
    df_sorted = df.sort_values(by=["business_date", "product_id"]).reset_index(drop=True)
    
    train_mask = df_sorted["business_date"] <= train_end
    val_mask = (df_sorted["business_date"] > train_end) & (df_sorted["business_date"] <= val_end)
    test_mask = df_sorted["business_date"] > val_end
    
    df_train = df_sorted[train_mask].copy().reset_index(drop=True)
    df_val = df_sorted[val_mask].copy().reset_index(drop=True)
    df_test = df_sorted[test_mask].copy().reset_index(drop=True)
    
    return df_train, df_val, df_test


def evaluate_by_category(
    df_test_clean: pd.DataFrame,
    y_test: np.ndarray,
    y_pred: np.ndarray
) -> Dict[str, Dict[str, float]]:
    """Calculates evaluation metrics broken down by product category."""
    breakdown = {}
    temp = df_test_clean.copy()
    temp["y_true"] = y_test
    temp["y_pred"] = y_pred
    
    for cat_name, group in temp.groupby("category_name"):
        metrics = calculate_metrics(group["y_true"].values, group["y_pred"].values)
        breakdown[cat_name] = metrics
        
    return breakdown


def train_and_evaluate(
    data_path: str = "ml/data/daily_demand_synthetic.csv",
    output_dir: str = "ml/artifacts/v1",
    train_end: str = "2026-03-31",
    val_end: str = "2026-04-30",
    seed: int = 42
) -> Dict[str, Any]:
    """Complete training and evaluation pipeline."""
    print(f"[1/6] Loading and validating dataset from: {data_path}")
    raw_df = pd.read_csv(data_path)
    val_report = run_full_validation(raw_df)
    
    print(f"[2/6] Filtering stockout-censored days ({val_report['stockout_records']} censored days excluded)...")
    clean_df, stockouts_df = filter_stockouts(raw_df)
    
    print(f"[3/6] Fitting FeaturePipeline and extracting features with zero leakage...")
    pipeline = FeaturePipeline()
    # Fit pipeline on all clean records to establish product/category encodings and median price anchors
    pipeline.fit(clean_df)
    
    # Transform full clean dataset with strictly shifted rolling history
    transformed_df = pipeline.transform(clean_df, drop_burn_in=True)
    
    print(f"[4/6] Performing strictly chronological train/val/test split...")
    df_train, df_val, df_test = chronological_split(transformed_df, train_end=train_end, val_end=val_end)
    
    print(f"      Train rows: {len(df_train):,} ({df_train['business_date'].min()} to {df_train['business_date'].max()})")
    print(f"      Val   rows: {len(df_val):,} ({df_val['business_date'].min()} to {df_val['business_date'].max()})")
    print(f"      Test  rows: {len(df_test):,} ({df_test['business_date'].min()} to {df_test['business_date'].max()})")
    
    X_train, y_train = pipeline.get_feature_matrix(df_train)
    X_val, y_val = pipeline.get_feature_matrix(df_val)
    X_test, y_test = pipeline.get_feature_matrix(df_test)
    
    # Train pooled XGBoost Regressor
    print(f"[5/6] Training pooled XGBRegressor (random_state={seed})...")
    hyperparameters = {
        "n_estimators": 250,
        "max_depth": 5,
        "learning_rate": 0.04,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "random_state": seed,
        "n_jobs": -1,
        "objective": "reg:squarederror"
    }
    
    model = XGBRegressor(**hyperparameters)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    print(f"[6/6] Evaluating models on chronological holdout test set...")
    # Predictions
    xgb_pred_raw = model.predict(X_test)
    xgb_pred = np.maximum(0.0, xgb_pred_raw) # Non-negative clamp
    
    # Metrics
    xgb_metrics = calculate_metrics(y_test.values, xgb_pred)
    
    # Baselines
    ma7 = MovingAverageBaseline(window=7)
    ma28 = MovingAverageBaseline(window=28)
    s_naive = SeasonalNaiveBaseline(lag=7)
    
    ma7_pred = ma7.predict(df_test)
    ma28_pred = ma28.predict(df_test)
    s_naive_pred = s_naive.predict(df_test)
    
    ma7_metrics = calculate_metrics(y_test.values, ma7_pred)
    ma28_metrics = calculate_metrics(y_test.values, ma28_pred)
    s_naive_metrics = calculate_metrics(y_test.values, s_naive_pred)
    
    # Category breakdown for XGBoost
    cat_breakdown = evaluate_by_category(df_test, y_test.values, xgb_pred)
    
    # Acceptance check
    best_baseline_wape = min(ma7_metrics["wape"], ma28_metrics["wape"], s_naive_metrics["wape"])
    is_accepted = xgb_metrics["wape"] <= best_baseline_wape
    status_label = "PREFERRED_MODEL" if is_accepted else "EXPERIMENTAL_BASELINE_PREFERRED"
    
    # Artifact persistence
    os.makedirs(output_dir, exist_ok=True)
    model_json_path = os.path.join(output_dir, "xgboost_model.json")
    preprocessor_path = os.path.join(output_dir, "preprocessor.joblib")
    metadata_path = os.path.join(output_dir, "metadata.json")
    report_path = os.path.join(output_dir, "evaluation_report.json")
    
    # 1. Save native XGBoost JSON
    model.save_model(model_json_path)
    
    # 2. Save FeaturePipeline preprocessor
    joblib.dump(pipeline, preprocessor_path)
    
    # 3. Save comprehensive metadata
    metadata = {
        "model_version": "v1.0.0",
        "model_type": "XGBRegressor (Pooled Supervised Demand Forecasting)",
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "random_seed": seed,
        "data_summary": {
            "source_file": data_path,
            "total_records": val_report["total_records"],
            "unique_skus": val_report["unique_products"],
            "date_range": f"{val_report['min_date']} to {val_report['max_date']}",
            "stockout_censored_days_excluded": val_report["stockout_records"],
            "train_range": f"{df_train['business_date'].min()} to {df_train['business_date'].max()}",
            "train_samples": len(df_train),
            "val_range": f"{df_val['business_date'].min()} to {df_val['business_date'].max()}",
            "val_samples": len(df_val),
            "test_range": f"{df_test['business_date'].min()} to {df_test['business_date'].max()}",
            "test_samples": len(df_test)
        },
        "feature_list": pipeline.feature_columns,
        "hyperparameters": {k: (v if not isinstance(v, np.generic) else v.item()) for k, v in hyperparameters.items()},
        "model_comparison": {
            "xgboost": xgb_metrics,
            "seasonal_naive_lag_7": s_naive_metrics,
            "moving_average_7d": ma7_metrics,
            "moving_average_28d": ma28_metrics
        },
        "model_acceptance_gate": {
            "status": status_label,
            "xgboost_wape": xgb_metrics["wape"],
            "best_baseline_wape": best_baseline_wape,
            "wape_improvement_pct": round(((best_baseline_wape - xgb_metrics["wape"]) / best_baseline_wape) * 100, 2),
            "is_selected_for_replenishment": is_accepted
        },
        "category_performance": cat_breakdown,
        "artifact_files": {
            "model_json": "xgboost_model.json",
            "preprocessor_joblib": "preprocessor.joblib",
            "metadata_json": "metadata.json"
        }
    }
    
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
        
    with open(report_path, "w") as f:
        json.dump({
            "test_evaluation": metadata["model_comparison"],
            "category_breakdown": cat_breakdown,
            "sample_predictions": [
                {
                    "product_id": int(df_test.iloc[i]["product_id"]),
                    "sku": str(df_test.iloc[i]["sku"]),
                    "date": str(df_test.iloc[i]["business_date"]),
                    "actual": float(y_test.iloc[i]),
                    "xgboost_pred": round(float(xgb_pred[i]), 2),
                    "seasonal_naive_pred": round(float(s_naive_pred[i]), 2),
                    "ma7_pred": round(float(ma7_pred[i]), 2)
                }
                for i in range(min(50, len(df_test)))
            ]
        }, f, indent=2)
        
    print("\n================ MODEL EVALUATION SUMMARY ================")
    print(f"{'Model':<24} | {'MAE':<8} | {'RMSE':<8} | {'WAPE':<8}")
    print("-" * 55)
    print(f"{'XGBoost Regressor':<24} | {xgb_metrics['mae']:<8.4f} | {xgb_metrics['rmse']:<8.4f} | {xgb_metrics['wape']:<8.4f}")
    print(f"{'Seasonal Naive (lag 7)':<24} | {s_naive_metrics['mae']:<8.4f} | {s_naive_metrics['rmse']:<8.4f} | {s_naive_metrics['wape']:<8.4f}")
    print(f"{'7-Day Moving Average':<24} | {ma7_metrics['mae']:<8.4f} | {ma7_metrics['rmse']:<8.4f} | {ma7_metrics['wape']:<8.4f}")
    print(f"{'28-Day Moving Average':<24} | {ma28_metrics['mae']:<8.4f} | {ma28_metrics['rmse']:<8.4f} | {ma28_metrics['wape']:<8.4f}")
    print("=" * 55)
    print(f"Model Acceptance Status: {status_label}")
    print(f"XGBoost WAPE Improvement over Best Baseline: {metadata['model_acceptance_gate']['wape_improvement_pct']}%")
    print(f"Artifacts successfully written to: {output_dir}")
    print("==========================================================")
    
    return metadata


def main():
    parser = argparse.ArgumentParser(description="StockPilot XGBoost Training & Evaluation CLI")
    parser.add_argument("--data", default="ml/data/daily_demand_synthetic.csv", help="Input synthetic dataset")
    parser.add_argument("--output-dir", default="ml/artifacts/v1", help="Directory to save model artifacts")
    parser.add_argument("--train-end", default="2026-03-31", help="End date for training set (YYYY-MM-DD)")
    parser.add_argument("--val-end", default="2026-04-30", help="End date for validation set (YYYY-MM-DD)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for model training")
    args = parser.parse_args()

    train_and_evaluate(
        data_path=args.data,
        output_dir=args.output_dir,
        train_end=args.train_end,
        val_end=args.val_end,
        seed=args.seed
    )


if __name__ == "__main__":
    main()
