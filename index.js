"use strict";

require("dotenv").config();
const logger = require("./config/logger");
const app = require("./app/app");

logger.info("Initializing Secure Software Application Gateway (CMP-X306)...");

process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received. Initiating graceful shutdown...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received. Terminating process cleanly...");
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection detected", {
    reason: reason ? reason.message || reason : "Unknown",
    promise
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception encountered", {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

module.exports = app;