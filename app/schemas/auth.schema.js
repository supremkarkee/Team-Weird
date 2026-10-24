"use strict";

const { z } = require("zod");

/**
 * Password Policy:
 * - Minimum 8 characters, maximum 100 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one numeric digit
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long.")
    .max(30, "Username must not exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens."),
  email: z
    .string()
    .trim()
    .email("Invalid email address format.")
    .max(255, "Email address is too long."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(100, "Password must not exceed 100 characters.")
    .regex(passwordRegex, "Password must contain at least one uppercase letter, one lowercase letter, and one number."),
  role: z.enum(["USER", "ADMIN"]).optional()
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required.")
});

const echoParamSchema = z.object({
  name: z.string().trim().min(1, "Name parameter cannot be empty.").max(50, "Name parameter cannot exceed 50 characters.")
});

module.exports = {
  registerSchema,
  loginSchema,
  echoParamSchema
};
