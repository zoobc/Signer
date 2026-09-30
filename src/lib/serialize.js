// JSON-safe copies of view models (BigInt → string, Uint8Array → hex) for chrome.storage.session and messaging.
import { bytesToHex } from './bytes.js';
export function jsonSafe(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return bytesToHex(v);
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { if (typeof v[k] === 'function') continue; o[k] = jsonSafe(v[k]); } return o; }
  return v;
}
