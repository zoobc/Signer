// Typed accounts (spec §3.2), ZBC_ text form (§3.3) and every foreign address encoding.
import { sha3_256, keccak_256 } from '@noble/hashes/sha3';
import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import { base32nopad, base58, base58xrp, bech32, bech32m } from '@scure/base';
import { hexToBytes, bytesToHex, concat, utf8, u32le, readU32le, equalBytes, DecodeError, compareBytes } from './bytes.js';

/** Account types: payload length, display name, wallet format and whether ZBC can be sent there. */
export const ACCOUNT_TYPES = {
  0:  { name: 'ZooBC',            len: 32, format: 'ZBC', holdsZbc: true },
  1:  { name: 'Bitcoin (legacy)', len: 20, format: null,  holdsZbc: true },
  2:  { name: 'Empty',            len: 0,  format: null,  holdsZbc: false },
  3:  { name: 'Estonian eID',     len: 32, format: null,  holdsZbc: false },
  4:  { name: 'Ethereum',         len: 20, format: 'ETH', holdsZbc: true },
  5:  { name: 'Bitcoin P2PKH',    len: 20, format: 'BTC', btc: 'legacy', holdsZbc: true },
  6:  { name: 'Bitcoin P2SH',     len: 20, format: null,  holdsZbc: false },
  7:  { name: 'Bitcoin P2WPKH',   len: 20, format: 'BTC', btc: 'segwit', holdsZbc: true },
  8:  { name: 'Bitcoin P2WSH',    len: 32, format: null,  holdsZbc: false },
  9:  { name: 'Bitcoin Taproot',  len: 32, format: 'BTC', btc: 'taproot', holdsZbc: true },
  10: { name: 'DataSet object',   len: 32, format: null,  holdsZbc: true },
  11: { name: 'Solana',           len: 32, format: 'SOL', holdsZbc: true },
  12: { name: 'Polkadot',         len: 32, format: 'DOT', holdsZbc: true },
  13: { name: 'Cardano',          len: 28, format: 'ADA', holdsZbc: true },
  14: { name: 'Ripple',           len: 20, format: 'XRP', holdsZbc: true },
  15: { name: 'Tron',             len: 20, format: 'TRX', holdsZbc: true },
  16: { name: 'Tezos',            len: 20, format: 'XTZ', holdsZbc: true },
  17: { name: 'Reserved',         len: 32, format: null,  holdsZbc: false },
};

export const FORMATS = ['ZBC', 'ETH', 'BNB', 'BTC', 'SOL', 'DOT', 'ADA', 'XTZ', 'TRX', 'XRP'];
export const FORMAT_INFO = {
  ZBC: { name: 'ZooBC', hint: 'ZBC_…', coin: 'ZBC' },
  ETH: { name: 'Ethereum', hint: '0x…', coin: 'ETH' },
  BNB: { name: 'BNB', hint: '0x…', coin: 'BNB' },
  BTC: { name: 'Bitcoin', hint: '1… / bc1q… / bc1p…', coin: 'BTC' },
  SOL: { name: 'Solana', hint: 'base58', coin: 'SOL' },
  DOT: { name: 'Polkadot', hint: 'SS58', coin: 'DOT' },
  ADA: { name: 'Cardano', hint: 'addr1…', coin: 'ADA' },
  XTZ: { name: 'Tezos', hint: 'tz1…', coin: 'XTZ' },
  TRX: { name: 'Tron', hint: 'T…', coin: 'TRX' },
  XRP: { name: 'Ripple', hint: 'r…', coin: 'XRP' },
};

/** Account type for a wallet format (+ BTC flavour). */
export function typeForFormat(format, btc) {
  switch (format) {
    case 'ZBC': return 0;
    case 'ETH': case 'BNB': return 4;
    case 'BTC': return btc === 'legacy' ? 5 : btc === 'taproot' ? 9 : 7;
    case 'SOL': return 11;
    case 'DOT': return 12;
    case 'ADA': return 13;
    case 'XRP': return 14;
    case 'TRX': return 15;
    case 'XTZ': return 16;
    default: throw new Error('unknown format ' + format);
  }
}

export const EMPTY_TYPED = new Uint8Array([2, 0, 0, 0]);

export function typed(type, payload) { return concat(u32le(type), payload); }

/** Read one typed account at offset. Returns { type, payload, typed, length }. */
export function readTyped(bytes, offset = 0) {
  if (offset + 4 > bytes.length) throw new DecodeError('truncated account type');
  const type = readU32le(bytes, offset);
  const info = ACCOUNT_TYPES[type];
  if (!info) throw new DecodeError(`unknown account type ${type}`);
  if (offset + 4 + info.len > bytes.length) throw new DecodeError(`truncated ${info.name} account`);
  const payload = bytes.slice(offset + 4, offset + 4 + info.len);
  return { type, payload, typed: bytes.slice(offset, offset + 4 + info.len), length: 4 + info.len };
}

