"use strict";

require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");

const { helmetConfig, corsConfig } = require("../config/security");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const logger = require("../config/logger");

// Import modular routes
const publicRoutes = require("./routes/public.routes");
const authRoutes = require("./routes/auth.routes");
const apiRoutes = require("./routes/api.routes");

const app = express();

// 1. Trust first proxy if behind Docker/Nginx reverse proxy
app.set("trust proxy", 1);

// 2. Enforce HTTP Security Headers (Helmet: CSP, HSTS, X-Frame-Options, noSniff)
app.use(helmetConfig);

// 3. Controlled Cross-Origin Resource Sharing (CORS)
app.use(corsConfig);

// 4. Request Logging (sanitized)
app.use(morgan("combined", {
  skip: (req) => req.url === "/health" // Keep health check logs quiet
}));

// 5. Enforce Payload Size Limits (Defeats Buffer Overflow & Memory Exhaustion DoS)
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// 6. Parse Cookies for HttpOnly Session Management
app.use(cookieParser());

// 7. Serve Static Files with restricted options
app.use(express.static(path.join(__dirname, "../static"), {
  dotfiles: "ignore", // Prevent access to hidden files like .env or .git
  index: false,
  maxAge: "1d"
}));

// 8. Mount Routes
app.use("/", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

// 9. 404 Handler for Unmatched Routes
app.use(notFoundHandler);

// 10. Centralized Security Error Handler (CWE-209 Info Leakage Prevention)
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || "3000", 10);

if (require.main === module || process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Secure Server actively listening on port ${PORT}`, {
      environment: process.env.NODE_ENV || "development",
      port: PORT
    });
  });
}

module.exports = app;