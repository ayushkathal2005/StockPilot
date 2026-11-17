"""
Tests for FastAPI Demand Forecasting Microservice.
Verifies health probe, model info, horizon validation (7..30), recursive predictions, and retrieval endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from ml.service.app import app, forecast_engine


@pytest.fixture
def client():
    return TestClient(app)


def test_get_health(client):
    """Verifies GET /health reports service status and model readiness."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "stockpilot-ml-service"
    assert data["model_loaded"] is True
    assert data["model_version"] == "v1.0.0"
    assert "timestamp" in data


def test_get_model_info(client):
    """Verifies GET /model/info returns model architecture and evaluation metrics."""
    res = client.get("/model/info")
    assert res.status_code == 200
    data = res.json()
    assert data["model_version"] == "v1.0.0"
    assert "XGBRegressor" in data["model_type"]
    assert len(data["feature_list"]) == 18
    assert "model_comparison" in data
    assert "xgboost" in data["model_comparison"]
    assert data["model_comparison"]["xgboost"]["wape"] < 0.10


def test_forecast_run_valid_horizon(client):
    """Verifies POST /forecast/run executes multi-day recursive forecast."""
    payload = {
        "horizon_days": 14,
        "product_ids": [1, 2, 3]
    }
    res = client.post("/forecast/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["horizon_days"] == 14
    assert data["products_count"] == 3
    assert data["run_id"] is not None
    assert len(data["forecasts"]) == 3
    
    # Check first product
    p1 = data["forecasts"][0]
    assert p1["product_id"] == 1
    assert p1["forecast_source"] in ["xgboost", "moving_average_fallback"]
    assert p1["lead_time_demand"] > 0
    assert p1["total_horizon_demand"] >= p1["lead_time_demand"]
    assert len(p1["daily_predictions"]) == 14
    for daily in p1["daily_predictions"]:
        assert daily["predicted_units"] >= 0.0


def test_forecast_run_horizon_boundary_validation(client):
    """Verifies boundary validation: horizon < 7 or > 30 is rejected with 422."""
    # Under boundary
    res_under = client.post("/forecast/run", json={"horizon_days": 6})
    assert res_under.status_code == 422

    # Over boundary
    res_over = client.post("/forecast/run", json={"horizon_days": 31})
    assert res_over.status_code == 422

    # Lower boundary (7 days) should succeed
    res_7 = client.post("/forecast/run", json={"horizon_days": 7, "product_ids": [1]})
    assert res_7.status_code == 200
    assert res_7.json()["horizon_days"] == 7

    # Upper boundary (30 days) should succeed
    res_30 = client.post("/forecast/run", json={"horizon_days": 30, "product_ids": [1]})
    assert res_30.status_code == 200
    assert res_30.json()["horizon_days"] == 30


def test_get_forecast_run_and_product(client):
    """Verifies retrieving previously run forecast and querying specific product."""
    create_res = client.post("/forecast/run", json={"horizon_days": 10, "product_ids": [5]})
    assert create_res.status_code == 200
    run_id = create_res.json()["run_id"]

    # Retrieve whole run
    run_res = client.get(f"/forecast/runs/{run_id}")
    assert run_res.status_code == 200
    assert run_res.json()["run_id"] == run_id

    # Retrieve product 5 within run
    prod_res = client.get(f"/forecast/runs/{run_id}/products/5")
    assert prod_res.status_code == 200
    assert prod_res.json()["product_id"] == 5
    assert len(prod_res.json()["daily_predictions"]) == 10

    # Non-existent run
    not_found = client.get("/forecast/runs/999999")
    assert not_found.status_code == 404
