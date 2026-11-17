const sql = require('mssql');
const config = require('./env');

let pool = null;

/**
 * Initializes and caches the singleton SQL Server connection pool.
 */
async function connectDB() {
  if (pool) {
    return pool;
  }

  try {
    pool = await new sql.ConnectionPool(config.db).connect();
    
    pool.on('error', (err) => {
      console.error('[SQL Server Pool Error]:', err.message);
    });

    return pool;
  } catch (err) {
    pool = null;
    console.error('[SQL Server Connection Failed]:', err.message);
    throw err;
  }
}

/**
 * Returns the active connection pool instance.
 */
function getPool() {
  if (!pool) {
    throw new Error('Database connection pool has not been initialized. Call connectDB() first.');
  }
  return pool;
}

/**
 * Closes the SQL Server connection pool.
 */
async function closeDB() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
    } catch (err) {
      console.error('[Error Closing Database Pool]:', err.message);
    }
  }
}

/**
 * Performs a health-check query on SQL Server.
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  try {
    const activePool = await connectDB();
    const result = await activePool.request().query('SELECT 1 AS is_alive, DB_NAME() AS current_database, SYSUTCDATETIME() AS server_time;');
    const latencyMs = Date.now() - startTime;

    return {
      status: 'UP',
      database: result.recordset[0].current_database,
      serverTime: result.recordset[0].server_time,
      latencyMs
    };
  } catch (err) {
    return {
      status: 'DOWN',
      error: err.message,
      latencyMs: Date.now() - startTime
    };
  }
}

module.exports = {
  sql,
  connectDB,
  getPool,
  closeDB,
  checkDatabaseHealth
};
