"""
StockPilot Demand Forecasting - Feature Engineering Pipeline
Phase 6: Strict zero-leakage temporal feature extraction & categorical encoding.

Rules:
- Strictly sorted by product_id and business_date.
- All rolling statistics operate on shifted target (shift(1)) so date t never includes sales from date t or future dates.
- Categorical encoders fitted strictly on training data with an unknown-category fallback.
- Serializable via joblib for inference in the FastAPI ML service.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np


FEATURE_COLUMNS = [
    # Categorical Encoded
    "product_encoded",
    "category_encoded",
    
    # Calendar & Temporal
    "day_of_week",
    "day_of_month",
    "month",
    "week_of_year",
    "is_weekend",
    
    # Exogenous / Pricing
    "selling_price",
    "is_promotional_day",
    "price_ratio",
    
    # Lagged Demand
    "lag_1",
    "lag_7",
    "lag_14",
    "lag_28",
    
    # Rolling Statistics (Shifted History)
    "rolling_7_mean",
    "rolling_7_std",
    "rolling_28_mean",
    "rolling_28_std",
]

TARGET_COLUMN = "units_sold"


class FeaturePipeline:
    """
    Stateful Feature Pipeline for Retail Demand Forecasting.
    
    Fits categorical mappings and historical reference baselines on training data,
    then transforms arbitrary input frames guaranteeing zero lookahead leakage.
    """
    
    def __init__(self):
        self.product_to_idx: Dict[int, int] = {}
        self.category_to_idx: Dict[int, int] = {}
        self.product_base_prices: Dict[int, float] = {}
        self.global_median_price: float = 5.0
        self.feature_columns: List[str] = list(FEATURE_COLUMNS)
        self.target_column: str = TARGET_COLUMN
        self.is_fitted: bool = False

    def fit(self, df_train: pd.DataFrame) -> "FeaturePipeline":
        """Fits encoders and reference baselines strictly on training set."""
        df = df_train.copy()
        
        # 1. Product mapping (with 0 reserved for unknown)
        unique_prods = sorted(df["product_id"].unique())
        self.product_to_idx = {int(p): idx + 1 for idx, p in enumerate(unique_prods)}
        
        # 2. Category mapping (with 0 reserved for unknown)
        unique_cats = sorted(df["category_id"].unique())
        self.category_to_idx = {int(c): idx + 1 for idx, c in enumerate(unique_cats)}
        
        # 3. Product reference prices (median per SKU)
        price_medians = df.groupby("product_id")["selling_price"].median().to_dict()
        self.product_base_prices = {int(k): float(v) for k, v in price_medians.items()}
        self.global_median_price = float(df["selling_price"].median()) if len(df) > 0 else 5.0
        
        self.is_fitted = True
        return self

    def _extract_calendar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extracts deterministic calendar signals from business_date."""
        dt = pd.to_datetime(df["business_date"])
        df["day_of_week"] = dt.dt.day_of_week
        df["day_of_month"] = dt.dt.day
        df["month"] = dt.dt.month
        df["week_of_year"] = dt.dt.isocalendar().week.astype(int)
        df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
        return df

    def _extract_lag_and_rolling_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Computes lagged and rolling statistics with ZERO TARGET LEAKAGE.
        
        Target values are shifted by 1 BEFORE calculating rolling windows, ensuring
        that for observation at time t, only observations at t-1, t-2, ... are accessed.
        """
        # Sort strictly by product_id and business_date
        df = df.sort_values(by=["product_id", "business_date"]).reset_index(drop=True)
        
        grouped = df.groupby("product_id")["units_sold"]
        
        # Lags
        df["lag_1"] = grouped.shift(1)
        df["lag_7"] = grouped.shift(7)
        df["lag_14"] = grouped.shift(14)
        df["lag_28"] = grouped.shift(28)
        
        # Strictly shifted series for rolling calculations
        shifted_1 = grouped.shift(1)
        
        # Rolling 7-day stats
        # min_periods=1 allows calculation with partial history; std uses min_periods=2
        df["rolling_7_mean"] = shifted_1.groupby(df["product_id"]).rolling(window=7, min_periods=1).mean().reset_index(level=0, drop=True)
        df["rolling_7_std"] = shifted_1.groupby(df["product_id"]).rolling(window=7, min_periods=2).std().reset_index(level=0, drop=True).fillna(0.0)
        
        # Rolling 28-day stats
        df["rolling_28_mean"] = shifted_1.groupby(df["product_id"]).rolling(window=28, min_periods=1).mean().reset_index(level=0, drop=True)
        df["rolling_28_std"] = shifted_1.groupby(df["product_id"]).rolling(window=28, min_periods=2).std().reset_index(level=0, drop=True).fillna(0.0)
        
        return df

    def transform(self, df_input: pd.DataFrame, drop_burn_in: bool = True) -> pd.DataFrame:
        """
        Transforms input dataframe into feature matrix.
        
        Parameters:
        - df_input: Raw dataframe with required columns
        - drop_burn_in: If True, drops initial 28 days where lag_28 is NaN.
        """
        if not self.is_fitted:
            raise RuntimeError("FeaturePipeline must be fit() before transform() can be called.")
            
        df = df_input.copy()
        
        # 1. Calendar features
        df = self._extract_calendar_features(df)
        
        # 2. Categorical encodings (0 for unknown/unseen)
        df["product_encoded"] = df["product_id"].map(lambda p: self.product_to_idx.get(int(p), 0))
        df["category_encoded"] = df["category_id"].map(lambda c: self.category_to_idx.get(int(c), 0))
        
        # 3. Price ratio relative to reference baseline
        def get_base_price(pid):
            return self.product_base_prices.get(int(pid), self.global_median_price)
            
        df["base_ref_price"] = df["product_id"].map(get_base_price)
        df["price_ratio"] = (df["selling_price"] / df["base_ref_price"].replace(0, 1.0)).round(4)
        
        # 4. Lag and rolling statistics (zero leakage)
        df = self._extract_lag_and_rolling_features(df)
        
        # 5. Burn-in handling
        if drop_burn_in:
            # Drop rows where 28-day lag is unavailable
            df = df.dropna(subset=["lag_28"]).reset_index(drop=True)
        else:
            # Impute forward for cold-start / inference fallback
            df["lag_28"] = df["lag_28"].fillna(df["lag_14"]).fillna(df["lag_7"]).fillna(df["lag_1"]).fillna(0.0)
            df["lag_14"] = df["lag_14"].fillna(df["lag_7"]).fillna(df["lag_1"]).fillna(0.0)
            df["lag_7"] = df["lag_7"].fillna(df["lag_1"]).fillna(0.0)
            df["lag_1"] = df["lag_1"].fillna(0.0)
            df["rolling_7_mean"] = df["rolling_7_mean"].fillna(df["lag_1"]).fillna(0.0)
            df["rolling_7_std"] = df["rolling_7_std"].fillna(0.0)
            df["rolling_28_mean"] = df["rolling_28_mean"].fillna(df["rolling_7_mean"]).fillna(0.0)
            df["rolling_28_std"] = df["rolling_28_std"].fillna(0.0)

        return df

    def fit_transform(self, df_train: pd.DataFrame, drop_burn_in: bool = True) -> pd.DataFrame:
        """Fits on training data and transforms in one step."""
        return self.fit(df_train).transform(df_train, drop_burn_in=drop_burn_in)

    def get_feature_matrix(self, df_transformed: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Splits transformed dataframe into X (features) and y (target)."""
        X = df_transformed[self.feature_columns].copy()
        y = df_transformed[self.target_column].copy() if self.target_column in df_transformed.columns else None
        return X, y


from typing import Tuple
