"use strict";

const logger = require("../../config/logger");

/**
 * Centralized Security Error Handler
 * Defeats Information Disclosure (CWE-209) by preventing stack trace leakage to clients.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Capture full diagnostic context internally
  logger.error("Unhandled Application Exception", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : "ANONYMOUS"
  });

  const statusCode = err.status || err.statusCode || 500;

  // Safe client response (no internal paths or stack traces)
  res.status(statusCode).json({
    error: statusCode === 500
      ? "An internal server error occurred. Please contact the administrator."
      : err.message || "Request could not be processed."
  });
}

/**
 * 404 Not Found Catch-All Handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
