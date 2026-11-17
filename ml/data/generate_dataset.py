"""
StockPilot Demand Forecasting - Synthetic Dataset Generator
Phase 6: Deterministic 18-month daily demand dataset generation.

Follows TPDS-III Course Module specifications:
- Seed-fixed, reproducible synthetic daily demand across realistic retail SKUs.
- Realistic day-of-week, seasonality, trend, promotional uplift, and stockout censoring.
- Explicitly labeled with data_source = 'SYNTHETIC_SIMULATION'.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# Core 35 catalog products matching StockPilotDB seeded catalogue
CORE_PRODUCTS = [
    # Beverages (Category 1)
    {"product_id": 1, "sku": "BEV-COLA-330", "name": "Classic Cola Can 330ml (Pack of 24)", "category_id": 1, "category": "Beverages", "base_price": 18.99, "base_demand": 38, "lead_time": 5},
    {"product_id": 2, "sku": "BEV-DIET-330", "name": "Diet Cola Can 330ml (Pack of 24)", "category_id": 1, "category": "Beverages", "base_price": 18.99, "base_demand": 28, "lead_time": 5},
    {"product_id": 3, "sku": "BEV-ORNG-100", "name": "Pure Squeezed Orange Juice 1L", "category_id": 1, "category": "Beverages", "base_price": 3.49, "base_demand": 45, "lead_time": 3},
    {"product_id": 4, "sku": "BEV-APPL-100", "name": "Cold Pressed Apple Cider 1L", "category_id": 1, "category": "Beverages", "base_price": 3.89, "base_demand": 30, "lead_time": 3},
    {"product_id": 5, "sku": "BEV-SPRK-500", "name": "Sparkling Mineral Water 500ml (Pack of 12)", "category_id": 1, "category": "Beverages", "base_price": 8.49, "base_demand": 25, "lead_time": 5},
    {"product_id": 6, "sku": "BEV-GRNT-050", "name": "Organic Japanese Green Tea Bags (50ct)", "category_id": 1, "category": "Beverages", "base_price": 6.99, "base_demand": 18, "lead_time": 6},
    {"product_id": 7, "sku": "BEV-ROST-250", "name": "Dark Roast Whole Bean Coffee 250g", "category_id": 1, "category": "Beverages", "base_price": 8.99, "base_demand": 32, "lead_time": 5},

    # Packaged Foods (Category 2)
    {"product_id": 8, "sku": "PKF-CHOC-150", "name": "Dark Chocolate Almond Bar 150g", "category_id": 2, "category": "Packaged Foods", "base_price": 2.79, "base_demand": 24, "lead_time": 7},
    {"product_id": 9, "sku": "PKF-CRCK-200", "name": "Whole Grain Crackers Box 200g", "category_id": 2, "category": "Packaged Foods", "base_price": 2.49, "base_demand": 22, "lead_time": 7},
    {"product_id": 10, "sku": "PKF-PSTA-500", "name": "Italian Durum Wheat Penne Pasta 500g", "category_id": 2, "category": "Packaged Foods", "base_price": 1.99, "base_demand": 50, "lead_time": 7},
    {"product_id": 11, "sku": "PKF-TOMA-400", "name": "Organic Peeled Plum Tomatoes 400g Can", "category_id": 2, "category": "Packaged Foods", "base_price": 1.59, "base_demand": 42, "lead_time": 7},
    {"product_id": 12, "sku": "PKF-OATS-100", "name": "Rolled Traditional Oats 1kg Tub", "category_id": 2, "category": "Packaged Foods", "base_price": 4.49, "base_demand": 19, "lead_time": 7},
    {"product_id": 13, "sku": "PKF-CHIP-180", "name": "Sea Salt Kettle Potato Chips 180g", "category_id": 2, "category": "Packaged Foods", "base_price": 2.99, "base_demand": 36, "lead_time": 7},
    {"product_id": 14, "sku": "PKF-ALMD-500", "name": "Roasted Unsalted Whole Almonds 500g", "category_id": 2, "category": "Packaged Foods", "base_price": 10.99, "base_demand": 15, "lead_time": 7},

    # Dairy & Chilled (Category 3)
    {"product_id": 15, "sku": "DRY-WMLK-100", "name": "Whole Pasteurized Fresh Milk 1L", "category_id": 3, "category": "Dairy & Chilled", "base_price": 1.89, "base_demand": 75, "lead_time": 3},
    {"product_id": 16, "sku": "DRY-SMLK-100", "name": "Semi-Skimmed Fresh Milk 1L", "category_id": 3, "category": "Dairy & Chilled", "base_price": 1.89, "base_demand": 65, "lead_time": 3},
    {"product_id": 17, "sku": "DRY-CHED-250", "name": "Aged Mature White Cheddar Block 250g", "category_id": 3, "category": "Dairy & Chilled", "base_price": 4.79, "base_demand": 26, "lead_time": 3},
    {"product_id": 18, "sku": "DRY-YOGT-500", "name": "Natural Greek Strained Yogurt 500g", "category_id": 3, "category": "Dairy & Chilled", "base_price": 3.29, "base_demand": 34, "lead_time": 3},
    {"product_id": 19, "sku": "DRY-BUTR-250", "name": "Salted Pure Creamery Butter 250g", "category_id": 3, "category": "Dairy & Chilled", "base_price": 3.49, "base_demand": 29, "lead_time": 3},
    {"product_id": 20, "sku": "DRY-EGGS-012", "name": "Free Range Grade-A Eggs (12-pack)", "category_id": 3, "category": "Dairy & Chilled", "base_price": 4.29, "base_demand": 58, "lead_time": 2},
    {"product_id": 21, "sku": "DRY-CRMT-200", "name": "Fresh Heavy Whipping Cream 200ml", "category_id": 3, "category": "Dairy & Chilled", "base_price": 2.39, "base_demand": 16, "lead_time": 3},

    # Household Essentials (Category 4)
    {"product_id": 22, "sku": "HSE-LDET-200", "name": "Concentrated Liquid Laundry Detergent 2L", "category_id": 4, "category": "Household Essentials", "base_price": 11.49, "base_demand": 14, "lead_time": 10},
    {"product_id": 23, "sku": "HSE-DWSH-750", "name": "Antibacterial Dishwashing Liquid 750ml", "category_id": 4, "category": "Household Essentials", "base_price": 2.79, "base_demand": 25, "lead_time": 10},
    {"product_id": 24, "sku": "HSE-PTOW-004", "name": "Ultra Absorbent Paper Towels (4 Rolls)", "category_id": 4, "category": "Household Essentials", "base_price": 5.99, "base_demand": 30, "lead_time": 10},
    {"product_id": 25, "sku": "HSE-TLTP-012", "name": "Soft 3-Ply Toilet Tissue (12 Rolls)", "category_id": 4, "category": "Household Essentials", "base_price": 9.49, "base_demand": 32, "lead_time": 10},
    {"product_id": 26, "sku": "HSE-TRSH-030", "name": "Heavy Duty Drawstring Trash Bags 30L (30ct)", "category_id": 4, "category": "Household Essentials", "base_price": 4.49, "base_demand": 20, "lead_time": 10},
    {"product_id": 27, "sku": "HSE-CLNR-500", "name": "Multi-Surface Disinfectant Spray 500ml", "category_id": 4, "category": "Household Essentials", "base_price": 3.49, "base_demand": 22, "lead_time": 10},
    {"product_id": 28, "sku": "HSE-SPNG-006", "name": "Heavy Duty Scrub Sponges (6-pack)", "category_id": 4, "category": "Household Essentials", "base_price": 3.19, "base_demand": 18, "lead_time": 10},

    # Personal Care (Category 5)
    {"product_id": 29, "sku": "PER-SHMP-400", "name": "Nourishing Moisture Shampoo 400ml", "category_id": 5, "category": "Personal Care", "base_price": 6.79, "base_demand": 16, "lead_time": 8},
    {"product_id": 30, "sku": "PER-COND-400", "name": "Nourishing Moisture Conditioner 400ml", "category_id": 5, "category": "Personal Care", "base_price": 6.79, "base_demand": 14, "lead_time": 8},
    {"product_id": 31, "sku": "PER-BWSH-500", "name": "Hydrating Body Wash Gel 500ml", "category_id": 5, "category": "Personal Care", "base_price": 5.89, "base_demand": 21, "lead_time": 8},
    {"product_id": 32, "sku": "PER-SOAP-004", "name": "Gentle Cleansing Soap Bars (4-pack)", "category_id": 5, "category": "Personal Care", "base_price": 3.99, "base_demand": 27, "lead_time": 8},
    {"product_id": 33, "sku": "PER-TPST-100", "name": "Fluoride Total Protection Toothpaste 100ml", "category_id": 5, "category": "Personal Care", "base_price": 2.69, "base_demand": 35, "lead_time": 8},
    {"product_id": 34, "sku": "PER-TBRS-002", "name": "Medium Bristle Toothbrush Duo (2-pack)", "category_id": 5, "category": "Personal Care", "base_price": 3.19, "base_demand": 19, "lead_time": 8},
    {"product_id": 35, "sku": "PER-HDLT-250", "name": "Soothing Aloe Vera Hand Lotion 250ml", "category_id": 5, "category": "Personal Care", "base_price": 4.99, "base_demand": 13, "lead_time": 8},
]


def generate_synthetic_demand(
    start_date: str = "2025-01-01",
    end_date: str = "2026-06-30",
    seed: int = 42,
    products: list = None
) -> pd.DataFrame:
    """
    Generates deterministic daily product demand for ~18 months.
    
    Parameters:
    - start_date: ISO format 'YYYY-MM-DD'
    - end_date: ISO format 'YYYY-MM-DD'
    - seed: Integer random seed for 100% reproducible data
    - products: Optional list of product dicts; defaults to CORE_PRODUCTS
    """
    rng = np.random.default_rng(seed)
    
    if products is None:
        products = CORE_PRODUCTS
        
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(date_range)
    
    rows = []
    
    # Day of week multiplier (Mon=0, Tue=1, ..., Sun=6)
    # Retail lift on Friday, Saturday, Sunday
    dow_multipliers = {
        0: 0.90,  # Monday
        1: 0.92,  # Tuesday
        2: 0.95,  # Wednesday
        3: 1.00,  # Thursday
        4: 1.20,  # Friday
        5: 1.45,  # Saturday
        6: 1.30   # Sunday
    }
    
    # Category seasonal month multipliers (1..12)
    # E.g. Beverages peak in summer (May-August); Packaged Foods peak in winter
    category_seasonality = {
        1: {1: 0.85, 2: 0.88, 3: 0.95, 4: 1.05, 5: 1.20, 6: 1.35, 7: 1.40, 8: 1.35, 9: 1.15, 10: 1.00, 11: 0.90, 12: 1.10}, # Beverages
        2: {1: 1.15, 2: 1.10, 3: 1.00, 4: 0.95, 5: 0.90, 6: 0.85, 7: 0.85, 8: 0.90, 9: 1.00, 10: 1.10, 11: 1.20, 12: 1.30}, # Packaged Foods
        3: {1: 1.00, 2: 1.00, 3: 1.02, 4: 1.03, 5: 1.05, 6: 1.05, 7: 1.05, 8: 1.04, 9: 1.02, 10: 1.00, 11: 1.01, 12: 1.10}, # Dairy & Chilled
        4: {1: 1.05, 2: 1.00, 3: 1.10, 4: 1.05, 5: 1.00, 6: 0.95, 7: 0.95, 8: 1.00, 9: 1.10, 10: 1.05, 11: 1.05, 12: 1.15}, # Household
        5: {1: 1.00, 2: 1.02, 3: 1.00, 4: 1.00, 5: 1.05, 6: 1.05, 7: 1.05, 8: 1.02, 9: 1.00, 10: 1.00, 11: 1.05, 12: 1.15}, # Personal Care
    }
    
    for prod in products:
        prod_id = prod["product_id"]
        sku = prod["sku"]
        cat_id = prod["category_id"]
        cat_name = prod["category"]
        base_demand = prod["base_demand"]
        base_price = prod["base_price"]
        
        # Product-specific trend: gradual +2% to +5% annual growth
        trend_annual = rng.uniform(0.02, 0.06)
        
        # Pre-generate promotional events for this product (approx 6% of days)
        # Promos run for 2-4 consecutive days
        promo_days = np.zeros(num_days, dtype=bool)
        promo_prob = 0.02
        idx = 0
        while idx < num_days - 5:
            if rng.random() < promo_prob:
                duration = rng.integers(2, 5)
                promo_days[idx:min(idx + duration, num_days)] = True
                idx += duration + 10 # Buffer between promos
            else:
                idx += 1
                
        # Pre-generate stockout incidents (approx 2.5% of days)
        # Stockouts run 1-3 days when an item goes out of stock
        stockout_days = np.zeros(num_days, dtype=bool)
        stockout_prob = 0.008
        idx = 20 # Give initial weeks without stockouts
        while idx < num_days - 3:
            if rng.random() < stockout_prob:
                duration = rng.integers(1, 4)
                stockout_days[idx:min(idx + duration, num_days)] = True
                idx += duration + 15
            else:
                idx += 1

        for day_idx, dt in enumerate(date_range):
            bdate_str = dt.strftime("%Y-%m-%d")
            dow = dt.day_of_week
            month = dt.month
            
            # Trend factor (relative to start)
            trend_factor = 1.0 + trend_annual * (day_idx / 365.25)
            
            # Seasonality & Day of week
            dow_factor = dow_multipliers.get(dow, 1.0)
            month_factor = category_seasonality.get(cat_id, {}).get(month, 1.0)
            
            # Promotion
            is_promo = bool(promo_days[day_idx])
            if is_promo:
                # 15% discount on average
                discount = round(rng.uniform(0.12, 0.22), 2)
                selling_price = round(base_price * (1.0 - discount), 2)
                promo_multiplier = rng.uniform(1.40, 1.75)
            else:
                # Small price variations (+- 2% test fluctuations occasionally)
                price_jitter = rng.choice([0.0, 0.0, 0.0, 0.02, -0.02])
                selling_price = round(base_price * (1.0 + price_jitter), 2)
                promo_multiplier = 1.0
                
            # Expected Poisson/Gaussian demand lambda
            expected_demand = base_demand * trend_factor * dow_factor * month_factor * promo_multiplier
            
            # Stockout censoring
            is_stockout = bool(stockout_days[day_idx])
            if is_stockout:
                # Stock is depleted mid-day or completely unavailable
                units_sold = int(rng.choice([0, 0, 1, 2]))
            else:
                # Realized demand with Poisson variance + normal jitter
                noise = rng.normal(0, np.sqrt(max(1.0, expected_demand * 0.35)))
                units_sold = int(max(0, round(expected_demand + noise)))
                
            rows.append({
                "product_id": prod_id,
                "sku": sku,
                "category_id": cat_id,
                "category_name": cat_name,
                "business_date": bdate_str,
                "units_sold": units_sold,
                "selling_price": selling_price,
                "is_promotional_day": int(is_promo),
                "is_stockout_day": int(is_stockout),
                "data_source": "SYNTHETIC_SIMULATION"
            })
            
    df = pd.DataFrame(rows)
    # Sort strictly by product_id and business_date
    df = df.sort_values(by=["product_id", "business_date"]).reset_index(drop=True)
    return df


def save_dataset(df: pd.DataFrame, output_path: str):
    """Saves generated dataset to CSV."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"[Dataset Generator] Successfully generated {len(df):,} records saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="StockPilot Synthetic Daily Demand Generator")
    parser.add_argument("--start", default="2025-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", default="2026-06-30", help="End date (YYYY-MM-DD)")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed")
    parser.add_argument("--output", default="ml/data/daily_demand_synthetic.csv", help="Output CSV path")
    args = parser.parse_args()

    print(f"Generating synthetic demand from {args.start} to {args.end} with seed {args.seed}...")
    df = generate_synthetic_demand(start_date=args.start, end_date=args.end, seed=args.seed)
    save_dataset(df, args.output)

    # Summary statistics
    print("--- Dataset Summary ---")
    print(f"Total Rows: {len(df):,}")
    print(f"SKUs Count: {df['product_id'].nunique()}")
    print(f"Date Range: {df['business_date'].min()} to {df['business_date'].max()} ({df['business_date'].nunique()} days)")
    print(f"Total Units Sold: {df['units_sold'].sum():,}")
    print(f"Promo Days: {df['is_promotional_day'].sum():,} ({df['is_promotional_day'].mean()*100:.2f}%)")
    print(f"Stockout Days: {df['is_stockout_day'].sum():,} ({df['is_stockout_day'].mean()*100:.2f}%)")


if __name__ == "__main__":
    main()
