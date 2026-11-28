const POSTGRES_INT_MAX = 2_147_483_647;

/** converts an allowed pounds string to integer pence 
 * @param {string} poundsValue
 * @returns {number}
*/
export function poundsToPence(poundsValue) {
    if (typeof poundsValue !== 'string') {
        throw new TypeError("Pounds value must be a string");
    }

    const match = /^£?(?:(?:0|[1-9]\d*)|(?:[1-9]\d{0,2}(?:,\d{3})+))(?:\.(\d{1,2}))?$/.exec(poundsValue);
    
    const wholePart = poundsValue.replace(/^£/, '').split('.')[0].replaceAll(',', '');
    const fraction = match[1] ?? '';
    const pence = BigInt(wholePart) * 100n + BigInt(fraction.padEnd(2, '0'));

    if (pence <= 0n){
        throw new RangeError('Pence must be greater than zero');
    }

    if (pence > BigInt(POSTGRES_INT_MAX)) {
        throw new RangeError('Pence exceeds the PostgreSQL int limit');
    }

    return Number(pence);
}