// ---- ZBC_ text form ----------------------------------------------------------------

export function zbcEncode(payload, prefix = 'ZBC') {
  if (payload.length !== 32) throw new Error('32-byte payload expected');
  const buf = concat(payload, utf8(prefix));
  const h = sha3_256(buf);
  buf[32] = h[0]; buf[33] = h[1]; buf[34] = h[2];
  const b = base32nopad.encode(buf); // 56 chars
  const groups = [];
  for (let i = 0; i < 56; i += 8) groups.push(b.slice(i, i + 8));
  return prefix + '_' + groups.join('_');
}

/** Decode any ZBC_/ZNK_/ZBS_… text form. Returns { prefix, payload } or null. */
export function zbcDecode(str) {
  if (typeof str !== 'string') return null;
  const clean = str.replace(/[\s_\-]/g, '').toUpperCase();
  if (clean.length !== 59) return null;
  const prefix = clean.slice(0, 3);
  if (!/^[A-Z]{3}$/.test(prefix)) return null;
  const body = clean.slice(3);
  if (!/^[A-Z2-7]{56}$/.test(body)) return null;
  let buf;
  try { buf = base32nopad.decode(body); } catch { return null; }
  if (buf.length !== 35) return null;
  const payload = buf.slice(0, 32);
  const h = sha3_256(concat(payload, utf8(prefix)));
  if (h[0] !== buf[32] || h[1] !== buf[33] || h[2] !== buf[34]) return null;
  return { prefix, payload };
}

// ---- foreign encodings ---------------------------------------------------------------

function sha256d(b) { return sha256(sha256(b)); }

function b58checkEncode(payload, alphabet = base58) {
  const cs = sha256d(payload).slice(0, 4);
  return alphabet.encode(concat(payload, cs));
}
function b58checkDecode(str, alphabet = base58) {
  let raw; try { raw = alphabet.decode(str); } catch { return null; }
  if (raw.length < 5) return null;
  const body = raw.slice(0, raw.length - 4), cs = raw.slice(raw.length - 4);
  if (!equalBytes(sha256d(body).slice(0, 4), cs)) return null;
  return body;
}

export function eip55(payload20) {
  const hex = bytesToHex(payload20);
  const h = bytesToHex(keccak_256(utf8(hex)));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  return out;
}

const SS58_PREFIX = utf8('SS58PRE');
export function ss58Encode(payload32, prefix = 0) {
  const pre = prefix < 64 ? new Uint8Array([prefix]) : new Uint8Array([((prefix & 0xfc) >> 2) | 0x40, (prefix >> 8) | ((prefix & 0x03) << 6)]);
  const body = concat(pre, payload32);
  const cs = blake2b(concat(SS58_PREFIX, body), { dkLen: 64 }).slice(0, 2);
  return base58.encode(concat(body, cs));
}
export function ss58Decode(str) {
  let raw; try { raw = base58.decode(str); } catch { return null; }
  if (raw.length < 35) return null;
  const preLen = raw[0] < 64 ? 1 : (raw[0] & 0x40) ? 2 : 0;
  if (!preLen) return null;
  if (raw.length !== preLen + 32 + 2) return null;
  const body = raw.slice(0, preLen + 32), cs = raw.slice(preLen + 32);
  const h = blake2b(concat(SS58_PREFIX, body), { dkLen: 64 });
  if (h[0] !== cs[0] || h[1] !== cs[1]) return null;
  return body.slice(preLen);
}

function bech32Encode(hrp, version, program) {
  const words = [version, ...bech32.toWords(program)];
  return version === 0 ? bech32.encode(hrp, words) : bech32m.encode(hrp, words);
}
function btcBech32Decode(str) {
  const lower = str.toLowerCase();
  if (lower !== str && str.toUpperCase() !== str) return null;
  let d = null, kind = null;
  try { d = bech32.decode(lower, 90); kind = 'bech32'; } catch { try { d = bech32m.decode(lower, 90); kind = 'bech32m'; } catch { return null; } }
  if (!['bc', 'tb', 'bcrt'].includes(d.prefix)) return null;
  const version = d.words[0];
  if (version === undefined || version > 16) return null;
  let program; try { program = bech32.fromWords(d.words.slice(1)); } catch { return null; }
  if (version === 0 && kind !== 'bech32') return null;
  if (version !== 0 && kind !== 'bech32m') return null;
  if (version === 0 && program.length === 20) return { type: 7, payload: program };
  if (version === 0 && program.length === 32) return { type: 8, payload: program };
  if (version === 1 && program.length === 32) return { type: 9, payload: program };
  return null;
}

