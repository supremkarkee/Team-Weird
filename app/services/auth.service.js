"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/user.repository");
const auditRepository = require("../repositories/audit.repository");
const logger = require("../../config/logger");

const JWT_SECRET = process.env.JWT_SECRET || "default_insecure_secret_cmp_x306";
const BCRYPT_SALT_ROUNDS = 12; // Enforces computational resistance against brute force

/**
 * Hash password with bcrypt salt rounds = 12
 */
async function hashPassword(plainText) {
  return await bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare plain text password against stored hash with constant-time comparison
 */
async function verifyPassword(plainText, hash) {
  return await bcrypt.compare(plainText, hash);
}

/**
 * Generate secure signed JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "8h",
    issuer: "cmp-x306-secure-app"
  });
}

/**
 * Register a new user
 */
async function registerUser({ username, email, password, role = "USER", ipAddress = "0.0.0.0" }) {
  // Check for duplicate username
  const existingUsername = await userRepository.findByUsername(username);
  if (existingUsername) {
    const error = new Error("Username is already taken.");
    error.status = 409;
    throw error;
  }

  // Check for duplicate email
  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) {
    const error = new Error("Email address is already registered.");
    error.status = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const newUser = await userRepository.create({
    username,
    email,
    passwordHash,
    role
  });

  await auditRepository.recordEvent({
    eventType: "USER_REGISTERED",
    actorId: newUser.id,
    ipAddress,
    details: { username: newUser.username, role: newUser.role }
  });

  logger.info("New user registered successfully", {
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role
  });

  const token = generateToken(newUser);
  return { user: newUser, token };
}

/**
 * Authenticate user credentials
 */
async function loginUser({ username, password, ipAddress = "0.0.0.0" }) {
  const user = await userRepository.findByUsername(username);

  // Use dummy verification if user not found to defeat timing attacks (user enumeration)
  if (!user) {
    // Perform dummy hash comparison to equalize response time
    await bcrypt.compare(password, "$2a$12$e80MvdH253hGqYq23y4c7e6v68xVfS6QyZ7M5W3Z.Q31k11k111k1");
    await auditRepository.recordEvent({
      eventType: "LOGIN_FAILED",
      actorId: null,
      ipAddress,
      details: { username, reason: "USER_NOT_FOUND" },
      status: "FAILURE"
    });
    const error = new Error("Invalid username or password.");
    error.status = 401;
    throw error;
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    await auditRepository.recordEvent({
      eventType: "LOGIN_FAILED",
      actorId: user.id,
      ipAddress,
      details: { username, reason: "BAD_PASSWORD" },
      status: "FAILURE"
    });
    const error = new Error("Invalid username or password.");
    error.status = 401;
    throw error;
  }

  // Login successful
  await auditRepository.recordEvent({
    eventType: "LOGIN_SUCCESS",
    actorId: user.id,
    ipAddress,
    details: { username: user.username, role: user.role }
  });

  logger.info("User logged in successfully", {
    userId: user.id,
    username: user.username,
    role: user.role
  });

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    token
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  registerUser,
  loginUser
};
