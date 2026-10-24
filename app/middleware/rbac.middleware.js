"use strict";

const logger = require("../../config/logger");

/**
 * Role-Based Access Control (RBAC) Middleware Guard
 * @param {Array<string>} allowedRoles - List of roles permitted to access the route
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      logger.security("RBAC check failed: No authenticated user context", {
        ip: req.ip,
        path: req.originalUrl
      });
      return res.status(401).json({ error: "Authentication required." });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      logger.security("Authorization failure (Access Denied)", {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: allowedRoles,
        ip: req.ip,
        path: req.originalUrl
      });
      return res.status(403).json({
        error: "Access denied. You do not possess the required permissions for this action."
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
