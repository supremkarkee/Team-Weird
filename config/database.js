"use strict";

require("dotenv").config();
const mysql = require("mysql2/promise");
const logger = require("./logger");

/**
 * Least-Privilege Database Connection Pool
 * Uses prepared statements (pool.execute) to guarantee defense against SQL Injection.
 */

const poolConfig = {
  host: process.env.DB_HOST || process.env.DB_CONTAINER || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "app_user",
  password: process.env.DB_PASSWORD || "SecureAppPassword123!",
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "sd2-db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = mysql.createPool(poolConfig);

/**
 * Executes a parameterized SQL query using prepared statements.
 * @param {string} sql - SQL query with '?' placeholders
 * @param {Array} params - Bound parameter values
 * @returns {Promise<Array>} - Query result rows
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    logger.error("Database query failed", {
      code: err.code,
      sqlState: err.sqlState,
      message: err.message
    });
    throw err;
  }
}

/**
 * Health check verification for the database connection.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info("Database connection successfully established to pool", {
      host: poolConfig.host,
      database: poolConfig.database
    });
    connection.release();
    return true;
  } catch (err) {
    logger.error("Failed to connect to database pool", {
      host: poolConfig.host,
      database: poolConfig.database,
      error: err.message
    });
    return false;
  }
}

module.exports = {
  query,
  pool,
  testConnection
};
