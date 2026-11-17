const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { requestLogger } = require('./middleware/logger');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// 1. Security & Core Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows inline scripts for simple UI demos if needed
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);

// 2. OpenAPI / Swagger Documentation
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (err) {
  console.warn('[Swagger]: OpenAPI specification not loaded:', err.message);
}

// 3. API Routes
app.use('/api', routes);

// 4. Fallback 404 handler
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found on this server.`, 404, 'NOT_FOUND'));
});

// 5. Centralized Error Handler
app.use(errorHandler);

module.exports = app;
