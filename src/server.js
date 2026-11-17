const app = require('./app');
const config = require('./config/env');
const { connectDB, closeDB } = require('./config/database');

let server = null;

async function startServer() {
  try {
    console.log('[StockPilot]: Initializing database connection pool...');
    await connectDB();
    console.log(`[StockPilot]: Connected to Microsoft SQL Server [${config.db.database}] at ${config.db.server}:${config.db.port}`);

    server = app.listen(config.port, () => {
      console.log(`[StockPilot]: Server listening on http://localhost:${config.port}`);
      console.log(`[StockPilot]: API Documentation available at http://localhost:${config.port}/api/docs`);
      console.log(`[StockPilot]: Health check endpoint at http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('[StockPilot Server Fatal Startup Error]:', err.message);
    process.exit(1);
  }
}

// Graceful Shutdown Handlers
async function handleShutdown(signal) {
  console.log(`\n[StockPilot]: Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log('[StockPilot]: HTTP server closed.');
    });
  }

  await closeDB();
  console.log('[StockPilot]: Database connection pool closed.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
