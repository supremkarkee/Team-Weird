

/** An input-validation failure with field-keyed, user-safe messages */
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

/** The caller is authenticated but is not allowed to perform the request */
export class ForbiddenError extends Error {
    /** @param {string} [message] */
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
        this.status = 403;
    }
}

/** The requested record does not exist */
export class NotFoundError extends Error {
    /** @param {string} [message] */
    constructor(message = 'Not found') {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

/** The requested state change conflicts with the current state or business rule */
export class ConflictError extends Error {
    /** @param {string} [message] */
    constructor(message = 'Conflict') {
        super(message);
        this.name = 'ConflictError';
        this.status = 409;
    }
}

/** Checks whether an error is a PostgreSQL unique constraint violation 
 * @param {unknown} error
 * @param {string} [constraintName]
 * @return {boolean}
*/
export function isUniqueViolation(error, constraintName) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const pgError = /** @type {{code?: unknown, constraint?: unknown}} */ (error);

    if (pgError.code !== "23505") {
        return false;
    }

    return constraintName === undefined || pgError.constraint === constraintName;
}
