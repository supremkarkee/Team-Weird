// The one PostgreSQL pool for the app, and the transaction wrapper that
// services use. Repositories take an optional `db` (the pool or a client).
import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

/** @type {import('pg').Pool} */
export const pool = new Pool({ connectionString: config.databaseUrl });

// An idle client can fail (for example, the database restarts).
// Without a listener, Node would crash the whole app.
pool.on('error', (err) => {
  console.error('pg pool error', err.message);
});

/**
 * Run one parameterised query through the pool.
 * @param {string} text
 * @param {unknown[]} [values]
 * @returns {Promise<import('pg').QueryResult>}
 */
export function query(text, values = []) {
  return pool.query(text, values);
}

/**
 * Run `fn` inside one transaction. COMMIT if it resolves, ROLLBACK if it throws.
 * Never call the payment gateway inside `fn` (BR-18).
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Keep the original error. Don't return this connection to the pool.
      broken = true;
    }
    throw err;
  } finally {
    client.release(broken); // true destroys the client
  }
}

/** Close the pool. Used by tests and on shutdown. */
export function closePool() {
  return pool.end();
}