"use strict";

const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller");
const { authenticateToken } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const { echoParamSchema } = require("../schemas/auth.schema");
const { apiLimiter } = require("../../config/security");

// Apply general API rate limiting
router.use(apiLimiter);

/**
 * @route   GET /api/public/info
 * @desc    Public system information (Domain-agnostic)
 * @access  Public
 */
router.get("/public/info", (req, res) => {
  res.status(200).json({
    status: "active",
    message: "CMP-X306 Secure Software Development API Gateway",
    version: "1.0.0",
    securityControls: [
      "Strict Content-Security-Policy",
      "Helmet HTTP Headers",
      "Anti-Brute Force Rate Limiting",
      "Parameterized SQL Prepared Statements",
      "HttpOnly Strict SameSite Cookies",
      "Role-Based Access Control"
    ]
  });
});

/**
 * @route   GET /api/echo/:name
 * @desc    Validated & context-escaped echo endpoint (replaces vulnerable scaffold route)
 * @access  Public
 */
router.get("/echo/:name", validate(echoParamSchema, "params"), systemController.safeEcho);

/**
 * @route   GET /api/user/data
 * @desc    Protected resource accessible only by authenticated users (USER or ADMIN)
 * @access  Private (USER, ADMIN)
 */
router.get("/user/data", authenticateToken, (req, res) => {
  res.status(200).json({
    message: "Welcome to your protected user dashboard.",
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/admin/users
 * @desc    Restricted resource accessible ONLY by administrators
 * @access  Private (ADMIN Only)
 */
router.get("/admin/users", authenticateToken, requireRole(["ADMIN"]), systemController.getUsersList);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Restricted security audit log viewer
 * @access  Private (ADMIN Only)
 */
router.get("/admin/audit-logs", authenticateToken, requireRole(["ADMIN"]), systemController.getAuditLogs);

module.exports = router;
