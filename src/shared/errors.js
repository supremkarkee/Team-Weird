// Errors that services throw. The error handler turns each into a page.
// Messages are for the server log only. They are never shown to users.

/** Input failed validation. `fields` maps field names to user-safe messages. */
export class ValidationError extends Error {
  /** @param {Record<string, string>} [fields] */
  constructor(fields = {}) {
    super('Invalid input');
    this.name = 'ValidationError';
    this.status = 400;
    /** @type {Record<string, string>} */
    this.fields = fields;
  }
}

/**
 * The caller may not do this. Pass a short reason such as 'not_owner',
 * 'wrong_role' or 'wrong_portal'. Never log the 403 yourself:
 * errorHandler.js does it for every 403.
 */
export class ForbiddenError extends Error {
  /** @param {string} [reason] */
  constructor(reason = 'forbidden') {
    super(reason);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

/** The record does not exist. */
export class NotFoundError extends Error {
  /** @param {string} [message] */
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

/** The change conflicts with the current state, e.g. a guarded transition found no row. */
export class ConflictError extends Error {
  /** @param {string} [message] */
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

/**
 * True if `error` is a PostgreSQL unique violation, optionally on one constraint.
 * @param {unknown} error
 * @param {string} [constraintName]
 * @returns {boolean}
 */
export function isUniqueViolation(error, constraintName) {
  if (!error || typeof error !== 'object') return false;
  const pgError = /** @type {{ code?: unknown, constraint?: unknown }} */ (error);
  if (pgError.code !== '23505') return false;
  return constraintName === undefined || pgError.constraint === constraintName;
}