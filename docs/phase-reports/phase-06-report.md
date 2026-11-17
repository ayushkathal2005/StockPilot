# Phase 6 Completion Report — ML Dataset Engineering, Baseline Models & XGBoost Training

## 1. Executive Summary
Phase 6 of **StockPilot** establishes the complete offline Machine Learning foundation for product-level daily demand forecasting. A deterministic 18-month retail demand dataset (19,110 records across 35 SKUs) was engineered with realistic seasonality, price dynamics, promotions, and stockout censoring. A zero-target-leakage feature pipeline was built, followed by chronological benchmarking of heuristic baselines (7-day MA, 28-day MA, Seasonal Naive) against a pooled **XGBoost Regressor** (`XGBRegressor`).

The trained XGBoost model achieved a **WAPE of 8.76%** on held-out chronological test data (2026-05-01 to 2026-06-30), delivering a **41.09% error reduction** over the best baseline (Seasonal Naive at 14.87% WAPE). All model artifacts, preprocessors, and machine-readable metadata manifests are persisted in `ml/artifacts/v1/`.

---

## 2. TPDS-III Course Module Alignment
- **Module 3 (Back-End Development):** Implementation of clean, modular Python microservice architecture (`ml/data/`, `ml/features/`, `ml/models/`) with reproducible CLI pipelines and deterministic data contracts.
- **Module 4 (Git & Deployment):** Versioned ML artifacts (`ml/artifacts/v1/`), clean dependency pinning (`ml/requirements.txt`), automated test validation, and strict Git commit/tag integration.

---

## 3. Implemented Deliverables

### A. Synthetic Dataset Generation (`ml/data/generate_dataset.py`)
- **Catalogue:** 35 retail SKUs matching `StockPilotDB` active catalogue across 5 core categories (Beverages, Packaged Foods, Dairy & Chilled, Household Essentials, Personal Care).
- **Time Horizon:** 546 consecutive days (2025-01-01 to 2026-06-30), producing 19,110 rows.
- **Determinism:** Seed-fixed (`--seed 42`) generating bit-for-bit identical outputs.
- **Signals Simulated:** Day-of-week retail traffic lifts, category seasonal cycles, price jitter, promotional discount surges (+40% to +75% lift), and Poisson/normal demand noise.
- **Stockout Censoring:** 286 product-days (1.50%) simulated as inventory depletion events, collapsing observed demand to 0–2 units.
- **Labeling:** Explicitly tagged with `data_source = 'SYNTHETIC_SIMULATION'`.

### B. Dataset Quality Validation Pipeline (`ml/data/validate_dataset.py`)
- Verifies schema completeness, absence of duplicates on `(product_id, business_date)`, temporal continuity per SKU (0 date gaps), non-negative demand, positive selling prices, and binary flag validity.
- Functions `filter_stockouts()` to isolate censored records so they are excluded from supervised model training and evaluation.

### C. Zero-Leakage Feature Pipeline (`ml/features/feature_pipeline.py`)
- Encodes product and category identifiers with unseen-category fallbacks.
- Extracts calendar features (`day_of_week`, `day_of_month`, `month`, `week_of_year`, `is_weekend`).
- Computes price ratios against historical median baseline prices.
- Extracts lag features (`lag_1`, `lag_7`, `lag_14`, `lag_28`) and rolling statistics (7-day and 28-day means and standard deviations) **strictly on target shifted by 1** (`df.groupby('product_id')['units_sold'].shift(1)`).
- Mathematically verified via test: target values on day $t$ cannot influence features on day $t$.

### D. Baseline Benchmark Models (`ml/models/baselines.py`)
- Implements 7-day Moving Average, 28-day Moving Average, and Seasonal Naive (`lag_7`) models.
- Standardizes metrics calculation (MAE, RMSE, WAPE) with explicit zero-denominator handling and non-negative prediction clamping.

