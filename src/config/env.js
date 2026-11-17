const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev_stockpilot_super_secret_jwt_key_32_chars_min',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  
  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME || 'StockPilotDB',
    user: process.env.DB_USER || 'stockpilot_app',
    password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true' || false,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true,
      connectTimeout: 15000,
      requestTimeout: 15000
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: 30000
    }
  },

  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000'
};

module.exports = config;