const XTZ_PREFIX = new Uint8Array([6, 0xa1, 0x9f]);

/** Display form of a typed account (spec §3.2 "display" column). */
export function display(typedBytes) {
  const { type, payload } = readTyped(typedBytes, 0);
  switch (type) {
    case 0: return zbcEncode(payload, 'ZBC');
    case 2: return '—';
    case 4: return eip55(payload);
    case 5: return b58checkEncode(concat(new Uint8Array([0x00]), payload));
    case 6: return b58checkEncode(concat(new Uint8Array([0x05]), payload));
    case 7: case 8: return bech32Encode('bc', 0, payload);
    case 9: return bech32Encode('bc', 1, payload);
    case 10: return zbcEncode(payload, 'ZBS');
    case 11: return base58.encode(payload);
    case 12: return ss58Encode(payload, 0);
    case 13: return bech32.encode('addr', bech32.toWords(concat(new Uint8Array([0x61]), payload)), 200);
    case 14: return b58checkEncode(concat(new Uint8Array([0x00]), payload), base58xrp);
    case 15: return b58checkEncode(concat(new Uint8Array([0x41]), payload));
    case 16: return b58checkEncode(concat(XTZ_PREFIX, payload));
    default: return bytesToHex(payload);
  }
}

/** Ellipsise the middle of a display address: ZBC_A7XD…Q4LP */
export function shortAddress(str, head = 8, tail = 4) {
  if (!str || str.length <= head + tail + 1) return str;
  return str.slice(0, head) + '…' + str.slice(-tail);
}

function result(type, payload) {
  const t = typed(type, payload);
  return { type, payload, typed: t, hex: bytesToHex(t), display: display(t) };
}

/** Strict typed-hex input: 4-byte LE type + exact payload. Returns null if not that shape. */
export function parseTypedHex(str) {
  if (typeof str !== 'string') return null;
  const s = str.startsWith('0x') ? str.slice(2) : str;
  if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2) return null;
  const b = hexToBytes(s);
  if (b.length < 4) return null;
  const type = readU32le(b, 0);
  const info = ACCOUNT_TYPES[type];
  if (!info || b.length !== 4 + info.len) return null;
  if (type === 2) return null;
  return result(type, b.slice(4));
}

/**
 * Parse an address in any accepted form (addresses.md §3 order, plus typed hex first).
 * chain: optional strict hint 'zbc'|'zbs'|'btc'|'eth'|'sol'|'dot'|'ada'|'xrp'|'trx'|'xtz'.
 * Returns { type, payload, typed, hex, display } or null.
 */
export function parseAddress(input, chain) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const hexBody = s.startsWith('0x') ? s.slice(2) : s;
  const isHexStr = /^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length % 2 === 0;

  if (chain) {
    const strict = parseAddressStrict(s, chain, hexBody, isHexStr);
    if (strict) return strict;
  }
  return parseAddressAuto(s, hexBody, isHexStr);
}

function parseAddressStrict(s, chain, hexBody, isHexStr) {
  {
    switch (chain) {
      case 'zbc': { const z = zbcDecode(s); if (z) return result(0, z.payload); if (isHexStr && hexBody.length === 64) return result(0, hexToBytes(hexBody)); return null; }
      case 'zbs': { const z = zbcDecode(s); return z ? result(10, z.payload) : null; }
      case 'eth': { if (isHexStr && hexBody.length === 40) return result(4, hexToBytes(hexBody)); return null; }
      case 'btc': { const b = btcBech32Decode(s); if (b) return result(b.type, b.payload); const r = b58checkDecode(s); if (r && r.length === 21 && r[0] === 0) return result(5, r.slice(1)); if (r && r.length === 21 && r[0] === 5) return result(6, r.slice(1)); return null; }
      case 'sol': { try { const b = base58.decode(s); if (b.length === 32) return result(11, b); } catch {} return null; }
      case 'dot': { const p = ss58Decode(s); return p ? result(12, p) : null; }
      case 'ada': return parseCardano(s);
      case 'xrp': { const r = b58checkDecode(s, base58xrp); return r && r.length === 21 && r[0] === 0 ? result(14, r.slice(1)) : null; }
      case 'trx': { const r = b58checkDecode(s); return r && r.length === 21 && r[0] === 0x41 ? result(15, r.slice(1)) : null; }
      case 'xtz': { const r = b58checkDecode(s); return r && r.length === 23 && r[0] === 6 && r[1] === 0xa1 && r[2] === 0x9f ? result(16, r.slice(3)) : null; }
      default: return null;
    }
  }
}

