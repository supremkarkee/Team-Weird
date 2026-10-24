"use strict";

const authService = require("../services/auth.service");
const { cookieConfig } = require("../../config/security");
const logger = require("../../config/logger");

async function register(req, res, next) {
  try {
    const { username, email, password, role } = req.body;
    const { user, token } = await authService.registerUser({
      username,
      email,
      password,
      role: role || "USER",
      ipAddress: req.ip
    });

    // Set secure HttpOnly cookie
    res.cookie("authToken", token, cookieConfig);

    res.status(201).json({
      message: "User registered successfully.",
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const { user, token } = await authService.loginUser({
      username,
      password,
      ipAddress: req.ip
    });

    // Set secure HttpOnly cookie
    res.cookie("authToken", token, cookieConfig);

    res.status(200).json({
      message: "Authentication successful.",
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  // Clear the authentication cookie
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  logger.info("User logged out", {
    userId: req.user ? req.user.id : "ANONYMOUS",
    ip: req.ip
  });

  res.status(200).json({
    message: "Logged out successfully. Authentication session terminated."
  });
}

function getProfile(req, res) {
  res.status(200).json({
    user: req.user
  });
}

module.exports = {
  register,
  login,
  logout,
  getProfile
};