### E. XGBoost Regressor Training Pipeline (`ml/models/train_xgboost.py`)
- Strictly chronological 3-way partition:
  - **Train:** 2025-01-29 to 2026-03-31 (14,698 samples).
  - **Validation:** 2026-04-01 to 2026-04-30 (1,038 samples).
  - **Test (Holdout):** 2026-05-01 to 2026-06-30 (2,108 samples).
- Pooled regression model across all SKUs using 18 feature predictors.
- Automatically compares XGBoost vs all baselines, checks the Part E acceptance gate, and persists versioned artifacts to `ml/artifacts/v1/`.

### F. Model Documentation & Artifacts
- **Model Card:** `docs/ml-model-card.md`.
- **Artifacts (`ml/artifacts/v1/`):**
  - `xgboost_model.json`: Native XGBoost JSON booster.
  - `preprocessor.joblib`: Serialized `FeaturePipeline`.
  - `metadata.json`: Machine-readable training metadata, parameter manifest, and comparison metrics.
  - `evaluation_report.json`: Category breakdown and sample predictions.

---

## 4. Evaluation Results & Model Acceptance Decision

Evaluated on the 61-day holdout test set (2,108 product-days):

| Model | MAE (units/day) | RMSE (units/day) | WAPE | Model Acceptance Status |
|---|---|---|---|---|
| **XGBoost Regressor (`v1.0.0`)** | **3.2389** | **4.2921** | **0.0876 (8.76%)** | **PREFERRED_MODEL (Accepted)** |
| Seasonal Naive (`lag_7`) | 5.4953 | 8.5478 | 0.1487 (14.87%) | Baseline Benchmark |
| 28-Day Moving Average | 6.9693 | 9.4843 | 0.1886 (18.86%) | Baseline Benchmark |
| 7-Day Moving Average | 7.1337 | 9.6194 | 0.1931 (19.31%) | Baseline Benchmark |

### Category Performance Breakdown
- **Dairy & Chilled:** WAPE **7.32%**, MAE 3.93
- **Beverages:** WAPE **8.57%**, MAE 4.04
- **Personal Care:** WAPE **8.78%**, MAE 2.05
- **Packaged Foods:** WAPE **9.38%**, MAE 3.40
- **Household Essentials:** WAPE **10.32%**, MAE 2.79

### Acceptance Gate Determination
The implementation plan states:
> *"XGBoost may be selected as the preferred model only if chronological held-out results are at least competitive with the strongest baseline on the agreed primary metric (WAPE) and do not materially worsen MAE/RMSE."*

**Outcome:** XGBoost outperformed the strongest baseline by **41.09% on WAPE**, reduced MAE by 41.1%, and reduced RMSE by 49.8%. Therefore, XGBoost is formally designated as `PREFERRED_MODEL` and selected for the Phase 7 live replenishment service.

---

## 5. Automated Test Suite Results

### Python ML Suite (`pytest ml/tests -v`)
- `test_baselines.py`: 3 tests (metric calculations, zero denominator, clamped predictions).
- `test_data_generation.py`: 3 tests (determinism, seed variance, labeling/structure).
- `test_feature_pipeline.py`: 2 tests (**zero target leakage**, unseen category handling).
- `test_model_training.py`: 3 tests (artifact existence, clean process loading & prediction, metadata acceptance gate).
- `test_validation.py`: 6 tests (clean data, duplicates, negative demand, invalid price, date gaps, stockout filtering).
**Result:** **17 passed, 0 failed in 2.11s (100% passing)**.

### Node.js Backend Suite (`npm test`)
- 8 test suites passed, **61 passed, 61 total (100% passing)**.

**Total Automated Tests:** **78 passing tests across Node.js and Python**.

---

## 6. Git Synchronization Checklist
- [x] All ML source files created in `ml/`.
- [x] All tests passing.
- [x] Documentation and Model Card created in `docs/`.
- [x] Artifacts versioned in `ml/artifacts/v1/`.
- [ ] Staged and committed on `develop`.
- [ ] Tagged as `phase-06-complete`.
- [ ] Pushed `develop` and tag to GitHub remote `origin`.
- [ ] Verified via `git ls-remote`.
