"use strict";

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const logger = require("./logger");

/**
 * Helmet HTTP Security Headers Suite
 * Fulfills CMP-X306 requirement: HTTP Security Headers Check
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: "deny" // Defeats Clickjacking
  },
  noSniff: true, // Defeats MIME-confusion attacks
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  }
});

/**
 * Anti-Brute-Force Rate Limiter for Authentication Endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/auth requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security("Rate limit exceeded on authentication endpoint", {
      ip: req.ip,
      path: req.originalUrl
    });
    res.status(429).json({
      error: "Too many authentication attempts. Please try again after 15 minutes."
    });
  }
});

/**
 * General API Traffic Throttling
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("General API rate limit exceeded", {
      ip: req.ip,
      path: req.originalUrl
    });
    res.status(429).json({
      error: "Request limit exceeded. Please throttle your requests."
    });
  }
});

/**
 * Controlled Cross-Origin Resource Sharing (CORS)
 */
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400 // Cache preflight response for 24 hours
};

/**
 * Secure Cookie Options
 */
const cookieConfig = {
  httpOnly: true, // Inaccessible to JavaScript document.cookie (defeats XSS cookie theft)
  secure: process.env.NODE_ENV === "production", // Enforces transmission only over HTTPS
  sameSite: "strict", // Defeats CSRF attacks
  maxAge: 8 * 60 * 60 * 1000 // 8 hours absolute expiration
};

module.exports = {
  helmetConfig,
  authLimiter,
  apiLimiter,
  corsConfig: cors(corsOptions),
  cookieConfig
};
