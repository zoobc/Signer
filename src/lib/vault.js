// Encrypted vault (spec §9.1): PBKDF2-SHA256 600 000 → AES-GCM 256, fresh IV per write.
import { randomBytes, toBase64, fromBase64, utf8 } from './bytes.js';

const subtle = globalThis.crypto.subtle;
export const PBKDF2_ITERATIONS = 600000;

export async function deriveVaultKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle.importKey('raw', utf8(password.normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
  return new Uint8Array(bits);
}
export async function importAesKey(raw) { return subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }

export async function encryptVault(keyRaw, data, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await importAesKey(keyRaw);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(JSON.stringify(data))));
  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct), iterations };
}
export async function decryptVault(keyRaw, blob) {
  const key = await importAesKey(keyRaw);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(blob.iv) }, key, fromBase64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

export function emptyVault() {
  return { seeds: [], keys: [], accounts: [], multisigs: [], sites: {}, log: [], settings: { autoLockMinutes: 15, network: 'testnet', nodes: {}, blindDigest: false, sessionKeys: false, language: 'en', trustPageGenesis: false } };
}

/** Create a new vault. Returns { blob, keyRaw }. */
export async function createVault(password, data = emptyVault()) {
  const salt = randomBytes(16);
  const keyRaw = await deriveVaultKey(password, salt);
  const blob = await encryptVault(keyRaw, data, salt);
  return { blob, keyRaw };
}
/** Unlock: returns { keyRaw, data } or throws. */
export async function unlockVault(password, blob) {
  const salt = fromBase64(blob.salt);
  const keyRaw = await deriveVaultKey(password, salt, blob.iterations || PBKDF2_ITERATIONS);
  const data = await decryptVault(keyRaw, blob);
  return { keyRaw, data, salt };
}

export function passwordStrength(pw) {
  const s = String(pw || '');
  let score = 0;
  if (s.length >= 10) score++; if (s.length >= 14) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s)) score++; if (/[^\w]/.test(s)) score++;
  if (/^(.)\1+$/.test(s) || /^(1234|abcd|qwer|pass)/i.test(s)) score = Math.min(score, 1);
  return Math.min(4, score);
}