function parseAddressAuto(s, hexBody, isHexStr) {
  // typed hex (the provider's canonical form)
  if (isHexStr) { const t = parseTypedHex(hexBody); if (t) return t; }
  // 0x + 40 hex → Ethereum
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return result(4, hexToBytes(s.slice(2)));
  // ZBC text form (4th char _ or -, or separator-less with ZBC/ZBS prefix)
  const compact = s.replace(/[\s_\-]/g, '');
  const upper = compact.toUpperCase();
  if (s[3] === '_' || s[3] === '-' || /^Z(BC|BS|NK)[A-Z2-7]{56}$/i.test(compact) || /\s/.test(s.trim())) {
    const z = zbcDecode(s);
    if (z) {
      // Only ZBC/ZBS/ZNK prefixes are known; a bare form without separators needs ZBC/ZBS and must be upper case
      if (!(s[3] === '_' || s[3] === '-') && !/^Z(BC|BS)[A-Z2-7]{56}$/.test(compact) && !/^z(bc|bs)[a-z2-7]{56}$/.test(compact) && !/\s/.test(s.trim())) return null;
      if (z.prefix === 'ZBS') return result(10, z.payload);
      if (z.prefix === 'ZBC' || z.prefix === 'ZNK') return result(0, z.payload);
      return null;
    }
    if (s[3] === '_' || s[3] === '-') return null;
  }
  void upper;
  // Bitcoin bech32
  if (/^(bc1|tb1|bcrt1)/i.test(s)) { const b = btcBech32Decode(s); return b ? result(b.type, b.payload) : null; }
  // Bitcoin base58check
  if (/^[13]/.test(s) && s.length >= 26 && s.length <= 35) {
    const r = b58checkDecode(s);
    if (r && r.length === 21 && r[0] === 0) return result(5, r.slice(1));
    if (r && r.length === 21 && r[0] === 5) return result(6, r.slice(1));
  }
  if (/^addr1/i.test(s)) return parseCardano(s);
  if (/^T/.test(s) && s.length === 34) { const r = b58checkDecode(s); if (r && r.length === 21 && r[0] === 0x41) return result(15, r.slice(1)); }
  if (/^r/.test(s) && s.length >= 25 && s.length <= 35) { const r = b58checkDecode(s, base58xrp); if (r && r.length === 21 && r[0] === 0) return result(14, r.slice(1)); }
  if (/^tz1/.test(s)) { const r = b58checkDecode(s); if (r && r.length === 23 && r[0] === 6 && r[1] === 0xa1 && r[2] === 0x9f) return result(16, r.slice(3)); }
  { const p = ss58Decode(s); if (p) return result(12, p); }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) { try { const b = base58.decode(s); if (b.length === 32) return result(11, b); } catch {} }
  if (isHexStr && hexBody.length === 64 && !s.startsWith('0x')) return result(0, hexToBytes(hexBody));
  return null;
}

function parseCardano(s) {
  let d; try { d = bech32.decode(s.toLowerCase(), 200); } catch { return null; }
  if (d.prefix !== 'addr') return null;
  let b; try { b = bech32.fromWords(d.words); } catch { return null; }
  if (b.length !== 29 || b[0] !== 0x61) return null;
  return result(13, b.slice(1));
}

/** Multisig address: SHA3-256(min u32 ‖ nonce u64 ‖ n u32 ‖ participants sorted bytewise) as a type-0 payload. */
export function multisigAddress(min, nonce, participantsTyped) {
  const sorted = [...participantsTyped].sort(compareBytes);
  const { u64le: u64 } = bytesHelpers;
  const pre = concat(u32le(min), u64(nonce), u32le(sorted.length), ...sorted);
  return sha3_256(pre);
}
import * as bytesHelpers from './bytes.js';

/** Group address (spec §3.3): 00000000 ‖ SHA3-256("ZBC-GROUP" ‖ founding_tx_hash). */
export function groupAddress(foundingTxHash) {
  return typed(0, sha3_256(concat(utf8('ZBC-GROUP'), foundingTxHash)));
}

export function isZbcTyped(t) { return t.length === 36 && readU32le(t, 0) === 0; }
export function formatOfType(type) { const i = ACCOUNT_TYPES[type]; return i ? i.format : null; }
export function btcOfType(type) { const i = ACCOUNT_TYPES[type]; return i ? i.btc : undefined; }
