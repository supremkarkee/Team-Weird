// Money is always integer pence. Never parseFloat(x) * 100, never toFixed on a float.

/** PostgreSQL int limit: the largest amount we can store. */
export const MAX_PENCE = 2_147_483_647;

// Optional £, then whole pounds (no leading zeros; commas only in groups of three),
// then an optional 1 or 2 digit fraction.
const POUNDS_RE = /^£?(0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;

/**
 * Convert a pounds string such as "£1,200.50" to integer pence (120050).
 * @param {string} input
 * @returns {number}
 * @throws {TypeError} not a string, or not a valid pounds value
 * @throws {RangeError} below 1p or above MAX_PENCE
 */
export function poundsToPence(input) {
  if (typeof input !== 'string') throw new TypeError('Amount must be a string');
  const match = POUNDS_RE.exec(input);
  if (!match) throw new TypeError('Amount is not a valid pounds value');

  const [, whole, fraction = ''] = match;
  const pence = BigInt(whole.replaceAll(',', '')) * 100n + BigInt(fraction.padEnd(2, '0'));

  if (pence < 1n) throw new RangeError('Amount must be at least 1p');
  if (pence > BigInt(MAX_PENCE)) throw new RangeError('Amount is too large');
  return Number(pence);
}

/**
 * Check that `value` is a valid pence amount and return it.
 * allowZero is for display and totals only: stored amounts are always > 0.
 * @param {unknown} value
 * @param {{ allowZero?: boolean }} [options]
 * @returns {number}
 */
export function assertPence(value, { allowZero = false } = {}) {
  if (
    !Number.isSafeInteger(value) ||
    /** @type {number} */ (value) > MAX_PENCE ||
    /** @type {number} */ (value) < (allowZero ? 0 : 1)
  ) {
    throw new RangeError('Invalid pence amount');
  }
  return /** @type {number} */ (value);
}

/**
 * Format pence as pounds: 120050 → "£1,200.50", 0 → "£0.00".
 * Registered as the Nunjucks filter `| pence`.
 * @param {number} value
 * @returns {string}
 */
export function formatPence(value) {
  assertPence(value, { allowZero: true });
  const pounds = Math.floor(value / 100).toLocaleString('en-GB');
  const pence = String(value % 100).padStart(2, '0');
  return `£${pounds}.${pence}`;
}