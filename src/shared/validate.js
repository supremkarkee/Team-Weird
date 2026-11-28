import { z } from 'zod';
import { ValidationError } from "./errors";

/** marks a zod schema as optional for an empty HTML form string 
 * @param {z.ZodType} schema
 * @returns {z.ZodType<unknown, unknown>}
*/
export function optional(schema) {
    return z.preprocess(
        (value) => (typeof value == 'string' && value.trim() === '' ? undefined : value),
        z.union([schema, z.undefined()]),
    );
}

/** Validates user input and returns only zod-cleaned data 
 * @param {z.ZodType} schema
 * @param {unknown} data
 * @returns {unknown}
*/
export function validate(schema, data) {
    const result = schema.safeParse(data);

    if (!result.success) {
        /** @type {Record<string, string>} */
        const fields = {};

        for (const issue of result.error.issues) {
            const key = issue.path.length > 0 ? issue.path.join('.') : "_form";
            fields[key] ??= issue.message;
        }

        throw new ValidationError(fields);
    }

    return result.data;
}