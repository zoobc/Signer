// Byte helpers: hex, little-endian integers, BigInt-safe readers.
// Every integer wider than 32 bits is a BigInt; ids are never JS Numbers.

export class DecodeError extends Error {
  constructor(message) { super(message); this.name = 'DecodeError'; this.code = 4300; }
}

const HEX = /^[0-9a-fA-F]*$/;

export function isHex(s) { return typeof s === 'string' && s.length % 2 === 0 && HEX.test(s); }

export function hexToBytes(hex) {
  if (typeof hex !== 'string') throw new DecodeError('hex expected');
  if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);
  if (!isHex(hex)) throw new DecodeError('bad hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

export function concat(...arrs) {
  let n = 0; for (const a of arrs) n += a.length;
  const out = new Uint8Array(n); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export function compareBytes(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

const te = new TextEncoder();
const td = new TextDecoder('utf-8', { fatal: true });
export function utf8(s) { return te.encode(s); }
export function fromUtf8(b) { try { return td.decode(b); } catch { return null; } }

export function u8(v) { return new Uint8Array([v & 0xff]); }
export function u16le(v) { return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]); }
export function u32le(v) { v = Number(v) >>> 0; return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]); }
export function u64le(v) {
  v = BigInt.asUintN(64, BigInt(v));
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}
export const i64le = u64le;

export function readU16le(b, o = 0) { return b[o] | (b[o + 1] << 8); }
export function readU32le(b, o = 0) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
export function readU64le(b, o = 0) {
  let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]);
  return v;
}
export function readI64le(b, o = 0) { return BigInt.asIntN(64, readU64le(b, o)); }
export function readI32le(b, o = 0) { return readU32le(b, o) | 0; }

export function lp4(bytes) { return concat(u32le(bytes.length), bytes); }
export function lp2(bytes) { return concat(u16le(bytes.length), bytes); }

/** Bounds-checked sequential reader. Every read past the end throws DecodeError. */
export class Reader {
  constructor(bytes, offset = 0) { this.b = bytes; this.o = offset; }
  get remaining() { return this.b.length - this.o; }
  get done() { return this.o >= this.b.length; }
  need(n, what = 'bytes') {
    if (n < 0 || this.o + n > this.b.length) throw new DecodeError(`truncated: need ${n} ${what} at ${this.o}, have ${this.remaining}`);
  }
  bytes(n, what) { this.need(n, what); const out = this.b.slice(this.o, this.o + n); this.o += n; return out; }
  u8(what) { this.need(1, what); return this.b[this.o++]; }
  u16(what) { this.need(2, what); const v = readU16le(this.b, this.o); this.o += 2; return v; }
  u32(what) { this.need(4, what); const v = readU32le(this.b, this.o); this.o += 4; return v; }
  i32(what) { this.need(4, what); const v = readI32le(this.b, this.o); this.o += 4; return v; }
  u64(what) { this.need(8, what); const v = readU64le(this.b, this.o); this.o += 8; return v; }
  i64(what) { this.need(8, what); const v = readI64le(this.b, this.o); this.o += 8; return v; }
  lp4(what) { const n = this.u32(what + ' length'); return this.bytes(n, what); }
  lp2(what) { const n = this.u16(what + ' length'); return this.bytes(n, what); }
  str4(what) { const b = this.lp4(what); const s = fromUtf8(b); return s === null ? bytesToHex(b) : s; }
  str2(what) { const b = this.lp2(what); const s = fromUtf8(b); return s === null ? bytesToHex(b) : s; }
  finish(what = 'transaction') { if (!this.done) throw new DecodeError(`${this.remaining} trailing byte(s) after ${what}`); }
}

export function randomBytes(n) { const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b); return b; }

export function zero(b) { if (b && b.fill) b.fill(0); }

export function toBase64(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
export function fromBase64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i); return out; }
