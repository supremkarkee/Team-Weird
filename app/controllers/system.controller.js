"use strict";

const db = require("../../config/database");
const auditRepository = require("../repositories/audit.repository");
const userRepository = require("../repositories/user.repository");

/**
 * System Health Check & Operational Metrics
 */
async function healthCheck(req, res) {
  const dbConnected = await db.testConnection();

  const healthData = {
    status: dbConnected ? "UP" : "DEGRADED",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: dbConnected ? "CONNECTED" : "DISCONNECTED",
      securityHeaders: "ENFORCED",
      rateLimiting: "ACTIVE"
    }
  };

  const statusCode = dbConnected ? 200 : 503;
  res.status(statusCode).json(healthData);
}

/**
 * Secure Echo Handler (Context-Aware Output Encoding)
 * Remediates Reflected Cross-Site Scripting (XSS) from original scaffolding.
 */
function safeEcho(req, res) {
  // Input validated by schema middleware before reaching here
  const rawName = req.params.name;

  // Escape HTML special characters to eliminate XSS
  const sanitized = String(rawName)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  res.status(200).json({
    message: `Hello, ${sanitized}!`,
    sanitized: true,
    inputLength: rawName.length
  });
}

/**
 * Admin Security Audit Logs Viewer (Requires RBAC: ADMIN)
 */
async function getAuditLogs(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const logs = await auditRepository.listAuditLogs(limit, offset);
    res.status(200).json({
      count: logs.length,
      limit,
      offset,
      logs
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin User List Viewer (Requires RBAC: ADMIN)
 */
async function getUsersList(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const users = await userRepository.listUsers(limit, offset);
    res.status(200).json({
      count: users.length,
      limit,
      offset,
      users
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  healthCheck,
  safeEcho,
  getAuditLogs,
  getUsersList
};
