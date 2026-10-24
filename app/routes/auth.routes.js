"use strict";

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateToken } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { registerSchema, loginSchema } = require("../schemas/auth.schema");
const { authLimiter } = require("../../config/security");

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account with validated credentials
 * @access  Public (Rate Limited)
 */
router.post(
  "/register",
  authLimiter,
  validate(registerSchema, "body"),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and issue JWT / HttpOnly cookie
 * @access  Public (Rate Limited)
 */
router.post(
  "/login",
  authLimiter,
  validate(loginSchema, "body"),
  authController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Invalidate authentication cookie
 * @access  Authenticated
 */
router.post("/logout", authenticateToken, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve profile of the currently authenticated user
 * @access  Authenticated
 */
router.get("/me", authenticateToken, authController.getProfile);

module.exports = router;
