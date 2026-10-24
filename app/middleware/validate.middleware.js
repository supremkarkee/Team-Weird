"use strict";

const logger = require("../../config/logger");

/**
 * Zod Schema Request Validation Middleware
 * Enforces strict input validation to prevent injection, type juggling, and parameter tampering.
 * 
 * @param {import("zod").ZodSchema} schema - Zod validation schema
 * @param {'body'|'query'|'params'} target - Request property to validate (default: 'body')
 */
function validate(schema, target = "body") {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[target]);
      req[target] = parsed; // Replace with sanitized/coerced values
      next();
    } catch (err) {
      if (err.errors) {
        const issues = err.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }));

        logger.warn("Request input validation failed", {
          target,
          issues,
          ip: req.ip,
          path: req.originalUrl
        });

        return res.status(400).json({
          error: "Validation failed. Please correct the highlighted errors.",
          details: issues
        });
      }

      logger.error("Unexpected validation exception", { error: err.message });
      return res.status(400).json({ error: "Invalid request payload format." });
    }
  };
}

module.exports = {
  validate
};
