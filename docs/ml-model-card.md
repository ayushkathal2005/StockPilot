# StockPilot — Machine Learning Model Card: Demand Forecasting (v1.0.0)

## 1. Model Overview
- **Model Name:** StockPilot Pooled Demand Forecasting Engine
- **Model Type:** Gradient Boosted Decision Trees Regressor (`xgboost.XGBRegressor`)
- **Version:** `v1.0.0`
- **Trained Date:** November 2026
- **Architecture:** Pooled supervised regression model capturing cross-product and categorical demand patterns while conditioning on SKU encodings, calendar dynamics, price elasticity, and historical lag/rolling statistics.

---

## 2. Intended Use & Scope
- **Primary Use:** Daily demand forecasting for 7- to 30-day replenishment horizons in small and medium-sized businesses (SMBs).
- **Downstream Application:** Feeds safety stock estimation and target inventory calculations in Phase 7 replenishment workflows.
- **Out of Scope:** Does not make autonomous purchase order commitments; all recommendations require human manager sign-off.

---

## 3. Training & Evaluation Dataset
- **Nature of Data:** **Deterministic Synthetic Retail Daily Demand** (`data_source = 'SYNTHETIC_SIMULATION'`). Generated via `ml/data/generate_dataset.py` with random seed `42`.
- **Catalogue Size:** 35 retail SKUs spanning 5 categories (Beverages, Packaged Foods, Dairy & Chilled, Household Essentials, Personal Care).
- **Time Horizon:** 546 consecutive days (2025-01-01 to 2026-06-30). Total rows: 19,110.
- **Stockout Censoring Handling:** 286 product-days (1.50%) were identified as stockout-censored (depleted inventory where realized sales understate true consumer demand). Per implementation specification, stockout-censored days are **strictly excluded** from supervised training and test evaluation.
- **Chronological Partitions (No Random Shuffling):**
  - **Train Partition:** 2025-01-29 to 2026-03-31 (14,698 samples, initial 28 days burn-in for lag features excluded).
  - **Validation Partition:** 2026-04-01 to 2026-04-30 (1,038 samples).
  - **Holdout Test Partition:** 2026-05-01 to 2026-06-30 (2,108 samples).

---

## 4. Feature Engineering & Zero-Leakage Guarantee

All features are extracted via `ml/features/feature_pipeline.py`.

| Feature Name | Type | Description | Zero-Leakage Guarantee |
|---|---|---|---|
| `product_encoded` | Categorical | Integer encoding of SKU | Fitted on training set; unknown mapped to `0` |
| `category_encoded` | Categorical | Integer encoding of Category | Fitted on training set; unknown mapped to `0` |
| `day_of_week` | Temporal | Integer `0` (Monday) to `6` (Sunday) | Known ahead of time |
| `day_of_month` | Temporal | Day of month (`1` to `31`) | Known ahead of time |
| `month` | Temporal | Month (`1` to `12`) | Known ahead of time |
| `week_of_year` | Temporal | ISO week of year (`1` to `53`) | Known ahead of time |
| `is_weekend` | Temporal | Binary flag (`1` for Sat/Sun) | Known ahead of time |
| `selling_price` | Exogenous | Unit selling price on forecast date | Known planned price |
| `is_promotional_day` | Exogenous | Binary promotion flag | Known planned event |
| `price_ratio` | Exogenous | Ratio of price to historical median | Anchored on historical training median |
| `lag_1` | Autoregressive | Demand on day $t-1$ | Shifted $1$ day backwards |
| `lag_7` | Autoregressive | Demand on day $t-7$ | Shifted $7$ days backwards |
| `lag_14` | Autoregressive | Demand on day $t-14$ | Shifted $14$ days backwards |
| `lag_28` | Autoregressive | Demand on day $t-28$ | Shifted $28$ days backwards |
| `rolling_7_mean` | Moving Stat | Mean demand over $[t-7, t-1]$ | Computed on `shift(1)` |
| `rolling_7_std` | Moving Stat | Std dev of demand over $[t-7, t-1]$ | Computed on `shift(1)` |
| `rolling_28_mean` | Moving Stat | Mean demand over $[t-28, t-1]$ | Computed on `shift(1)` |
| `rolling_28_std` | Moving Stat | Std dev of demand over $[t-28, t-1]$ | Computed on `shift(1)` |

> [!IMPORTANT]
> The automated test `test_zero_target_leakage` in `ml/tests/test_feature_pipeline.py` modifies the target demand $y_t$ on date $t$ to 999,999 and verifies that all 18 feature values for date $t$ remain 100% identical.

---

## 5. Model Evaluation & Benchmark Comparison

Evaluated on the 61-day holdout test period (2026-05-01 to 2026-06-30, 2,108 product-days):

$$\text{WAPE} = \frac{\sum |y_i - \hat{y}_i|}{\sum y_i}$$

| Model Candidate | MAE (units/day) | RMSE (units/day) | WAPE | Outcome |
|---|---|---|---|---|
| **XGBoost Regressor (`v1.0.0`)** | **3.2389** | **4.2921** | **0.0876 (8.76%)** | **ACCEPTED (Preferred)** |
| Seasonal Naive (`lag_7`) | 5.4953 | 8.5478 | 0.1487 (14.87%) | Benchmark Baseline |
| 28-Day Moving Average | 6.9693 | 9.4843 | 0.1886 (18.86%) | Benchmark Baseline |
| 7-Day Moving Average | 7.1337 | 9.6194 | 0.1931 (19.31%) | Benchmark Baseline |

### Performance Breakdown by Retail Category
| Category Name | Test Rows | MAE | RMSE | WAPE |
|---|---|---|---|---|
| **Dairy & Chilled** | 423 | 3.9279 | 5.3848 | **7.32%** |
| **Beverages** | 422 | 4.0363 | 5.1183 | **8.57%** |
| **Personal Care** | 421 | 2.0527 | 2.7661 | **8.78%** |
| **Packaged Foods** | 421 | 3.3999 | 4.3015 | **9.38%** |
| **Household Essentials** | 421 | 2.7882 | 3.5709 | **10.32%** |

---

## 6. Model Acceptance Gate Decision
- **Status:** `PREFERRED_MODEL`
- **Rule Verification:** XGBoost achieved **WAPE 8.76%**, outperforming the strongest baseline (Seasonal Naive at 14.87%) by **41.09% relative error reduction** while also dramatically reducing MAE from 5.50 to 3.24 units/day and RMSE from 8.55 to 4.29 units/day.
- **Replenishment Selection:** Formally selected as the primary forecasting engine for Phase 7.

---

## 7. Model Artifacts & Reproducibility
Versioned artifacts saved in `ml/artifacts/v1/`:
- `xgboost_model.json`: Native JSON format XGBoost booster.
- `preprocessor.joblib`: Serialized `FeaturePipeline` instance with fitted mappings.
- `metadata.json`: Machine-readable metadata record detailing parameters, data slices, and comparison metrics.
- `evaluation_report.json`: Detailed evaluation results and sample predictions.

**CLI Commands for Full Reproduction:**
```powershell
# 1. Generate 18-month deterministic synthetic dataset
python ml/data/generate_dataset.py --seed 42

# 2. Validate data quality and stockout censoring
python ml/data/validate_dataset.py

# 3. Train pooled XGBoost model and generate artifacts
python ml/models/train_xgboost.py --seed 42

# 4. Run automated test suite
python -m pytest ml/tests -v
```
