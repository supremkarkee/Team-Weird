// Provides the one application PostgreSQL pool and the transaction wrapper used by repositories and services

import pg from 'pg'
import { Pool } from pg
import { config } from '../config/index.js'

/** @type {Pool} */
export const pool = new Pool({
    connectionString: config.databaseUrl,
}) // exporting once so that all repos and services share just one connection pool

/**
 * Run one parameterized PostgreSQL query through the application pool
 * @param {string} text
 * @param {unknown[]} [value]
 * @returns {Promise<ImportAttributes('pg').QuertResult>}
 */
export function query(text, values = []){
    return pool.query(text, values);
}

/**
 * Run an async callback inside one PostgreSQL transaction
 * @template T
 * @param {(client:import('pg').PoolClient) => Promise<T>} fn 
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
    const client = await pool.connect();

    try {
        // checks out just one client then starts BEGIN
        await client.query('BEGIN');

        const result = await fn(client); // runs the callback 
        
        // ONLY runs commit after the callback succeeds
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK'); // rollback for egvery caught error
        throw error;
    } finally {
        client.release(); // release the client 
    }
} 