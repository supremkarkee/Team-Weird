"use strict";

const db = require("../../config/database");
const logger = require("../../config/logger");

/**
 * Audit Log Data Access Layer
 * Persists security events for accountability and incident response (Repudiation defense).
 */

async function recordEvent({ eventType, actorId = null, ipAddress = "0.0.0.0", details = {}, status = "SUCCESS" }) {
  try {
    const sql = `
      INSERT INTO audit_logs (event_type, actor_id, ip_address, details, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    const detailsJson = JSON.stringify(details);
    await db.query(sql, [eventType, actorId, ipAddress, detailsJson, status]);
  } catch (err) {
    // If DB fails to record audit log, ensure internal system logger logs it
    logger.error("Failed to write audit event to database", {
      eventType,
      actorId,
      error: err.message
    });
  }
}

async function listAuditLogs(limit = 100, offset = 0) {
  const sql = `
    SELECT id, event_type, actor_id, ip_address, details, status, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;
  return await db.query(sql, [Number(limit), Number(offset)]);
}

module.exports = {
  recordEvent,
  listAuditLogs
};
