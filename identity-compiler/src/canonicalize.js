// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : CANONICALIZE
// # Environment   : Development
// # Version       : 4.0.0
// # Updated       : 2026-05-10
// #           
// ############################################################

export function canonicalize(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isInteger(value)) throw new Error('CANONICALIZE_FLOAT_NOT_ALLOWED');
    if (!Number.isFinite(value)) throw new Error('CANONICALIZE_NONFINITE_NUMBER');
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  throw new Error(`CANONICALIZE_UNSUPPORTED_TYPE:${t}`);
}
// ############################################################
// # End of File: canonicalize.js
// # Do not modify without code review
// ############################################################

