"use strict";

/**
 * Structured Security Logger
 * Prevents log injection, masks sensitive tokens, and standardizes audit trails.
 */

const fs = require("fs");
const path = require("path");

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  SECURITY: 3,
  ERROR: 4
};

const currentLevel = process.env.LOG_LEVEL || "INFO";

function sanitizeLogMessage(data) {
  if (typeof data === "string") {
    // Strip CRLF to prevent log injection / splitting
    return data.replace(/[\r\n]/g, " ");
  }
  if (typeof data === "object" && data !== null) {
    const sanitized = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      // Redact sensitive keys
      if (/password|token|secret|authorization|cookie|credit_card/i.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeLogMessage(value);
      } else if (typeof value === "string") {
        sanitized[key] = value.replace(/[\r\n]/g, " ");
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return data;
}

function log(level, message, metadata = {}) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === "string" ? message.replace(/[\r\n]/g, " ") : message,
    context: sanitizeLogMessage(metadata)
  };

  const output = JSON.stringify(logEntry);
  if (level === "ERROR" || level === "SECURITY") {
    console.error(output);
  } else {
    console.log(output);
  }
}

module.exports = {
  debug: (msg, meta) => log("DEBUG", msg, meta),
  info: (msg, meta) => log("INFO", msg, meta),
  warn: (msg, meta) => log("WARN", msg, meta),
  security: (msg, meta) => log("SECURITY", msg, meta),
  error: (msg, meta) => log("ERROR", msg, meta)
};
