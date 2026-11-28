import { z } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Makes a field optional for HTML forms, where an empty box arrives as ''.
 * @param {z.ZodType} schema
 */
export function optional(schema) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );
}

/**
 * Validate `data` against `schema`. Returns only the parsed data, so unknown
 * fields are dropped (NFR-SEC-02). Throws ValidationError with one message per field.
 * @template {z.ZodType} S
 * @param {S} schema
 * @param {unknown} data
 * @returns {z.infer<S>}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  /** @type {Record<string, string>} */
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    fields[key] ??= issue.message;
  }
  throw new ValidationError(fields);
}