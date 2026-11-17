# StockPilot Demand Forecasting ML Service
# Production container for FastAPI, Scikit-learn, and XGBoost Regressor

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

# Install curl for healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY ml/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML service application code, pipeline, and versioned model artifacts
COPY ml/ ./ml/

# Run as non-privileged service user
RUN useradd -m -u 1000 stockpilot && chown -R stockpilot:stockpilot /app
USER stockpilot

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "ml.service.app:app", "--host", "0.0.0.0", "--port", "8000"]
