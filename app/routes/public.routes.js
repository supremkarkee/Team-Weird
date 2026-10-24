"use strict";

const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller");

/**
 * @route   GET /health
 * @desc    System and database health check
 * @access  Public
 */
router.get("/health", systemController.healthCheck);

/**
 * @route   GET /
 * @desc    Application entrypoint & landing verification
 * @access  Public
 */
router.get("/", (req, res) => {
  res.status(200).json({
    project: "CMP-X306 Secure Software Development Baseline",
    team: "Team Weird",
    status: "Operational",
    endpoints: {
      health: "/health",
      auth: "/api/auth/*",
      api: "/api/*",
      documentation: "See /config/security.js and architecture documents"
    }
  });
});

module.exports = router;
