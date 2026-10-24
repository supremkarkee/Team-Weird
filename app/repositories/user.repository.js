"use strict";

const db = require("../../config/database");

/**
 * User Data Access Object (DAO)
 * Strictly utilizes prepared statements to guarantee prevention of SQL Injection (CWE-89).
 */

async function findByUsername(username) {
  const sql = "SELECT id, username, email, password_hash, role, created_at FROM users WHERE username = ? LIMIT 1";
  const rows = await db.query(sql, [username]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const sql = "SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1";
  const rows = await db.query(sql, [email]);
  return rows[0] || null;
}

async function findById(id) {
  const sql = "SELECT id, username, email, role, created_at FROM users WHERE id = ? LIMIT 1";
  const rows = await db.query(sql, [id]);
  return rows[0] || null;
}

async function create({ username, email, passwordHash, role = "USER" }) {
  const sql = "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)";
  const result = await db.query(sql, [username, email, passwordHash, role]);
  return {
    id: result.insertId,
    username,
    email,
    role
  };
}

async function listUsers(limit = 50, offset = 0) {
  const sql = "SELECT id, username, email, role, created_at FROM users ORDER BY id ASC LIMIT ? OFFSET ?";
  return await db.query(sql, [Number(limit), Number(offset)]);
}

module.exports = {
  findByUsername,
  findByEmail,
  findById,
  create,
  listUsers
};
