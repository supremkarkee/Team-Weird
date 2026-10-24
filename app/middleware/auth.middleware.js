"use strict";

const jwt = require("jsonwebtoken");
const logger = require("../../config/logger");

const JWT_SECRET = process.env.JWT_SECRET || "default_insecure_secret_cmp_x306";

/**
 * Authentication Middleware
 * Enforces valid JWT token from either HttpOnly cookie or Authorization Bearer header.
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Primary: HttpOnly Cookie
  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  }
  // 2. Secondary: Authorization Bearer Header (for API clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    logger.security("Unauthenticated access attempt to protected route", {
      ip: req.ip,
      method: req.method,
      path: req.originalUrl
    });
    return res.status(401).json({
      error: "Authentication required. Please log in to access this resource."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = decoded; // Contains id, username, role, email
    next();
  } catch (err) {
    logger.security("Invalid or expired authentication token presented", {
      ip: req.ip,
      path: req.originalUrl,
      reason: err.message
    });

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session has expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid authentication credentials." });
  }
}

/**
 * Optional Authentication: Attaches req.user if a valid token exists, but does not block if unauthenticated.
 */
function optionalAuth(req, res, next) {
  let token = null;
  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      // Ignore invalid token on public routes
      req.user = null;
    }
  }
  next();
}

module.exports = {
  authenticateToken,
  optionalAuth
};
