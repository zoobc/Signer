var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/bytes.js
var bytes_exports = {};
__export(bytes_exports, {
  DecodeError: () => DecodeError,
  Reader: () => Reader,
  bytesToHex: () => bytesToHex,
  compareBytes: () => compareBytes,
  concat: () => concat,
  equalBytes: () => equalBytes,
  fromBase64: () => fromBase64,
  fromUtf8: () => fromUtf8,
  hexToBytes: () => hexToBytes,
  i64le: () => i64le,
  isHex: () => isHex,
  lp2: () => lp2,
  lp4: () => lp4,
  randomBytes: () => randomBytes,
  readI32le: () => readI32le,
  readI64le: () => readI64le,
  readU16le: () => readU16le,
  readU32le: () => readU32le,
  readU64le: () => readU64le,
  toBase64: () => toBase64,
  u16le: () => u16le,
  u32le: () => u32le,
  u64le: () => u64le,
  u8: () => u8,
  utf8: () => utf8,
  zero: () => zero
});
var DecodeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DecodeError";
    this.code = 4300;
  }
};
var HEX = /^[0-9a-fA-F]*$/;
function isHex(s) {
  return typeof s === "string" && s.length % 2 === 0 && HEX.test(s);
}
function hexToBytes(hex) {
  if (typeof hex !== "string") throw new DecodeError("hex expected");
  if (hex.startsWith("0x") || hex.startsWith("0X")) hex = hex.slice(2);
  if (!isHex(hex)) throw new DecodeError("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
function concat(...arrs) {
  let n = 0;
  for (const a of arrs) n += a.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function compareBytes(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
var te = new TextEncoder();
var td = new TextDecoder("utf-8", { fatal: true });
function utf8(s) {
  return te.encode(s);
}
function fromUtf8(b) {
  try {
    return td.decode(b);
  } catch {
    return null;
  }
}
function u8(v) {
  return new Uint8Array([v & 255]);
}
function u16le(v) {
  return new Uint8Array([v & 255, v >>> 8 & 255]);
}
function u32le(v) {
  v = Number(v) >>> 0;
  return new Uint8Array([v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255]);
}
function u64le(v) {
  v = BigInt.asUintN(64, BigInt(v));
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
var i64le = u64le;
function readU16le(b, o = 0) {
  return b[o] | b[o + 1] << 8;
}
function readU32le(b, o = 0) {
  return (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
}
function readU64le(b, o = 0) {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = v << 8n | BigInt(b[o + i]);
  return v;
}
function readI64le(b, o = 0) {
  return BigInt.asIntN(64, readU64le(b, o));
}
function readI32le(b, o = 0) {
  return readU32le(b, o) | 0;
}
function lp4(bytes) {
  return concat(u32le(bytes.length), bytes);
}
function lp2(bytes) {
  return concat(u16le(bytes.length), bytes);
}
var Reader = class {
  constructor(bytes, offset = 0) {
    this.b = bytes;
    this.o = offset;
  }
  get remaining() {
    return this.b.length - this.o;
  }
  get done() {
    return this.o >= this.b.length;
  }
  need(n, what = "bytes") {
    if (n < 0 || this.o + n > this.b.length) throw new DecodeError(`truncated: need ${n} ${what} at ${this.o}, have ${this.remaining}`);
  }
  bytes(n, what) {
    this.need(n, what);
    const out = this.b.slice(this.o, this.o + n);
    this.o += n;
    return out;
  }
  u8(what) {
    this.need(1, what);
    return this.b[this.o++];
  }
  u16(what) {
    this.need(2, what);
    const v = readU16le(this.b, this.o);
    this.o += 2;
    return v;
  }
  u32(what) {
    this.need(4, what);
    const v = readU32le(this.b, this.o);
    this.o += 4;
    return v;
  }
  i32(what) {
    this.need(4, what);
    const v = readI32le(this.b, this.o);
    this.o += 4;
    return v;
  }
  u64(what) {
    this.need(8, what);
    const v = readU64le(this.b, this.o);
    this.o += 8;
    return v;
  }
  i64(what) {
    this.need(8, what);
    const v = readI64le(this.b, this.o);
    this.o += 8;
    return v;
  }
  lp4(what) {
    const n = this.u32(what + " length");
    return this.bytes(n, what);
  }
  lp2(what) {
    const n = this.u16(what + " length");
    return this.bytes(n, what);
  }
  str4(what) {
    const b = this.lp4(what);
    const s = fromUtf8(b);
    return s === null ? bytesToHex(b) : s;
  }
  str2(what) {
    const b = this.lp2(what);
    const s = fromUtf8(b);
    return s === null ? bytesToHex(b) : s;
  }
  finish(what = "transaction") {
    if (!this.done) throw new DecodeError(`${this.remaining} trailing byte(s) after ${what}`);
  }
};
function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}
function zero(b) {
  if (b && b.fill) b.fill(0);
}
function toBase64(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var shrSH = (h, _l, s) => h >>> s;
var shrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
var rotr32H = (_h, l) => l;
var rotr32L = (h, _l) => h;
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/hashes/esm/crypto.js
var crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function rotl(word, shift) {
  return word << shift | word >>> 32 - shift >>> 0;
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
var swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n);
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex2(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes2(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function kdfInputToBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts(defaults, opts) {
  if (opts !== void 0 && {}.toString.call(opts) !== "[object Object]")
    throw new Error("options should be object or undefined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
var Hash = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function createOptHasher(hashCons) {
  const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  return hashC;
}
function randomBytes2(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return Uint8Array.from(crypto2.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// node_modules/@noble/hashes/esm/sha3.js
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var Keccak = class _Keccak extends Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    this.enableXOF = false;
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen);
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
var sha3_256 = /* @__PURE__ */ (() => gen(6, 136, 256 / 8))();
var keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
var SHA512 = class extends HashMD {
  constructor(outputLen = 64) {
    super(128, outputLen, 16, false);
    this.Ah = SHA512_IV[0] | 0;
    this.Al = SHA512_IV[1] | 0;
    this.Bh = SHA512_IV[2] | 0;
    this.Bl = SHA512_IV[3] | 0;
    this.Ch = SHA512_IV[4] | 0;
    this.Cl = SHA512_IV[5] | 0;
    this.Dh = SHA512_IV[6] | 0;
    this.Dl = SHA512_IV[7] | 0;
    this.Eh = SHA512_IV[8] | 0;
    this.El = SHA512_IV[9] | 0;
    this.Fh = SHA512_IV[10] | 0;
    this.Fl = SHA512_IV[11] | 0;
    this.Gh = SHA512_IV[12] | 0;
    this.Gl = SHA512_IV[13] | 0;
    this.Hh = SHA512_IV[14] | 0;
    this.Hl = SHA512_IV[15] | 0;
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());
var sha512 = /* @__PURE__ */ createHasher(() => new SHA512());

// node_modules/@noble/hashes/esm/sha256.js
var sha2562 = sha256;

// node_modules/@noble/hashes/esm/_blake.js
var BSIGMA = /* @__PURE__ */ Uint8Array.from([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9,
  12,
  5,
  1,
  15,
  14,
  13,
  4,
  10,
  0,
  7,
  6,
  3,
  9,
  2,
  8,
  11,
  13,
  11,
  7,
  14,
  12,
  1,
  3,
  9,
  5,
  0,
  15,
  4,
  8,
  6,
  2,
  10,
  6,
  15,
  14,
  9,
  11,
  3,
  0,
  8,
  12,
  2,
  13,
  7,
  1,
  4,
  10,
  5,
  10,
  2,
  8,
  4,
  7,
  6,
  1,
  5,
  15,
  11,
  9,
  14,
  3,
  12,
  13,
  0,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  // Blake1, unused in others
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9
]);

// node_modules/@noble/hashes/esm/blake2.js
var B2B_IV = /* @__PURE__ */ Uint32Array.from([
  4089235720,
  1779033703,
  2227873595,
  3144134277,
  4271175723,
  1013904242,
  1595750129,
  2773480762,
  2917565137,
  1359893119,
  725511199,
  2600822924,
  4215389547,
  528734635,
  327033209,
  1541459225
]);
var BBUF = /* @__PURE__ */ new Uint32Array(32);
function G1b(a, b, c, d, msg, x) {
  const Xl = msg[x], Xh = msg[x + 1];
  let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1];
  let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1];
  let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1];
  let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1];
  let ll = add3L(Al, Bl, Xl);
  Ah = add3H(ll, Ah, Bh, Xh);
  Al = ll | 0;
  ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
  ({ Dh, Dl } = { Dh: rotr32H(Dh, Dl), Dl: rotr32L(Dh, Dl) });
  ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
  ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
  ({ Bh, Bl } = { Bh: rotrSH(Bh, Bl, 24), Bl: rotrSL(Bh, Bl, 24) });
  BBUF[2 * a] = Al, BBUF[2 * a + 1] = Ah;
  BBUF[2 * b] = Bl, BBUF[2 * b + 1] = Bh;
  BBUF[2 * c] = Cl, BBUF[2 * c + 1] = Ch;
  BBUF[2 * d] = Dl, BBUF[2 * d + 1] = Dh;
}
function G2b(a, b, c, d, msg, x) {
  const Xl = msg[x], Xh = msg[x + 1];
  let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1];
  let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1];
  let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1];
  let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1];
  let ll = add3L(Al, Bl, Xl);
  Ah = add3H(ll, Ah, Bh, Xh);
  Al = ll | 0;
  ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
  ({ Dh, Dl } = { Dh: rotrSH(Dh, Dl, 16), Dl: rotrSL(Dh, Dl, 16) });
  ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
  ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
  ({ Bh, Bl } = { Bh: rotrBH(Bh, Bl, 63), Bl: rotrBL(Bh, Bl, 63) });
  BBUF[2 * a] = Al, BBUF[2 * a + 1] = Ah;
  BBUF[2 * b] = Bl, BBUF[2 * b + 1] = Bh;
  BBUF[2 * c] = Cl, BBUF[2 * c + 1] = Ch;
  BBUF[2 * d] = Dl, BBUF[2 * d + 1] = Dh;
}
function checkBlake2Opts(outputLen, opts = {}, keyLen, saltLen, persLen) {
  anumber(keyLen);
  if (outputLen < 0 || outputLen > keyLen)
    throw new Error("outputLen bigger than keyLen");
  const { key, salt: salt2, personalization } = opts;
  if (key !== void 0 && (key.length < 1 || key.length > keyLen))
    throw new Error("key length must be undefined or 1.." + keyLen);
  if (salt2 !== void 0 && salt2.length !== saltLen)
    throw new Error("salt must be undefined or " + saltLen);
  if (personalization !== void 0 && personalization.length !== persLen)
    throw new Error("personalization must be undefined or " + persLen);
}
var BLAKE2 = class extends Hash {
  constructor(blockLen, outputLen) {
    super();
    this.finished = false;
    this.destroyed = false;
    this.length = 0;
    this.pos = 0;
    anumber(blockLen);
    anumber(outputLen);
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.buffer = new Uint8Array(blockLen);
    this.buffer32 = u32(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { blockLen, buffer, buffer32 } = this;
    const len = data.length;
    const offset = data.byteOffset;
    const buf = data.buffer;
    for (let pos = 0; pos < len; ) {
      if (this.pos === blockLen) {
        swap32IfBE(buffer32);
        this.compress(buffer32, 0, false);
        swap32IfBE(buffer32);
        this.pos = 0;
      }
      const take = Math.min(blockLen - this.pos, len - pos);
      const dataOffset = offset + pos;
      if (take === blockLen && !(dataOffset % 4) && pos + take < len) {
        const data32 = new Uint32Array(buf, dataOffset, Math.floor((len - pos) / 4));
        swap32IfBE(data32);
        for (let pos32 = 0; pos + blockLen < len; pos32 += buffer32.length, pos += blockLen) {
          this.length += blockLen;
          this.compress(data32, pos32, false);
        }
        swap32IfBE(data32);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      this.length += take;
      pos += take;
    }
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    const { pos, buffer32 } = this;
    this.finished = true;
    clean(this.buffer.subarray(pos));
    swap32IfBE(buffer32);
    this.compress(buffer32, 0, true);
    swap32IfBE(buffer32);
    const out32 = u32(out);
    this.get().forEach((v, i) => out32[i] = swap8IfBE(v));
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    const { buffer, length, finished, destroyed, outputLen, pos } = this;
    to || (to = new this.constructor({ dkLen: outputLen }));
    to.set(...this.get());
    to.buffer.set(buffer);
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    to.outputLen = outputLen;
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var BLAKE2b = class extends BLAKE2 {
  constructor(opts = {}) {
    const olen = opts.dkLen === void 0 ? 64 : opts.dkLen;
    super(128, olen);
    this.v0l = B2B_IV[0] | 0;
    this.v0h = B2B_IV[1] | 0;
    this.v1l = B2B_IV[2] | 0;
    this.v1h = B2B_IV[3] | 0;
    this.v2l = B2B_IV[4] | 0;
    this.v2h = B2B_IV[5] | 0;
    this.v3l = B2B_IV[6] | 0;
    this.v3h = B2B_IV[7] | 0;
    this.v4l = B2B_IV[8] | 0;
    this.v4h = B2B_IV[9] | 0;
    this.v5l = B2B_IV[10] | 0;
    this.v5h = B2B_IV[11] | 0;
    this.v6l = B2B_IV[12] | 0;
    this.v6h = B2B_IV[13] | 0;
    this.v7l = B2B_IV[14] | 0;
    this.v7h = B2B_IV[15] | 0;
    checkBlake2Opts(olen, opts, 64, 16, 16);
    let { key, personalization, salt: salt2 } = opts;
    let keyLength = 0;
    if (key !== void 0) {
      key = toBytes(key);
      keyLength = key.length;
    }
    this.v0l ^= this.outputLen | keyLength << 8 | 1 << 16 | 1 << 24;
    if (salt2 !== void 0) {
      salt2 = toBytes(salt2);
      const slt = u32(salt2);
      this.v4l ^= swap8IfBE(slt[0]);
      this.v4h ^= swap8IfBE(slt[1]);
      this.v5l ^= swap8IfBE(slt[2]);
      this.v5h ^= swap8IfBE(slt[3]);
    }
    if (personalization !== void 0) {
      personalization = toBytes(personalization);
      const pers = u32(personalization);
      this.v6l ^= swap8IfBE(pers[0]);
      this.v6h ^= swap8IfBE(pers[1]);
      this.v7l ^= swap8IfBE(pers[2]);
      this.v7h ^= swap8IfBE(pers[3]);
    }
    if (key !== void 0) {
      const tmp = new Uint8Array(this.blockLen);
      tmp.set(key);
      this.update(tmp);
    }
  }
  // prettier-ignore
  get() {
    let { v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h } = this;
    return [v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h];
  }
  // prettier-ignore
  set(v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h) {
    this.v0l = v0l | 0;
    this.v0h = v0h | 0;
    this.v1l = v1l | 0;
    this.v1h = v1h | 0;
    this.v2l = v2l | 0;
    this.v2h = v2h | 0;
    this.v3l = v3l | 0;
    this.v3h = v3h | 0;
    this.v4l = v4l | 0;
    this.v4h = v4h | 0;
    this.v5l = v5l | 0;
    this.v5h = v5h | 0;
    this.v6l = v6l | 0;
    this.v6h = v6h | 0;
    this.v7l = v7l | 0;
    this.v7h = v7h | 0;
  }
  compress(msg, offset, isLast) {
    this.get().forEach((v, i) => BBUF[i] = v);
    BBUF.set(B2B_IV, 16);
    let { h, l } = fromBig(BigInt(this.length));
    BBUF[24] = B2B_IV[8] ^ l;
    BBUF[25] = B2B_IV[9] ^ h;
    if (isLast) {
      BBUF[28] = ~BBUF[28];
      BBUF[29] = ~BBUF[29];
    }
    let j = 0;
    const s = BSIGMA;
    for (let i = 0; i < 12; i++) {
      G1b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
      G2b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
      G1b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
      G2b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
      G1b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
      G2b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
      G1b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
      G2b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
      G1b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
      G2b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
      G1b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
      G2b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
      G1b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
      G2b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
      G1b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
      G2b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
    }
    this.v0l ^= BBUF[0] ^ BBUF[16];
    this.v0h ^= BBUF[1] ^ BBUF[17];
    this.v1l ^= BBUF[2] ^ BBUF[18];
    this.v1h ^= BBUF[3] ^ BBUF[19];
    this.v2l ^= BBUF[4] ^ BBUF[20];
    this.v2h ^= BBUF[5] ^ BBUF[21];
    this.v3l ^= BBUF[6] ^ BBUF[22];
    this.v3h ^= BBUF[7] ^ BBUF[23];
    this.v4l ^= BBUF[8] ^ BBUF[24];
    this.v4h ^= BBUF[9] ^ BBUF[25];
    this.v5l ^= BBUF[10] ^ BBUF[26];
    this.v5h ^= BBUF[11] ^ BBUF[27];
    this.v6l ^= BBUF[12] ^ BBUF[28];
    this.v6h ^= BBUF[13] ^ BBUF[29];
    this.v7l ^= BBUF[14] ^ BBUF[30];
    this.v7h ^= BBUF[15] ^ BBUF[31];
    clean(BBUF);
  }
  destroy() {
    this.destroyed = true;
    clean(this.buffer32);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var blake2b = /* @__PURE__ */ createOptHasher((opts) => new BLAKE2b(opts));

// node_modules/@noble/hashes/esm/blake2b.js
var blake2b2 = blake2b;

// node_modules/@scure/base/lib/esm/index.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function isArrayOf(isString, arr) {
  if (!Array.isArray(arr))
    return false;
  if (arr.length === 0)
    return true;
  if (isString) {
    return arr.every((item) => typeof item === "string");
  } else {
    return arr.every((item) => Number.isSafeInteger(item));
  }
}
function afn(input) {
  if (typeof input !== "function")
    throw new Error("function expected");
  return true;
}
function astr(label, input) {
  if (typeof input !== "string")
    throw new Error(`${label}: string expected`);
  return true;
}
function anumber2(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`invalid integer: ${n}`);
}
function aArr(input) {
  if (!Array.isArray(input))
    throw new Error("array expected");
}
function astrArr(label, input) {
  if (!isArrayOf(true, input))
    throw new Error(`${label}: array of strings expected`);
}
function anumArr(label, input) {
  if (!isArrayOf(false, input))
    throw new Error(`${label}: array of numbers expected`);
}
// @__NO_SIDE_EFFECTS__
function chain(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode = args.map((x) => x.decode).reduce(wrap, id);
  return { encode, decode };
}
// @__NO_SIDE_EFFECTS__
function alphabet(letters) {
  const lettersA = typeof letters === "string" ? letters.split("") : letters;
  const len = lettersA.length;
  astrArr("alphabet", lettersA);
  const indexes = new Map(lettersA.map((l, i) => [l, i]));
  return {
    encode: (digits) => {
      aArr(digits);
      return digits.map((i) => {
        if (!Number.isSafeInteger(i) || i < 0 || i >= len)
          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
        return lettersA[i];
      });
    },
    decode: (input) => {
      aArr(input);
      return input.map((letter) => {
        astr("alphabet.decode", letter);
        const i = indexes.get(letter);
        if (i === void 0)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
        return i;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join(separator = "") {
  astr("join", separator);
  return {
    encode: (from) => {
      astrArr("join.decode", from);
      return from.join(separator);
    },
    decode: (to) => {
      astr("join.decode", to);
      return to.split(separator);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function padding(bits, chr = "=") {
  anumber2(bits);
  astr("padding", chr);
  return {
    encode(data) {
      astrArr("padding.encode", data);
      while (data.length * bits % 8)
        data.push(chr);
      return data;
    },
    decode(input) {
      astrArr("padding.decode", input);
      let end = input.length;
      if (end * bits % 8)
        throw new Error("padding: invalid, string should have whole number of bytes");
      for (; end > 0 && input[end - 1] === chr; end--) {
        const last = end - 1;
        const byte = last * bits;
        if (byte % 8 === 0)
          throw new Error("padding: invalid, string has too much padding");
      }
      return input.slice(0, end);
    }
  };
}
function convertRadix(data, from, to) {
  if (from < 2)
    throw new Error(`convertRadix: invalid from=${from}, base cannot be less than 2`);
  if (to < 2)
    throw new Error(`convertRadix: invalid to=${to}, base cannot be less than 2`);
  aArr(data);
  if (!data.length)
    return [];
  let pos = 0;
  const res = [];
  const digits = Array.from(data, (d) => {
    anumber2(d);
    if (d < 0 || d >= from)
      throw new Error(`invalid integer: ${d}`);
    return d;
  });
  const dlen = digits.length;
  while (true) {
    let carry = 0;
    let done = true;
    for (let i = pos; i < dlen; i++) {
      const digit = digits[i];
      const fromCarry = from * carry;
      const digitBase = fromCarry + digit;
      if (!Number.isSafeInteger(digitBase) || fromCarry / from !== carry || digitBase - digit !== fromCarry) {
        throw new Error("convertRadix: carry overflow");
      }
      const div = digitBase / to;
      carry = digitBase % to;
      const rounded = Math.floor(div);
      digits[i] = rounded;
      if (!Number.isSafeInteger(rounded) || rounded * to + carry !== digitBase)
        throw new Error("convertRadix: carry overflow");
      if (!done)
        continue;
      else if (!rounded)
        pos = i;
      else
        done = false;
    }
    res.push(carry);
    if (done)
      break;
  }
  for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
    res.push(0);
  return res.reverse();
}
var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
var radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
var powers = /* @__PURE__ */ (() => {
  let res = [];
  for (let i = 0; i < 40; i++)
    res.push(2 ** i);
  return res;
})();
function convertRadix2(data, from, to, padding2) {
  aArr(data);
  if (from <= 0 || from > 32)
    throw new Error(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${/* @__PURE__ */ radix2carry(from, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const max = powers[from];
  const mask = powers[to] - 1;
  const res = [];
  for (const n of data) {
    anumber2(n);
    if (n >= max)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    const pow = powers[pos];
    if (pow === void 0)
      throw new Error("invalid carry");
    carry &= pow - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding2 && pos >= from)
    throw new Error("Excess padding");
  if (!padding2 && carry > 0)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding2 && pos > 0)
    res.push(carry >>> 0);
  return res;
}
// @__NO_SIDE_EFFECTS__
function radix(num2) {
  anumber2(num2);
  const _256 = 2 ** 8;
  return {
    encode: (bytes) => {
      if (!isBytes2(bytes))
        throw new Error("radix.encode input should be Uint8Array");
      return convertRadix(Array.from(bytes), _256, num2);
    },
    decode: (digits) => {
      anumArr("radix.decode", digits);
      return Uint8Array.from(convertRadix(digits, num2, _256));
    }
  };
}
// @__NO_SIDE_EFFECTS__
function radix2(bits, revPadding = false) {
  anumber2(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry(8, bits) > 32 || /* @__PURE__ */ radix2carry(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes2(bytes))
        throw new Error("radix2.encode input should be Uint8Array");
      return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      anumArr("radix2.decode", digits);
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
function unsafeWrapper(fn) {
  afn(fn);
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
function checksum(len, fn) {
  anumber2(len);
  afn(fn);
  return {
    encode(data) {
      if (!isBytes2(data))
        throw new Error("checksum.encode: input should be Uint8Array");
      const sum = fn(data).slice(0, len);
      const res = new Uint8Array(data.length + len);
      res.set(data);
      res.set(sum, data.length);
      return res;
    },
    decode(data) {
      if (!isBytes2(data))
        throw new Error("checksum.decode: input should be Uint8Array");
      const payload = data.slice(0, -len);
      const oldChecksum = data.slice(-len);
      const newChecksum = fn(payload).slice(0, len);
      for (let i = 0; i < len; i++)
        if (newChecksum[i] !== oldChecksum[i])
          throw new Error("Invalid checksum");
      return payload;
    }
  };
}
var utils = {
  alphabet,
  chain,
  checksum,
  convertRadix,
  convertRadix2,
  radix,
  radix2,
  join,
  padding
};
var base32nopad = /* @__PURE__ */ chain(/* @__PURE__ */ radix2(5), /* @__PURE__ */ alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"), /* @__PURE__ */ join(""));
var genBase58 = /* @__NO_SIDE_EFFECTS__ */ (abc) => /* @__PURE__ */ chain(/* @__PURE__ */ radix(58), /* @__PURE__ */ alphabet(abc), /* @__PURE__ */ join(""));
var base58 = /* @__PURE__ */ genBase58("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
var base58xrp = /* @__PURE__ */ genBase58("rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz");
var createBase58check = (sha2563) => /* @__PURE__ */ chain(checksum(4, (data) => sha2563(sha2563(data))), base58);
var BECH_ALPHABET = /* @__PURE__ */ chain(/* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join(""));
var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i];
  }
  return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i = 0; i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }
  chk = bech32Polymod(chk);
  for (let i = 0; i < len; i++)
    chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = bech32Polymod(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET.encode(convertRadix2([chk % powers[30]], 30, 5, false));
}
// @__NO_SIDE_EFFECTS__
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = /* @__PURE__ */ radix2(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper(fromWords);
  function encode(prefix, words, limit = 90) {
    astr("bech32.encode prefix", prefix);
    if (isBytes2(words))
      words = Array.from(words);
    anumArr("bech32.encode", words);
    const plen = prefix.length;
    if (plen === 0)
      throw new TypeError(`Invalid prefix length ${plen}`);
    const actualLength = plen + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    const lowered = prefix.toLowerCase();
    const sum = bechChecksum(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
  }
  function decode(str, limit = 90) {
    astr("bech32.decode input", str);
    const slen = str.length;
    if (slen < 8 || limit !== false && slen > limit)
      throw new TypeError(`invalid string length: ${slen} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase())
      throw new Error(`String must be lowercase or uppercase`);
    const sepIndex = lowered.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix = lowered.slice(0, sepIndex);
    const data = lowered.slice(sepIndex + 1);
    if (data.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const words = BECH_ALPHABET.decode(data).slice(0, -6);
    const sum = bechChecksum(prefix, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix, words };
  }
  const decodeUnsafe = unsafeWrapper(decode);
  function decodeToBytes(str) {
    const { prefix, words } = decode(str, false);
    return { prefix, words, bytes: fromWords(words) };
  }
  function encodeFromBytes(prefix, bytes) {
    return encode(prefix, toWords(bytes));
  }
  return {
    encode,
    decode,
    encodeFromBytes,
    decodeToBytes,
    decodeUnsafe,
    fromWords,
    fromWordsUnsafe,
    toWords
  };
}
var bech32 = /* @__PURE__ */ genBech32("bech32");
var bech32m = /* @__PURE__ */ genBech32("bech32m");

// src/lib/address.js
var ACCOUNT_TYPES = {
  0: { name: "ZooBC", len: 32, format: "ZBC", holdsZbc: true },
  1: { name: "Bitcoin (legacy)", len: 20, format: null, holdsZbc: true },
  2: { name: "Empty", len: 0, format: null, holdsZbc: false },
  3: { name: "Estonian eID", len: 32, format: null, holdsZbc: false },
  4: { name: "Ethereum", len: 20, format: "ETH", holdsZbc: true },
  5: { name: "Bitcoin P2PKH", len: 20, format: "BTC", btc: "legacy", holdsZbc: true },
  6: { name: "Bitcoin P2SH", len: 20, format: null, holdsZbc: false },
  7: { name: "Bitcoin P2WPKH", len: 20, format: "BTC", btc: "segwit", holdsZbc: true },
  8: { name: "Bitcoin P2WSH", len: 32, format: null, holdsZbc: false },
  9: { name: "Bitcoin Taproot", len: 32, format: "BTC", btc: "taproot", holdsZbc: true },
  10: { name: "DataSet object", len: 32, format: null, holdsZbc: true },
  11: { name: "Solana", len: 32, format: "SOL", holdsZbc: true },
  12: { name: "Polkadot", len: 32, format: "DOT", holdsZbc: true },
  13: { name: "Cardano", len: 28, format: "ADA", holdsZbc: true },
  14: { name: "Ripple", len: 20, format: "XRP", holdsZbc: true },
  15: { name: "Tron", len: 20, format: "TRX", holdsZbc: true },
  16: { name: "Tezos", len: 20, format: "XTZ", holdsZbc: true },
  17: { name: "Reserved", len: 32, format: null, holdsZbc: false }
};
var FORMATS = ["ZBC", "ETH", "BNB", "BTC", "SOL", "DOT", "ADA", "XTZ", "TRX", "XRP"];
function typeForFormat(format, btc) {
  switch (format) {
    case "ZBC":
      return 0;
    case "ETH":
    case "BNB":
      return 4;
    case "BTC":
      return btc === "legacy" ? 5 : btc === "taproot" ? 9 : 7;
    case "SOL":
      return 11;
    case "DOT":
      return 12;
    case "ADA":
      return 13;
    case "XRP":
      return 14;
    case "TRX":
      return 15;
    case "XTZ":
      return 16;
    default:
      throw new Error("unknown format " + format);
  }
}
var EMPTY_TYPED = new Uint8Array([2, 0, 0, 0]);
function typed(type, payload) {
  return concat(u32le(type), payload);
}
function readTyped(bytes, offset = 0) {
  if (offset + 4 > bytes.length) throw new DecodeError("truncated account type");
  const type = readU32le(bytes, offset);
  const info = ACCOUNT_TYPES[type];
  if (!info) throw new DecodeError(`unknown account type ${type}`);
  if (offset + 4 + info.len > bytes.length) throw new DecodeError(`truncated ${info.name} account`);
  const payload = bytes.slice(offset + 4, offset + 4 + info.len);
  return { type, payload, typed: bytes.slice(offset, offset + 4 + info.len), length: 4 + info.len };
}
function zbcEncode(payload, prefix = "ZBC") {
  if (payload.length !== 32) throw new Error("32-byte payload expected");
  const buf = concat(payload, utf8(prefix));
  const h = sha3_256(buf);
  buf[32] = h[0];
  buf[33] = h[1];
  buf[34] = h[2];
  const b = base32nopad.encode(buf);
  const groups = [];
  for (let i = 0; i < 56; i += 8) groups.push(b.slice(i, i + 8));
  return prefix + "_" + groups.join("_");
}
function zbcDecode(str) {
  if (typeof str !== "string") return null;
  const clean2 = str.replace(/[\s_\-]/g, "").toUpperCase();
  if (clean2.length !== 59) return null;
  const prefix = clean2.slice(0, 3);
  if (!/^[A-Z]{3}$/.test(prefix)) return null;
  const body = clean2.slice(3);
  if (!/^[A-Z2-7]{56}$/.test(body)) return null;
  let buf;
  try {
    buf = base32nopad.decode(body);
  } catch {
    return null;
  }
  if (buf.length !== 35) return null;
  const payload = buf.slice(0, 32);
  const h = sha3_256(concat(payload, utf8(prefix)));
  if (h[0] !== buf[32] || h[1] !== buf[33] || h[2] !== buf[34]) return null;
  return { prefix, payload };
}
function sha256d(b) {
  return sha2562(sha2562(b));
}
function b58checkEncode(payload, alphabet2 = base58) {
  const cs = sha256d(payload).slice(0, 4);
  return alphabet2.encode(concat(payload, cs));
}
function b58checkDecode(str, alphabet2 = base58) {
  let raw;
  try {
    raw = alphabet2.decode(str);
  } catch {
    return null;
  }
  if (raw.length < 5) return null;
  const body = raw.slice(0, raw.length - 4), cs = raw.slice(raw.length - 4);
  if (!equalBytes(sha256d(body).slice(0, 4), cs)) return null;
  return body;
}
function eip55(payload20) {
  const hex = bytesToHex(payload20);
  const h = bytesToHex(keccak_256(utf8(hex)));
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  return out;
}
var SS58_PREFIX = utf8("SS58PRE");
function ss58Encode(payload32, prefix = 0) {
  const pre = prefix < 64 ? new Uint8Array([prefix]) : new Uint8Array([(prefix & 252) >> 2 | 64, prefix >> 8 | (prefix & 3) << 6]);
  const body = concat(pre, payload32);
  const cs = blake2b2(concat(SS58_PREFIX, body), { dkLen: 64 }).slice(0, 2);
  return base58.encode(concat(body, cs));
}
function ss58Decode(str) {
  let raw;
  try {
    raw = base58.decode(str);
  } catch {
    return null;
  }
  if (raw.length < 35) return null;
  const preLen = raw[0] < 64 ? 1 : raw[0] & 64 ? 2 : 0;
  if (!preLen) return null;
  if (raw.length !== preLen + 32 + 2) return null;
  const body = raw.slice(0, preLen + 32), cs = raw.slice(preLen + 32);
  const h = blake2b2(concat(SS58_PREFIX, body), { dkLen: 64 });
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
  try {
    d = bech32.decode(lower, 90);
    kind = "bech32";
  } catch {
    try {
      d = bech32m.decode(lower, 90);
      kind = "bech32m";
    } catch {
      return null;
    }
  }
  if (!["bc", "tb", "bcrt"].includes(d.prefix)) return null;
  const version = d.words[0];
  if (version === void 0 || version > 16) return null;
  let program;
  try {
    program = bech32.fromWords(d.words.slice(1));
  } catch {
    return null;
  }
  if (version === 0 && kind !== "bech32") return null;
  if (version !== 0 && kind !== "bech32m") return null;
  if (version === 0 && program.length === 20) return { type: 7, payload: program };
  if (version === 0 && program.length === 32) return { type: 8, payload: program };
  if (version === 1 && program.length === 32) return { type: 9, payload: program };
  return null;
}
var XTZ_PREFIX = new Uint8Array([6, 161, 159]);
function display(typedBytes) {
  const { type, payload } = readTyped(typedBytes, 0);
  switch (type) {
    case 0:
      return zbcEncode(payload, "ZBC");
    case 2:
      return "\u2014";
    case 4:
      return eip55(payload);
    case 5:
      return b58checkEncode(concat(new Uint8Array([0]), payload));
    case 6:
      return b58checkEncode(concat(new Uint8Array([5]), payload));
    case 7:
    case 8:
      return bech32Encode("bc", 0, payload);
    case 9:
      return bech32Encode("bc", 1, payload);
    case 10:
      return zbcEncode(payload, "ZBS");
    case 11:
      return base58.encode(payload);
    case 12:
      return ss58Encode(payload, 0);
    case 13:
      return bech32.encode("addr", bech32.toWords(concat(new Uint8Array([97]), payload)), 200);
    case 14:
      return b58checkEncode(concat(new Uint8Array([0]), payload), base58xrp);
    case 15:
      return b58checkEncode(concat(new Uint8Array([65]), payload));
    case 16:
      return b58checkEncode(concat(XTZ_PREFIX, payload));
    default:
      return bytesToHex(payload);
  }
}
function result(type, payload) {
  const t = typed(type, payload);
  return { type, payload, typed: t, hex: bytesToHex(t), display: display(t) };
}
function parseTypedHex(str) {
  if (typeof str !== "string") return null;
  const s = str.startsWith("0x") ? str.slice(2) : str;
  if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2) return null;
  const b = hexToBytes(s);
  if (b.length < 4) return null;
  const type = readU32le(b, 0);
  const info = ACCOUNT_TYPES[type];
  if (!info || b.length !== 4 + info.len) return null;
  if (type === 2) return null;
  return result(type, b.slice(4));
}
function parseAddress(input, chain2) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  const hexBody = s.startsWith("0x") ? s.slice(2) : s;
  const isHexStr = /^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length % 2 === 0;
  if (chain2) {
    const strict = parseAddressStrict(s, chain2, hexBody, isHexStr);
    if (strict) return strict;
  }
  return parseAddressAuto(s, hexBody, isHexStr);
}
function parseAddressStrict(s, chain2, hexBody, isHexStr) {
  {
    switch (chain2) {
      case "zbc": {
        const z = zbcDecode(s);
        if (z) return result(0, z.payload);
        if (isHexStr && hexBody.length === 64) return result(0, hexToBytes(hexBody));
        return null;
      }
      case "zbs": {
        const z = zbcDecode(s);
        return z ? result(10, z.payload) : null;
      }
      case "eth": {
        if (isHexStr && hexBody.length === 40) return result(4, hexToBytes(hexBody));
        return null;
      }
      case "btc": {
        const b = btcBech32Decode(s);
        if (b) return result(b.type, b.payload);
        const r = b58checkDecode(s);
        if (r && r.length === 21 && r[0] === 0) return result(5, r.slice(1));
        if (r && r.length === 21 && r[0] === 5) return result(6, r.slice(1));
        return null;
      }
      case "sol": {
        try {
          const b = base58.decode(s);
          if (b.length === 32) return result(11, b);
        } catch {
        }
        return null;
      }
      case "dot": {
        const p = ss58Decode(s);
        return p ? result(12, p) : null;
      }
      case "ada":
        return parseCardano(s);
      case "xrp": {
        const r = b58checkDecode(s, base58xrp);
        return r && r.length === 21 && r[0] === 0 ? result(14, r.slice(1)) : null;
      }
      case "trx": {
        const r = b58checkDecode(s);
        return r && r.length === 21 && r[0] === 65 ? result(15, r.slice(1)) : null;
      }
      case "xtz": {
        const r = b58checkDecode(s);
        return r && r.length === 23 && r[0] === 6 && r[1] === 161 && r[2] === 159 ? result(16, r.slice(3)) : null;
      }
      default:
        return null;
    }
  }
}
function parseAddressAuto(s, hexBody, isHexStr) {
  if (isHexStr) {
    const t = parseTypedHex(hexBody);
    if (t) return t;
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return result(4, hexToBytes(s.slice(2)));
  const compact = s.replace(/[\s_\-]/g, "");
  const upper = compact.toUpperCase();
  if (s[3] === "_" || s[3] === "-" || /^Z(BC|BS|NK)[A-Z2-7]{56}$/i.test(compact) || /\s/.test(s.trim())) {
    const z = zbcDecode(s);
    if (z) {
      if (!(s[3] === "_" || s[3] === "-") && !/^Z(BC|BS)[A-Z2-7]{56}$/.test(compact) && !/^z(bc|bs)[a-z2-7]{56}$/.test(compact) && !/\s/.test(s.trim())) return null;
      if (z.prefix === "ZBS") return result(10, z.payload);
      if (z.prefix === "ZBC" || z.prefix === "ZNK") return result(0, z.payload);
      return null;
    }
    if (s[3] === "_" || s[3] === "-") return null;
  }
  void upper;
  if (/^(bc1|tb1|bcrt1)/i.test(s)) {
    const b = btcBech32Decode(s);
    return b ? result(b.type, b.payload) : null;
  }
  if (/^[13]/.test(s) && s.length >= 26 && s.length <= 35) {
    const r = b58checkDecode(s);
    if (r && r.length === 21 && r[0] === 0) return result(5, r.slice(1));
    if (r && r.length === 21 && r[0] === 5) return result(6, r.slice(1));
  }
  if (/^addr1/i.test(s)) return parseCardano(s);
  if (/^T/.test(s) && s.length === 34) {
    const r = b58checkDecode(s);
    if (r && r.length === 21 && r[0] === 65) return result(15, r.slice(1));
  }
  if (/^r/.test(s) && s.length >= 25 && s.length <= 35) {
    const r = b58checkDecode(s, base58xrp);
    if (r && r.length === 21 && r[0] === 0) return result(14, r.slice(1));
  }
  if (/^tz1/.test(s)) {
    const r = b58checkDecode(s);
    if (r && r.length === 23 && r[0] === 6 && r[1] === 161 && r[2] === 159) return result(16, r.slice(3));
  }
  {
    const p = ss58Decode(s);
    if (p) return result(12, p);
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) {
    try {
      const b = base58.decode(s);
      if (b.length === 32) return result(11, b);
    } catch {
    }
  }
  if (isHexStr && hexBody.length === 64 && !s.startsWith("0x")) return result(0, hexToBytes(hexBody));
  return null;
}
function parseCardano(s) {
  let d;
  try {
    d = bech32.decode(s.toLowerCase(), 200);
  } catch {
    return null;
  }
  if (d.prefix !== "addr") return null;
  let b;
  try {
    b = bech32.fromWords(d.words);
  } catch {
    return null;
  }
  if (b.length !== 29 || b[0] !== 97) return null;
  return result(13, b.slice(1));
}
function multisigAddress(min, nonce, participantsTyped) {
  const sorted = [...participantsTyped].sort(compareBytes);
  const { u64le: u642 } = bytes_exports;
  const pre = concat(u32le(min), u642(nonce), u32le(sorted.length), ...sorted);
  return sha3_256(pre);
}
function formatOfType(type) {
  const i = ACCOUNT_TYPES[type];
  return i ? i.format : null;
}

// node_modules/@noble/hashes/esm/hmac.js
var HMAC = class extends Hash {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

// node_modules/@noble/hashes/esm/pbkdf2.js
function pbkdf2Init(hash, _password, _salt, _opts) {
  ahash(hash);
  const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
  const { c, dkLen, asyncTick } = opts;
  anumber(c);
  anumber(dkLen);
  anumber(asyncTick);
  if (c < 1)
    throw new Error("iterations (c) should be >= 1");
  const password = kdfInputToBytes(_password);
  const salt2 = kdfInputToBytes(_salt);
  const DK = new Uint8Array(dkLen);
  const PRF = hmac.create(hash, password);
  const PRFSalt = PRF._cloneInto().update(salt2);
  return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
}
function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
  PRF.destroy();
  PRFSalt.destroy();
  if (prfW)
    prfW.destroy();
  clean(u);
  return DK;
}
function pbkdf2(hash, password, salt2, opts) {
  const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt2, opts);
  let prfW;
  const arr = new Uint8Array(4);
  const view = createView(arr);
  const u = new Uint8Array(PRF.outputLen);
  for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
    const Ti = DK.subarray(pos, pos + PRF.outputLen);
    view.setInt32(0, ti, false);
    (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
    Ti.set(u.subarray(0, Ti.length));
    for (let ui = 1; ui < c; ui++) {
      PRF._cloneInto(prfW).update(u).digestInto(u);
      for (let i = 0; i < Ti.length; i++)
        Ti[i] ^= u[i];
    }
  }
  return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
}

// node_modules/@scure/bip39/esm/index.js
var isJapanese = (wordlist2) => wordlist2[0] === "\u3042\u3044\u3053\u304F\u3057\u3093";
function nfkd(str) {
  if (typeof str !== "string")
    throw new TypeError("invalid mnemonic type: " + typeof str);
  return str.normalize("NFKD");
}
function normalize(str) {
  const norm = nfkd(str);
  const words = norm.split(" ");
  if (![12, 15, 18, 21, 24].includes(words.length))
    throw new Error("Invalid mnemonic");
  return { nfkd: norm, words };
}
function aentropy(ent) {
  abytes(ent, 16, 20, 24, 28, 32);
}
function generateMnemonic(wordlist2, strength = 128) {
  anumber(strength);
  if (strength % 32 !== 0 || strength > 256)
    throw new TypeError("Invalid entropy");
  return entropyToMnemonic(randomBytes2(strength / 8), wordlist2);
}
var calcChecksum = (entropy) => {
  const bitsLeft = 8 - entropy.length / 4;
  return new Uint8Array([sha256(entropy)[0] >> bitsLeft << bitsLeft]);
};
function getCoder(wordlist2) {
  if (!Array.isArray(wordlist2) || wordlist2.length !== 2048 || typeof wordlist2[0] !== "string")
    throw new Error("Wordlist: expected array of 2048 strings");
  wordlist2.forEach((i) => {
    if (typeof i !== "string")
      throw new Error("wordlist: non-string element: " + i);
  });
  return utils.chain(utils.checksum(1, calcChecksum), utils.radix2(11, true), utils.alphabet(wordlist2));
}
function mnemonicToEntropy(mnemonic, wordlist2) {
  const { words } = normalize(mnemonic);
  const entropy = getCoder(wordlist2).decode(words);
  aentropy(entropy);
  return entropy;
}
function entropyToMnemonic(entropy, wordlist2) {
  aentropy(entropy);
  const words = getCoder(wordlist2).encode(entropy);
  return words.join(isJapanese(wordlist2) ? "\u3000" : " ");
}
function validateMnemonic(mnemonic, wordlist2) {
  try {
    mnemonicToEntropy(mnemonic, wordlist2);
  } catch (e) {
    return false;
  }
  return true;
}
var psalt = (passphrase) => nfkd("mnemonic" + passphrase);
function mnemonicToSeedSync(mnemonic, passphrase = "") {
  return pbkdf2(sha512, normalize(mnemonic).nfkd, psalt(passphrase), { c: 2048, dkLen: 64 });
}

// node_modules/@scure/bip39/esm/wordlists/english.js
var wordlist = `abandon
ability
able
about
above
absent
absorb
abstract
absurd
abuse
access
accident
account
accuse
achieve
acid
acoustic
acquire
across
act
action
actor
actress
actual
adapt
add
addict
address
adjust
admit
adult
advance
advice
aerobic
affair
afford
afraid
again
age
agent
agree
ahead
aim
air
airport
aisle
alarm
album
alcohol
alert
alien
all
alley
allow
almost
alone
alpha
already
also
alter
always
amateur
amazing
among
amount
amused
analyst
anchor
ancient
anger
angle
angry
animal
ankle
announce
annual
another
answer
antenna
antique
anxiety
any
apart
apology
appear
apple
approve
april
arch
arctic
area
arena
argue
arm
armed
armor
army
around
arrange
arrest
arrive
arrow
art
artefact
artist
artwork
ask
aspect
assault
asset
assist
assume
asthma
athlete
atom
attack
attend
attitude
attract
auction
audit
august
aunt
author
auto
autumn
average
avocado
avoid
awake
aware
away
awesome
awful
awkward
axis
baby
bachelor
bacon
badge
bag
balance
balcony
ball
bamboo
banana
banner
bar
barely
bargain
barrel
base
basic
basket
battle
beach
bean
beauty
because
become
beef
before
begin
behave
behind
believe
below
belt
bench
benefit
best
betray
better
between
beyond
bicycle
bid
bike
bind
biology
bird
birth
bitter
black
blade
blame
blanket
blast
bleak
bless
blind
blood
blossom
blouse
blue
blur
blush
board
boat
body
boil
bomb
bone
bonus
book
boost
border
boring
borrow
boss
bottom
bounce
box
boy
bracket
brain
brand
brass
brave
bread
breeze
brick
bridge
brief
bright
bring
brisk
broccoli
broken
bronze
broom
brother
brown
brush
bubble
buddy
budget
buffalo
build
bulb
bulk
bullet
bundle
bunker
burden
burger
burst
bus
business
busy
butter
buyer
buzz
cabbage
cabin
cable
cactus
cage
cake
call
calm
camera
camp
can
canal
cancel
candy
cannon
canoe
canvas
canyon
capable
capital
captain
car
carbon
card
cargo
carpet
carry
cart
case
cash
casino
castle
casual
cat
catalog
catch
category
cattle
caught
cause
caution
cave
ceiling
celery
cement
census
century
cereal
certain
chair
chalk
champion
change
chaos
chapter
charge
chase
chat
cheap
check
cheese
chef
cherry
chest
chicken
chief
child
chimney
choice
choose
chronic
chuckle
chunk
churn
cigar
cinnamon
circle
citizen
city
civil
claim
clap
clarify
claw
clay
clean
clerk
clever
click
client
cliff
climb
clinic
clip
clock
clog
close
cloth
cloud
clown
club
clump
cluster
clutch
coach
coast
coconut
code
coffee
coil
coin
collect
color
column
combine
come
comfort
comic
common
company
concert
conduct
confirm
congress
connect
consider
control
convince
cook
cool
copper
copy
coral
core
corn
correct
cost
cotton
couch
country
couple
course
cousin
cover
coyote
crack
cradle
craft
cram
crane
crash
crater
crawl
crazy
cream
credit
creek
crew
cricket
crime
crisp
critic
crop
cross
crouch
crowd
crucial
cruel
cruise
crumble
crunch
crush
cry
crystal
cube
culture
cup
cupboard
curious
current
curtain
curve
cushion
custom
cute
cycle
dad
damage
damp
dance
danger
daring
dash
daughter
dawn
day
deal
debate
debris
decade
december
decide
decline
decorate
decrease
deer
defense
define
defy
degree
delay
deliver
demand
demise
denial
dentist
deny
depart
depend
deposit
depth
deputy
derive
describe
desert
design
desk
despair
destroy
detail
detect
develop
device
devote
diagram
dial
diamond
diary
dice
diesel
diet
differ
digital
dignity
dilemma
dinner
dinosaur
direct
dirt
disagree
discover
disease
dish
dismiss
disorder
display
distance
divert
divide
divorce
dizzy
doctor
document
dog
doll
dolphin
domain
donate
donkey
donor
door
dose
double
dove
draft
dragon
drama
drastic
draw
dream
dress
drift
drill
drink
drip
drive
drop
drum
dry
duck
dumb
dune
during
dust
dutch
duty
dwarf
dynamic
eager
eagle
early
earn
earth
easily
east
easy
echo
ecology
economy
edge
edit
educate
effort
egg
eight
either
elbow
elder
electric
elegant
element
elephant
elevator
elite
else
embark
embody
embrace
emerge
emotion
employ
empower
empty
enable
enact
end
endless
endorse
enemy
energy
enforce
engage
engine
enhance
enjoy
enlist
enough
enrich
enroll
ensure
enter
entire
entry
envelope
episode
equal
equip
era
erase
erode
erosion
error
erupt
escape
essay
essence
estate
eternal
ethics
evidence
evil
evoke
evolve
exact
example
excess
exchange
excite
exclude
excuse
execute
exercise
exhaust
exhibit
exile
exist
exit
exotic
expand
expect
expire
explain
expose
express
extend
extra
eye
eyebrow
fabric
face
faculty
fade
faint
faith
fall
false
fame
family
famous
fan
fancy
fantasy
farm
fashion
fat
fatal
father
fatigue
fault
favorite
feature
february
federal
fee
feed
feel
female
fence
festival
fetch
fever
few
fiber
fiction
field
figure
file
film
filter
final
find
fine
finger
finish
fire
firm
first
fiscal
fish
fit
fitness
fix
flag
flame
flash
flat
flavor
flee
flight
flip
float
flock
floor
flower
fluid
flush
fly
foam
focus
fog
foil
fold
follow
food
foot
force
forest
forget
fork
fortune
forum
forward
fossil
foster
found
fox
fragile
frame
frequent
fresh
friend
fringe
frog
front
frost
frown
frozen
fruit
fuel
fun
funny
furnace
fury
future
gadget
gain
galaxy
gallery
game
gap
garage
garbage
garden
garlic
garment
gas
gasp
gate
gather
gauge
gaze
general
genius
genre
gentle
genuine
gesture
ghost
giant
gift
giggle
ginger
giraffe
girl
give
glad
glance
glare
glass
glide
glimpse
globe
gloom
glory
glove
glow
glue
goat
goddess
gold
good
goose
gorilla
gospel
gossip
govern
gown
grab
grace
grain
grant
grape
grass
gravity
great
green
grid
grief
grit
grocery
group
grow
grunt
guard
guess
guide
guilt
guitar
gun
gym
habit
hair
half
hammer
hamster
hand
happy
harbor
hard
harsh
harvest
hat
have
hawk
hazard
head
health
heart
heavy
hedgehog
height
hello
helmet
help
hen
hero
hidden
high
hill
hint
hip
hire
history
hobby
hockey
hold
hole
holiday
hollow
home
honey
hood
hope
horn
horror
horse
hospital
host
hotel
hour
hover
hub
huge
human
humble
humor
hundred
hungry
hunt
hurdle
hurry
hurt
husband
hybrid
ice
icon
idea
identify
idle
ignore
ill
illegal
illness
image
imitate
immense
immune
impact
impose
improve
impulse
inch
include
income
increase
index
indicate
indoor
industry
infant
inflict
inform
inhale
inherit
initial
inject
injury
inmate
inner
innocent
input
inquiry
insane
insect
inside
inspire
install
intact
interest
into
invest
invite
involve
iron
island
isolate
issue
item
ivory
jacket
jaguar
jar
jazz
jealous
jeans
jelly
jewel
job
join
joke
journey
joy
judge
juice
jump
jungle
junior
junk
just
kangaroo
keen
keep
ketchup
key
kick
kid
kidney
kind
kingdom
kiss
kit
kitchen
kite
kitten
kiwi
knee
knife
knock
know
lab
label
labor
ladder
lady
lake
lamp
language
laptop
large
later
latin
laugh
laundry
lava
law
lawn
lawsuit
layer
lazy
leader
leaf
learn
leave
lecture
left
leg
legal
legend
leisure
lemon
lend
length
lens
leopard
lesson
letter
level
liar
liberty
library
license
life
lift
light
like
limb
limit
link
lion
liquid
list
little
live
lizard
load
loan
lobster
local
lock
logic
lonely
long
loop
lottery
loud
lounge
love
loyal
lucky
luggage
lumber
lunar
lunch
luxury
lyrics
machine
mad
magic
magnet
maid
mail
main
major
make
mammal
man
manage
mandate
mango
mansion
manual
maple
marble
march
margin
marine
market
marriage
mask
mass
master
match
material
math
matrix
matter
maximum
maze
meadow
mean
measure
meat
mechanic
medal
media
melody
melt
member
memory
mention
menu
mercy
merge
merit
merry
mesh
message
metal
method
middle
midnight
milk
million
mimic
mind
minimum
minor
minute
miracle
mirror
misery
miss
mistake
mix
mixed
mixture
mobile
model
modify
mom
moment
monitor
monkey
monster
month
moon
moral
more
morning
mosquito
mother
motion
motor
mountain
mouse
move
movie
much
muffin
mule
multiply
muscle
museum
mushroom
music
must
mutual
myself
mystery
myth
naive
name
napkin
narrow
nasty
nation
nature
near
neck
need
negative
neglect
neither
nephew
nerve
nest
net
network
neutral
never
news
next
nice
night
noble
noise
nominee
noodle
normal
north
nose
notable
note
nothing
notice
novel
now
nuclear
number
nurse
nut
oak
obey
object
oblige
obscure
observe
obtain
obvious
occur
ocean
october
odor
off
offer
office
often
oil
okay
old
olive
olympic
omit
once
one
onion
online
only
open
opera
opinion
oppose
option
orange
orbit
orchard
order
ordinary
organ
orient
original
orphan
ostrich
other
outdoor
outer
output
outside
oval
oven
over
own
owner
oxygen
oyster
ozone
pact
paddle
page
pair
palace
palm
panda
panel
panic
panther
paper
parade
parent
park
parrot
party
pass
patch
path
patient
patrol
pattern
pause
pave
payment
peace
peanut
pear
peasant
pelican
pen
penalty
pencil
people
pepper
perfect
permit
person
pet
phone
photo
phrase
physical
piano
picnic
picture
piece
pig
pigeon
pill
pilot
pink
pioneer
pipe
pistol
pitch
pizza
place
planet
plastic
plate
play
please
pledge
pluck
plug
plunge
poem
poet
point
polar
pole
police
pond
pony
pool
popular
portion
position
possible
post
potato
pottery
poverty
powder
power
practice
praise
predict
prefer
prepare
present
pretty
prevent
price
pride
primary
print
priority
prison
private
prize
problem
process
produce
profit
program
project
promote
proof
property
prosper
protect
proud
provide
public
pudding
pull
pulp
pulse
pumpkin
punch
pupil
puppy
purchase
purity
purpose
purse
push
put
puzzle
pyramid
quality
quantum
quarter
question
quick
quit
quiz
quote
rabbit
raccoon
race
rack
radar
radio
rail
rain
raise
rally
ramp
ranch
random
range
rapid
rare
rate
rather
raven
raw
razor
ready
real
reason
rebel
rebuild
recall
receive
recipe
record
recycle
reduce
reflect
reform
refuse
region
regret
regular
reject
relax
release
relief
rely
remain
remember
remind
remove
render
renew
rent
reopen
repair
repeat
replace
report
require
rescue
resemble
resist
resource
response
result
retire
retreat
return
reunion
reveal
review
reward
rhythm
rib
ribbon
rice
rich
ride
ridge
rifle
right
rigid
ring
riot
ripple
risk
ritual
rival
river
road
roast
robot
robust
rocket
romance
roof
rookie
room
rose
rotate
rough
round
route
royal
rubber
rude
rug
rule
run
runway
rural
sad
saddle
sadness
safe
sail
salad
salmon
salon
salt
salute
same
sample
sand
satisfy
satoshi
sauce
sausage
save
say
scale
scan
scare
scatter
scene
scheme
school
science
scissors
scorpion
scout
scrap
screen
script
scrub
sea
search
season
seat
second
secret
section
security
seed
seek
segment
select
sell
seminar
senior
sense
sentence
series
service
session
settle
setup
seven
shadow
shaft
shallow
share
shed
shell
sheriff
shield
shift
shine
ship
shiver
shock
shoe
shoot
shop
short
shoulder
shove
shrimp
shrug
shuffle
shy
sibling
sick
side
siege
sight
sign
silent
silk
silly
silver
similar
simple
since
sing
siren
sister
situate
six
size
skate
sketch
ski
skill
skin
skirt
skull
slab
slam
sleep
slender
slice
slide
slight
slim
slogan
slot
slow
slush
small
smart
smile
smoke
smooth
snack
snake
snap
sniff
snow
soap
soccer
social
sock
soda
soft
solar
soldier
solid
solution
solve
someone
song
soon
sorry
sort
soul
sound
soup
source
south
space
spare
spatial
spawn
speak
special
speed
spell
spend
sphere
spice
spider
spike
spin
spirit
split
spoil
sponsor
spoon
sport
spot
spray
spread
spring
spy
square
squeeze
squirrel
stable
stadium
staff
stage
stairs
stamp
stand
start
state
stay
steak
steel
stem
step
stereo
stick
still
sting
stock
stomach
stone
stool
story
stove
strategy
street
strike
strong
struggle
student
stuff
stumble
style
subject
submit
subway
success
such
sudden
suffer
sugar
suggest
suit
summer
sun
sunny
sunset
super
supply
supreme
sure
surface
surge
surprise
surround
survey
suspect
sustain
swallow
swamp
swap
swarm
swear
sweet
swift
swim
swing
switch
sword
symbol
symptom
syrup
system
table
tackle
tag
tail
talent
talk
tank
tape
target
task
taste
tattoo
taxi
teach
team
tell
ten
tenant
tennis
tent
term
test
text
thank
that
theme
then
theory
there
they
thing
this
thought
three
thrive
throw
thumb
thunder
ticket
tide
tiger
tilt
timber
time
tiny
tip
tired
tissue
title
toast
tobacco
today
toddler
toe
together
toilet
token
tomato
tomorrow
tone
tongue
tonight
tool
tooth
top
topic
topple
torch
tornado
tortoise
toss
total
tourist
toward
tower
town
toy
track
trade
traffic
tragic
train
transfer
trap
trash
travel
tray
treat
tree
trend
trial
tribe
trick
trigger
trim
trip
trophy
trouble
truck
true
truly
trumpet
trust
truth
try
tube
tuition
tumble
tuna
tunnel
turkey
turn
turtle
twelve
twenty
twice
twin
twist
two
type
typical
ugly
umbrella
unable
unaware
uncle
uncover
under
undo
unfair
unfold
unhappy
uniform
unique
unit
universe
unknown
unlock
until
unusual
unveil
update
upgrade
uphold
upon
upper
upset
urban
urge
usage
use
used
useful
useless
usual
utility
vacant
vacuum
vague
valid
valley
valve
van
vanish
vapor
various
vast
vault
vehicle
velvet
vendor
venture
venue
verb
verify
version
very
vessel
veteran
viable
vibrant
vicious
victory
video
view
village
vintage
violin
virtual
virus
visa
visit
visual
vital
vivid
vocal
voice
void
volcano
volume
vote
voyage
wage
wagon
wait
walk
wall
walnut
want
warfare
warm
warrior
wash
wasp
waste
water
wave
way
wealth
weapon
wear
weasel
weather
web
wedding
weekend
weird
welcome
west
wet
whale
what
wheat
wheel
when
where
whip
whisper
wide
width
wife
wild
will
win
window
wine
wing
wink
winner
winter
wire
wisdom
wise
wish
witness
wolf
woman
wonder
wood
wool
word
work
world
worry
worth
wrap
wreck
wrestle
wrist
write
wrong
yard
year
yellow
you
young
youth
zebra
zero
zone
zoo`.split("\n");

// node_modules/@noble/curves/esm/utils.js
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function _abytes2(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n2 : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex2(bytes));
}
function bytesToNumberLE(bytes) {
  abytes(bytes);
  return hexToNumber(bytesToHex2(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes2(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes2(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
function equalBytes2(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes(bytes) {
  return Uint8Array.from(bytes);
}
var isPosBig = (n) => typeof n === "bigint" && _0n2 <= n;
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n2; n >>= _1n2, len += 1)
    ;
  return len;
}
var bitMask = (n) => (_1n2 << BigInt(n)) - _1n2;
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const u8of = (byte) => Uint8Array.of(byte);
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n(0)) => {
    k = h(u8of(0), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8of(1), seed);
    v = h();
  };
  const gen2 = () => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen2())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
var notImplemented = () => {
  throw new Error("not implemented");
};
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}

// node_modules/@noble/curves/esm/abstract/modular.js
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
var _2n2 = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n2 = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result2 = a % b;
  return result2 >= _0n3 ? result2 : b + result2;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n3)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n3)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n3, y = _1n3, u = _1n3, v = _0n3;
  while (a !== _0n3) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd2 = b;
  if (gcd2 !== _1n3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp2, root, n) {
  if (!Fp2.eql(Fp2.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp2, n) {
  const p1div4 = (Fp2.ORDER + _1n3) / _4n;
  const root = Fp2.pow(n, p1div4);
  assertIsSquare(Fp2, root, n);
  return root;
}
function sqrt5mod8(Fp2, n) {
  const p5div8 = (Fp2.ORDER - _5n) / _8n;
  const n2 = Fp2.mul(n, _2n2);
  const v = Fp2.pow(n2, p5div8);
  const nv = Fp2.mul(n, v);
  const i = Fp2.mul(Fp2.mul(nv, _2n2), v);
  const root = Fp2.mul(nv, Fp2.sub(i, Fp2.ONE));
  assertIsSquare(Fp2, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n2) / _16n;
  return (Fp2, n) => {
    let tv1 = Fp2.pow(n, c4);
    let tv2 = Fp2.mul(tv1, c1);
    const tv3 = Fp2.mul(tv1, c2);
    const tv4 = Fp2.mul(tv1, c3);
    const e1 = Fp2.eql(Fp2.sqr(tv2), n);
    const e2 = Fp2.eql(Fp2.sqr(tv3), n);
    tv1 = Fp2.cmov(tv1, tv2, e1);
    tv2 = Fp2.cmov(tv4, tv3, e2);
    const e3 = Fp2.eql(Fp2.sqr(tv2), n);
    const root = Fp2.cmov(tv1, tv2, e3);
    assertIsSquare(Fp2, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n3;
  let S = 0;
  while (Q % _2n2 === _0n3) {
    Q /= _2n2;
    S++;
  }
  let Z = _2n2;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n3) / _2n2;
  return function tonelliSlow(Fp2, n) {
    if (Fp2.is0(n))
      return n;
    if (FpLegendre(Fp2, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp2.mul(Fp2.ONE, cc);
    let t = Fp2.pow(n, Q);
    let R = Fp2.pow(n, Q1div2);
    while (!Fp2.eql(t, Fp2.ONE)) {
      if (Fp2.is0(t))
        return Fp2.ZERO;
      let i = 1;
      let t_tmp = Fp2.sqr(t);
      while (!Fp2.eql(t_tmp, Fp2.ONE)) {
        i++;
        t_tmp = Fp2.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n3 << BigInt(M - i - 1);
      const b = Fp2.pow(c, exponent);
      M = i;
      c = Fp2.sqr(b);
      t = Fp2.mul(t, c);
      R = Fp2.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var isNegativeLE = (num2, modulo) => (mod(num2, modulo) & _1n3) === _1n3;
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
function FpPow(Fp2, num2, power) {
  if (power < _0n3)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n3)
    return Fp2.ONE;
  if (power === _1n3)
    return num2;
  let p = Fp2.ONE;
  let d = num2;
  while (power > _0n3) {
    if (power & _1n3)
      p = Fp2.mul(p, d);
    d = Fp2.sqr(d);
    power >>= _1n3;
  }
  return p;
}
function FpInvertBatch(Fp2, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp2.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (Fp2.is0(num2))
      return acc;
    inverted[i] = acc;
    return Fp2.mul(acc, num2);
  }, Fp2.ONE);
  const invertedAcc = Fp2.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (Fp2.is0(num2))
      return acc;
    inverted[i] = Fp2.mul(acc, inverted[i]);
    return Fp2.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp2, n) {
  const p1mod2 = (Fp2.ORDER - _1n3) / _2n2;
  const powered = Fp2.pow(n, p1mod2);
  const yes = Fp2.eql(powered, Fp2.ONE);
  const zero2 = Fp2.eql(powered, Fp2.ZERO);
  const no = Fp2.eql(powered, Fp2.neg(Fp2.ONE));
  if (!yes && !zero2 && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero2 ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLenOrOpts, isLE2 = false, opts = {}) {
  if (ORDER <= _0n3)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = void 0;
  let _sqrt = void 0;
  let modFromBytes = false;
  let allowedLengths = void 0;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE2)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE2 = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE: isLE2,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n3,
    ONE: _1n3,
    allowedLengths,
    create: (num2) => mod(num2, ORDER),
    isValid: (num2) => {
      if (typeof num2 !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num2);
      return _0n3 <= num2 && num2 < ORDER;
    },
    is0: (num2) => num2 === _0n3,
    // is valid and invertible
    isValidNot0: (num2) => !f.is0(num2) && f.isValid(num2),
    isOdd: (num2) => (num2 & _1n3) === _1n3,
    neg: (num2) => mod(-num2, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num2) => mod(num2 * num2, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num2, power) => FpPow(f, num2, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num2) => num2 * num2,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num2) => invert(num2, ORDER),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num2) => isLE2 ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES),
    fromBytes: (bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    },
    // TODO: we don't need it here, move out to separate fn
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n3) + _1n3;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// node_modules/@noble/curves/esm/abstract/curve.js
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n4;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n4)
    throw new Error("invalid wNAF");
}
var wNAF = class {
  // Parametrized with a given Point class (not individual point)
  constructor(Point2, bits) {
    this.BASE = Point2.BASE;
    this.ZERO = Point2.ZERO;
    this.Fn = Point2.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n4) {
      if (n & _1n4)
        p = p.add(d);
      d = d.double();
      n >>= _1n4;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point Point instance
   * @param W window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0; window < windows; window++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
   * @param acc accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      if (n === _0n4)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
function mulEndoUnsafe(Point2, point, k1, k2) {
  let acc = point;
  let p1 = Point2.ZERO;
  let p2 = Point2.ZERO;
  while (k1 > _0n4 || k2 > _0n4) {
    if (k1 & _1n4)
      p1 = p1.add(acc);
    if (k2 & _1n4)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n4;
    k2 >>= _1n4;
  }
  return { p1, p2 };
}
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero2 = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero2);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero2;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero2);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero2;
    for (let j = buckets.length - 1, sumI = zero2; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n4))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp2 = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn2 = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp2.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp: Fp2, Fn: Fn2 };
}

// node_modules/@noble/curves/esm/abstract/weierstrass.js
var divNearest = (num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n3) / den;
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n5;
  const k2neg = k2 < _0n5;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n5;
  if (k1 < _0n5 || k1 >= MAX_NUM || k2 < _0n5 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
var DERErr = class extends Error {
  constructor(m = "") {
    super(m);
  }
};
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num2) {
      const { Err: E } = DER;
      if (num2 < _0n5)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num2);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = ensureBytes("signature", hex);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n5 = BigInt(0);
var _1n5 = BigInt(1);
var _2n3 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function _normFnElement(Fn2, key) {
  const { BYTES: expected } = Fn2;
  let num2;
  if (typeof key === "bigint") {
    num2 = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num2 = Fn2.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn2.isValidNot0(num2))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num2;
}
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp: Fp2, Fn: Fn2 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp2.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp2, Fn2);
  function assertCompressionIsSupported() {
    if (!Fp2.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes2(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp2.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp2.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp2.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    _abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp2.fromBytes(tail);
      if (!Fp2.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp2.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp2.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp2.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L2 = Fp2.BYTES;
      const x = Fp2.fromBytes(tail.subarray(0, L2));
      const y = Fp2.fromBytes(tail.subarray(L2, L2 * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes2;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp2.sqr(x);
    const x3 = Fp2.mul(x2, x);
    return Fp2.add(Fp2.add(x3, Fp2.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp2.sqr(y);
    const right = weierstrassEquation(x);
    return Fp2.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp2.mul(Fp2.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp2.mul(Fp2.sqr(CURVE.b), BigInt(27));
  if (Fp2.is0(Fp2.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp2.isValid(n) || banZero && Fp2.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ProjectivePoint expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn2.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp2.eql(Z, Fp2.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp2.ONE : Fp2.inv(Z);
    const x = Fp2.mul(X, iz);
    const y = Fp2.mul(Y, iz);
    const zz = Fp2.mul(Z, iz);
    if (is0)
      return { x: Fp2.ZERO, y: Fp2.ZERO };
    if (!Fp2.eql(zz, Fp2.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp2.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp2.isValid(x) || !Fp2.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point2(Fp2.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  class Point2 {
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point2)
        throw new Error("projective point not allowed");
      if (Fp2.is0(x) && Fp2.is0(y))
        return Point2.ZERO;
      return new Point2(x, y, Fp2.ONE);
    }
    static fromBytes(bytes) {
      const P = Point2.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point2.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp2.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp2.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
      const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point2(this.X, Fp2.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp2.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X1);
      let t1 = Fp2.mul(Y1, Y1);
      let t2 = Fp2.mul(Z1, Z1);
      let t3 = Fp2.mul(X1, Y1);
      t3 = Fp2.add(t3, t3);
      Z3 = Fp2.mul(X1, Z1);
      Z3 = Fp2.add(Z3, Z3);
      X3 = Fp2.mul(a, Z3);
      Y3 = Fp2.mul(b3, t2);
      Y3 = Fp2.add(X3, Y3);
      X3 = Fp2.sub(t1, Y3);
      Y3 = Fp2.add(t1, Y3);
      Y3 = Fp2.mul(X3, Y3);
      X3 = Fp2.mul(t3, X3);
      Z3 = Fp2.mul(b3, Z3);
      t2 = Fp2.mul(a, t2);
      t3 = Fp2.sub(t0, t2);
      t3 = Fp2.mul(a, t3);
      t3 = Fp2.add(t3, Z3);
      Z3 = Fp2.add(t0, t0);
      t0 = Fp2.add(Z3, t0);
      t0 = Fp2.add(t0, t2);
      t0 = Fp2.mul(t0, t3);
      Y3 = Fp2.add(Y3, t0);
      t2 = Fp2.mul(Y1, Z1);
      t2 = Fp2.add(t2, t2);
      t0 = Fp2.mul(t2, t3);
      X3 = Fp2.sub(X3, t0);
      Z3 = Fp2.mul(t2, t1);
      Z3 = Fp2.add(Z3, Z3);
      Z3 = Fp2.add(Z3, Z3);
      return new Point2(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      const a = CURVE.a;
      const b3 = Fp2.mul(CURVE.b, _3n2);
      let t0 = Fp2.mul(X1, X2);
      let t1 = Fp2.mul(Y1, Y2);
      let t2 = Fp2.mul(Z1, Z2);
      let t3 = Fp2.add(X1, Y1);
      let t4 = Fp2.add(X2, Y2);
      t3 = Fp2.mul(t3, t4);
      t4 = Fp2.add(t0, t1);
      t3 = Fp2.sub(t3, t4);
      t4 = Fp2.add(X1, Z1);
      let t5 = Fp2.add(X2, Z2);
      t4 = Fp2.mul(t4, t5);
      t5 = Fp2.add(t0, t2);
      t4 = Fp2.sub(t4, t5);
      t5 = Fp2.add(Y1, Z1);
      X3 = Fp2.add(Y2, Z2);
      t5 = Fp2.mul(t5, X3);
      X3 = Fp2.add(t1, t2);
      t5 = Fp2.sub(t5, X3);
      Z3 = Fp2.mul(a, t4);
      X3 = Fp2.mul(b3, t2);
      Z3 = Fp2.add(X3, Z3);
      X3 = Fp2.sub(t1, Z3);
      Z3 = Fp2.add(t1, Z3);
      Y3 = Fp2.mul(X3, Z3);
      t1 = Fp2.add(t0, t0);
      t1 = Fp2.add(t1, t0);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.mul(b3, t4);
      t1 = Fp2.add(t1, t2);
      t2 = Fp2.sub(t0, t2);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.add(t4, t2);
      t0 = Fp2.mul(t1, t4);
      Y3 = Fp2.add(Y3, t0);
      t0 = Fp2.mul(t5, t4);
      X3 = Fp2.mul(t3, X3);
      X3 = Fp2.sub(X3, t0);
      t0 = Fp2.mul(t3, t1);
      Z3 = Fp2.mul(t5, Z3);
      Z3 = Fp2.add(Z3, t0);
      return new Point2(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point2.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn2.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point2, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point2, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn2.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n5 || p.is0())
        return Point2.ZERO;
      if (sc === _1n5)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point2, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? void 0 : sum;
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n5)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point2, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n5)
        return this;
      if (clearCofactor)
        return clearCofactor(Point2, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point2, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex2(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(Point2, points);
    }
    static msm(points, scalars) {
      return pippenger(Point2, Fn2, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return Point2.BASE.multiply(_normFnElement(Fn2, privateKey));
    }
  }
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp2.ONE);
  Point2.ZERO = new Point2(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
  Point2.Fp = Fp2;
  Point2.Fn = Fn2;
  const bits = Fn2.BITS;
  const wnaf = new wNAF(Point2, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point2.BASE.precompute(8);
  return Point2;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp2, Fn2) {
  return {
    secretKey: Fn2.BYTES,
    publicKey: 1 + Fp2.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp2.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn2.BYTES
  };
}
function ecdh(Point2, ecdhOpts = {}) {
  const { Fn: Fn2 } = Point2;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes2;
  const lengths = Object.assign(getWLengths(Point2.Fp, Fn2), { seed: getMinHashLength(Fn2.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn2, secretKey);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point2.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn2.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point2.BASE.multiply(_normFnElement(Fn2, secretKey)).toBytes(isCompressed);
  }
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point2)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn2.allowedLengths || secretKey === publicKey)
      return void 0;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn2, secretKeyA);
    const b = Point2.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils2 = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    // TODO: remove
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: (key) => _normFnElement(Fn2, key),
    precompute(windowSize = 8, point = Point2.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point: Point2, utils: utils2, lengths });
}
function ecdsa(Point2, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes3 = ecdsaOpts.randomBytes || randomBytes2;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
  const { Fp: Fp2, Fn: Fn2 } = Point2;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn2;
  const { keygen, getPublicKey, getSharedSecret, utils: utils2, lengths } = ecdh(Point2, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: void 0,
    //'compact' as ECDSASigFormat,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n5;
    return number > HALF;
  }
  function validateRS(title, num2) {
    if (!Fn2.isValidNot0(num2))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num2;
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return _abytes2(bytes, sizer, `${format} signature`);
  }
  class Signature {
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L2 = Fn2.BYTES;
      const r = bytes.subarray(0, L2);
      const s = bytes.subarray(L2, L2 * 2);
      return new Signature(Fn2.fromBytes(r), Fn2.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes2(hex), format);
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp2.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n3 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp2.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp2.toBytes(radj);
      const R = Point2.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
      const ir = Fn2.inv(radj);
      const h = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn2.create(-h * ir);
      const u2 = Fn2.create(s * ir);
      const Q = Point2.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes2(DER.hexFromSig(this));
      const r = Fn2.toBytes(this.r);
      const s = Fn2.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes(r, s);
    }
    toHex(format) {
      return bytesToHex2(this.toBytes(format));
    }
    // TODO: remove
    assertValidity() {
    }
    static fromCompact(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, Fn2.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex2(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex2(this.toBytes("compact"));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num2 = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn2.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num2) {
    aInRange("num < 2^" + fnBits, num2, _0n5, ORDER_MASK);
    return Fn2.toBytes(num2);
  }
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, void 0, "message");
    return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
  }
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn2, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes3(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn2.isValidNot0(k))
        return;
      const ik = Fn2.inv(k);
      const q = Point2.BASE.multiply(k).toAffine();
      const r = Fn2.create(q.x);
      if (r === _0n5)
        return;
      const s = Fn2.create(ik * Fn2.create(m + r * d));
      if (s === _0n5)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n5);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn2.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn2.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  function tryParsingSig(sg) {
    let sig = void 0;
    const isHex2 = typeof sg === "string" || isBytes(sg);
    const isObj = !isHex2 && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex2 && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex2) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === void 0 ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P = Point2.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn2.inv(s);
      const u1 = Fn2.create(h * is);
      const u2 = Fn2.create(r * is);
      const R = Point2.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn2.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils: utils2,
    lengths,
    Point: Point2,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp2 = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
  const Fn2 = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp: Fp2,
    Fn: Fn2,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point2 = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point2,
    CURVE: Object.assign({}, c, nLength(Point2.Fn.ORDER, Point2.Fn.BITS))
  });
}
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point2 = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point2, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}

// node_modules/@noble/curves/esm/_shortw_utils.js
function createCurve(curveDef, defHash) {
  const create = (hash) => weierstrass({ ...curveDef, hash });
  return { ...create(defHash), create };
}

// node_modules/@noble/curves/esm/secp256k1.js
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n6 = /* @__PURE__ */ BigInt(0);
var _1n6 = /* @__PURE__ */ BigInt(1);
var _2n4 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n4 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n4, P) * b3 % P;
  const b9 = pow2(b6, _3n4, P) * b3 % P;
  const b11 = pow2(b9, _2n4, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n4, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n4, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(utf8ToBytes(tag));
    tagP = concatBytes(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes(tagP, ...messages));
}
var pointToBytes = (point) => point.toBytes(true).slice(1);
var Pointk1 = /* @__PURE__ */ (() => secp256k1.Point)();
var hasEven = (y) => y % _2n4 === _0n6;
function schnorrGetExtPubKey(priv) {
  const { Fn: Fn2, BASE } = Pointk1;
  const d_ = _normFnElement(Fn2, priv);
  const p = BASE.multiply(d_);
  const scalar = hasEven(p.y) ? d_ : Fn2.neg(d_);
  return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
  const Fp2 = Fpk1;
  if (!Fp2.isValidNot0(x))
    throw new Error("invalid x: Fail if x \u2265 p");
  const xx = Fp2.create(x * x);
  const c = Fp2.create(xx * x + BigInt(7));
  let y = Fp2.sqrt(c);
  if (!hasEven(y))
    y = Fp2.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = randomBytes2(32)) {
  const { Fn: Fn2 } = Pointk1;
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = Fn2.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(rand);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn2.toBytes(Fn2.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const { Fn: Fn2, BASE } = Pointk1;
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n6, secp256k1_CURVE.p))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n6, secp256k1_CURVE.n))
      return false;
    const e = challenge(Fn2.toBytes(r), pointToBytes(P), m);
    const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn2.neg(e)));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = (seed = randomBytes2(seedLength)) => {
    return mapHashToField(seed, secp256k1_CURVE.n);
  };
  secp256k1.utils.randomSecretKey;
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: schnorrGetPublicKey(secretKey) };
  }
  return {
    keygen,
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: {
      randomSecretKey,
      randomPrivateKey: randomSecretKey,
      taggedHash,
      // TODO: remove
      lift_x,
      pointToBytes,
      numberToBytesBE,
      bytesToNumberBE,
      mod
    },
    lengths: {
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    }
  };
})();

// node_modules/@noble/hashes/esm/legacy.js
var Rho160 = /* @__PURE__ */ Uint8Array.from([
  7,
  4,
  13,
  1,
  10,
  6,
  15,
  3,
  12,
  0,
  9,
  5,
  2,
  14,
  11,
  8
]);
var Id160 = /* @__PURE__ */ (() => Uint8Array.from(new Array(16).fill(0).map((_, i) => i)))();
var Pi160 = /* @__PURE__ */ (() => Id160.map((i) => (9 * i + 5) % 16))();
var idxLR = /* @__PURE__ */ (() => {
  const L2 = [Id160];
  const R = [Pi160];
  const res = [L2, R];
  for (let i = 0; i < 4; i++)
    for (let j of res)
      j.push(j[i].map((k) => Rho160[k]));
  return res;
})();
var idxL = /* @__PURE__ */ (() => idxLR[0])();
var idxR = /* @__PURE__ */ (() => idxLR[1])();
var shifts160 = /* @__PURE__ */ [
  [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
  [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
  [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
  [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
  [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5]
].map((i) => Uint8Array.from(i));
var shiftsL160 = /* @__PURE__ */ idxL.map((idx, i) => idx.map((j) => shifts160[i][j]));
var shiftsR160 = /* @__PURE__ */ idxR.map((idx, i) => idx.map((j) => shifts160[i][j]));
var Kl160 = /* @__PURE__ */ Uint32Array.from([
  0,
  1518500249,
  1859775393,
  2400959708,
  2840853838
]);
var Kr160 = /* @__PURE__ */ Uint32Array.from([
  1352829926,
  1548603684,
  1836072691,
  2053994217,
  0
]);
function ripemd_f(group, x, y, z) {
  if (group === 0)
    return x ^ y ^ z;
  if (group === 1)
    return x & y | ~x & z;
  if (group === 2)
    return (x | ~y) ^ z;
  if (group === 3)
    return x & z | y & ~z;
  return x ^ (y | ~z);
}
var BUF_160 = /* @__PURE__ */ new Uint32Array(16);
var RIPEMD160 = class extends HashMD {
  constructor() {
    super(64, 20, 8, true);
    this.h0 = 1732584193 | 0;
    this.h1 = 4023233417 | 0;
    this.h2 = 2562383102 | 0;
    this.h3 = 271733878 | 0;
    this.h4 = 3285377520 | 0;
  }
  get() {
    const { h0, h1, h2, h3, h4 } = this;
    return [h0, h1, h2, h3, h4];
  }
  set(h0, h1, h2, h3, h4) {
    this.h0 = h0 | 0;
    this.h1 = h1 | 0;
    this.h2 = h2 | 0;
    this.h3 = h3 | 0;
    this.h4 = h4 | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      BUF_160[i] = view.getUint32(offset, true);
    let al = this.h0 | 0, ar = al, bl = this.h1 | 0, br = bl, cl = this.h2 | 0, cr = cl, dl = this.h3 | 0, dr = dl, el = this.h4 | 0, er = el;
    for (let group = 0; group < 5; group++) {
      const rGroup = 4 - group;
      const hbl = Kl160[group], hbr = Kr160[group];
      const rl = idxL[group], rr = idxR[group];
      const sl = shiftsL160[group], sr = shiftsR160[group];
      for (let i = 0; i < 16; i++) {
        const tl = rotl(al + ripemd_f(group, bl, cl, dl) + BUF_160[rl[i]] + hbl, sl[i]) + el | 0;
        al = el, el = dl, dl = rotl(cl, 10) | 0, cl = bl, bl = tl;
      }
      for (let i = 0; i < 16; i++) {
        const tr = rotl(ar + ripemd_f(rGroup, br, cr, dr) + BUF_160[rr[i]] + hbr, sr[i]) + er | 0;
        ar = er, er = dr, dr = rotl(cr, 10) | 0, cr = br, br = tr;
      }
    }
    this.set(this.h1 + cl + dr | 0, this.h2 + dl + er | 0, this.h3 + el + ar | 0, this.h4 + al + br | 0, this.h0 + bl + cr | 0);
  }
  roundClean() {
    clean(BUF_160);
  }
  destroy() {
    this.destroyed = true;
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0);
  }
};
var ripemd160 = /* @__PURE__ */ createHasher(() => new RIPEMD160());

// node_modules/@scure/bip32/lib/esm/index.js
var Point = secp256k1.ProjectivePoint;
var base58check = createBase58check(sha256);
function bytesToNumber(bytes) {
  abytes(bytes);
  const h = bytes.length === 0 ? "0" : bytesToHex2(bytes);
  return BigInt("0x" + h);
}
function numberToBytes(num2) {
  if (typeof num2 !== "bigint")
    throw new Error("bigint expected");
  return hexToBytes2(num2.toString(16).padStart(64, "0"));
}
var MASTER_SECRET = utf8ToBytes("Bitcoin seed");
var BITCOIN_VERSIONS = { private: 76066276, public: 76067358 };
var HARDENED_OFFSET = 2147483648;
var hash160 = (data) => ripemd160(sha256(data));
var fromU32 = (data) => createView(data).getUint32(0, false);
var toU32 = (n) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > 2 ** 32 - 1) {
    throw new Error("invalid number, should be from 0 to 2**32-1, got " + n);
  }
  const buf = new Uint8Array(4);
  createView(buf).setUint32(0, n, false);
  return buf;
};
var HDKey = class _HDKey {
  get fingerprint() {
    if (!this.pubHash) {
      throw new Error("No publicKey set!");
    }
    return fromU32(this.pubHash);
  }
  get identifier() {
    return this.pubHash;
  }
  get pubKeyHash() {
    return this.pubHash;
  }
  get privateKey() {
    return this.privKeyBytes || null;
  }
  get publicKey() {
    return this.pubKey || null;
  }
  get privateExtendedKey() {
    const priv = this.privateKey;
    if (!priv) {
      throw new Error("No private key");
    }
    return base58check.encode(this.serialize(this.versions.private, concatBytes(new Uint8Array([0]), priv)));
  }
  get publicExtendedKey() {
    if (!this.pubKey) {
      throw new Error("No public key");
    }
    return base58check.encode(this.serialize(this.versions.public, this.pubKey));
  }
  static fromMasterSeed(seed, versions = BITCOIN_VERSIONS) {
    abytes(seed);
    if (8 * seed.length < 128 || 8 * seed.length > 512) {
      throw new Error("HDKey: seed length must be between 128 and 512 bits; 256 bits is advised, got " + seed.length);
    }
    const I = hmac(sha512, MASTER_SECRET, seed);
    return new _HDKey({
      versions,
      chainCode: I.slice(32),
      privateKey: I.slice(0, 32)
    });
  }
  static fromExtendedKey(base58key, versions = BITCOIN_VERSIONS) {
    const keyBuffer = base58check.decode(base58key);
    const keyView = createView(keyBuffer);
    const version = keyView.getUint32(0, false);
    const opt = {
      versions,
      depth: keyBuffer[4],
      parentFingerprint: keyView.getUint32(5, false),
      index: keyView.getUint32(9, false),
      chainCode: keyBuffer.slice(13, 45)
    };
    const key = keyBuffer.slice(45);
    const isPriv = key[0] === 0;
    if (version !== versions[isPriv ? "private" : "public"]) {
      throw new Error("Version mismatch");
    }
    if (isPriv) {
      return new _HDKey({ ...opt, privateKey: key.slice(1) });
    } else {
      return new _HDKey({ ...opt, publicKey: key });
    }
  }
  static fromJSON(json) {
    return _HDKey.fromExtendedKey(json.xpriv);
  }
  constructor(opt) {
    this.depth = 0;
    this.index = 0;
    this.chainCode = null;
    this.parentFingerprint = 0;
    if (!opt || typeof opt !== "object") {
      throw new Error("HDKey.constructor must not be called directly");
    }
    this.versions = opt.versions || BITCOIN_VERSIONS;
    this.depth = opt.depth || 0;
    this.chainCode = opt.chainCode || null;
    this.index = opt.index || 0;
    this.parentFingerprint = opt.parentFingerprint || 0;
    if (!this.depth) {
      if (this.parentFingerprint || this.index) {
        throw new Error("HDKey: zero depth with non-zero index/parent fingerprint");
      }
    }
    if (opt.publicKey && opt.privateKey) {
      throw new Error("HDKey: publicKey and privateKey at same time.");
    }
    if (opt.privateKey) {
      if (!secp256k1.utils.isValidPrivateKey(opt.privateKey)) {
        throw new Error("Invalid private key");
      }
      this.privKey = typeof opt.privateKey === "bigint" ? opt.privateKey : bytesToNumber(opt.privateKey);
      this.privKeyBytes = numberToBytes(this.privKey);
      this.pubKey = secp256k1.getPublicKey(opt.privateKey, true);
    } else if (opt.publicKey) {
      this.pubKey = Point.fromHex(opt.publicKey).toRawBytes(true);
    } else {
      throw new Error("HDKey: no public or private key provided");
    }
    this.pubHash = hash160(this.pubKey);
  }
  derive(path) {
    if (!/^[mM]'?/.test(path)) {
      throw new Error('Path must start with "m" or "M"');
    }
    if (/^[mM]'?$/.test(path)) {
      return this;
    }
    const parts = path.replace(/^[mM]'?\//, "").split("/");
    let child = this;
    for (const c of parts) {
      const m = /^(\d+)('?)$/.exec(c);
      const m1 = m && m[1];
      if (!m || m.length !== 3 || typeof m1 !== "string")
        throw new Error("invalid child index: " + c);
      let idx = +m1;
      if (!Number.isSafeInteger(idx) || idx >= HARDENED_OFFSET) {
        throw new Error("Invalid index");
      }
      if (m[2] === "'") {
        idx += HARDENED_OFFSET;
      }
      child = child.deriveChild(idx);
    }
    return child;
  }
  deriveChild(index) {
    if (!this.pubKey || !this.chainCode) {
      throw new Error("No publicKey or chainCode set");
    }
    let data = toU32(index);
    if (index >= HARDENED_OFFSET) {
      const priv = this.privateKey;
      if (!priv) {
        throw new Error("Could not derive hardened child key");
      }
      data = concatBytes(new Uint8Array([0]), priv, data);
    } else {
      data = concatBytes(this.pubKey, data);
    }
    const I = hmac(sha512, this.chainCode, data);
    const childTweak = bytesToNumber(I.slice(0, 32));
    const chainCode = I.slice(32);
    if (!secp256k1.utils.isValidPrivateKey(childTweak)) {
      throw new Error("Tweak bigger than curve order");
    }
    const opt = {
      versions: this.versions,
      chainCode,
      depth: this.depth + 1,
      parentFingerprint: this.fingerprint,
      index
    };
    try {
      if (this.privateKey) {
        const added = mod(this.privKey + childTweak, secp256k1.CURVE.n);
        if (!secp256k1.utils.isValidPrivateKey(added)) {
          throw new Error("The tweak was out of range or the resulted private key is invalid");
        }
        opt.privateKey = added;
      } else {
        const added = Point.fromHex(this.pubKey).add(Point.fromPrivateKey(childTweak));
        if (added.equals(Point.ZERO)) {
          throw new Error("The tweak was equal to negative P, which made the result key invalid");
        }
        opt.publicKey = added.toRawBytes(true);
      }
      return new _HDKey(opt);
    } catch (err) {
      return this.deriveChild(index + 1);
    }
  }
  sign(hash) {
    if (!this.privateKey) {
      throw new Error("No privateKey set!");
    }
    abytes(hash, 32);
    return secp256k1.sign(hash, this.privKey).toCompactRawBytes();
  }
  verify(hash, signature) {
    abytes(hash, 32);
    abytes(signature, 64);
    if (!this.publicKey) {
      throw new Error("No publicKey set!");
    }
    let sig;
    try {
      sig = secp256k1.Signature.fromCompact(signature);
    } catch (error) {
      return false;
    }
    return secp256k1.verify(sig, hash, this.publicKey);
  }
  wipePrivateData() {
    this.privKey = void 0;
    if (this.privKeyBytes) {
      this.privKeyBytes.fill(0);
      this.privKeyBytes = void 0;
    }
    return this;
  }
  toJSON() {
    return {
      xpriv: this.privateExtendedKey,
      xpub: this.publicExtendedKey
    };
  }
  serialize(version, key) {
    if (!this.chainCode) {
      throw new Error("No chainCode set");
    }
    abytes(key, 33);
    return concatBytes(toU32(version), new Uint8Array([this.depth]), toU32(this.parentFingerprint), toU32(this.index), this.chainCode, key);
  }
};

// node_modules/@noble/hashes/esm/sha512.js
var sha5122 = sha512;

// node_modules/@noble/hashes/esm/ripemd160.js
var ripemd1602 = ripemd160;

// node_modules/@noble/curves/esm/abstract/edwards.js
var _0n7 = BigInt(0);
var _1n7 = BigInt(1);
var _2n5 = BigInt(2);
var _8n2 = BigInt(8);
function isEdValidXY(Fp2, CURVE, x, y) {
  const x2 = Fp2.sqr(x);
  const y2 = Fp2.sqr(y);
  const left = Fp2.add(Fp2.mul(CURVE.a, x2), y2);
  const right = Fp2.add(Fp2.ONE, Fp2.mul(CURVE.d, Fp2.mul(x2, y2)));
  return Fp2.eql(left, right);
}
function edwards(params, extraOpts = {}) {
  const validated = _createCurveFields("edwards", params, extraOpts, extraOpts.FpFnLE);
  const { Fp: Fp2, Fn: Fn2 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  _validateObject(extraOpts, {}, { uvRatio: "function" });
  const MASK = _2n5 << BigInt(Fn2.BYTES * 8) - _1n7;
  const modP = (n) => Fp2.create(n);
  const uvRatio2 = extraOpts.uvRatio || ((u, v) => {
    try {
      return { isValid: true, value: Fp2.sqrt(Fp2.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n7 };
    }
  });
  if (!isEdValidXY(Fp2, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n7 : _0n7;
    aInRange("coordinate " + title, n, min, MASK);
    return n;
  }
  function aextpoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ExtendedPoint expected");
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? _8n2 : Fp2.inv(Z);
    const x = modP(X * iz);
    const y = modP(Y * iz);
    const zz = Fp2.mul(Z, iz);
    if (is0)
      return { x: _0n7, y: _1n7 };
    if (zz !== _1n7)
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    const { a, d } = CURVE;
    if (p.is0())
      throw new Error("bad point: ZERO");
    const { X, Y, Z, T } = p;
    const X2 = modP(X * X);
    const Y2 = modP(Y * Y);
    const Z2 = modP(Z * Z);
    const Z4 = modP(Z2 * Z2);
    const aX2 = modP(X2 * a);
    const left = modP(Z2 * modP(aX2 + Y2));
    const right = modP(Z4 + modP(d * modP(X2 * Y2)));
    if (left !== right)
      throw new Error("bad point: equation left != right (1)");
    const XY = modP(X * Y);
    const ZT = modP(Z * T);
    if (XY !== ZT)
      throw new Error("bad point: equation left != right (2)");
    return true;
  });
  class Point2 {
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      if (p instanceof Point2)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point2(x, y, _1n7, modP(x * y));
    }
    // Uses algo from RFC8032 5.1.3.
    static fromBytes(bytes, zip215 = false) {
      const len = Fp2.BYTES;
      const { a, d } = CURVE;
      bytes = copyBytes(_abytes2(bytes, len, "point"));
      _abool2(zip215, "zip215");
      const normed = copyBytes(bytes);
      const lastByte = bytes[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp2.ORDER;
      aInRange("point.y", y, _0n7, max);
      const y2 = modP(y * y);
      const u = modP(y2 - _1n7);
      const v = modP(d * y2 - a);
      let { isValid, value: x } = uvRatio2(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = (x & _1n7) === _1n7;
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && x === _0n7 && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = modP(-x);
      return Point2.fromAffine({ x, y });
    }
    static fromHex(bytes, zip215 = false) {
      return Point2.fromBytes(ensureBytes("point", bytes), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_2n5);
      return this;
    }
    // Useful in fromAffine() - not for fromBytes(), which always created valid points.
    assertValidity() {
      assertValidMemo(this);
    }
    // Compare one point to another.
    equals(other) {
      aextpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = modP(X1 * Z2);
      const X2Z1 = modP(X2 * Z1);
      const Y1Z2 = modP(Y1 * Z2);
      const Y2Z1 = modP(Y2 * Z1);
      return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
    }
    is0() {
      return this.equals(Point2.ZERO);
    }
    negate() {
      return new Point2(modP(-this.X), this.Y, this.Z, modP(-this.T));
    }
    // Fast algo for doubling Extended Point.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
    // Cost: 4M + 4S + 1*a + 6add + 1*2.
    double() {
      const { a } = CURVE;
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = modP(X1 * X1);
      const B = modP(Y1 * Y1);
      const C = modP(_2n5 * modP(Z1 * Z1));
      const D = modP(a * A);
      const x1y1 = X1 + Y1;
      const E = modP(modP(x1y1 * x1y1) - A - B);
      const G = D + B;
      const F = G - C;
      const H = D - B;
      const X3 = modP(E * F);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F * G);
      return new Point2(X3, Y3, Z3, T3);
    }
    // Fast algo for adding 2 Extended Points.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
    // Cost: 9M + 1*a + 1*d + 7add.
    add(other) {
      aextpoint(other);
      const { a, d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = modP(X1 * X2);
      const B = modP(Y1 * Y2);
      const C = modP(T1 * d * T2);
      const D = modP(Z1 * Z2);
      const E = modP((X1 + Y1) * (X2 + Y2) - A - B);
      const F = D - C;
      const G = D + C;
      const H = modP(B - a * A);
      const X3 = modP(E * F);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F * G);
      return new Point2(X3, Y3, Z3, T3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    // Constant-time multiplication.
    multiply(scalar) {
      if (!Fn2.isValidNot0(scalar))
        throw new Error("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.cached(this, scalar, (p2) => normalizeZ(Point2, p2));
      return normalizeZ(Point2, [p, f])[0];
    }
    // Non-constant-time multiplication. Uses double-and-add algorithm.
    // It's faster, but should only be used when you don't care about
    // an exposed private key e.g. sig verification.
    // Does NOT allow scalars higher than CURVE.n.
    // Accepts optional accumulator to merge with multiply (important for sparse scalars)
    multiplyUnsafe(scalar, acc = Point2.ZERO) {
      if (!Fn2.isValid(scalar))
        throw new Error("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n7)
        return Point2.ZERO;
      if (this.is0() || scalar === _1n7)
        return this;
      return wnaf.unsafe(this, scalar, (p) => normalizeZ(Point2, p), acc);
    }
    // Checks if point is of small order.
    // If you add something to small order point, you will have "dirty"
    // point with torsion component.
    // Multiplies point by cofactor and checks if the result is 0.
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    // Multiplies point by curve order and checks if the result is 0.
    // Returns `false` is the point is dirty.
    isTorsionFree() {
      return wnaf.unsafe(this, CURVE.n).is0();
    }
    // Converts Extended point to default (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    clearCofactor() {
      if (cofactor === _1n7)
        return this;
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes = Fp2.toBytes(y);
      bytes[bytes.length - 1] |= x & _1n7 ? 128 : 0;
      return bytes;
    }
    toHex() {
      return bytesToHex2(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get ex() {
      return this.X;
    }
    get ey() {
      return this.Y;
    }
    get ez() {
      return this.Z;
    }
    get et() {
      return this.T;
    }
    static normalizeZ(points) {
      return normalizeZ(Point2, points);
    }
    static msm(points, scalars) {
      return pippenger(Point2, Fn2, points, scalars);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    toRawBytes() {
      return this.toBytes();
    }
  }
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, _1n7, modP(CURVE.Gx * CURVE.Gy));
  Point2.ZERO = new Point2(_0n7, _1n7, _1n7, _0n7);
  Point2.Fp = Fp2;
  Point2.Fn = Fn2;
  const wnaf = new wNAF(Point2, Fn2.BITS);
  Point2.BASE.precompute(8);
  return Point2;
}
var PrimeEdwardsPoint = class {
  constructor(ep) {
    this.ep = ep;
  }
  // Static methods that must be implemented by subclasses
  static fromBytes(_bytes) {
    notImplemented();
  }
  static fromHex(_hex) {
    notImplemented();
  }
  get x() {
    return this.toAffine().x;
  }
  get y() {
    return this.toAffine().y;
  }
  // Common implementations
  clearCofactor() {
    return this;
  }
  assertValidity() {
    this.ep.assertValidity();
  }
  toAffine(invertedZ) {
    return this.ep.toAffine(invertedZ);
  }
  toHex() {
    return bytesToHex2(this.toBytes());
  }
  toString() {
    return this.toHex();
  }
  isTorsionFree() {
    return true;
  }
  isSmallOrder() {
    return false;
  }
  add(other) {
    this.assertSame(other);
    return this.init(this.ep.add(other.ep));
  }
  subtract(other) {
    this.assertSame(other);
    return this.init(this.ep.subtract(other.ep));
  }
  multiply(scalar) {
    return this.init(this.ep.multiply(scalar));
  }
  multiplyUnsafe(scalar) {
    return this.init(this.ep.multiplyUnsafe(scalar));
  }
  double() {
    return this.init(this.ep.double());
  }
  negate() {
    return this.init(this.ep.negate());
  }
  precompute(windowSize, isLazy) {
    return this.init(this.ep.precompute(windowSize, isLazy));
  }
  /** @deprecated use `toBytes` */
  toRawBytes() {
    return this.toBytes();
  }
};
function eddsa(Point2, cHash, eddsaOpts = {}) {
  if (typeof cHash !== "function")
    throw new Error('"hash" function param is required');
  _validateObject(eddsaOpts, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    mapToCurve: "function"
  });
  const { prehash } = eddsaOpts;
  const { BASE, Fp: Fp2, Fn: Fn2 } = Point2;
  const randomBytes3 = eddsaOpts.randomBytes || randomBytes2;
  const adjustScalarBytes2 = eddsaOpts.adjustScalarBytes || ((bytes) => bytes);
  const domain = eddsaOpts.domain || ((data, ctx, phflag) => {
    _abool2(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  });
  function modN_LE(hash) {
    return Fn2.create(bytesToNumberLE(hash));
  }
  function getPrivateScalar(key) {
    const len = lengths.secretKey;
    key = ensureBytes("private key", key, len);
    const hashed = ensureBytes("hashed private key", cHash(key), 2 * len);
    const head = adjustScalarBytes2(hashed.slice(0, len));
    const prefix = hashed.slice(len, 2 * len);
    const scalar = modN_LE(head);
    return { head, prefix, scalar };
  }
  function getExtendedPublicKey(secretKey) {
    const { head, prefix, scalar } = getPrivateScalar(secretKey);
    const point = BASE.multiply(scalar);
    const pointBytes = point.toBytes();
    return { head, prefix, scalar, point, pointBytes };
  }
  function getPublicKey(secretKey) {
    return getExtendedPublicKey(secretKey).pointBytes;
  }
  function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
    const msg = concatBytes(...msgs);
    return modN_LE(cHash(domain(msg, ensureBytes("context", context), !!prehash)));
  }
  function sign(msg, secretKey, options = {}) {
    msg = ensureBytes("message", msg);
    if (prehash)
      msg = prehash(msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
    const r = hashDomainToScalar(options.context, prefix, msg);
    const R = BASE.multiply(r).toBytes();
    const k = hashDomainToScalar(options.context, R, pointBytes, msg);
    const s = Fn2.create(r + k * scalar);
    if (!Fn2.isValid(s))
      throw new Error("sign failed: invalid s");
    const rs = concatBytes(R, Fn2.toBytes(s));
    return _abytes2(rs, lengths.signature, "result");
  }
  const verifyOpts = { zip215: true };
  function verify(sig, msg, publicKey, options = verifyOpts) {
    const { context, zip215 } = options;
    const len = lengths.signature;
    sig = ensureBytes("signature", sig, len);
    msg = ensureBytes("message", msg);
    publicKey = ensureBytes("publicKey", publicKey, lengths.publicKey);
    if (zip215 !== void 0)
      _abool2(zip215, "zip215");
    if (prehash)
      msg = prehash(msg);
    const mid = len / 2;
    const r = sig.subarray(0, mid);
    const s = bytesToNumberLE(sig.subarray(mid, len));
    let A, R, SB;
    try {
      A = Point2.fromBytes(publicKey, zip215);
      R = Point2.fromBytes(r, zip215);
      SB = BASE.multiplyUnsafe(s);
    } catch (error) {
      return false;
    }
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = hashDomainToScalar(context, R.toBytes(), A.toBytes(), msg);
    const RkA = R.add(A.multiplyUnsafe(k));
    return RkA.subtract(SB).clearCofactor().is0();
  }
  const _size = Fp2.BYTES;
  const lengths = {
    secretKey: _size,
    publicKey: _size,
    signature: 2 * _size,
    seed: _size
  };
  function randomSecretKey(seed = randomBytes3(lengths.seed)) {
    return _abytes2(seed, lengths.seed, "seed");
  }
  function keygen(seed) {
    const secretKey = utils2.randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  function isValidSecretKey(key) {
    return isBytes(key) && key.length === Fn2.BYTES;
  }
  function isValidPublicKey(key, zip215) {
    try {
      return !!Point2.fromBytes(key, zip215);
    } catch (error) {
      return false;
    }
  }
  const utils2 = {
    getExtendedPublicKey,
    randomSecretKey,
    isValidSecretKey,
    isValidPublicKey,
    /**
     * Converts ed public key to x public key. Uses formula:
     * - ed25519:
     *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
     *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
     * - ed448:
     *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
     *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
     */
    toMontgomery(publicKey) {
      const { y } = Point2.fromBytes(publicKey);
      const size = lengths.publicKey;
      const is25519 = size === 32;
      if (!is25519 && size !== 57)
        throw new Error("only defined for 25519 and 448");
      const u = is25519 ? Fp2.div(_1n7 + y, _1n7 - y) : Fp2.div(y - _1n7, y + _1n7);
      return Fp2.toBytes(u);
    },
    toMontgomerySecret(secretKey) {
      const size = lengths.secretKey;
      _abytes2(secretKey, size);
      const hashed = cHash(secretKey.subarray(0, size));
      return adjustScalarBytes2(hashed).subarray(0, size);
    },
    /** @deprecated */
    randomPrivateKey: randomSecretKey,
    /** @deprecated */
    precompute(windowSize = 8, point = Point2.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({
    keygen,
    getPublicKey,
    sign,
    verify,
    utils: utils2,
    Point: Point2,
    lengths
  });
}
function _eddsa_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    d: c.d,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp2 = c.Fp;
  const Fn2 = Field(CURVE.n, c.nBitLength, true);
  const curveOpts = { Fp: Fp2, Fn: Fn2, uvRatio: c.uvRatio };
  const eddsaOpts = {
    randomBytes: c.randomBytes,
    adjustScalarBytes: c.adjustScalarBytes,
    domain: c.domain,
    prehash: c.prehash,
    mapToCurve: c.mapToCurve
  };
  return { CURVE, curveOpts, hash: c.hash, eddsaOpts };
}
function _eddsa_new_output_to_legacy(c, eddsa2) {
  const Point2 = eddsa2.Point;
  const legacy = Object.assign({}, eddsa2, {
    ExtendedPoint: Point2,
    CURVE: c,
    nBitLength: Point2.Fn.BITS,
    nByteLength: Point2.Fn.BYTES
  });
  return legacy;
}
function twistedEdwards(c) {
  const { CURVE, curveOpts, hash, eddsaOpts } = _eddsa_legacy_opts_to_new(c);
  const Point2 = edwards(CURVE, curveOpts);
  const EDDSA = eddsa(Point2, hash, eddsaOpts);
  return _eddsa_new_output_to_legacy(c, EDDSA);
}

// node_modules/@noble/curves/esm/ed25519.js
var _0n8 = /* @__PURE__ */ BigInt(0);
var _1n8 = BigInt(1);
var _2n6 = BigInt(2);
var _3n3 = BigInt(3);
var _5n2 = BigInt(5);
var _8n3 = BigInt(8);
var ed25519_CURVE_p = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
var ed25519_CURVE = /* @__PURE__ */ (() => ({
  p: ed25519_CURVE_p,
  n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
  h: _8n3,
  a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
  d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
  Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
  Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
}))();
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n6, P) * b2 % P;
  const b5 = pow2(b4, _1n8, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n6, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
function uvRatio(u, v) {
  const P = ed25519_CURVE_p;
  const v3 = mod(v * v * v, P);
  const v7 = mod(v3 * v3 * v, P);
  const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
  let x = mod(u * v3 * pow, P);
  const vx2 = mod(v * x * x, P);
  const root1 = x;
  const root2 = mod(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u, P);
  const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
var Fp = /* @__PURE__ */ (() => Field(ed25519_CURVE.p, { isLE: true }))();
var Fn = /* @__PURE__ */ (() => Field(ed25519_CURVE.n, { isLE: true }))();
var ed25519Defaults = /* @__PURE__ */ (() => ({
  ...ed25519_CURVE,
  Fp,
  hash: sha512,
  adjustScalarBytes,
  // dom2
  // Ratio of u to v. Allows us to combine inversion and square root. Uses algo from RFC8032 5.1.3.
  // Constant-time, u/√v
  uvRatio
}))();
var ed25519 = /* @__PURE__ */ (() => twistedEdwards(ed25519Defaults))();
var SQRT_M1 = ED25519_SQRT_M1;
var SQRT_AD_MINUS_ONE = /* @__PURE__ */ BigInt("25063068953384623474111414158702152701244531502492656460079210482610430750235");
var INVSQRT_A_MINUS_D = /* @__PURE__ */ BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578");
var ONE_MINUS_D_SQ = /* @__PURE__ */ BigInt("1159843021668779879193775521855586647937357759715417654439879720876111806838");
var D_MINUS_ONE_SQ = /* @__PURE__ */ BigInt("40440834346308536858101042469323190826248399146238708352240133220865137265952");
var invertSqrt = (number) => uvRatio(_1n8, number);
var MAX_255B = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
var bytes255ToNumberLE = (bytes) => ed25519.Point.Fp.create(bytesToNumberLE(bytes) & MAX_255B);
function calcElligatorRistrettoMap(r0) {
  const { d } = ed25519_CURVE;
  const P = ed25519_CURVE_p;
  const mod3 = (n) => Fp.create(n);
  const r = mod3(SQRT_M1 * r0 * r0);
  const Ns = mod3((r + _1n8) * ONE_MINUS_D_SQ);
  let c = BigInt(-1);
  const D = mod3((c - d * r) * mod3(r + d));
  let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D);
  let s_ = mod3(s * r0);
  if (!isNegativeLE(s_, P))
    s_ = mod3(-s_);
  if (!Ns_D_is_sq)
    s = s_;
  if (!Ns_D_is_sq)
    c = r;
  const Nt = mod3(c * (r - _1n8) * D_MINUS_ONE_SQ - D);
  const s2 = s * s;
  const W0 = mod3((s + s) * D);
  const W1 = mod3(Nt * SQRT_AD_MINUS_ONE);
  const W2 = mod3(_1n8 - s2);
  const W3 = mod3(_1n8 + s2);
  return new ed25519.Point(mod3(W0 * W3), mod3(W2 * W1), mod3(W1 * W3), mod3(W0 * W2));
}
function ristretto255_map(bytes) {
  abytes(bytes, 64);
  const r1 = bytes255ToNumberLE(bytes.subarray(0, 32));
  const R1 = calcElligatorRistrettoMap(r1);
  const r2 = bytes255ToNumberLE(bytes.subarray(32, 64));
  const R2 = calcElligatorRistrettoMap(r2);
  return new _RistrettoPoint(R1.add(R2));
}
var _RistrettoPoint = class __RistrettoPoint extends PrimeEdwardsPoint {
  constructor(ep) {
    super(ep);
  }
  static fromAffine(ap) {
    return new __RistrettoPoint(ed25519.Point.fromAffine(ap));
  }
  assertSame(other) {
    if (!(other instanceof __RistrettoPoint))
      throw new Error("RistrettoPoint expected");
  }
  init(ep) {
    return new __RistrettoPoint(ep);
  }
  /** @deprecated use `import { ristretto255_hasher } from '@noble/curves/ed25519.js';` */
  static hashToCurve(hex) {
    return ristretto255_map(ensureBytes("ristrettoHash", hex, 64));
  }
  static fromBytes(bytes) {
    abytes(bytes, 32);
    const { a, d } = ed25519_CURVE;
    const P = ed25519_CURVE_p;
    const mod3 = (n) => Fp.create(n);
    const s = bytes255ToNumberLE(bytes);
    if (!equalBytes2(Fp.toBytes(s), bytes) || isNegativeLE(s, P))
      throw new Error("invalid ristretto255 encoding 1");
    const s2 = mod3(s * s);
    const u1 = mod3(_1n8 + a * s2);
    const u2 = mod3(_1n8 - a * s2);
    const u1_2 = mod3(u1 * u1);
    const u2_2 = mod3(u2 * u2);
    const v = mod3(a * d * u1_2 - u2_2);
    const { isValid, value: I } = invertSqrt(mod3(v * u2_2));
    const Dx = mod3(I * u2);
    const Dy = mod3(I * Dx * v);
    let x = mod3((s + s) * Dx);
    if (isNegativeLE(x, P))
      x = mod3(-x);
    const y = mod3(u1 * Dy);
    const t = mod3(x * y);
    if (!isValid || isNegativeLE(t, P) || y === _0n8)
      throw new Error("invalid ristretto255 encoding 2");
    return new __RistrettoPoint(new ed25519.Point(x, y, _1n8, t));
  }
  /**
   * Converts ristretto-encoded string to ristretto point.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode).
   * @param hex Ristretto-encoded 32 bytes. Not every 32-byte string is valid ristretto encoding
   */
  static fromHex(hex) {
    return __RistrettoPoint.fromBytes(ensureBytes("ristrettoHex", hex, 32));
  }
  static msm(points, scalars) {
    return pippenger(__RistrettoPoint, ed25519.Point.Fn, points, scalars);
  }
  /**
   * Encodes ristretto point to Uint8Array.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode).
   */
  toBytes() {
    let { X, Y, Z, T } = this.ep;
    const P = ed25519_CURVE_p;
    const mod3 = (n) => Fp.create(n);
    const u1 = mod3(mod3(Z + Y) * mod3(Z - Y));
    const u2 = mod3(X * Y);
    const u2sq = mod3(u2 * u2);
    const { value: invsqrt } = invertSqrt(mod3(u1 * u2sq));
    const D1 = mod3(invsqrt * u1);
    const D2 = mod3(invsqrt * u2);
    const zInv = mod3(D1 * D2 * T);
    let D;
    if (isNegativeLE(T * zInv, P)) {
      let _x = mod3(Y * SQRT_M1);
      let _y = mod3(X * SQRT_M1);
      X = _x;
      Y = _y;
      D = mod3(D1 * INVSQRT_A_MINUS_D);
    } else {
      D = D2;
    }
    if (isNegativeLE(X * zInv, P))
      Y = mod3(-Y);
    let s = mod3((Z - Y) * D);
    if (isNegativeLE(s, P))
      s = mod3(-s);
    return Fp.toBytes(s);
  }
  /**
   * Compares two Ristretto points.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals).
   */
  equals(other) {
    this.assertSame(other);
    const { X: X1, Y: Y1 } = this.ep;
    const { X: X2, Y: Y2 } = other.ep;
    const mod3 = (n) => Fp.create(n);
    const one = mod3(X1 * Y2) === mod3(Y1 * X2);
    const two = mod3(Y1 * Y2) === mod3(X1 * X2);
    return one || two;
  }
  is0() {
    return this.equals(__RistrettoPoint.ZERO);
  }
};
_RistrettoPoint.BASE = /* @__PURE__ */ (() => new _RistrettoPoint(ed25519.Point.BASE))();
_RistrettoPoint.ZERO = /* @__PURE__ */ (() => new _RistrettoPoint(ed25519.Point.ZERO))();
_RistrettoPoint.Fp = /* @__PURE__ */ (() => Fp)();
_RistrettoPoint.Fn = /* @__PURE__ */ (() => Fn)();
var RistrettoPoint = _RistrettoPoint;

// src/lib/sr25519.js
var L = ed25519.CURVE.n;
var STROBE_R = 166;
var FLAG_I = 1;
var FLAG_A = 2;
var FLAG_C = 4;
var FLAG_T = 8;
var FLAG_M = 16;
var FLAG_K = 32;
var Strobe128 = class _Strobe128 {
  constructor(label) {
    this.state = new Uint8Array(200);
    this.words = new Uint32Array(this.state.buffer);
    this.pos = 0;
    this.posBegin = 0;
    this.curFlags = 0;
    this.state.set([1, STROBE_R + 2, 1, 0, 1, 96], 0);
    this.state.set(utf8("STROBEv1.0.2"), 6);
    this.runF(true);
    this.metaAd(label, false);
  }
  runF(init = false) {
    if (!init) {
      this.state[this.pos] ^= this.posBegin;
      this.state[this.pos + 1] ^= 4;
      this.state[STROBE_R + 1] ^= 128;
    }
    keccakP(this.words, 24);
    this.pos = 0;
    this.posBegin = 0;
  }
  absorb(data) {
    for (let i = 0; i < data.length; i++) {
      this.state[this.pos++] ^= data[i];
      if (this.pos === STROBE_R) this.runF();
    }
  }
  overwrite(data) {
    for (let i = 0; i < data.length; i++) {
      this.state[this.pos++] = data[i];
      if (this.pos === STROBE_R) this.runF();
    }
  }
  squeeze(n) {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = this.state[this.pos];
      this.state[this.pos++] = 0;
      if (this.pos === STROBE_R) this.runF();
    }
    return out;
  }
  beginOp(flags, more) {
    if (more) {
      if (this.curFlags !== flags) throw new Error("strobe: flag mismatch");
      return;
    }
    if (flags & FLAG_T) throw new Error("strobe: T flag unsupported");
    const oldBegin = this.posBegin;
    this.posBegin = this.pos + 1;
    this.curFlags = flags;
    this.absorb(new Uint8Array([oldBegin, flags]));
    const forceF = (flags & (FLAG_C | FLAG_K)) !== 0;
    if (forceF && this.pos !== 0) this.runF();
  }
  metaAd(data, more) {
    this.beginOp(FLAG_M | FLAG_A, more);
    this.absorb(data);
  }
  ad(data, more) {
    this.beginOp(FLAG_A, more);
    this.absorb(data);
  }
  prf(n, more) {
    this.beginOp(FLAG_I | FLAG_A | FLAG_C, more);
    return this.squeeze(n);
  }
  key(data, more) {
    this.beginOp(FLAG_A | FLAG_C, more);
    this.overwrite(data);
  }
  clone() {
    const c = Object.create(_Strobe128.prototype);
    c.state = this.state.slice();
    c.words = new Uint32Array(c.state.buffer);
    c.pos = this.pos;
    c.posBegin = this.posBegin;
    c.curFlags = this.curFlags;
    return c;
  }
};
var Transcript = class {
  constructor(label) {
    this.s = new Strobe128(utf8("Merlin v1.0"));
    this.appendMessage("dom-sep", label);
  }
  appendMessage(label, message) {
    if (typeof label === "string") label = utf8(label);
    if (typeof message === "string") message = utf8(message);
    this.s.metaAd(label, false);
    this.s.metaAd(u32le(message.length), true);
    this.s.ad(message, false);
  }
  challengeBytes(label, n) {
    if (typeof label === "string") label = utf8(label);
    this.s.metaAd(label, false);
    this.s.metaAd(u32le(n), true);
    return this.s.prf(n, false);
  }
  /** Merlin TranscriptRng: rekeyed with witness bytes and fresh randomness. */
  witnessBytes(label, nonceSeeds, n, rng = randomBytes) {
    if (typeof label === "string") label = utf8(label);
    const s = this.s.clone();
    for (const ns of nonceSeeds) {
      s.metaAd(label, false);
      s.metaAd(u32le(ns.length), true);
      s.key(ns, false);
    }
    const r = rng(32);
    s.metaAd(utf8("rng"), false);
    s.key(r, false);
    s.metaAd(u32le(n), false);
    return s.prf(n, false);
  }
};
function leToBigInt(b) {
  let v = 0n;
  for (let i = b.length - 1; i >= 0; i--) v = v << 8n | BigInt(b[i]);
  return v;
}
function bigIntToLe32(v) {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
var mod2 = (a) => (a % L + L) % L;
function scalarFromWide(b64) {
  return mod2(leToBigInt(b64));
}
function sr25519FromMiniSecret(mini) {
  if (mini.length !== 32) throw new Error("mini secret must be 32 bytes");
  const r = sha5122(mini);
  const key = r.slice(0, 32);
  key[0] &= 248;
  key[31] &= 63;
  key[31] |= 64;
  const scalar = mod2(leToBigInt(key) >> 3n);
  const nonce = r.slice(32, 64);
  const publicKey = RistrettoPoint.BASE.multiply(scalar).toRawBytes();
  return { key: scalar, nonce, publicKey };
}
function signingTranscript(context, message, publicKey) {
  const t = new Transcript("SigningContext");
  t.appendMessage("", context);
  t.appendMessage("sign-bytes", message);
  t.appendMessage("proto-name", "Schnorr-sig");
  t.appendMessage("sign:pk", publicKey);
  return t;
}
function sr25519Sign(secret, message, context = "substrate") {
  const t = signingTranscript(utf8(context), message, secret.publicKey);
  const rBytes = t.witnessBytes("signing", [secret.nonce], 64);
  const r = scalarFromWide(rBytes);
  const R = RistrettoPoint.BASE.multiply(r).toRawBytes();
  t.appendMessage("sign:R", R);
  const k = scalarFromWide(t.challengeBytes("sign:c", 64));
  const s = mod2(k * secret.key + r);
  const sig = concat(R, bigIntToLe32(s));
  sig[63] |= 128;
  return sig;
}
function sr25519Verify(publicKey, message, signature, context = "substrate") {
  if (signature.length !== 64 || !(signature[63] & 128)) return false;
  const R = signature.slice(0, 32);
  const sBytes = signature.slice(32, 64);
  sBytes[31] &= 127;
  const s = leToBigInt(sBytes);
  if (s >= L) return false;
  const t = signingTranscript(utf8(context), message, publicKey);
  t.appendMessage("sign:R", R);
  const k = scalarFromWide(t.challengeBytes("sign:c", 64));
  let pk;
  try {
    pk = RistrettoPoint.fromHex(publicKey);
  } catch {
    return false;
  }
  const Rp = RistrettoPoint.BASE.multiply(s).subtract(pk.multiply(k)).toRawBytes();
  return Rp.every((b, i) => b === R[i]);
}
function sr25519HardDerive(mini, chainCode) {
  const secret = sr25519FromMiniSecret(mini);
  const t = new Transcript("SchnorrRistrettoHDKD");
  t.appendMessage("sign-bytes", new Uint8Array(0));
  t.appendMessage("chain-code", chainCode);
  t.appendMessage("secret-key", bigIntToLe32(secret.key));
  const msk = t.challengeBytes("HDKD-hard", 32);
  t.challengeBytes("HDKD-chaincode", 32);
  return msk;
}
function junctionIndex(n) {
  const cc = new Uint8Array(32);
  cc.set(u64le(n), 0);
  return cc;
}

// src/lib/keys.js
function newMnemonic(words = 24) {
  return generateMnemonic(wordlist, words === 12 ? 128 : words === 15 ? 160 : words === 18 ? 192 : words === 21 ? 224 : 256);
}
function isValidMnemonic(m) {
  return validateMnemonic(normalizeMnemonic(m), wordlist);
}
function normalizeMnemonic(m) {
  return String(m || "").normalize("NFKD").trim().toLowerCase().split(/\s+/).join(" ");
}
function bip39Seed(mnemonic, passphrase = "") {
  return mnemonicToSeedSync(normalizeMnemonic(mnemonic), passphrase.normalize("NFKD"));
}
function slip10Ed25519(seed, indices) {
  let I = hmac(sha5122, utf8("ed25519 seed"), seed);
  let k = I.slice(0, 32), c = I.slice(32);
  for (const idx of indices) {
    const i = idx >>> 0 | 2147483648;
    const data = concat(new Uint8Array([0]), k, new Uint8Array([i >>> 24 & 255, i >>> 16 & 255, i >>> 8 & 255, i & 255]));
    I = hmac(sha5122, c, data);
    k = I.slice(0, 32);
    c = I.slice(32);
  }
  return k;
}
function derivationPath(format, btc, index) {
  switch (format) {
    case "ZBC":
      return `m/44'/883'/${index}'`;
    case "SOL":
      return `m/44'/501'/${index}'/0'`;
    case "ADA":
      return `m/44'/1815'/${index}'`;
    case "XTZ":
      return `m/44'/1729'/${index}'`;
    case "DOT":
      return index ? `//${index}` : "(mini secret, no path)";
    case "ETH":
    case "BNB":
      return `m/44'/60'/0'/0/${index}`;
    case "TRX":
      return `m/44'/195'/0'/0/${index}`;
    case "XRP":
      return `m/44'/144'/0'/0/${index}`;
    case "BTC":
      return btc === "legacy" ? `m/44'/0'/0'/0/${index}` : btc === "taproot" ? `m/86'/0'/0'/0/${index}` : `m/84'/0'/0'/0/${index}`;
    default:
      throw new Error("unknown format " + format);
  }
}
function hardenedIndices(path) {
  return path.split("/").slice(1).map((p) => parseInt(p, 10));
}
function deriveSecret({ mnemonic, passphrase = "" }, format, btc, index = 0) {
  const path = derivationPath(format, btc, index);
  switch (format) {
    case "ZBC":
    case "SOL":
    case "ADA":
    case "XTZ": {
      const seed = bip39Seed(mnemonic, passphrase);
      const k = slip10Ed25519(seed, hardenedIndices(path));
      zero(seed);
      return k;
    }
    case "DOT": {
      const entropy = mnemonicToEntropy(normalizeMnemonic(mnemonic), wordlist);
      let mini = pbkdf2(sha5122, entropy, utf8("mnemonic" + passphrase.normalize("NFKD")), { c: 2048, dkLen: 64 }).slice(0, 32);
      if (index) mini = sr25519HardDerive(mini, junctionIndex(index));
      return mini;
    }
    default: {
      const seed = bip39Seed(mnemonic, passphrase);
      const hd = HDKey.fromMasterSeed(seed);
      const child = hd.derive(path);
      const k = new Uint8Array(child.privateKey);
      zero(seed);
      child.wipePrivateData();
      return k;
    }
  }
}
function hash1602(b) {
  return ripemd1602(sha2562(b));
}
var N = secp256k1.CURVE.n;
function bytesToBig(b) {
  let v = 0n;
  for (const x of b) v = v << 8n | BigInt(x);
  return v;
}
function bigToBytes32(v) {
  return hexToBytes(v.toString(16).padStart(64, "0"));
}
function taprootTweak(priv) {
  const comp = secp256k1.getPublicKey(priv, true);
  let d = bytesToBig(priv);
  if (comp[0] === 3) d = N - d;
  const internal = comp.slice(1);
  const t = bytesToBig(schnorr.utils.taggedHash("TapTweak", internal));
  const tweaked = bigToBytes32((d + t) % N);
  return { secret: tweaked, outputKey: schnorr.getPublicKey(tweaked) };
}
function accountFromSecret(secret, format, btc) {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new Error("secret must be 32 bytes");
  const type = typeForFormat(format, btc);
  let publicKey, payload, signingSecret = secret;
  switch (format) {
    case "ZBC":
    case "SOL":
      publicKey = ed25519.getPublicKey(secret);
      payload = publicKey;
      break;
    case "ADA":
      publicKey = ed25519.getPublicKey(secret);
      payload = blake2b2(publicKey, { dkLen: 28 });
      break;
    case "XTZ":
      publicKey = ed25519.getPublicKey(secret);
      payload = blake2b2(publicKey, { dkLen: 20 });
      break;
    case "DOT":
      publicKey = sr25519FromMiniSecret(secret).publicKey;
      payload = publicKey;
      break;
    case "ETH":
    case "BNB":
    case "TRX": {
      if (bytesToBig(secret) === 0n || bytesToBig(secret) >= N) throw new Error("invalid secp256k1 key");
      publicKey = secp256k1.getPublicKey(secret, false);
      payload = keccak_256(publicKey.slice(1)).slice(12);
      break;
    }
    case "XRP":
      publicKey = secp256k1.getPublicKey(secret, true);
      payload = hash1602(publicKey);
      break;
    case "BTC": {
      if (btc === "taproot") {
        const t2 = taprootTweak(secret);
        signingSecret = t2.secret;
        publicKey = t2.outputKey;
        payload = t2.outputKey;
      } else {
        publicKey = secp256k1.getPublicKey(secret, true);
        payload = hash1602(publicKey);
      }
      break;
    }
    default:
      throw new Error("unknown format " + format);
  }
  const t = typed(type, payload);
  return { format, btc: format === "BTC" ? btc || "segwit" : void 0, type, publicKey, payload, typed: t, hex: bytesToHex(t), address: display(t), signingSecret };
}
function parseRawKey(hex) {
  const s = String(hex || "").trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(s)) return null;
  return hexToBytes(s);
}
function deriveAccount(seed, format, btc, index) {
  const secret = deriveSecret(seed, format, btc, index);
  const acc = accountFromSecret(secret, format, btc);
  return { ...acc, index, path: derivationPath(format, btc, index) };
}

// src/lib/sign.js
function sha256d2(b) {
  return sha2562(sha2562(b));
}
function signDigest(secret, format, btc, digest) {
  const acc = accountFromSecret(secret, format, btc);
  switch (format) {
    case "ZBC":
    case "SOL":
      return ed25519.sign(digest, secret);
    case "ADA":
    case "XTZ":
      return concat(u16le(32), acc.publicKey, ed25519.sign(digest, secret));
    case "DOT":
      return sr25519Sign(sr25519FromMiniSecret(secret), digest);
    case "ETH":
    case "BNB":
    case "TRX": {
      const sig = secp256k1.sign(keccak_256(digest), secret, { lowS: true });
      return concat(sig.toCompactRawBytes(), new Uint8Array([sig.recovery + 27]));
    }
    case "XRP": {
      const sig = secp256k1.sign(sha256d2(digest), secret, { lowS: true });
      return concat(u16le(33), acc.publicKey, sig.toCompactRawBytes());
    }
    case "BTC": {
      if (btc === "taproot") return schnorr.sign(digest, acc.signingSecret);
      const sig = secp256k1.sign(sha256d2(digest), secret, { lowS: true });
      return concat(u16le(33), acc.publicKey, sig.toCompactRawBytes());
    }
    default:
      throw new Error("unknown format " + format);
  }
}
function signRawEd25519(secret, bytes) {
  return ed25519.sign(bytes, secret);
}
function verifyRawEd25519(publicKey, bytes, sig) {
  try {
    return ed25519.verify(sig, bytes, publicKey);
  } catch {
    return false;
  }
}
function verifyDigest(format, btc, payload, digest, sig) {
  try {
    switch (format) {
      case "ZBC":
      case "SOL":
        return sig.length === 64 && ed25519.verify(sig, digest, payload);
      case "ADA":
      case "XTZ": {
        if (sig.length !== 98 || sig[0] !== 32 || sig[1] !== 0) return false;
        const pub = sig.slice(2, 34), s = sig.slice(34);
        const acc = pubToPayload(format, pub);
        return acc.every((b, i) => b === payload[i]) && ed25519.verify(s, digest, pub);
      }
      case "DOT":
        return sr25519Verify(payload, digest, sig);
      case "ETH":
      case "BNB":
      case "TRX": {
        if (sig.length !== 65) return false;
        const s = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(sig[64] - 27);
        const pub = s.recoverPublicKey(keccak_256(digest)).toRawBytes(false);
        const addr2 = keccak_256(pub.slice(1)).slice(12);
        return addr2.every((b, i) => b === payload[i]);
      }
      case "XRP":
      case "BTC": {
        if (btc === "taproot") return sig.length === 64 && schnorr.verify(sig, digest, payload);
        if (sig.length !== 99 || sig[0] !== 33 || sig[1] !== 0) return false;
        const pub = sig.slice(2, 35), s = sig.slice(35);
        const h = pubToPayload(format === "XRP" ? "XRP" : "BTC", pub);
        return h.every((b, i) => b === payload[i]) && secp256k1.verify(s, sha256d2(digest), pub);
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
function pubToPayload(format, pub) {
  if (format === "ADA") return blake2b2(pub, { dkLen: 28 });
  if (format === "XTZ") return blake2b2(pub, { dkLen: 20 });
  return ripemd1602(sha2562(pub));
}

// src/lib/zbc.js
var DEFAULT_TAG = "ZBC-TX";
function txDigest(unsigned, genesis, tag = DEFAULT_TAG) {
  if (!genesis || genesis.length !== 32) throw new Error("genesis hash must be 32 bytes");
  return sha3_256(concat(utf8(tag), genesis, unsigned));
}
function txDigestV1(unsigned) {
  return sha3_256(unsigned);
}
function txHash(unsigned, signature) {
  return sha3_256(concat(unsigned, signature));
}
function messageDigest(message, genesis) {
  return sha3_256(concat(utf8("ZBC-MSG"), genesis, u32le(message.length), message));
}
function groupConsentDigest(kind, { controller, member, validUntil, seq, genesis }) {
  const tag = kind === "group-link" ? "ZBC-GROUP-LINK" : kind === "group-control" ? "ZBC-GROUP-CONTROL" : null;
  if (!tag) throw new Error("unknown consent kind");
  return sha3_256(concat(utf8(tag), genesis, u8(controller.length), controller, u8(member.length), member, u32le(validUntil), u32le(seq)));
}
function consentProof(kind, sig) {
  return concat(u8(kind), u16le(sig.length), sig);
}
function relayPermitMessage({ from, to, exp }) {
  return utf8(`ZBC-RELAY-PERMIT-v1|${from}|${to}|${exp}`);
}
function feeVoteInfo({ recentBlockHash, height, feeVote }) {
  const h = typeof recentBlockHash === "string" ? hexToBytes(recentBlockHash) : recentBlockHash;
  if (h.length !== 32) throw new Error("recentBlockHash must be 32 bytes");
  return concat(h, u32le(height), u64le(BigInt(feeVote)));
}
function genesisShort(genesisHex) {
  return (genesisHex || "").toUpperCase().slice(0, 16) + "\u2026";
}
function buildPayload(tx, signatureHex) {
  const senderHex = tx.sender.type === 0 ? bytesToHex(tx.sender.payload) : bytesToHex(tx.sender.typed);
  const recipientHex = !tx.recipient ? "" : tx.recipient.type === 0 ? bytesToHex(tx.recipient.payload) : bytesToHex(tx.recipient.typed);
  const obj = {
    version: tx.version,
    ...tx.version >= 2 ? { survival: (tx.survival ?? 0n).toString() } : {},
    timestamp: Number(tx.timestamp),
    sender_account_address: senderHex,
    recipient_account_address: recipientHex,
    transaction_type: tx.type,
    fee: "__FEE__",
    transaction_body_bytes: bytesToHex(tx.body),
    signature: signatureHex
  };
  if (tx.message && tx.message.length) {
    obj.message_hex = bytesToHex(tx.message);
    obj.message_encrypted = !!tx.encrypted;
  }
  if (tx.escrow) {
    obj.escrow = {
      approver_address: bytesToHex(tx.escrow.approver.typed),
      commission: "__COMMISSION__",
      timeout: "__TIMEOUT__",
      instruction: tx.escrow.instruction
    };
    if (tx.escrow.multiParty) {
      obj.escrow.multi_party = true;
      obj.escrow.escrow_request_id = "__REQID__";
      obj.escrow.co_signer_signature = bytesToHex(tx.escrow.cosig);
    }
  }
  let json = JSON.stringify(obj);
  json = json.replace('"__FEE__"', tx.fee.toString());
  if (tx.escrow) {
    json = json.replace('"__COMMISSION__"', tx.escrow.commission.toString()).replace('"__TIMEOUT__"', tx.escrow.timeout.toString());
    if (tx.escrow.multiParty) json = json.replace('"__REQID__"', tx.escrow.requestId.toString());
  }
  return json;
}

// src/lib/decoder.js
var decoder_exports = {};
__export(decoder_exports, {
  BODY: () => BODY,
  ZBE1: () => ZBE1,
  decodeTransaction: () => decodeTransaction,
  fieldTree: () => fieldTree,
  plain: () => plain,
  typeName: () => typeName
});
var ZBE1 = [90, 66, 69, 49];
function account(r, what) {
  const a = readTyped(r.b, r.o);
  r.o += a.length;
  return { type: a.type, payload: a.payload, typed: a.typed, hex: bytesToHex(a.typed), display: display(a.typed) };
}
function decodeTransaction(bytes, opts = {}) {
  if (!(bytes instanceof Uint8Array)) throw new DecodeError("bytes expected");
  const r = new Reader(bytes);
  const type = r.u32("type");
  const version = r.u8("version");
  if (version !== 1 && version !== 2) throw new DecodeError(`unsupported envelope version ${version}`);
  const timestamp = r.u64("timestamp");
  const sender = account(r, "sender");
  if (sender.type === 2) throw new DecodeError("sender cannot be empty");
  const recipientAcc = account(r, "recipient");
  const recipient = recipientAcc.type === 2 ? null : recipientAcc;
  const fee = r.u64("fee");
  const survival = version >= 2 ? r.u64("survival") : null;
  const body = r.lp4("body");
  const approver = account(r, "escrow approver");
  let escrow = null;
  if (approver.type !== 2) {
    const commission = r.u64("commission");
    const timeout = r.u64("timeout");
    const instruction = r.str4("instruction");
    const multiParty = r.u8("multi_party");
    if (multiParty !== 0 && multiParty !== 1) throw new DecodeError("bad multi_party flag");
    let cosig = null, requestId = null;
    if (multiParty === 1) {
      cosig = r.lp4("co-signature");
      requestId = r.i64("escrow request id");
    }
    escrow = { approver, commission, timeout, instruction, multiParty: multiParty === 1, cosig, requestId };
  }
  const message = r.lp4("message");
  r.finish("envelope");
  const encrypted = message.length >= 4 && ZBE1.every((b, i) => message[i] === b);
  const messageText = encrypted || !message.length ? null : fromUtf8(message);
  const tx = { type, version, timestamp, sender, recipient, fee, survival, body, escrow, message, messageText, encrypted, unsigned: bytes, fields: null, known: false, inner: opts.inner || false };
  const dec = BODY[type];
  if (dec) {
    const br = new Reader(body);
    tx.fields = dec(br, tx);
    br.finish(`body of type ${type}`);
    tx.known = true;
  } else {
    tx.fields = { raw: bytesToHex(body) };
  }
  return tx;
}
var hex32 = (r, what) => bytesToHex(r.bytes(32, what));
function typedList8(r, what) {
  const n = r.u8(what + " count");
  const out = [];
  for (let i = 0; i < n; i++) out.push(account(r, what));
  return out;
}
var BODY = {
  0: (r) => ({}),
  1: (r) => ({ amount: r.u64("amount") }),
  6: (r) => {
    const f = { amount: r.u64("amount"), completeMinutes: r.u64("complete_minutes") };
    f.tokenId = r.done ? 0n : r.u64("token_id");
    f.feeInToken = r.done ? false : r.u8("fee_in_token") === 1;
    return f;
  },
  262: (r) => ({ txId: r.i64("tx_id") }),
  15: (r) => {
    const f = { fireHeight: r.u64("fire_height"), amount: r.u64("amount") };
    f.eventId = r.done ? "" : r.str4("event_id");
    return f;
  },
  16: (r) => ({ triggerId: r.i64("trigger_id") }),
  29: (r) => ({ tokenId: r.u64("token_id"), perTranche: r.u64("per_tranche"), intervalS: r.u64("interval_s"), fires: r.u32("fires"), cliffS: r.u64("cliff_s"), fundingMode: r.u8("funding_mode"), cancelPolicy: r.u8("cancel_policy"), endTime: r.u64("end_time"), reserved: r.u8("reserved") }),
  30: (r) => ({ scheduleId: r.i64("schedule_id") }),
  31: (r) => ({ scheduleId: r.i64("schedule_id"), newRecipient: account(r, "new recipient") }),
  10: (r) => {
    const f = { decimals: r.u8("decimals"), flags: r.u8("flags"), supply: r.u64("supply"), backing: r.u64("backing"), symbol: r.str2("symbol"), name: r.str2("name") };
    f.survival = r.done ? null : r.u64("survival");
    return f;
  },
  11: (r) => {
    const f = { tokenId: r.u64("token_id"), amount: r.u64("amount") };
    f.feeInToken = r.done ? false : r.u8("fee_in_token") === 1;
    f.survival = r.done ? null : r.u64("survival");
    return f;
  },
  12: (r) => {
    const f = { tokenId: r.u64("token_id"), amount: r.u64("amount") };
    if (!r.done) r.u8("reserved");
    f.survival = r.done ? null : r.u64("survival");
    return f;
  },
  13: (r) => {
    const f = { tokenId: r.u64("token_id"), amount: r.u64("amount") };
    if (!r.done) r.u8("reserved");
    f.survival = r.done ? null : r.u64("survival");
    return f;
  },
  14: (r) => {
    const f = { tokenId: r.u64("token_id") };
    f.amount = r.done ? 0n : r.u64("amount");
    return f;
  },
  18: (r) => {
    const f = { giveToken: r.u64("give_token"), giveAmount: r.u64("give_amount"), wantToken: r.u64("want_token"), wantAmount: r.u64("want_amount"), expiry: r.u64("expiry") };
    f.counterparty = r.done ? null : account(r, "counterparty");
    return f;
  },
  19: (r) => ({ offerId: r.i64("offer_id") }),
  20: (r) => ({ offerId: r.i64("offer_id") }),
  21: (r) => ({ baseToken: r.u64("base_token"), quoteToken: r.u64("quote_token"), deposit: r.u64("deposit") }),
  22: (r) => ({ marketId: r.i64("market_id"), side: r.u8("side"), price: r.i64("price"), amount: r.u64("amount"), flags: r.u8("flags"), expiry: r.u64("expiry") }),
  23: (r) => ({ orderId: r.i64("order_id") }),
  3: (r) => {
    const f = { property: r.str4("property"), value: r.str4("value") };
    if (!r.done) {
      f.setter = account(r, "setter");
      f.about = account(r, "recipient");
    }
    return f;
  },
  259: (r) => BODY[3](r),
  8: (r) => ({ path: r.str4("path"), content: r.lp4("content") }),
  264: (r) => BODY[8](r),
  520: (r) => ({ path: r.str4("path") }),
  9: (r) => ({ amount: r.u64("amount") }),
  40: (r) => {
    const f = { fileRoot: hex32(r, "file_root"), totalSize: r.u64("total_size"), pieceSize: r.u32("piece_size"), deposit: r.u64("deposit") };
    const n = r.u32("piece count");
    f.pieces = [];
    for (let i = 0; i < n; i++) f.pieces.push(hex32(r, "piece id"));
    return f;
  },
  296: (r) => ({ fileRoot: hex32(r, "file_root"), amount: r.u64("amount") }),
  52: (r) => {
    const f = { targetTxId: r.i64("target_tx_id"), amount: r.u64("amount") };
    if (!r.done) {
      f.targetHeight = r.u32("target_height");
      f.targetBytes = r.u64("target_bytes");
    }
    return f;
  },
  309: (r) => ({ targetId: r.i64("target_id") }),
  53: (r) => ({ targetTxId: r.i64("target_tx_id") }),
  42: (r) => ({ objectId: hex32(r, "object_id"), newOwner: account(r, "new owner") }),
  43: (r) => ({ objectId: hex32(r, "object_id"), mode: r.u8("mode"), add: typedList8(r, "add"), remove: typedList8(r, "remove") }),
  44: (r) => ({ objectId: hex32(r, "object_id") }),
  45: (r) => ({ objectId: hex32(r, "object_id") }),
  4: (r) => ({ decision: r.u32("decision"), escrowTxHash: hex32(r, "escrow tx hash") }),
  260: (r) => ({ payer: account(r, "payer"), amount: r.u64("amount"), approver: account(r, "approver"), commission: r.u64("commission"), timeout: r.u64("timeout"), instruction: r.str4("instruction"), expiry: r.u64("expiry") }),
  516: (r) => {
    const f = { id: r.i64("id"), reason: r.str2("reason") };
    f.isEscrow = r.done ? false : r.u8("target flag") === 1;
    return f;
  },
  5: decodeMultisig,
  55: (r) => groupBody(r, (f) => {
    f.validUntil = r.u32("valid_until");
    f.seq = r.u32("seq");
    f.proof = decodeProof(r);
  }),
  56: (r) => groupBody(r, () => {
  }),
  57: (r) => groupBody(r, (f) => {
    f.flags = r.u8("flags");
    f.limit = r.u64("limit");
    f.periodBlocks = r.u32("period_blocks");
  }),
  58: (r) => BODY[55](r),
  2: (r) => ({ nodePub: hex32(r, "node key"), owner: account(r, "owner"), locked: r.u64("locked"), poown: decodePoown(r) }),
  258: (r) => ({ nodePub: hex32(r, "node key"), locked: r.u64("locked"), poown: decodePoown(r) }),
  514: (r) => ({ nodePub: hex32(r, "node key") }),
  770: (r) => ({ nodePub: hex32(r, "node key"), poown: decodePoown(r) }),
  36: (r) => ({ gatewayKey: hex32(r, "gateway key"), domain: r.str4("domain"), url: r.str4("url") }),
  38: (r) => ({ gatewayKey: hex32(r, "gateway key") }),
  46: (r) => ({ nodePub: hex32(r, "node key"), domain: r.str4("domain"), url: r.str4("url") }),
  47: (r) => ({ nodePub: hex32(r, "node key") }),
  48: (r) => ({ relayKey: hex32(r, "relay key"), gatewayKey: hex32(r, "gateway key"), domain: r.str4("domain"), url: r.str4("url") }),
  49: (r) => ({ relayKey: hex32(r, "relay key") }),
  7: (r) => ({ voteHash: hex32(r, "vote hash") }),
  263: (r) => {
    const info = r.bytes(44, "FeeVoteInfo");
    const sig = r.lp4("voter signature");
    if (sig.length !== 64) throw new DecodeError("voter signature must be 64 bytes");
    return { info: bytesToHex(info), blockHash: bytesToHex(info.slice(0, 32)), height: readU32le(info, 32), feeVote: new Reader(info, 36).i64(), voterSig: bytesToHex(sig) };
  },
  51: (r) => ({ parameter: r.str4("parameter"), value: r.u64("value") }),
  50: (r) => ({ mask: r.u16("mask") }),
  54: (r) => {
    const n = r.u8("count");
    const out = [];
    for (let i = 0; i < n; i++) {
      const len = r.u8("addr len");
      const start = r.o;
      const a = account(r, "split recipient");
      if (r.o - start !== len) throw new DecodeError("split address length mismatch");
      out.push({ account: a, shareBp: r.u16("share") });
    }
    return { recipients: out };
  },
  24: (r) => {
    const f = { gameType: r.u8("game_type"), stakeToken: r.u64("stake_token"), stake: r.u64("stake"), seats: r.u8("seats"), params: bytesToHex(r.lp2("params")) };
    f.opponent = null;
    f.channel = null;
    if (r.remaining >= 36) f.opponent = account(r, "opponent");
    if (!r.done) f.channel = r.u8("channel");
    return f;
  },
  25: (r) => ({ gameId: r.i64("game_id") }),
  26: (r) => ({ gameId: r.i64("game_id"), move: bytesToHex(r.lp2("move")) }),
  27: (r) => ({ gameId: r.i64("game_id") }),
  28: (r) => ({ gameId: r.i64("game_id") }),
  17: (r) => ({ eventId: r.str4("event_id"), value: r.str4("value") })
};
function groupBody(r, rest) {
  const v = r.u8("version");
  if (v !== 1) throw new DecodeError("unexpected group body version");
  const len = r.u8("member len");
  const start = r.o;
  const f = { member: account(r, "member") };
  if (r.o - start !== len) throw new DecodeError("member length mismatch");
  rest(f);
  return f;
}
function decodeProof(r) {
  const kind = r.u8("proof kind");
  if (kind === 0 || kind === 2) {
    const sig = r.lp2("proof signature");
    return { kind, sig: bytesToHex(sig) };
  }
  if (kind === 1) {
    const min = r.u32("min");
    const nonce = r.i64("nonce");
    const n = r.u8("n");
    const parts = [];
    for (let i = 0; i < n; i++) {
      const len = r.u8("len");
      const start = r.o;
      const a = account(r, "participant");
      if (r.o - start !== len) throw new DecodeError("participant length mismatch");
      parts.push({ account: a, sig: bytesToHex(r.lp2("sig")) });
    }
    return { kind, min, nonce, participants: parts };
  }
  throw new DecodeError("unknown proof kind " + kind);
}
function decodePoown(r) {
  const b = r.bytes(136, "proof of ownership");
  const owner = readTyped(b, 0);
  return { owner: { type: owner.type, hex: bytesToHex(owner.typed), display: display(owner.typed) }, blockHash: bytesToHex(b.slice(36, 68)), height: readU32le(b, 68), sig: bytesToHex(b.slice(72)) };
}
function decodeMultisig(r, tx) {
  const f = { info: null, inner: null, innerBytes: null, sigs: null };
  const infoPresent = r.u32("info_present");
  if (infoPresent !== 0 && infoPresent !== 1) throw new DecodeError("bad info_present");
  if (infoPresent) {
    const min = r.u32("min");
    const nonce = r.u64("nonce");
    const n = r.u32("n");
    const participants = [];
    for (let i = 0; i < n; i++) participants.push(account(r, "participant"));
    f.info = { min, nonce, participants };
  }
  const inner = r.lp4("inner");
  if (inner.length) {
    f.innerBytes = inner;
    f.inner = decodeTransaction(inner, { inner: true });
  }
  const sigPresent = r.u32("sig_present");
  if (sigPresent !== 0 && sigPresent !== 1) throw new DecodeError("bad sig_present");
  if (sigPresent) {
    const hash = hex32(r, "inner hash");
    const count = r.u32("count");
    const list = [];
    for (let i = 0; i < count; i++) {
      const signer = account(r, "signer");
      const sig = r.lp4("signature");
      list.push({ signer, sig: bytesToHex(sig) });
    }
    f.sigs = { hash, list };
  }
  return f;
}
function fieldTree(tx) {
  const rows = [
    ["type", tx.type],
    ["version", tx.version],
    ["timestamp", tx.timestamp.toString()],
    ["sender", tx.sender.hex],
    ["recipient", tx.recipient ? tx.recipient.hex : "02000000 (empty)"],
    ["fee", tx.fee.toString()]
  ];
  if (tx.survival !== null) rows.push(["survival", tx.survival.toString()]);
  rows.push(["body", bytesToHex(tx.body)]);
  if (tx.escrow) rows.push(["escrow", JSON.stringify(plain(tx.escrow))]);
  rows.push(["message", bytesToHex(tx.message)]);
  rows.push(["fields", JSON.stringify(plain(tx.fields), null, 1)]);
  return rows;
}
function plain(v) {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return bytesToHex(v);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) {
      if (k === "typed" || k === "payload" || k === "unsigned" || k === "innerBytes" || k === "body" || k === "message") continue;
      o[k] = plain(v[k]);
    }
    return o;
  }
  return v;
}
var typeName = (t) => ACCOUNT_TYPES[t] ? ACCOUNT_TYPES[t].name : `type ${t}`;

// src/lib/vault.js
var subtle = globalThis.crypto.subtle;
var PBKDF2_ITERATIONS = 6e5;
async function deriveVaultKey(password, salt2, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle.importKey("raw", utf8(password.normalize("NFKD")), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt2, iterations }, base, 256);
  return new Uint8Array(bits);
}
async function importAesKey(raw) {
  return subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptVault(keyRaw2, data, salt2, iterations = PBKDF2_ITERATIONS) {
  const key = await importAesKey(keyRaw2);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(JSON.stringify(data))));
  return { v: 1, salt: toBase64(salt2), iv: toBase64(iv), ct: toBase64(ct), iterations };
}
async function decryptVault(keyRaw2, blob) {
  const key = await importAesKey(keyRaw2);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: fromBase64(blob.iv) }, key, fromBase64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function emptyVault() {
  return { seeds: [], keys: [], accounts: [], multisigs: [], sites: {}, log: [], settings: { autoLockMinutes: 15, network: "testnet", nodes: {}, blindDigest: false, sessionKeys: false, language: "en", trustPageGenesis: false } };
}
async function createVault(password, data = emptyVault()) {
  const salt2 = randomBytes(16);
  const keyRaw2 = await deriveVaultKey(password, salt2);
  const blob = await encryptVault(keyRaw2, data, salt2);
  return { blob, keyRaw: keyRaw2 };
}
async function unlockVault(password, blob) {
  const salt2 = fromBase64(blob.salt);
  const keyRaw2 = await deriveVaultKey(password, salt2, blob.iterations || PBKDF2_ITERATIONS);
  const data = await decryptVault(keyRaw2, blob);
  return { keyRaw: keyRaw2, data, salt: salt2 };
}

// src/lib/format.js
var ATOMIC = 100000000n;
var THIN = "\u202F";
function formatUnits(atomic, decimals = 8) {
  let v = BigInt(atomic);
  const neg = v < 0n;
  if (neg) v = -v;
  const base = 10n ** BigInt(decimals);
  const whole = v / base, frac = v % base;
  let w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  let f = decimals ? frac.toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return (neg ? "-" : "") + w + (f ? "." + f : "");
}
function formatZBC(atomic) {
  return formatUnits(atomic, 8) + " ZBC";
}
function formatToken(atomic, token2) {
  if (!token2 || token2.decimals === void 0) return `${formatUnits(atomic, 0)} units of #${token2 && token2.id !== void 0 ? token2.id : "?"}`;
  return `${formatUnits(atomic, token2.decimals)} ${token2.symbol || "#" + token2.id}`;
}
function parseUnits(str, decimals = 8) {
  const s = String(str).trim().replace(/[\s, ]/g, "");
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || !m[2] && !m[3]) return null;
  const whole = m[2] || "0", frac = (m[3] || "").slice(0, decimals).padEnd(decimals, "0");
  const v = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || "0");
  return m[1] ? -v : v;
}
function formatDuration(seconds) {
  let s = Number(seconds);
  if (!isFinite(s) || s < 0) return String(seconds);
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const parts = [];
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(" ") || `${Math.round(s)} s`;
}
function blockDate(height, chain2) {
  if (!chain2 || !chain2.height || !chain2.avgBlockSeconds) return null;
  const now2 = chain2.at || Math.floor(Date.now() / 1e3);
  return now2 + (Number(height) - Number(chain2.height)) * chain2.avgBlockSeconds;
}
function formatBytes(n) {
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function percentOfBp(bp) {
  return (Number(bp) / 100).toFixed(2).replace(/\.?0+$/, "") + "%";
}

// src/lib/describe.js
var CATEGORIES = ["Payments", "Apps & games", "Tokens", "Exchange", "Data & storage", "Escrow & multisig", "Node & infrastructure", "Bridge", "Governance"];
var TYPE_NAMES = {
  0: ["Message", "MessageOnly", "SendMessage"],
  1: ["SendZBC", "Transfer", "Send ZBC", "Send", "SendFunds", "Send funds", "Payment"],
  2: ["NodeRegistration", "RegisterNode"],
  258: ["NodeRegistrationUpdate", "UpdateNode"],
  514: ["RemoveNodeRegistration", "RemoveNode"],
  770: ["ClaimNodeRegistration", "ClaimNode"],
  3: ["SetupAccountDataset", "SaveDataset", "SetupDataset", "Dataset"],
  259: ["RemoveAccountDataset", "RemoveDataset"],
  4: ["ApprovalEscrow", "EscrowApproval", "Escrow decision", "ApproveEscrow"],
  5: ["MultiSignature", "Multisig", "MultiSig"],
  6: ["LiquidPayment", "Stream", "LiquidPay"],
  262: ["LiquidPaymentStop", "StopLiquidPayment", "StopStream"],
  7: ["FeeVoteCommitment", "FeeVoteCommit"],
  263: ["FeeVoteReveal"],
  8: ["DFSCreateFile", "CreateFile"],
  264: ["DFSUpdateFile", "UpdateFile"],
  520: ["DFSDeleteFile", "DeleteFile"],
  9: ["AddPrepaidStorage", "PrepaidStorage"],
  10: ["IssueToken", "CreateToken"],
  11: ["TransferToken", "SendToken"],
  12: ["MintToken"],
  13: ["BurnToken"],
  14: ["FinanceToken", "ExtendTokenLife"],
  15: ["CreateTrigger"],
  16: ["CancelTrigger"],
  17: ["AttestEvent", "EventAttested"],
  18: ["CreateSwapOffer", "SwapCreate"],
  19: ["AcceptSwapOffer", "SwapAccept"],
  20: ["CancelSwapOffer", "SwapCancel"],
  21: ["CreateMarket", "MarketCreate"],
  22: ["PlaceOrder", "OrderPlace"],
  23: ["CancelOrder", "OrderCancel"],
  24: ["CreateApp", "CreateGame", "AppCreate"],
  25: ["JoinApp", "JoinGame"],
  26: ["AppMove", "GameMove", "Move"],
  27: ["ResignApp", "Resign"],
  28: ["ClaimAppTimeout", "ClaimTimeout"],
  29: ["ScheduledTransfer", "SchedulePayment", "Vesting"],
  30: ["CancelSchedule"],
  31: ["ReassignSchedule", "RedirectSchedule"],
  40: ["StoreFile"],
  296: ["FundStoredFile", "AddToStoredFile"],
  42: ["TransferDataset"],
  43: ["SetDatasetPolicy"],
  44: ["AcceptDataset"],
  45: ["DeleteDataset"],
  50: ["TransactPolicy"],
  51: ["SetConsensusParam", "GovernanceVote", "EconomicsVote"],
  52: ["FundLongevity", "KeepOnChain"],
  53: ["CancelLongevity"],
  309: ["CloseLongevity", "ClosePaidLife"],
  54: ["SplitPolicy"],
  55: ["GroupLink", "LinkToGroup"],
  56: ["GroupRemove", "RemoveFromGroup"],
  57: ["GroupPermissions", "SetMemberPermissions"],
  58: ["GroupHandover", "HandOverControl"],
  36: ["RegisterGateway"],
  38: ["UnregisterGateway"],
  46: ["RegisterArchival"],
  47: ["UnregisterArchival"],
  48: ["RegisterRelay"],
  49: ["UnregisterRelay"],
  260: ["EscrowRequest", "RequestEscrow"],
  516: ["DeclineRequest", "DeclineEscrow"]
};
var TYPE_CATEGORY = {
  0: 0,
  1: 0,
  6: 0,
  262: 0,
  15: 0,
  16: 0,
  29: 0,
  30: 0,
  31: 0,
  24: 1,
  25: 1,
  26: 1,
  27: 1,
  28: 1,
  10: 2,
  11: 2,
  12: 2,
  13: 2,
  14: 2,
  18: 3,
  19: 3,
  20: 3,
  21: 3,
  22: 3,
  23: 3,
  3: 4,
  259: 4,
  8: 4,
  264: 4,
  520: 4,
  9: 4,
  40: 4,
  296: 4,
  52: 4,
  309: 4,
  53: 4,
  42: 4,
  43: 4,
  44: 4,
  45: 4,
  4: 5,
  260: 5,
  516: 5,
  5: 5,
  55: 5,
  56: 5,
  57: 5,
  58: 5,
  2: 6,
  258: 6,
  514: 6,
  770: 6,
  36: 6,
  38: 6,
  46: 6,
  47: 6,
  48: 6,
  49: 6,
  17: 7,
  7: 8,
  263: 8,
  51: 8
};
var GAME_TYPES = { 1: "tic-tac-toe", 2: "chess", 3: "connect four", 4: "checkers", 5: "reversi", 6: "gomoku", 7: "battleship", 8: "dots and boxes", 16: "dice", 17: "coin flip", 18: "roulette", 19: "slots", 20: "lottery", 21: "crash", 32: "ludo", 33: "pig", 34: "race", 35: "monopoly" };
function canonicalTypeName(type) {
  return (TYPE_NAMES[type] || [`Type${type}`])[0];
}
function normName(s) {
  return String(s || "").toLowerCase().replace(/[\s_\-]/g, "");
}
function typeNameMatches(type, name) {
  const n = normName(name);
  if (!n) return true;
  return (TYPE_NAMES[type] || []).some((a) => normName(a) === n) || n === `type${type}` || n === String(type);
}
var zbc = (atomic) => ({ kind: "amount", atomic: BigInt(atomic), decimals: 8, unit: "ZBC", text: formatZBC(atomic) });
var signedId = (u) => BigInt.asIntN(64, BigInt(u));
var idText = (u) => signedId(u).toString();
function tokenOf(ctx, tokenId) {
  const id = idText(tokenId);
  if (BigInt(tokenId) === 0n) return { id: "0", symbol: "ZBC", name: "ZooBC", decimals: 8, native: true };
  const t = ctx.tokens && ctx.tokens[id] || (ctx.context && ctx.context.token && idText(ctx.context.token.id ?? ctx.context.token.token_id ?? "0") === id ? ctx.context.token : null);
  if (t) return { id, symbol: t.symbol, name: t.name, decimals: Number(t.decimals ?? 0), redeemable: t.redeemable, mintable: t.mintable, supply: t.supply, backing: t.backing, persistHeight: t.persist_height ?? t.persistHeight };
  return { id, symbol: `#${id}`, name: null, decimals: void 0, unknown: true };
}
var tok = (atomic, token2) => ({ kind: "amount", atomic: BigInt(atomic), decimals: token2.decimals, unit: token2.symbol, text: token2.native ? formatZBC(atomic) : formatToken(atomic, token2), unknownDecimals: token2.decimals === void 0 });
var amountText = (atomic, token2) => tok(atomic, token2).text;
function addr(ctx, a) {
  if (!a) return { kind: "text", text: "\u2014" };
  const label = ctx.labelFor ? ctx.labelFor(a.hex) : null;
  return { kind: "address", hex: a.hex, display: a.display, label, text: label ? `${label} \xB7 ${a.display}` : a.display };
}
var text = (t) => ({ kind: "text", text: String(t) });
var date = (unix) => ({ kind: "date", unix: Number(unix), text: String(unix) });
var dur = (seconds) => ({ kind: "text", text: formatDuration(seconds) });
var quote = (t) => ({ kind: "quote", text: String(t) });
var code = (t) => ({ kind: "code", text: String(t) });
var blockRow = (ctx, height) => {
  const d = blockDate(height, ctx.chain);
  return { kind: "block", height: Number(height), approxUnix: d, text: `block ${formatUnits(height, 0)}` + (d ? ` (\u2248 ${new Date(d * 1e3).toLocaleString()})` : "") };
};
var yesno = (b) => text(b ? "Yes" : "No");
var znk = (hex) => code(zbcEncode(hexToBytes(hex), "ZNK"));
function describe(tx, ctx = {}) {
  const f = tx.fields || {};
  const out = {
    type: tx.type,
    typeName: canonicalTypeName(tx.type),
    category: TYPE_CATEGORY[tx.type],
    kicker: "",
    title: "",
    rows: [],
    warnings: [],
    notes: [],
    total: null,
    canSign: true,
    hold: false,
    nested: null,
    canonical: { amounts: {}, recipients: [], ids: {} },
    unknown: !tx.known,
    retired: false,
    extras: {}
  };
  const warn = (level, t) => out.warnings.push({ level, text: t });
  const row = (label, value) => out.rows.push({ label, value });
  const rec = tx.recipient;
  const recip = () => {
    if (rec) out.canonical.recipients.push(rec.hex);
    return addr(ctx, rec);
  };
  const amt = (label, value) => {
    out.canonical.amounts[label.toLowerCase()] = value;
  };
  const c = ctx.context || {};
  let total = tx.fee + (tx.survival || 0n);
  if (tx.escrow) total += tx.escrow.commission;
  out.kicker = CATEGORIES[out.category] ? CATEGORIES[out.category].toUpperCase() : "TRANSACTION";
  switch (tx.type) {
    case 0: {
      out.kicker = "MESSAGE";
      out.title = "Send a message (no coins)";
      row("To", recip());
      if (tx.encrypted) row("Message", text("Encrypted note (only the recipient can read it)"));
      else row("Message", quote(tx.messageText ?? bytesToHex(tx.message)));
      out.notes.push("Only the message is stored on-chain. No ZBC moves.");
      break;
    }
    case 1: {
      out.kicker = "TRANSFER";
      const a = f.amount;
      amt("amount", a);
      out.title = tx.escrow ? `Send ${formatZBC(a)} in escrow` : `Send ${formatZBC(a)}`;
      row("To", recip());
      row("Amount", zbc(a));
      total += a;
      if (rec && [2, 3, 6, 8].includes(rec.type)) warn("red", "ZBC cannot be sent to this kind of address \u2014 the node rejects it.");
      if (rec && rec.type === 10) out.notes.push("Funds a dataset's storage balance.");
      break;
    }
    case 6: {
      const token2 = tokenOf(ctx, f.tokenId);
      const minutes = f.completeMinutes;
      const seconds = minutes * 60n;
      amt("amount", f.amount);
      out.kicker = "STREAM";
      out.title = `Stream ${amountText(f.amount, token2)} over ${formatDuration(seconds)}`;
      row("To", recip());
      row("Amount", tok(f.amount, token2));
      row("Duration", dur(seconds));
      if (minutes > 0n) {
        const perHour = f.amount * 60n / minutes;
        row("Rate per hour", { ...tok(perHour, token2), text: "\u2248 " + amountText(perHour, token2) + " / hour" });
      }
      row("Ends", { kind: "date", unix: Number(tx.timestamp + seconds), approx: true, text: "\u2248" });
      row("Fee paid in token", yesno(f.feeInToken));
      if (token2.native) total += f.amount;
      out.notes.push("The recipient receives it gradually. You can stop it; the unstreamed part returns to you.");
      break;
    }
    case 262: {
      out.title = "Stop a liquid payment";
      row("Stream id", code(f.txId.toString()));
      out.canonical.ids.stream = f.txId.toString();
      if (c.stream) {
        if (c.stream.recipient) row("Recipient", text(c.stream.recipient));
        if (c.stream.remaining !== void 0) row("Remaining", zbc(c.stream.remaining));
      }
      out.notes.push("Nothing more flows after the block this is included in.");
      break;
    }
    case 15: {
      amt("amount", f.amount);
      out.title = `Lock ${formatZBC(f.amount)} until block ${formatUnits(f.fireHeight, 0)}`;
      row("Beneficiary", recip());
      row("Amount", zbc(f.amount));
      row("Fires at", blockRow(ctx, f.fireHeight));
      if (f.eventId) row("Event id", text(f.eventId));
      total += f.amount;
      out.notes.push("Locked until the trigger fires.");
      break;
    }
    case 16:
      out.title = "Cancel a trigger";
      row("Trigger id", code(f.triggerId.toString()));
      out.notes.push("The locked amount returns to you.");
      break;
    case 29: {
      const token2 = tokenOf(ctx, f.tokenId);
      amt("per payment", f.perTranche);
      out.kicker = "SCHEDULE";
      out.title = `Schedule ${f.fires} payment${f.fires === 1 ? "" : "s"} of ${amountText(f.perTranche, token2)}`;
      row("To", recip());
      row("Per payment", tok(f.perTranche, token2));
      row("Every", dur(f.intervalS));
      row("First after", f.cliffS > 0n ? dur(f.cliffS) : text("No cliff"));
      row("Ends", f.endTime > 0n ? date(f.endTime) : text("After the last payment"));
      const lockedAll = f.perTranche * BigInt(f.fires);
      row("Funding", text(f.fundingMode === 0 ? `Locked now: ${amountText(lockedAll, token2)}` : "Paid from your balance each time"));
      row("Revocable", yesno(f.cancelPolicy === 1));
      if (f.fundingMode === 0 && token2.native) total += lockedAll;
      if (f.cancelPolicy === 0) warn("amber", "You cannot cancel this later.");
      if (f.fires < 1 || f.fires > 520) warn("red", "The number of payments must be 1\u2013520; the node will refuse this.");
      break;
    }
    case 30:
      out.title = "Cancel a scheduled payment";
      row("Schedule id", code(f.scheduleId.toString()));
      out.notes.push("Sender revoke or recipient decline.");
      break;
    case 31:
      out.title = "Redirect scheduled payments to a new address";
      row("Schedule", code(f.scheduleId.toString()));
      row("New recipient", addr(ctx, f.newRecipient));
      out.canonical.recipients.push(f.newRecipient.hex);
      break;
    case 10: {
      out.kicker = "TOKEN";
      out.title = `Create token ${f.symbol}`;
      const redeemable = !!(f.flags & 1), mintable = !!(f.flags & 2);
      row("Name", text(f.name));
      row("Symbol", text(f.symbol));
      row("Supply", text(formatUnits(f.supply, f.decimals) + " " + f.symbol));
      row("Decimals", text(f.decimals));
      row("Backing locked", zbc(f.backing));
      row("Redeemable", yesno(redeemable));
      row("Mintable", yesno(mintable));
      if (f.survival !== null) row("Token life paid", zbc(f.survival));
      if (tx.messageText) {
        try {
          const meta = JSON.parse(tx.messageText);
          if (meta && meta.d) row("Description", quote(meta.d));
        } catch {
        }
      }
      total += f.backing + (f.survival || 0n);
      amt("backing", f.backing);
      break;
    }
    case 11: {
      const token2 = tokenOf(ctx, f.tokenId);
      amt("amount", f.amount);
      out.kicker = "TOKEN";
      out.title = `Send ${amountText(f.amount, token2)}`;
      row("To", recip());
      row("Token", text(token2.name ? `${token2.name} (#${token2.id})` : `#${token2.id}`));
      row("Amount", tok(f.amount, token2));
      row("Fee paid in token", yesno(f.feeInToken));
      if (f.survival !== null && f.survival > 0n) {
        row("Kept on chain", zbc(f.survival));
        total += f.survival;
      }
      if (token2.unknown) out.notes.push("Token details could not be loaded; the amount is shown in raw units.");
      break;
    }
    case 12: {
      const token2 = tokenOf(ctx, f.tokenId);
      amt("amount", f.amount);
      out.kicker = "TOKEN";
      out.title = `Mint ${amountText(f.amount, token2)}`;
      row("Token", text(token2.name ? `${token2.name} (#${token2.id})` : `#${token2.id}`));
      row("Amount", tok(f.amount, token2));
      let backing = c.backingAdded !== void 0 ? BigInt(c.backingAdded) : null;
      if (backing === null && token2.supply && token2.backing) {
        const s = BigInt(token2.supply), b = BigInt(token2.backing);
        if (s > 0n) backing = (f.amount * b + s - 1n) / s;
      }
      if (backing !== null) {
        row("Backing added", zbc(backing));
        total += backing;
      } else row("Backing added", text("Estimated at signing time"));
      if (f.survival) {
        row("Kept on chain", zbc(f.survival));
        total += f.survival;
      }
      out.notes.push("Issuer only. Locks more backing so unit value stays the same.");
      break;
    }
    case 13: {
      const token2 = tokenOf(ctx, f.tokenId);
      amt("amount", f.amount);
      out.kicker = "TOKEN";
      out.title = `Burn ${amountText(f.amount, token2)}`;
      row("Token", text(token2.name ? `${token2.name} (#${token2.id})` : `#${token2.id}`));
      row("Amount", tok(f.amount, token2));
      if (token2.supply && token2.backing) {
        const s = BigInt(token2.supply);
        if (s > 0n) {
          const back = f.amount * BigInt(token2.backing) / s;
          out.notes.push(`Returns your share of the backing: \u2248 ${formatZBC(back)}.`);
        }
      } else out.notes.push("Returns your share of the backing.");
      if (token2.redeemable === false) warn("amber", "This token is not redeemable: burning returns no backing.");
      if (f.survival) {
        row("Kept on chain", zbc(f.survival));
        total += f.survival;
      }
      break;
    }
    case 14: {
      const token2 = tokenOf(ctx, f.tokenId);
      amt("amount", f.amount);
      out.kicker = "TOKEN";
      out.title = `Pay ${formatZBC(f.amount)} to keep ${token2.symbol} alive`;
      row("Token", text(token2.name ? `${token2.name} (#${token2.id})` : `#${token2.id}`));
      row("Amount", zbc(f.amount));
      total += f.amount;
      out.notes.push("The amount buys blocks; the fee buys none.");
      break;
    }
    case 18: {
      const give = tokenOf(ctx, f.giveToken), want = tokenOf(ctx, f.wantToken);
      out.kicker = "EXCHANGE";
      out.title = `Offer ${amountText(f.giveAmount, give)} for ${amountText(f.wantAmount, want)}`;
      row("You give", tok(f.giveAmount, give));
      row("You get", tok(f.wantAmount, want));
      if (f.giveAmount > 0n && give.decimals !== void 0 && want.decimals !== void 0) {
        const price = f.wantAmount * 10n ** BigInt(give.decimals) * 10n ** 8n / (f.giveAmount * 10n ** BigInt(want.decimals));
        row("Price", text(`${formatUnits(price, 8)} ${want.symbol} per ${give.symbol}`));
      }
      row("Expires", f.expiry > 0n ? date(f.expiry) : text("Never"));
      row("Reserved for", f.counterparty ? addr(ctx, f.counterparty) : text("Anyone"));
      if (give.native) total += f.giveAmount;
      amt("amount", f.giveAmount);
      out.notes.push("The offered amount is locked until the offer is accepted or cancelled.");
      break;
    }
    case 19: {
      out.kicker = "EXCHANGE";
      out.title = `Accept offer #${f.offerId}`;
      out.canonical.ids.offer = f.offerId.toString();
      const o = c.offer;
      if (o) {
        const give = tokenOf(ctx, BigInt(o.give_token ?? o.giveToken ?? 0)), want = tokenOf(ctx, BigInt(o.want_token ?? o.wantToken ?? 0));
        row("You pay", tok(BigInt(o.want_amount ?? o.wantAmount ?? 0), want));
        row("You receive", tok(BigInt(o.give_amount ?? o.giveAmount ?? 0), give));
        if (o.maker) row("Maker", text(o.maker));
        if (want.native) total += BigInt(o.want_amount ?? o.wantAmount ?? 0);
      } else warn("amber", "Could not load the offer \u2014 check it on the site.");
      break;
    }
    case 20:
      out.kicker = "EXCHANGE";
      out.title = `Cancel your offer #${f.offerId}`;
      out.canonical.ids.offer = f.offerId.toString();
      break;
    case 21: {
      const base = tokenOf(ctx, f.baseToken), q = tokenOf(ctx, f.quoteToken);
      out.kicker = "EXCHANGE";
      out.title = `Open market ${base.symbol}/${q.symbol}`;
      const cost = c.marketCreationCost !== void 0 ? BigInt(c.marketCreationCost) : 50n * ATOMIC;
      row("Market creation cost", { ...zbc(cost), text: formatZBC(cost) + (c.marketCreationCost === void 0 ? " (default)" : "") });
      row("Deposit", zbc(f.deposit));
      out.notes.push("The creation cost is not refunded.");
      total += cost + f.deposit;
      break;
    }
    case 22: {
      const m = c.market || {};
      const base = tokenOf(ctx, BigInt(m.base_token ?? m.baseToken ?? -1n)), q = tokenOf(ctx, BigInt(m.quote_token ?? m.quoteToken ?? -1n));
      const baseSym = m.base_token !== void 0 || m.baseToken !== void 0 ? base.symbol : "base", quoteSym = m.quote_token !== void 0 || m.quoteToken !== void 0 ? q.symbol : "quote";
      const isMarket = !!(f.flags & 1), side = f.side === 0 ? "Buy" : "Sell";
      const baseDec = base.decimals ?? 8;
      out.kicker = "EXCHANGE";
      out.title = `${side} ${formatUnits(f.amount, baseDec)} ${baseSym} ${isMarket ? "at market price" : `at ${formatUnits(f.price, 8)} ${quoteSym}`}`;
      row("Market", text(`#${f.marketId}${baseSym !== "base" ? ` \xB7 ${baseSym}/${quoteSym}` : ""}`));
      row("Side", text(side));
      row("Price", text(isMarket ? "Market" : `${formatUnits(f.price, 8)} ${quoteSym} per ${baseSym}`));
      row("Amount", text(`${formatUnits(f.amount, baseDec)} ${baseSym}`));
      if (!isMarket) {
        const t = f.price * f.amount / 10n ** BigInt(baseDec);
        row("Total", text(`\u2248 ${formatUnits(t, 8)} ${quoteSym}`));
        if (f.side === 0 && q.native) total += t;
      }
      if (f.side === 1 && base.native) total += f.amount;
      row("Expires", f.expiry > 0n ? date(f.expiry) : text("Never"));
      amt("amount", f.amount);
      out.canonical.ids.market = f.marketId.toString();
      out.notes.push("Funds are locked until it fills or you cancel.");
      break;
    }
    case 23:
      out.kicker = "EXCHANGE";
      out.title = `Cancel order #${f.orderId}`;
      out.canonical.ids.order = f.orderId.toString();
      out.notes.push("The unfilled part returns to you.");
      break;
    case 3:
    case 259: {
      out.kicker = "DATA";
      const p = f.property || "";
      if (tx.type === 259) out.title = `Remove data "${p}"`;
      else if (p.startsWith("poe:")) out.title = "Anchor a document (notary)";
      else if (p.startsWith("form:")) out.title = "Publish a form";
      else if (p.startsWith("formreply:")) out.title = "Submit a form reply";
      else if (p.startsWith("inv")) out.title = "Create an invoice";
      else if (p.startsWith("poll:")) out.title = "Publish a poll";
      else if (p.startsWith("pollvote:")) out.title = "Vote in a poll";
      else if (p.startsWith("tokenicon:")) out.title = "Publish a token icon";
      else out.title = "Save data on-chain";
      row("About", f.about ? addr(ctx, f.about) : recip());
      row("Property", text(p));
      let v = f.value;
      let kind = "quote";
      try {
        const j = JSON.parse(v);
        v = JSON.stringify(j, null, 2);
        kind = "json";
      } catch {
      }
      row("Value", { kind, text: v, full: v.length > 200 });
      break;
    }
    case 8:
    case 264: {
      out.kicker = "FILE";
      out.title = `${tx.type === 8 ? "Create" : "Replace"} file ${f.path}`;
      row("Path", text(f.path));
      row("Size", text(formatBytes(f.content.length)));
      const t = fromUtf8(f.content);
      row("Preview", t !== null ? { kind: "quote", text: t.slice(0, 200), full: t.length > 200 } : text("binary"));
      if (f.content.length > 65536) warn("red", "Files above 64 KB are refused by the node.");
      out.notes.push("Rent is paid from the file's own ZBS_ deposit.");
      break;
    }
    case 520:
      out.kicker = "FILE";
      out.title = `Delete file ${f.path}`;
      row("Path", text(f.path));
      warn("amber", "The deposit remainder goes to the node pool.");
      break;
    case 9:
      out.kicker = "STORAGE";
      out.title = `Prepay ${formatZBC(f.amount)} of storage`;
      row("Amount", zbc(f.amount));
      total += f.amount;
      amt("amount", f.amount);
      break;
    case 40: {
      out.kicker = "STORAGE";
      out.title = `Store a ${formatBytes(f.totalSize)} file`;
      row("File root", code(f.fileRoot));
      row("Size", text(formatBytes(f.totalSize)));
      row("Pieces", text(`${f.pieces.length} \xD7 ${formatBytes(f.pieceSize)}`));
      row("Storage deposit", zbc(f.deposit));
      if (tx.survival) row("Kept for", zbc(tx.survival));
      if (f.deposit < ATOMIC / 100n) warn("amber", "The deposit is below the 0.01 ZBC minimum.");
      total += f.deposit;
      amt("deposit", f.deposit);
      break;
    }
    case 296:
      out.kicker = "STORAGE";
      out.title = `Add ${formatZBC(f.amount)} to a stored file`;
      row("File root", code(f.fileRoot));
      row("Amount", zbc(f.amount));
      total += f.amount;
      amt("amount", f.amount);
      out.notes.push("Anyone may add; nothing comes back.");
      break;
    case 52: {
      out.kicker = "STORAGE";
      out.title = `Keep a record on chain \u2014 add ${formatZBC(f.amount)}`;
      row("Record id", code(f.targetTxId.toString()));
      if (f.targetBytes !== void 0) row("Stated size", text(formatBytes(f.targetBytes)));
      if (f.targetHeight !== void 0) row("Until", blockRow(ctx, f.targetHeight));
      row("Amount", zbc(f.amount));
      total += f.amount;
      amt("amount", f.amount);
      if (f.amount < ATOMIC / 10n) warn("amber", "The amount is below the 0.1 ZBC minimum.");
      break;
    }
    case 309:
      out.kicker = "STORAGE";
      out.title = "Close a record's paid life";
      row("Record id", code(f.targetId.toString()));
      warn("amber", "The rest goes to the node pool.");
      break;
    case 53:
      out.kicker = "RETIRED";
      out.title = "Retired transaction type 53";
      row("Target id", code(f.targetTxId.toString()));
      warn("red", "Retired transaction type \u2014 the network rejects it.");
      out.canSign = false;
      out.retired = true;
      break;
    case 42:
      out.kicker = "DATA OBJECT";
      out.title = "Transfer a data object";
      row("Object", code(f.objectId));
      row("New owner", addr(ctx, f.newOwner));
      out.canonical.recipients.push(f.newOwner.hex);
      out.notes.push("Two-step: the recipient must accept it.");
      break;
    case 43: {
      out.kicker = "DATA OBJECT";
      out.title = "Change who may write to a data object";
      row("Object", code(f.objectId));
      row("Mode", text(f.mode));
      row("Added", f.add.length ? { kind: "list", items: f.add.map((a) => addr(ctx, a)), text: f.add.map((a) => a.display).join(", ") } : text("None"));
      row("Removed", f.remove.length ? { kind: "list", items: f.remove.map((a) => addr(ctx, a)), text: f.remove.map((a) => a.display).join(", ") } : text("None"));
      break;
    }
    case 44:
      out.kicker = "DATA OBJECT";
      out.title = "Accept a data object";
      row("Object", code(f.objectId));
      break;
    case 45:
      out.kicker = "DATA OBJECT";
      out.title = "Delete a data object";
      row("Object", code(f.objectId));
      warn("red", "Deleting a data object is permanent.");
      out.hold = true;
      break;
    case 4: {
      const approve = f.decision === 0, reject = f.decision === 1;
      out.kicker = "ESCROW APPROVAL";
      out.title = approve ? "Approve escrow" : reject ? "Reject escrow" : "Expire escrow";
      out.extras.danger = !approve;
      out.extras.primaryLabel = approve ? "Approve & sign" : reject ? "Reject & sign" : "Sign";
      const e = c.escrow;
      out.canonical.ids.escrow = f.escrowTxHash;
      if (e) {
        const amount = e.amount !== void 0 ? BigInt(e.amount) : null, commission = e.commission !== void 0 ? BigInt(e.commission) : null;
        if (e.payer || e.sender) row("Payer", text(e.payer || e.sender));
        if (e.recipient) row("Recipient", text(e.recipient));
        if (amount !== null) row("Amount", zbc(amount));
        if (commission !== null) row("Your commission", zbc(commission));
        if (e.instruction) row("Instruction", quote(e.instruction));
        if (approve) out.notes.push(`${amount !== null ? formatZBC(amount) : "The amount"} is released to ${e.recipient || "the recipient"}.${commission !== null ? ` You receive ${formatZBC(commission)}.` : ""}`);
        else if (reject) out.notes.push(`${amount !== null ? formatZBC(amount) : "The amount"} returns to ${e.payer || e.sender || "the payer"}.`);
        if (e.status && e.status !== "pending") warn("red", `This escrow is ${e.status}; the node will refuse the decision.`);
      } else {
        row("Escrow", code(f.escrowTxHash));
        warn("amber", "Could not load the escrow \u2014 check it on the site.");
      }
      break;
    }
    case 260: {
      out.kicker = "ESCROW REQUEST";
      out.title = `Ask ${f.payer.display.slice(0, 12)}\u2026 to pay ${formatZBC(f.amount)} into escrow`;
      row("Payer", addr(ctx, f.payer));
      row("Amount", zbc(f.amount));
      row("Approver", addr(ctx, f.approver));
      row("Commission", zbc(f.commission));
      row("Timeout", date(f.timeout));
      row("Instruction", quote(f.instruction));
      row("Request expires", f.expiry > 0n ? date(f.expiry) : text("With the timeout"));
      amt("amount", f.amount);
      out.canonical.recipients.push(f.payer.hex);
      break;
    }
    case 516: {
      out.kicker = "ESCROW";
      out.title = f.isEscrow ? "Refuse an escrow" : "Decline a payment request";
      row("From", recip());
      row("Reason", quote(f.reason));
      row(f.isEscrow ? "Escrow id" : "Request id", code(f.id.toString()));
      if (f.isEscrow) {
        warn("red", "The money goes back to the sender. The approver is not paid. This cannot be undone.");
        out.hold = true;
      }
      break;
    }
    case 5:
      describeMultisig(tx, ctx, out, warn, row);
      break;
    case 55:
    case 58: {
      const m = f.member;
      out.kicker = "ACCOUNT GROUP";
      if (tx.type === 55) {
        out.title = `Link ${shortLabel(ctx, m)} to your account group`;
        warn("amber", "Linking is public and permanent. Everything the member owns moves into the group.");
      } else {
        out.title = `Make ${shortLabel(ctx, m)} the controller of your group`;
        warn("red", "You lose control of the group.");
        out.hold = true;
      }
      row("Member", addr(ctx, m));
      row("Consent proof kind", text(f.proof.kind === 0 ? "Raw signature" : f.proof.kind === 2 ? "Ethereum personal_sign" : "Multisig"));
      row("Valid until", blockRow(ctx, f.validUntil));
      row("Link sequence", text(f.seq));
      out.canonical.recipients.push(m.hex);
      break;
    }
    case 56: {
      const m = f.member;
      out.kicker = "ACCOUNT GROUP";
      out.title = m.hex === tx.sender.hex ? "Leave the account group" : `Remove ${shortLabel(ctx, m)} from the group`;
      row("Member", addr(ctx, m));
      out.notes.push("It leaves with nothing and becomes an empty address.");
      break;
    }
    case 57: {
      const m = f.member;
      out.kicker = "ACCOUNT GROUP";
      out.title = `Set ${shortLabel(ctx, m)}'s permissions`;
      row("Member", addr(ctx, m));
      const maySpend = !!(f.flags & 1), tokens = !!(f.flags & 2);
      if (!maySpend) row("Spending", text("Receive only"));
      else if (f.limit > 0n) row("Spending", text(`May spend up to ${formatZBC(f.limit)} per ${formatDuration(Number(f.periodBlocks) * (ctx.chain && ctx.chain.avgBlockSeconds || 60))} (${f.periodBlocks} blocks)`));
      else {
        row("Spending", text("May spend without limit"));
        warn("red", "This member may spend everything the group holds.");
      }
      row("May move tokens", yesno(tokens));
      break;
    }
    case 2: {
      out.kicker = "NODE";
      out.title = `Register node ${zbcEncode(hexToBytes(f.nodePub), "ZNK").slice(0, 17)}\u2026`;
      row("Node key", znk(f.nodePub));
      row("Owner", text(f.owner.display));
      row("Locked stake", zbc(f.locked));
      if (f.owner.hex !== tx.sender.hex) warn("red", "The owner in the body is not the sender.");
      total += f.locked;
      amt("stake", f.locked);
      nodeSenderCheck(tx, warn);
      break;
    }
    case 258:
      out.kicker = "NODE";
      out.title = `Update node stake to ${formatZBC(f.locked)}`;
      row("Node key", znk(f.nodePub));
      row("Locked stake", zbc(f.locked));
      out.notes.push("The stake may only stay or increase.");
      amt("stake", f.locked);
      nodeSenderCheck(tx, warn);
      break;
    case 514:
      out.kicker = "NODE";
      out.title = "Remove node registration";
      row("Node key", znk(f.nodePub));
      out.notes.push("The stake returns after the unlock period.");
      nodeSenderCheck(tx, warn);
      break;
    case 770:
      out.kicker = "NODE";
      out.title = "Claim node ownership";
      row("Node key", znk(f.nodePub));
      row("Proof block", blockRow(ctx, f.poown.height));
      nodeSenderCheck(tx, warn);
      break;
    case 36:
      out.kicker = "GATEWAY";
      out.title = `Register gateway ${f.domain}`;
      row("Gateway key", znk(f.gatewayKey));
      row("Domain", text(f.domain));
      row("URL", text(f.url));
      out.notes.push("Locks a 10 ZBC stake (refunded on unregister).");
      total += 10n * ATOMIC;
      nodeSenderCheck(tx, warn);
      break;
    case 38:
      out.kicker = "GATEWAY";
      out.title = "Unregister gateway";
      row("Gateway key", znk(f.gatewayKey));
      nodeSenderCheck(tx, warn);
      break;
    case 46:
      out.kicker = "ARCHIVAL";
      out.title = `Register archival ${f.domain}`;
      row("Node key", znk(f.nodePub));
      row("Domain", text(f.domain));
      row("URL", text(f.url));
      nodeSenderCheck(tx, warn);
      break;
    case 47:
      out.kicker = "ARCHIVAL";
      out.title = "Unregister archival node";
      row("Node key", znk(f.nodePub));
      nodeSenderCheck(tx, warn);
      break;
    case 48:
      out.kicker = "RELAY";
      out.title = `Register relay ${f.domain}`;
      row("Relay key", znk(f.relayKey));
      row("Gateway key", znk(f.gatewayKey));
      row("Domain", text(f.domain));
      row("URL", text(f.url));
      nodeSenderCheck(tx, warn);
      break;
    case 49:
      out.kicker = "RELAY";
      out.title = "Unregister relay";
      row("Relay key", znk(f.relayKey));
      nodeSenderCheck(tx, warn);
      break;
    case 7:
      out.kicker = "GOVERNANCE";
      out.title = "Commit a fee vote";
      row("Vote hash", code(f.voteHash));
      out.notes.push("The value stays hidden until you reveal it.");
      break;
    case 263: {
      out.kicker = "GOVERNANCE";
      out.title = `Reveal your fee vote: ${scaleText(f.feeVote)} fee scale`;
      row("Fee scale", text(scaleText(f.feeVote)));
      row("Committed at", blockRow(ctx, f.height));
      row("Block hash", code(f.blockHash));
      if (c.feeVoteInfo && String(c.feeVoteInfo).toLowerCase() !== f.info) {
        warn("red", "The body does not embed the fee vote info the page named.");
        out.canSign = false;
      }
      if (tx.sender.type === 0 && !verifyRawEd25519(tx.sender.payload, hexToBytes(f.info), hexToBytes(f.voterSig))) {
        warn("red", "The embedded voter signature does not verify against this account.");
        out.canSign = false;
      }
      break;
    }
    case 51: {
      out.kicker = "GOVERNANCE";
      out.title = `Vote ${f.parameter} = ${f.value}`;
      row("Parameter", text(f.parameter));
      row("Value", text(f.value.toString()));
      row("As node", tx.sender.type === 0 ? znk(bytesToHex(tx.sender.payload)) : text(tx.sender.display));
      if (!ctx.nodeKey) {
        warn("red", "Only an imported node key may sign a blockchain economics vote.");
        out.canSign = false;
      }
      break;
    }
    case 50: {
      out.kicker = "POLICY";
      out.title = "Change what this account transacts with";
      const off = CATEGORIES.filter((_, i) => f.mask & 1 << i);
      row("Turned off", off.length ? { kind: "list", items: off.map(text), text: off.join(", ") } : text("Nothing \u2014 everything allowed"));
      if (off.length) warn("amber", "A category turned off is refused both ways.");
      break;
    }
    case 54: {
      out.kicker = "POLICY";
      const n = f.recipients.length;
      out.title = n ? `Forward incoming money: ${n} recipient${n === 1 ? "" : "s"}` : "Clear your split policy";
      let sum = 0;
      for (const r of f.recipients) {
        sum += r.shareBp;
        row(percentOfBp(r.shareBp), addr(ctx, r.account));
        out.canonical.recipients.push(r.account.hex);
      }
      if (n) out.notes.push(`Unassigned ${percentOfBp(1e4 - sum)} stays in this account.`);
      if (sum > 1e4 || n > 10) warn("red", "Shares above 100% or more than 10 recipients \u2014 the node refuses this.");
      break;
    }
    case 24: {
      const token2 = tokenOf(ctx, f.stakeToken);
      const game2 = GAME_TYPES[f.gameType] || `type ${f.gameType}`;
      out.kicker = "GAME";
      out.title = `Start a ${game2} game \u2014 stake ${amountText(f.stake, token2)}`;
      row("Opponent", f.opponent ? addr(ctx, f.opponent) : rec ? recip() : text("Open challenge"));
      row("Seats", text(f.seats));
      row("Stake", tok(f.stake, token2));
      if (f.channel !== null) row("Payment channel", text(f.channel));
      if (token2.native) total += f.stake;
      amt("stake", f.stake);
      out.notes.push("Each move also pays the network fee.");
      break;
    }
    case 25: {
      out.kicker = "GAME";
      out.title = `Join game #${f.gameId}`;
      out.canonical.ids.game = f.gameId.toString();
      const g = c.game;
      if (g && g.stake !== void 0) {
        const token2 = tokenOf(ctx, BigInt(g.stake_token ?? g.stakeToken ?? 0));
        row("Stake", tok(BigInt(g.stake), token2));
        if (token2.native) total += BigInt(g.stake);
      } else warn("amber", "Stake unknown \u2014 could not load the game.");
      break;
    }
    case 26: {
      out.kicker = "GAME";
      out.title = `Play a move in game #${f.gameId}`;
      out.canonical.ids.game = f.gameId.toString();
      const g = c.game || {};
      const kind = g.type || g.game_type || g.gameType;
      let moveText = f.move;
      if ((kind === 1 || kind === "tic-tac-toe") && f.move.length === 2) moveText = `cell ${parseInt(f.move, 16)}`;
      else if ((kind === 2 || kind === "chess") && f.move.length === 4) {
        const b = hexToBytes(f.move);
        moveText = `${sq(b[0])} \u2192 ${sq(b[1])}`;
      }
      row("Move", code(moveText));
      out.extras.sessionKeyEligible = true;
      break;
    }
    case 27:
      out.kicker = "GAME";
      out.title = `Resign game #${f.gameId}`;
      out.canonical.ids.game = f.gameId.toString();
      warn("red", "The stake goes to your opponent.");
      out.extras.sessionKeyEligible = true;
      break;
    case 28:
      out.kicker = "GAME";
      out.title = `Claim a timeout win in game #${f.gameId}`;
      out.canonical.ids.game = f.gameId.toString();
      out.extras.sessionKeyEligible = true;
      break;
    case 17:
    default: {
      out.kicker = tx.known ? "EVENT" : "UNKNOWN";
      out.title = tx.type === 17 ? "Event attested (oracle/bridge)" : `Unknown transaction type ${tx.type}`;
      if (tx.type === 17) {
        row("Event id", text(f.eventId));
        row("Value", quote(f.value));
      }
      row("Body", code(bytesToHex(tx.body) || "(empty)"));
      row("Sender", text(tx.sender.display));
      row("Recipient", rec ? recip() : text("\u2014"));
      warn("amber", `The signer cannot describe this transaction. Sign only if you trust ${ctx.origin || "this site"} completely.`);
      out.hold = true;
      out.unknown = true;
      break;
    }
  }
  if (tx.escrow) {
    const e = tx.escrow;
    row("Approver", addr(ctx, e.approver));
    row("Commission", zbc(e.commission));
    row("Timeout", date(e.timeout));
    if (e.instruction) row("Instruction", quote(e.instruction));
    if (e.multiParty && e.requestId !== 0n) row("Pays escrow request", code("#" + e.requestId.toString()));
    amt("commission", e.commission);
  }
  if (tx.message && tx.message.length && tx.type !== 0) row("Message", tx.encrypted ? text("Encrypted note (only the recipient can read it)") : quote(tx.messageText ?? bytesToHex(tx.message)));
  if (tx.message && tx.message.length > 256) warn("amber", "The message is longer than 256 bytes; the node may refuse it.");
  if (tx.version === 1 && !tx.inner) warn("amber", "Version 1 envelope (no survival field); current nodes expect version 2.");
  out.common = [];
  out.common.push({ label: tx.type === 5 ? "Your network fee" : "Network fee", value: zbc(tx.fee) });
  if (tx.survival && tx.survival > 0n) out.common.push({ label: "Kept on chain", value: zbc(tx.survival) });
  if (tx.escrow) out.common.push({ label: "Escrow commission", value: zbc(tx.escrow.commission) });
  out.total = total;
  amt("total", total);
  out.common.push({ label: "Total leaving the account", value: zbc(total), bold: true });
  const now2 = ctx.now || Math.floor(Date.now() / 1e3);
  const ts = Number(tx.timestamp);
  if (ts < now2 - 3600) warn("amber", "Old request \u2014 the network may refuse it.");
  if (ts > now2 + 300) warn("amber", "The timestamp is more than 5 minutes in the future.");
  if (tx.fee === 0n) warn("amber", "Zero fee; the node will refuse it.");
  return out;
}
function shortLabel(ctx, a) {
  const l = ctx.labelFor ? ctx.labelFor(a.hex) : null;
  return l || (a.display.length > 20 ? a.display.slice(0, 12) + "\u2026" : a.display);
}
function nodeSenderCheck(tx, warn) {
  if (tx.sender.type !== 0) warn("red", "Node and infrastructure transactions must be sent from a ZooBC account.");
}
function scaleText(feeVote) {
  const v = Number(feeVote) / 1e4;
  return `${v.toFixed(2).replace(/\.?0+$/, "")}\xD7`;
}
function sq(b) {
  return "abcdefgh"[b % 8] + (Math.floor(b / 8) + 1);
}
function describeMultisig(tx, ctx, out, warn, row) {
  const f = tx.fields;
  out.kicker = "MULTISIG";
  const c = ctx.context || {};
  const shape = f.info && !f.inner ? "create" : f.info && f.inner ? "propose" : !f.info && !f.inner && f.sigs ? "cosign" : "other";
  const nestedCtx = { ...ctx, context: c.inner || {} };
  const inner = (innerTx) => {
    const d = describe(innerTx, nestedCtx);
    d.senderAddress = innerTx.sender.display;
    return d;
  };
  if (f.info) {
    const parts = f.info.participants;
    const addrHash = multisigAddress(f.info.min, f.info.nonce, parts.map((p) => p.typed));
    const addrTyped = typed(0, addrHash);
    out.extras.multisigAddress = display(addrTyped);
    out.extras.multisigHex = bytesToHex(addrTyped);
    if (shape === "create") {
      out.title = "Create a multisig account";
      row("Participants", { kind: "list", items: parts.map((p) => addr(ctx, p)), text: parts.map((p) => p.display).join(", ") });
      row("Signatures required", text(`${f.info.min} of ${parts.length}`));
      row("Nonce", text(f.info.nonce.toString()));
      row("Resulting address", code(display(addrTyped)));
      return;
    }
    if (shape === "propose") {
      out.title = "Propose a multisig transaction";
      if (f.inner.sender.hex !== bytesToHex(addrTyped)) {
        warn("red", "The inner transaction's sender is not the multisig these participants form.");
        out.canSign = false;
      }
      out.nested = inner(f.inner);
      row("Participants", text(`${parts.length}`));
      row("Signatures required", text(`${f.info.min} of ${parts.length}`));
      const have = f.sigs ? f.sigs.list.length : 0;
      row("Signatures so far", text(`${have} of ${f.info.min} \xB7 yours makes ${have + 1}`));
      checkInnerHash(f, warn, out);
      return;
    }
  }
  if (shape === "cosign") {
    out.title = "Add your signature to a multisig transaction";
    const innerHex = c.multisigInner;
    if (!innerHex) {
      warn("red", "The page did not provide what you are signing.");
      out.canSign = false;
      row("Inner hash", code(f.sigs.hash));
    } else {
      let innerBytes;
      try {
        innerBytes = hexToBytes(innerHex);
      } catch {
        innerBytes = null;
      }
      const h = innerBytes ? bytesToHex(sha3_256(innerBytes)) : null;
      if (h !== f.sigs.hash) {
        warn("red", "The inner transaction the page provided does not match the hash being signed.");
        out.canSign = false;
        row("Inner hash", code(f.sigs.hash));
      } else {
        try {
          const { decodeTransaction: decodeTransaction2 } = ctx.decoder;
          const innerTx = decodeTransaction2(innerBytes, { inner: true });
          out.nested = inner(innerTx);
          out.extras.innerBytes = innerBytes;
          out.notes.push(`Inner hash ${f.sigs.hash.slice(0, 4)}\u2026${f.sigs.hash.slice(-4)} \u2713 matches the proposal`);
        } catch (e) {
          warn("red", "The inner transaction the page provided does not decode: " + e.message);
          out.canSign = false;
        }
      }
    }
    const have = f.sigs.list.length;
    row("Signatures", text(c.min ? `${have} of ${c.min} \xB7 yours makes ${have + 1}` : `${have} so far \xB7 yours makes ${have + 1}`));
    return;
  }
  out.title = "Multisignature transaction";
  warn("amber", "Unusual multisig shape; check the raw bytes.");
  out.hold = true;
  if (f.inner) out.nested = inner(f.inner);
}
function checkInnerHash(f, warn, out) {
  if (f.sigs && f.innerBytes) {
    const h = bytesToHex(sha3_256(f.innerBytes));
    if (h !== f.sigs.hash) {
      warn("red", "The signature block's hash does not match the inner transaction.");
      out.canSign = false;
    }
  }
}
function describeParticipant(innerTx, ctx, ms) {
  const d = describe(innerTx, ctx);
  const out = { ...d, rows: [], nested: d, kicker: "MULTISIG", hold: false };
  out.title = ms.role === "cosign" ? "Add your signature to a multisig transaction" : "Sign as a participant of a multisig account";
  if (ms.participants) out.rows.push({ label: "Participants", value: text(String(ms.participants.length)) });
  if (ms.min) out.rows.push({ label: "Signatures required", value: text(String(ms.min)) });
  out.common = [];
  out.total = 0n;
  out.notes = [];
  out.warnings = d.warnings.filter((w) => w.level === "red");
  return out;
}

// src/lib/intent.js
var AMOUNT_LABELS = /amount|total|stake|pay|price|value|fee|commission|deposit/i;
var ADDRESS_LABELS = /to|recipient|payee|beneficiary|address|payer|approver|member|owner|counterparty|new recipient/i;
function compareIntent(described, intent = {}) {
  const diffs = [];
  if (intent.typeName && !typeNameMatches(described.type, intent.typeName)) {
    diffs.push({ label: "Type", site: intent.typeName, tx: described.typeName, severity: "warn" });
  }
  const rows = Array.isArray(intent.rows) ? intent.rows : [];
  const amounts = described.canonical.amounts;
  const recipients = described.canonical.recipients;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const label = String(r[0]), val = String(r[1]);
    if (AMOUNT_LABELS.test(label)) {
      const key = Object.keys(amounts).find((k) => label.toLowerCase().includes(k)) || (/total/i.test(label) ? "total" : "amount");
      if (amounts[key] === void 0) continue;
      const m = /-?[\d\s, ]*\.?\d+/.exec(val.replace(/[ \s](?=\d{3})/g, ""));
      if (!m) continue;
      const claimed = parseUnits(m[0], 8);
      if (claimed === null) continue;
      const actual = amounts[key];
      if (claimed !== actual) diffs.push({ label, site: val, tx: txAmountText(described, key), severity: "warn" });
    } else if (ADDRESS_LABELS.test(label)) {
      const p = parseAddress(val.trim());
      if (!p) continue;
      if (recipients.length && !recipients.includes(p.hex)) {
        const shown = described.rows.find((x) => x.value && x.value.kind === "address");
        diffs.push({ label, site: val, tx: shown ? shown.value.display : recipients[0], severity: "red" });
      }
    }
  }
  return { ok: diffs.length === 0, diffs };
}
function txAmountText(described, key) {
  const all = [...described.rows, ...described.common || []];
  const r = all.find((x) => x.label.toLowerCase().includes(key) && x.value && x.value.kind === "amount");
  return r ? r.value.text : described.canonical.amounts[key].toString();
}

// src/lib/errors.js
var ERR = {
  REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED: 4200,
  BAD_REQUEST: 4300,
  NOT_HELD: 4404,
  NOT_SHARED: 4405,
  CANNOT_SIGN: 4406,
  LOCKED: 4900,
  WRONG_CHAIN: 4901,
  INTERNAL: 5e3
};
var ERR_TEXT = {
  4001: "User rejected",
  4100: "Origin not authorised (call zbc_requestAccounts first)",
  4200: "Method not supported",
  4300: "Bytes do not decode, or the decoded transaction contradicts the request",
  4404: "Account not held by this signer",
  4405: "Account held but not shared with this origin",
  4406: "Account cannot sign this",
  4900: "Signer locked",
  4901: "Wrong chain: the page is on a different network than the signer",
  5e3: "Internal error"
};
var RpcError = class extends Error {
  constructor(code2, message) {
    super(message || ERR_TEXT[code2] || "Error");
    this.code = code2;
    this.name = "RpcError";
  }
  toJSON() {
    return { code: this.code, message: this.message };
  }
};
function rpcError(code2, message) {
  return new RpcError(code2, message);
}
function asRpcError(e) {
  if (e instanceof RpcError) return e;
  if (e && e.code === 4300) return new RpcError(4300, e.message);
  return new RpcError(5e3, e && e.message || String(e));
}

// src/lib/serialize.js
function jsonSafe(v) {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return bytesToHex(v);
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) {
      if (typeof v[k] === "function") continue;
      o[k] = jsonSafe(v[k]);
    }
    return o;
  }
  return v;
}

// src/lib/requests.js
function normalizeAccount(input) {
  if (typeof input !== "string" || !input.trim()) throw rpcError(ERR.BAD_REQUEST, "account is required");
  const p = parseTypedHex(input.trim()) || parseAddress(input.trim());
  if (!p) throw rpcError(ERR.BAD_REQUEST, "account is not a recognised address");
  return p;
}
function parseUnsigned(hex) {
  if (typeof hex !== "string" || !isHex(hex.replace(/^0x/, "")) || !hex.length) throw rpcError(ERR.BAD_REQUEST, "unsignedTx must be hex");
  const bytes = hexToBytes(hex);
  try {
    return decodeTransaction(bytes);
  } catch (e) {
    throw rpcError(ERR.BAD_REQUEST, "The transaction bytes do not decode: " + e.message);
  }
}
function isDisguisedTransaction(bytes) {
  if (bytes.length === 32) return true;
  const t = fromUtf8(bytes);
  if (t && /^[0-9a-fA-F]{64}$/.test(t.trim())) return true;
  try {
    decodeTransaction(bytes);
    return true;
  } catch {
  }
  if (t && /^[0-9a-fA-F]+$/.test(t.trim()) && t.trim().length % 2 === 0) {
    try {
      decodeTransaction(hexToBytes(t.trim()));
      return true;
    } catch {
    }
  }
  return false;
}
function originFlags(origin) {
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
  }
  const insecure = origin.startsWith("http:");
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[");
  const idn = host.includes("xn--");
  return { host, insecure, ip, idn, shown: origin.replace(/^https?:\/\//, "") };
}
function buildTxView(params, account3, ctx) {
  const tx = parseUnsigned(params.unsignedTx);
  const context = params.context && typeof params.context === "object" ? params.context : {};
  const ms = context.multisig;
  let described, participantOf = null;
  if (ms && typeof ms === "object") {
    if (ms.participants && Array.isArray(ms.participants)) {
      const parts = ms.participants.map((p) => normalizeAccount(String(p)));
      if (!parts.some((p) => p.hex === account3.hex)) throw rpcError(ERR.BAD_REQUEST, "The requested account is not a participant of this multisig.");
      const addrHash = multisigAddress(Number(ms.min), BigInt(ms.nonce ?? 0), parts.map((p) => p.typed));
      const addrTyped = typed(0, addrHash);
      if (bytesToHex(addrTyped) !== tx.sender.hex) throw rpcError(ERR.BAD_REQUEST, "The inner transaction is not from the multisig these participants form.");
      participantOf = { address: display(addrTyped), hex: bytesToHex(addrTyped), min: Number(ms.min), participants: parts.map((p) => p.hex), role: ms.role || "propose" };
    } else if (ms.address) {
      const a = normalizeAccount(String(ms.address));
      if (a.hex !== tx.sender.hex) throw rpcError(ERR.BAD_REQUEST, "The inner transaction is not from the multisig the page named.");
      participantOf = { address: a.display, hex: a.hex, min: ms.min ? Number(ms.min) : void 0, participants: void 0, role: ms.role || "cosign" };
    } else throw rpcError(ERR.BAD_REQUEST, "context.multisig needs participants or an address.");
    described = describeParticipant(tx, { ...ctx, decoder: decoder_exports, context }, participantOf);
  } else {
    if (tx.type !== 5 && tx.sender.hex !== account3.hex) throw rpcError(ERR.BAD_REQUEST, "The transaction is from a different account than requested.");
    if (tx.type === 5 && tx.sender.hex !== account3.hex) throw rpcError(ERR.BAD_REQUEST, "The multisig outer is from a different account than requested.");
    described = describe(tx, { ...ctx, decoder: decoder_exports, context });
  }
  if (tx.type === 263 && context.feeVoteInfo && String(context.feeVoteInfo).toLowerCase() !== tx.fields.info) throw rpcError(ERR.BAD_REQUEST, "The fee vote info in the body differs from context.feeVoteInfo.");
  const intent = normalizeIntent(params.intent);
  const match = compareIntent(described, intent);
  const view = {
    kind: "tx",
    typeName: canonicalTypeName(tx.type),
    type: tx.type,
    participantOf,
    described: jsonSafe(described),
    intent,
    match,
    unsignedTx: bytesToHex(tx.unsigned),
    raw: { hex: bytesToHex(tx.unsigned), fields: fieldTree(tx).map(([k, v]) => [k, String(v)]) },
    mode: params.mode === "submit" ? "submit" : "sign",
    node: params.node,
    timestamp: tx.timestamp.toString(),
    fee: tx.fee.toString(),
    checks: []
  };
  if (ctx.feeMinimum !== void 0 && ctx.feeMinimum !== null && tx.fee < ctx.feeMinimum) view.checks.push({ level: "amber", text: `Fee is below the network minimum (${formatZBC(ctx.feeMinimum)}); the node will refuse it.` });
  if (ctx.feeCheckFailed) view.checks.push({ level: "note", text: "Could not check the fee \u2014 verify on the site." });
  if ([11, 12, 13, 14].includes(tx.type) && ctx.tokenExpired) {
    view.checks.push({ level: "red", text: "This token has expired." });
    view.described.canSign = false;
  }
  return { view, tx };
}
function normalizeIntent(intent) {
  const i = intent && typeof intent === "object" ? intent : {};
  const rows = Array.isArray(i.rows) ? i.rows.filter((r) => Array.isArray(r) && r.length >= 2).map((r) => [String(r[0]).slice(0, 60), String(r[1]).slice(0, 300)]).slice(0, 30) : [];
  return { title: String(i.title || "").slice(0, 120), summary: String(i.summary || "").slice(0, 600), typeName: i.typeName ? String(i.typeName).slice(0, 60) : "", rows };
}
var DIGEST_KINDS = ["group-link", "group-control", "escrow-cosign", "relay-permit", "multisig-consent", "fee-vote-reveal"];
function buildDigestView(params, account3, ctx) {
  const kind = params.kind;
  const pre = params.preimage && typeof params.preimage === "object" ? params.preimage : null;
  const digestHex = typeof params.digest === "string" ? params.digest.toLowerCase().replace(/^0x/, "") : "";
  if (!DIGEST_KINDS.includes(kind)) {
    if (!pre && ctx.blindDigest && /^[0-9a-f]{64}$/.test(digestHex)) {
      return { kind: "digest", digestKind: "blind", title: "Sign an opaque 32-byte digest", rows: [{ label: "Digest", value: { kind: "code", text: digestHex } }], warnings: [{ level: "red", text: `You are about to sign bytes the signer cannot describe. ${ctx.origin} could make this mean anything, including moving all your funds.` }], notes: [], digest: digestHex, hold: true, blind: true, scheme: "envelope" };
    }
    throw rpcError(ERR.BAD_REQUEST, pre ? `Unknown digest kind ${kind}` : "A bare digest with no preimage is refused (enable blind digest signing in Advanced settings to allow it).");
  }
  if (!pre) throw rpcError(ERR.BAD_REQUEST, "preimage is required");
  const genesis = ctx.chain.genesisBytes;
  const rows = [], warnings = [], notes = [];
  let title = "", computed, scheme = "envelope", extra = {};
  switch (kind) {
    case "group-link":
    case "group-control": {
      const controller = normalizeAccount(String(pre.controller || ""));
      const member = normalizeAccount(String(pre.member || ""));
      if (member.hex !== account3.hex) throw rpcError(ERR.BAD_REQUEST, "The consent names a different member than the requested account.");
      const validUntil = Number(pre.validUntil), seq = Number(pre.seq || 0);
      if (!Number.isInteger(validUntil) || validUntil < 0) throw rpcError(ERR.BAD_REQUEST, "validUntil must be a block height");
      if (pre.genesis && String(pre.genesis).toLowerCase() !== ctx.chain.genesis) throw rpcError(ERR.WRONG_CHAIN, "The consent is for a different network");
      computed = groupConsentDigest(kind, { controller: controller.typed, member: member.typed, validUntil, seq, genesis });
      title = kind === "group-link" ? "Join an account group" : "Become controller of an account group";
      rows.push({ label: "Group controller", value: { kind: "address", hex: controller.hex, display: controller.display, label: ctx.labelFor ? ctx.labelFor(controller.hex) : null, text: controller.display } });
      rows.push({ label: "Valid until", value: { kind: "block", height: validUntil, text: `block ${validUntil}` + (ctx.chain.height ? ` (\u2248 ${Math.max(1, Math.round((validUntil - ctx.chain.height) * (ctx.chain.avgBlockSeconds || 60) / 60))} min)` : "") } });
      rows.push({ label: "Link sequence", value: { kind: "text", text: String(seq) } });
      notes.push("Everything this address owns moves into the group. It joins able to receive only. Linking is public and permanent history.");
      extra.proofKind = account3.type === 4 ? 2 : 0;
      extra.hold = true;
      break;
    }
    case "escrow-cosign": {
      const tx = parseUnsigned(String(pre.unsignedTx || ""));
      if (!tx.escrow) throw rpcError(ERR.BAD_REQUEST, "The payer transaction carries no escrow.");
      if (!tx.escrow.multiParty || tx.escrow.cosig && tx.escrow.cosig.length) throw rpcError(ERR.BAD_REQUEST, "The co-signature field must be present and empty.");
      if (!tx.recipient || tx.recipient.hex !== account3.hex) throw rpcError(ERR.BAD_REQUEST, "You are not the recipient of this escrow.");
      computed = txDigest(tx.unsigned, genesis, ctx.chain.tag);
      const d = describe(tx, { ...ctx, decoder: decoder_exports, context: {} });
      title = "Co-sign an escrow payment to you";
      extra.nested = jsonSafe(d);
      break;
    }
    case "relay-permit": {
      const from = String(pre.from || "").toLowerCase(), to = String(pre.to || "").toLowerCase(), exp = Number(pre.exp);
      if (account3.type !== 0) throw rpcError(ERR.CANNOT_SIGN, "Relay permits are signed by ZooBC accounts only");
      if (from !== bytesToHex(account3.payload)) throw rpcError(ERR.BAD_REQUEST, "The permit is for a different key than the requested account.");
      if (!/^[0-9a-f]{64}$/.test(to) || !Number.isFinite(exp)) throw rpcError(ERR.BAD_REQUEST, "bad relay permit preimage");
      const msg = relayPermitMessage({ from, to, exp });
      computed = msg;
      scheme = "raw";
      title = "Allow a contact to leave you messages";
      const contact = display(typed(0, hexToBytes(to)));
      rows.push({ label: "Contact", value: { kind: "address", hex: bytesToHex(typed(0, hexToBytes(to))), display: contact, text: contact } });
      rows.push({ label: "Expires", value: { kind: "date", unix: exp, text: String(exp) } });
      extra.digestIsMessage = true;
      break;
    }
    case "multisig-consent": {
      const controller = normalizeAccount(String(pre.controller || ""));
      const member = normalizeAccount(String(pre.member || ""));
      const parts = Array.isArray(pre.participants) ? pre.participants.map((p) => normalizeAccount(String(p))) : null;
      if (!parts || !parts.some((p) => p.hex === account3.hex)) throw rpcError(ERR.BAD_REQUEST, "The requested account is not a participant.");
      const addrHash = multisigAddress(Number(pre.min), BigInt(pre.nonce ?? 0), parts.map((p) => p.typed));
      if (bytesToHex(typed(0, addrHash)) !== member.hex) throw rpcError(ERR.BAD_REQUEST, "The participants do not form the multisig member named.");
      const validUntil = Number(pre.validUntil), seq = Number(pre.seq || 0);
      computed = groupConsentDigest(pre.control ? "group-control" : "group-link", { controller: controller.typed, member: member.typed, validUntil, seq, genesis });
      title = "Consent for a multisig account to join a group";
      rows.push({ label: "Multisig", value: { kind: "address", hex: member.hex, display: member.display, text: member.display } });
      rows.push({ label: "Group controller", value: { kind: "address", hex: controller.hex, display: controller.display, text: controller.display } });
      rows.push({ label: "Valid until", value: { kind: "block", height: validUntil, text: `block ${validUntil}` } });
      notes.push("Everything the multisig owns moves into the group. Linking is public and permanent history.");
      extra.hold = true;
      break;
    }
    case "fee-vote-reveal": {
      if (account3.type !== 0) throw rpcError(ERR.CANNOT_SIGN, "Fee vote reveals are signed by ZooBC accounts only");
      let info;
      try {
        info = feeVoteInfo({ recentBlockHash: String(pre.recentBlockHash), height: Number(pre.height), feeVote: BigInt(pre.feeVote) });
      } catch (e) {
        throw rpcError(ERR.BAD_REQUEST, "bad fee vote preimage: " + e.message);
      }
      computed = info;
      scheme = "raw";
      const scale = (Number(pre.feeVote) / 1e4).toFixed(2).replace(/\.?0+$/, "") + "\xD7";
      title = "Reveal your fee vote";
      rows.push({ label: "Proposed fee scale", value: { kind: "text", text: scale } });
      rows.push({ label: "Committed at", value: { kind: "block", height: Number(pre.height), text: `block ${pre.height}` } });
      notes.push("This proves the vote you committed earlier. Nothing leaves the account except the network fee of the reveal transaction that follows.");
      break;
    }
  }
  const computedHex = bytesToHex(computed);
  if (digestHex !== computedHex) throw rpcError(ERR.BAD_REQUEST, "The digest the page sent does not match the recomputed one.");
  return { kind: "digest", digestKind: kind, title, rows, warnings, notes, digest: computedHex, scheme, hold: !!extra.hold, proofKind: extra.proofKind, nested: extra.nested || null, network: genesisShort(ctx.chain.genesis) };
}
function buildMessageView(params, account3, ctx) {
  let bytes, shown, encoding = params.encoding === "hex" ? "hex" : "utf8";
  const m = params.message;
  if (typeof m !== "string") throw rpcError(ERR.BAD_REQUEST, "message must be a string");
  if (encoding === "hex") {
    if (!isHex(m.replace(/^0x/, ""))) throw rpcError(ERR.BAD_REQUEST, "message is not hex");
    bytes = hexToBytes(m);
  } else bytes = utf8(m);
  if (!bytes.length) throw rpcError(ERR.BAD_REQUEST, "message is empty");
  if (bytes.length > 4096) throw rpcError(ERR.BAD_REQUEST, "message too long");
  if (isDisguisedTransaction(bytes)) throw rpcError(ERR.BAD_REQUEST, "Refused: the message looks like a transaction or a digest.");
  const text2 = fromUtf8(bytes);
  shown = text2 !== null ? text2 : bytesToHex(bytes);
  const digest = messageDigest(bytes, ctx.chain.genesisBytes);
  return { kind: "message", title: "Sign a message", message: shown, isHexShown: text2 === null, digest: bytesToHex(digest), rows: [], notes: ["Signing a message proves you control this address. It cannot move funds."], warnings: [] };
}
function buildMultisigView(params, setup, heldAccounts, ctx) {
  const inner = parseUnsigned(String(params.inner || ""));
  const parts = setup.participants.map((h) => parseTypedHex(h));
  const addrHash = multisigAddress(setup.min, BigInt(setup.nonce), parts.map((p) => p.typed));
  const hex = bytesToHex(typed(0, addrHash));
  if (hex !== setup.typed) throw rpcError(ERR.INTERNAL, "stored multisig setup is inconsistent");
  if (inner.sender.hex !== hex) throw rpcError(ERR.BAD_REQUEST, "The inner transaction is not from this multisig.");
  const described = describe(inner, { ...ctx, decoder: decoder_exports, context: params.context && params.context.inner || {} });
  const held = parts.map((p) => {
    const h = heldAccounts.find((a) => a.hex === p.hex);
    return { hex: p.hex, display: p.display, format: formatOfType(p.type) || ACCOUNT_TYPES[p.type].name, held: !!h, label: h ? h.label : null, btc: h ? h.btc : void 0 };
  });
  const heldCount = held.filter((h) => h.held).length;
  const signWith = Math.min(heldCount, setup.min);
  const intent = normalizeIntent(params.intent);
  const match = compareIntent(described, intent);
  return {
    kind: "multisig",
    title: "Propose a multisig transaction",
    setup: { label: setup.label, address: setup.address, hex: setup.typed, min: setup.min, n: parts.length, nonce: String(setup.nonce) },
    nested: jsonSafe(described),
    participants: held,
    heldCount,
    signWith,
    need: setup.min,
    remaining: Math.max(0, setup.min - signWith),
    firstHeld: held.find((h) => h.held),
    innerHex: bytesToHex(inner.unsigned),
    intent,
    match,
    canSign: described.canSign && heldCount > 0,
    raw: { hex: bytesToHex(inner.unsigned), fields: fieldTree(inner).map(([k, v]) => [k, String(v)]) }
  };
}

// src/lib/node.js
var NETWORKS = {
  testnet: { id: "testnet", label: "TestNet", node: "https://zoobc.net", genesisHint: "6E75CA67A798331A" },
  mainnet: { id: "mainnet", label: "MainNet", node: "https://zoobc.network", genesisHint: null }
};
var infoCache = /* @__PURE__ */ new Map();
async function getJson(url, { timeout = 6e3, method = "GET", body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method, body, signal: ctl.signal, headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" } });
    const text2 = await res.text();
    let json = null;
    try {
      json = JSON.parse(text2);
    } catch {
    }
    return { ok: res.ok, status: res.status, json, text: text2 };
  } finally {
    clearTimeout(t);
  }
}
function normalizeNodeUrl(u) {
  const s = String(u || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+/.test(s)) return null;
  return s;
}
async function nodeInfo(node, { force = false } = {}) {
  const base = normalizeNodeUrl(node);
  if (!base) throw new Error("node URL must be https");
  const c = infoCache.get(base);
  if (!force && c && Date.now() - c.at < 6e4) return c.info;
  const r = await getJson(base + "/api/v1/node/info");
  if (!r.ok || !r.json) throw new Error(`node/info failed (${r.status})`);
  const g = String(r.json.genesis_hash || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(g)) throw new Error("node/info has no 32-byte genesis_hash");
  const info = { genesis: g, tag: r.json.signing_tag || "ZBC-TX", signingVersion: r.json.signing_version || 1, height: r.json.blockchain_height || r.json.height || null, raw: r.json };
  infoCache.set(base, { at: Date.now(), info });
  return info;
}
async function token(node, id) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/tokens/${encodeURIComponent(id)}`);
  if (!r.ok || !r.json) return null;
  const t = r.json.token || r.json;
  return { id: String(t.id ?? t.token_id ?? id), symbol: t.symbol, name: t.name, decimals: Number(t.decimals ?? 0), supply: t.supply, backing: t.backing ?? t.backing_locked, redeemable: t.redeemable ?? (t.flags !== void 0 ? !!(t.flags & 1) : void 0), mintable: t.mintable ?? (t.flags !== void 0 ? !!(t.flags & 2) : void 0), persist_height: t.persist_height ?? t.persistHeight ?? null };
}
async function transaction(node, hash) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions/${hash}`);
  return r.ok ? r.json : null;
}
async function escrowDetails(node, hash) {
  const t = await transaction(node, hash);
  if (!t) return null;
  const e = t.escrow || {};
  return { payer: t.sender || t.sender_account_address, recipient: t.recipient || t.recipient_account_address, amount: t.amount ?? (t.detail && t.detail.amount), commission: e.commission, instruction: e.instruction, timeout: e.timeout, status: e.status || t.escrow_status || "pending", raw: t };
}
async function offer(node, id) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/offers/${id}`);
  return r.ok ? r.json.offer || r.json : null;
}
async function market(node, id) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/markets/${id}`);
  return r.ok ? r.json.market || r.json : null;
}
async function game(node, id) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/apps/${id}`);
  return r.ok ? r.json.app || r.json : null;
}
async function estimateFee(node, { type, bodyLength, messageLength }) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions/estimate-fee?type=${type}&body_length=${bodyLength}&message_length=${messageLength}`);
  if (!r.ok || !r.json) return null;
  const v = r.json.fee ?? r.json.min_fee ?? r.json.estimated_fee;
  return v === void 0 ? null : BigInt(v);
}
async function account2(node, address) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/accounts/${encodeURIComponent(address)}`);
  if (!r.ok || !r.json) return null;
  return { balance: r.json.spendable_balance ?? r.json.balance ?? 0, total: r.json.total_balance ?? r.json.balance ?? 0, raw: r.json };
}
async function submit(node, payloadJson) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions`, { method: "POST", body: payloadJson, timeout: 15e3 });
  const j = r.json || {};
  const ok = r.ok || j.status === "success";
  return { ok, status: r.status, duplicate: !!j.duplicate, hash: j.transaction_hash || null, error: ok ? null : j.error || r.text || `HTTP ${r.status}`, response: j };
}

// src/lib/vectors.json
var vectors_default = { addresses: [{ input: "ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "zbc_2bflemtu_fo2kwoqt_nc6umfpe_43icesvx_diawxl4f_ecrtfslx_q43uiv2i", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "ZBC-2BFLEMTU-FO2KWOQT-NC6UMFPE-43ICESVX-DIAWXL4F-ECRTFSLX-Q43UIV2I", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "ZBC-2BFLEMTU_FO2KWOQT-NC6UMFPE_43ICESVX-DIAWXL4F_ECRTFSLX-Q43UIV2I", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "ZNK_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I", valid: false }, { input: "ZNK_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43WTXZ7", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2J", valid: false }, { input: "ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX", valid: false }, { input: "5e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "5E8EB28DCCAA94A992F7169FA67966207D96AA55DF7D24D2D6EC1F538C9F2152", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", valid: true, account_type: 4, address_bytes: "04000000d8da6bf26964af9d7eed9e03e53415d37aa96045" }, { input: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", valid: true, account_type: 4, address_bytes: "04000000d8da6bf26964af9d7eed9e03e53415d37aa96045" }, { input: "d8da6bf26964af9d7eed9e03e53415d37aa96045", valid: false }, { input: "0x1234", valid: false }, { input: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", valid: true, account_type: 5, address_bytes: "0500000077bff20c60e522dfaa3350c39b030a5d004e839a" }, { input: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", valid: true, account_type: 6, address_bytes: "06000000b472a266d0bd89c13706a4132ccfb16f7c3b9fcb" }, { input: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", valid: true, account_type: 7, address_bytes: "07000000751e76e8199196d454941c45d1b3a323f1433bd6" }, { input: "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", valid: true, account_type: 8, address_bytes: "080000001863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262" }, { input: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", valid: true, account_type: 9, address_bytes: "09000000a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c" }, { input: "11111111111111111111111111111111", valid: true, account_type: 11, address_bytes: "0b0000000000000000000000000000000000000000000000000000000000000000000000" }, { input: "So11111111111111111111111111111111111111112", valid: true, account_type: 11, address_bytes: "0b000000069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f00000000001" }, { input: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5", valid: true, account_type: 12, address_bytes: "0c000000d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d" }, { input: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", valid: true, account_type: 12, address_bytes: "0c000000d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d" }, { input: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8", valid: true, account_type: 15, address_bytes: "0f0000005cbdd86a2fa8dc4bddd8a8f69dba48572eec07fb" }, { input: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH", valid: true, account_type: 14, address_bytes: "0e00000093b89afcad4c8eac2b131c1331fef12ae1522bbe" }, { input: "tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx", valid: true, account_type: 16, address_bytes: "1000000002298c03ed7d454a101eb7022bc95f7e5f41ac78" }, { input: "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps", valid: false }, { input: "addr1vyqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qavsj8u", valid: true, account_type: 13, address_bytes: "0d0000000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c" }, { input: "", valid: false }, { input: "hello", valid: false }, { input: "ZBC_", valid: false }, { input: "ZBCL2HLFDOMVKKKTEXXC2P2M6LGEB6ZNKSV356SJUWW5QPVHDE7EFJA3PEX", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "zbc2bflemtufo2kwoqtnc6umfpe43icesvxdiawxl4fecrtfslxq43uiv2i", valid: true, account_type: 0, address_bytes: "00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737" }, { input: "ZBSL2HLFDOMVKKKTEXXC2P2M6LGEB6ZNKSV356SJUWW5QPVHDE7EFJA3PEX", valid: false }, { input: "ZBC_L2HLFDOM_VKKKTEXX_C2P2M6 LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "ZBC	L2HLFDOM	VKKKTEXX	C2P2M6LG	EB6ZNKSV	356SJUWW	5QPVHDE7	EFJA3PEX", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "  ZBC-L2HLFDOM-VKKKTEXX-C2P2M6LG-EB6ZNKSV-356SJUWW-5QPVHDE7-EFJA3PEX\n", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "ZNKL2HLFDOMVKKKTEXXC2P2M6LGEB6ZNKSV356SJUWW5QPVHDE7EFJA3PEX", valid: false }, { input: "zbcl2hlfdomvkkktexxc2p2m6lgeb6znksv356sjuww5qpvhde7efja3pe8", valid: false }, { input: "ZBCL2HLFDOMVKKKTEXXC2P2M6LGEB6ZNKSV356SJUWW5QPVHDE7EFJA3PE", valid: false }, { input: "d8da6bf26964af9d7eed9e03e53415d37aa96045", chain: "eth", valid: true, account_type: 4, address_bytes: "04000000d8da6bf26964af9d7eed9e03e53415d37aa96045" }, { input: "5e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152", chain: "zbc", valid: true, account_type: 0, address_bytes: "000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152" }, { input: "11111111111111111111111111111111", chain: "sol", valid: true, account_type: 11, address_bytes: "0b0000000000000000000000000000000000000000000000000000000000000000000000" }, { input: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "btc", valid: true, account_type: 4, address_bytes: "04000000d8da6bf26964af9d7eed9e03e53415d37aa96045" }], seeds: [{ seed: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", public_key: "5e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152", address: "ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX", node_address: "ZNK_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJH435X" }, { seed: "1111111111111111111111111111111111111111111111111111111111111111", public_key: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737", address: "ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I", node_address: "ZNK_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43WTXZ7" }, { seed: "2222222222222222222222222222222222222222222222222222222222222222", public_key: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0", address: "ZBC_UCNKL5D2_M5MYAL7Z_KX4NYLJK_CSS4THJD_X2L7QZAS_P74TQNCV_UTYAGL5D", node_address: "ZNK_UCNKL5D2_M5MYAL7Z_KX4NYLJK_CSS4THJD_X2L7QZAS_P74TQNCV_UTYHLHBQ" }], wallets: [{ mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", passphrase: "", accounts: [{ index: 0, seed: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", address: "ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX" }, { index: 1, seed: "2c0f8a5722d5701a7a4e7d61219c5235a9b74ba46fdbaff9f7978ec7bc14f85d", address: "ZBC_7VCHFO66_YQ5ZDGVD_PONTGZVD_GGHSSAVH_KOQV6X6W_2Q6EJNIS_DNTVIFT4" }, { index: 2, seed: "930baeed63aeba93c19ad9cf2106923495f5d693273de3db962c30c517f441b3", address: "ZBC_JHXE32WI_MWWDLBD7_M574IB4T_TCLVICYB_4HXSDECS_Y644KK24_4KO24BCC" }] }, { mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", passphrase: "TREZOR", accounts: [{ index: 0, seed: "c7c232cb15e54c5753957152dcb440decb04d6e9a465967140255b8db040d6e1", address: "ZBC_FM7CUJXC_B4VN5RLQ_XXFMZKDO_ZYLUG7HZ_YOYU57V4_RGYFDINT_LXHKQ7P5" }, { index: 1, seed: "b09379f2ab67198d6eff702e7a6d341f13f6f39a3c7523d21d88cc11f3ec584b", address: "ZBC_SLXNHQBE_BJPYBETU_GEEBSJZE_HVFGJCAK_H6OBOTXN_3D2VHF5R_FZYE6QAM" }, { index: 2, seed: "dfc260657a7cd8700fbdb454685995d5676b71d4f66fcee6895e6abb27f52e39", address: "ZBC_Z7VYDCA3_L77TKIIU_RAGQQCR4_ZMSYOTWX_277JGIYQ_6DTSILLC_NFARS45R" }] }], transactions: [{ name: "send-zbc/plain", key: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", genesis: "cf30b4a8c165da3bc004b3a397b18c68986271b0395f9df0e984552fb455cf1d", unsigned: "010000000100f1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152404b4c00000000000800000000e1f505000000000200000000000000", digest: "4ae94781c3c811882e89f21534002827e25002f65088b854d58fe358e88451f3", signature: "2ba02b283e8c8492cebd0cc59f264a470223bb807b97245f37ccaa8aea9acce09737344044fb7269df3e6c68463a7508af74504e02fe851b73df9d22fb12d704", hash: "4ac2d11be8fe534bf2b2776fa7c1a3ece08e17f3b71e8d796545f5edde8b86fa" }, { name: "send-zbc/escrow", key: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", genesis: "cf30b4a8c165da3bc004b3a397b18c68986271b0395f9df0e984552fb455cf1d", unsigned: "010000000102f1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152404b4c00000000000800000000e1f50500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152e803000000000000d0020000000000001300000072656c65617365206f6e2064656c69766572790000000000", digest: "4421893beb03534310616068fedb772c31c7723a9034bc8b1651d81c1b3f2298", signature: "eedc777bb80ea5683a907c098037e5ac257f40d0118093c065aedb6c74b08fb5fa106a6f77c3ba47477c2e7a7da6f8487e2e385da16d6e7cd901a6626975e10c", hash: "c168466b38db35b8ed3d5e35c9e3862e17d9384bff7b999c587b0f6415ed1c63" }, { name: "send-zbc/eth-recipient", key: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", genesis: "cf30b4a8c165da3bc004b3a397b18c68986271b0395f9df0e984552fb455cf1d", unsigned: "010000000108f1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f215204000000d8da6bf26964af9d7eed9e03e53415d37aa96045404b4c00000000000800000000e1f505000000000200000000000000", digest: "b5fb202dd07d3d2e567c1b613b1120cf066a971801850d994738911a30ffdf99", signature: "ca526d91da53d38562003e7d3e8fd2e373f03e7250c7e46e5f827ade2475c9c1179eeaece9ad5f5526a390dd15946a6ad3499aa4fd4951edcc4aa9c0f899b107", hash: "d71dec287b41da6ccca38b2abef8f91d012ed5a92e5d3abd4b919da53ef21cb8" }, { name: "send-zbc/signing-v1", key: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", genesis: "v1", unsigned: "010000000100f1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152404b4c00000000000800000000e1f505000000000200000000000000", digest: "a2595c72adb86f750985979613868fe48b742d9a7606a59b519b154381109bbd", signature: "cd6b6723d610833615b13b2db318cdbafc0e1d1fc97aaff39f9f9e985532167d2535292e1b5ca8a791b538a53a4d195fc8023694e606b78aa0d6e697aaa20d0a", hash: "507dbeece11525c894401c7752b62ff77360f54674ff0c1f77918a604b5546ed" }, { name: "approve-escrow/approve", key: "51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96", genesis: "cf30b4a8c165da3bc004b3a397b18c68986271b0395f9df0e984552fb455cf1d", unsigned: "04000000010af1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f215202000000404b4c00000000002400000000000000c168466b38db35b8ed3d5e35c9e3862e17d9384bff7b999c587b0f6415ed1c630200000000000000", digest: "3420aad82e48d4b9f1713ece5327e0faa530422c62dfeae244cf0c58adc7cde4", signature: "5489979dfb6ca22b9f8c1db7b135f5512c1449123fcfd837440ad60623f8400fb6554dba345f4f355f9645d6c82ebd72e7694bade5108d361bce87daff4fd301", hash: "6928b73fad47869196a3a8417c78ba1951b03d1dc882782c00dbffc8b0b2e450" }] };

// src/lib/selftest.js
async function runSelfTests() {
  const results = [];
  const t = (name, fn) => {
    try {
      const d = fn();
      results.push({ name, ok: true, detail: d || "" });
    } catch (e) {
      results.push({ name, ok: false, detail: e.message });
    }
  };
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  t("\xA74.6 digest + signature vector", () => {
    const acc = deriveAccount({ mnemonic: ABANDON }, "ZBC", void 0, 0);
    const unsigned = hexToBytes(vectors_default.transactions[0].unsigned);
    const d = txDigest(unsigned, new Uint8Array(32).fill(90));
    if (bytesToHex(d) !== "55f3ed31e5896bb127dfa7db19f3eb1d6e35a8e49e29fcbdca24acd84c9ab955") throw new Error("digest " + bytesToHex(d));
    const s = bytesToHex(signDigest(acc.signingSecret, "ZBC", void 0, d));
    if (s !== "8934cb7019641f7be76e1fec2a7e94395140da90cfc4dad041aee5f28479eac2f86460393d9a2ea6ab246300b3531338c25e64765df25ed9b7852d681ec8bc0b") throw new Error("signature " + s);
    return acc.address;
  });
  t("group consent vectors", () => {
    const genesis = new Uint8Array(32).fill(90), controller = hexToBytes("00000000" + "11".repeat(32)), member = hexToBytes("04000000" + "22".repeat(20));
    const a = bytesToHex(groupConsentDigest("group-link", { controller, member, validUntil: 1e3, seq: 0, genesis }));
    const b = bytesToHex(groupConsentDigest("group-control", { controller, member, validUntil: 1e3, seq: 3, genesis }));
    if (a !== "999e96f16db8bf3be83b59fce3dfc56f3cc7fa0397dc80bcbaa502f24ff66120" || b !== "7b3637c306eff8f6ffefc9bc316263c292a2fbf6f4a5e01c6dba57b70278334d") throw new Error(a + " " + b);
  });
  t(`${vectors_default.addresses.length} address vectors round-trip`, () => {
    let n = 0;
    for (const v of vectors_default.addresses) {
      const r = parseAddress(v.input, v.chain);
      if (!v.valid) {
        if (r) throw new Error("accepted invalid " + v.input);
        continue;
      }
      if (!r || r.hex !== v.address_bytes || r.type !== v.account_type) throw new Error("mismatch " + v.input);
      const back = parseAddress(r.display);
      if (!back || back.hex !== v.address_bytes) throw new Error("round trip " + v.input);
      n++;
    }
    return `${n} valid`;
  });
  t("keys.json wallets (SLIP-10 m/44'/883')", () => {
    for (const w of vectors_default.wallets) for (const a of w.accounts) {
      const acc = deriveAccount({ mnemonic: w.mnemonic, passphrase: w.passphrase }, "ZBC", void 0, a.index);
      if (acc.address !== a.address) throw new Error(a.address);
    }
    for (const s of vectors_default.seeds) if (accountFromSecret(hexToBytes(s.seed), "ZBC").address !== s.address) throw new Error(s.address);
  });
  t("reference transactions: decode, digest, sign, hash", () => {
    for (const v of vectors_default.transactions) {
      const u = hexToBytes(v.unsigned);
      const tx = decodeTransaction(u);
      describe(tx, { decoder: decoder_exports, now: 17e8 });
      const d = v.genesis === "v1" ? txDigestV1(u) : txDigest(u, hexToBytes(v.genesis));
      if (bytesToHex(d) !== v.digest) throw new Error(v.name + " digest");
      const s = signDigest(hexToBytes(v.key), "ZBC", void 0, d);
      if (bytesToHex(s) !== v.signature || bytesToHex(txHash(u, s)) !== v.hash) throw new Error(v.name + " signature");
      let threw = false;
      try {
        decodeTransaction(u.slice(0, -1));
      } catch (e) {
        threw = e instanceof DecodeError;
      }
      if (!threw) throw new Error(v.name + " truncation not detected");
    }
    return `${vectors_default.transactions.length} vectors`;
  });
  t("Merlin transcript vector (sr25519)", () => {
    const tr = new Transcript("test protocol");
    tr.appendMessage("some label", "some data");
    const c = bytesToHex(tr.challengeBytes("challenge", 32));
    if (c !== "d5a21972d0d5fe320c0d263fac7fffb8145aa640af6e9bca177c03c7efcf0615") throw new Error(c);
  });
  t("every format signs and verifies a random digest", () => {
    const digest = randomBytes(32);
    const seed = { mnemonic: ABANDON };
    for (const [f, b] of [["ZBC"], ["ETH"], ["BNB"], ["BTC", "legacy"], ["BTC", "segwit"], ["BTC", "taproot"], ["SOL"], ["DOT"], ["ADA"], ["XTZ"], ["TRX"], ["XRP"]]) {
      const acc = deriveAccount(seed, f, b, 0);
      const sig = signDigest(deriveSecret(seed, f, b, 0), f, b, digest);
      if (!verifyDigest(f, b, acc.payload, digest, sig)) throw new Error(f + " " + (b || ""));
    }
    return "12 envelopes";
  });
  t("known foreign addresses from the test mnemonic", () => {
    const seed = { mnemonic: ABANDON };
    const exp = { ETH: "0x9858EfFD232B4033E47d90003D41EC34EcaEda94", "BTC/legacy": "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA", "BTC/segwit": "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "BTC/taproot": "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr" };
    for (const [k, v] of Object.entries(exp)) {
      const [f, b] = k.split("/");
      const a = deriveAccount(seed, f, b, 0).address;
      if (a !== v) throw new Error(`${k}: ${a}`);
    }
  });
  t("ZBC_ text form of a Solana key matches zbc-cli", () => {
    const s = zbcEncode(new Uint8Array(32), "ZBC");
    if (s !== "ZBC_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAHKJF5") throw new Error(s);
    void display;
  });
  return results;
}

// src/background.js
var SESSION = chrome.storage.session;
var LOCAL = chrome.storage.local;
var APPROVE_URL = chrome.runtime.getURL("approve.html");
var POPUP_URL = chrome.runtime.getURL("popup.html");
var OPTIONS_URL = chrome.runtime.getURL("options.html");
var PROMPT_METHODS = /* @__PURE__ */ new Set(["zbc_requestAccounts", "zbc_signTransaction", "zbc_signDigest", "zbc_signMultisig", "zbc_signMessage", "zbc_submitTransaction"]);
var MAX_QUEUE_PER_ORIGIN = 20;
var vault = null;
var keyRaw = null;
var salt = null;
var ports = /* @__PURE__ */ new Map();
var portSeq = 0;
var inflight = /* @__PURE__ */ new Map();
var building = Promise.resolve();
var uid = () => bytesToHex(randomBytes(8));
var now = () => Math.floor(Date.now() / 1e3);
async function vaultExists() {
  const { vault: blob } = await LOCAL.get("vault");
  return !!blob;
}
async function ensureUnlocked() {
  if (vault && keyRaw) return true;
  const s = await SESSION.get(["keyRaw"]);
  if (!s.keyRaw) return false;
  const { vault: blob } = await LOCAL.get("vault");
  if (!blob) return false;
  try {
    keyRaw = fromBase64(s.keyRaw);
    vault = await decryptVault(keyRaw, blob);
    salt = fromBase64(blob.salt);
    migrate();
    return true;
  } catch (e) {
    keyRaw = null;
    vault = null;
    await SESSION.remove("keyRaw");
    return false;
  }
}
function migrate() {
  vault.settings = { ...emptyVault().settings, ...vault.settings || {} };
  vault.multisigs = vault.multisigs || [];
  vault.log = vault.log || [];
  vault.sites = vault.sites || {};
  vault.contacts = vault.contacts || {};
}
async function saveVault() {
  if (!vault || !keyRaw) throw rpcError(ERR.LOCKED);
  const blob = await encryptVault(keyRaw, vault, salt);
  await LOCAL.set({ vault: blob });
}
async function unlock(password) {
  const { vault: blob } = await LOCAL.get("vault");
  if (!blob) throw new Error("No vault yet");
  const u = await unlockVault(password, blob);
  keyRaw = u.keyRaw;
  vault = u.data;
  salt = u.salt;
  migrate();
  await SESSION.set({ keyRaw: toBase64(keyRaw) });
  await touch();
  await verifyCachedAddresses();
  return true;
}
async function lock() {
  if (keyRaw) zero(keyRaw);
  vault = null;
  keyRaw = null;
  salt = null;
  await SESSION.remove(["keyRaw"]);
  await chrome.alarms.clear("autolock");
  for (const [, p] of ports) {
    safePost(p.port, { kind: "event", event: "lock", data: {} });
    safePost(p.port, { kind: "event", event: "accountsChanged", data: [] });
  }
}
async function touch() {
  const minutes = Math.min(240, Math.max(1, Number(vault && vault.settings.autoLockMinutes || 15)));
  await chrome.alarms.create("autolock", { delayInMinutes: minutes });
}
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "autolock") lock();
});
chrome.runtime.onStartup.addListener(() => {
  SESSION.remove(["keyRaw"]);
});
async function verifyCachedAddresses() {
  let changed = false;
  for (const a of vault.accounts) {
    try {
      const acc = a.source === "seed" ? deriveAccount(seedById(a.seedId), a.format, a.btc, a.index) : accountFromSecret(hexToBytes(keyById(a.keyId).hex), a.format, a.btc);
      if (acc.hex !== a.typed || acc.address !== a.address) {
        a.typed = acc.hex;
        a.address = acc.address;
        changed = true;
      }
    } catch (e) {
      a.broken = e.message;
    }
  }
  if (changed) await saveVault();
}
var seedById = (id) => {
  const s = vault.seeds.find((x) => x.id === id);
  if (!s) throw new Error("seed missing");
  return s;
};
var keyById = (id) => {
  const k = vault.keys.find((x) => x.id === id);
  if (!k) throw new Error("key missing");
  return k;
};
function secretFor(acc) {
  if (acc.source === "seed") return deriveSecret(seedById(acc.seedId), acc.format, acc.btc, acc.index);
  return hexToBytes(keyById(acc.keyId).hex);
}
function findAccount(hex) {
  return vault.accounts.find((a) => a.typed === hex && !a.hidden) || vault.accounts.find((a) => a.typed === hex) || null;
}
function labelFor(hex) {
  const a = vault && vault.accounts.find((x) => x.typed === hex);
  if (a) return a.label;
  const m = vault && vault.multisigs.find((x) => x.typed === hex);
  if (m) return m.label;
  const c = vault && vault.contacts && vault.contacts[hex];
  return c || null;
}
function accountObject(a) {
  return { address: a.address, typed: a.typed, format: a.format, ...a.format === "BTC" ? { btc: a.btc } : {}, label: a.label, source: a.source, canSignDigest: true, ...a.nodeKey ? { nodeKey: true } : {} };
}
function multisigObject(m) {
  const held = m.participants.filter((p) => findAccount(p)).length;
  return { address: m.address, typed: m.typed, format: "ZBC", label: m.label, source: "key", canSignDigest: false, multisig: { min: m.min, nonce: String(m.nonce), participants: m.participants, held } };
}
function sharedAccounts(origin) {
  if (!vault) return [];
  const site = vault.sites[origin];
  if (!site) return [];
  const out = [];
  for (const hex of site.accounts) {
    const a = findAccount(hex);
    if (a) {
      out.push(accountObject(a));
      continue;
    }
    const m = vault.multisigs.find((x) => x.typed === hex);
    if (m && multisigObject(m).multisig.held > 0) out.push(multisigObject(m));
  }
  return out;
}
function log(entry) {
  vault.log.unshift({ at: now(), ...entry });
  if (vault.log.length > 500) vault.log.length = 500;
}
async function genesisCache() {
  const { genesisCache: g } = await LOCAL.get("genesisCache");
  return g || {};
}
async function rememberGenesis(id, info, nodeUrl) {
  const g = await genesisCache();
  g[id] = { genesis: info.genesis, tag: info.tag, node: nodeUrl, height: info.height, at: now() };
  await LOCAL.set({ genesisCache: g });
}
function nodeFor(id) {
  const custom = vault && vault.settings.nodes && vault.settings.nodes[id];
  return normalizeNodeUrl(custom) || NETWORKS[id] && NETWORKS[id].node || null;
}
var HOST_LIST = (chrome.runtime.getManifest().host_permissions || []).map((m) => m.replace(/\/\*$/, "")).join(", ");
async function hostPermitted(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return await chrome.permissions.contains({ origins: [`${u.origin}/*`] });
  } catch {
    return false;
  }
}
async function resolveChain(chainParam = {}) {
  const requested = String(chainParam.genesis || "").toLowerCase().replace(/^0x/, "");
  const wantId = chainParam.id && NETWORKS[chainParam.id] ? chainParam.id : null;
  const cache = await genesisCache();
  const finish = (id, c, unverified = false) => ({ id, label: NETWORKS[id] ? NETWORKS[id].label : id, genesis: c.genesis, genesisBytes: hexToBytes(c.genesis), tag: c.tag || "ZBC-TX", node: c.node, height: c.height || null, avgBlockSeconds: 60, unverified });
  const ids = [wantId, vault ? vault.settings.network : "testnet", ...Object.keys(NETWORKS)].filter((x, i, a) => x && a.indexOf(x) === i);
  for (const id of ids) {
    const c = cache[id];
    if (c && (!requested || c.genesis === requested) && now() - c.at < 3600) return finish(id, c);
  }
  const candidates = [];
  for (const id of ids) {
    const n = nodeFor(id);
    if (n) candidates.push({ id, node: n });
  }
  if (chainParam.node && await hostPermitted(chainParam.node)) candidates.unshift({ id: wantId || ids[0], node: normalizeNodeUrl(chainParam.node) });
  let lastErr = null;
  for (const cnd of candidates) {
    try {
      const info = await nodeInfo(cnd.node);
      await rememberGenesis(cnd.id, info, cnd.node);
      if (!requested || info.genesis === requested) return finish(cnd.id, { ...info, node: cnd.node });
    } catch (e) {
      lastErr = e;
    }
  }
  for (const id of ids) {
    const c = cache[id];
    if (c && (!requested || c.genesis === requested)) return finish(id, c);
  }
  if (requested && /^[0-9a-f]{64}$/.test(requested) && vault && vault.settings.trustPageGenesis) return finish(wantId || "unknown", { genesis: requested, tag: chainParam.tag || "ZBC-TX", node: nodeFor(wantId || "testnet") }, true);
  if (requested) throw rpcError(ERR.WRONG_CHAIN, "This page is on a different network than your signer" + (lastErr ? ` (${lastErr.message})` : ""));
  throw rpcError(ERR.WRONG_CHAIN, "Could not read the network's genesis hash" + (lastErr ? `: ${lastErr.message}` : ""));
}
function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch {
  }
}
function respond(req, result2, error) {
  const msg = { kind: "response", id: req.id, ...error ? { error: asRpcError(error).toJSON() } : { result: result2 } };
  const p = ports.get(req.portId);
  if (p) safePost(p.port, msg);
  else SESSION.get("results").then(({ results }) => SESSION.set({ results: { ...results || {}, [req.id]: msg } }));
}
function emitToOrigin(origin, event, data) {
  for (const [, p] of ports) if (p.origin === origin) safePost(p.port, { kind: "event", event, data });
}
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "zoobc-signer" || !port.sender || !port.sender.tab) return;
  const origin = port.sender.origin || (port.sender.url ? new URL(port.sender.url).origin : null);
  if (!origin || origin === "null") return;
  const portId = `p${++portSeq}`;
  ports.set(portId, { port, origin, tabId: port.sender.tab.id });
  port.onDisconnect.addListener(() => ports.delete(portId));
  port.onMessage.addListener((m) => {
    if (!m || typeof m !== "object") return;
    if (m.kind === "resume" && Array.isArray(m.ids)) return resume(portId, m.ids.filter((x) => typeof x === "string").slice(0, 50));
    if (m.kind !== "request" || typeof m.id !== "string" || typeof m.method !== "string") return;
    handleRequest({ id: m.id.slice(0, 64), method: m.method, params: m.params, origin, portId, tabId: port.sender.tab.id }).catch((e) => respond({ id: m.id, portId }, void 0, e));
  });
});
async function resume(portId, ids) {
  const { results, pending } = await SESSION.get(["results", "pending"]);
  for (const id of ids) {
    if (results && results[id]) {
      safePost(ports.get(portId).port, results[id]);
      delete results[id];
    } else if (pending && pending[id]) pending[id].portId = portId;
    else safePost(ports.get(portId).port, { kind: "response", id, error: { code: 5e3, message: "Request lost" } });
  }
  await SESSION.set({ results: results || {}, pending: pending || {} });
  for (const id of ids) {
    const f = inflight.get(id);
    if (f) f.portId = portId;
  }
}
async function handleRequest(req) {
  const { method, params = {}, origin } = req;
  if (params !== void 0 && (typeof params !== "object" || params === null)) throw rpcError(ERR.BAD_REQUEST, "params must be an object");
  const unlocked = await ensureUnlocked();
  switch (method) {
    case "zbc_accounts":
      return respond(req, unlocked ? sharedAccounts(origin) : []);
    case "zbc_hasAccount": {
      if (!unlocked) return respond(req, { held: false, shared: false, locked: true });
      const site = vault.sites[origin];
      if (!site) return respond(req, { held: false, shared: false, locked: false });
      let hex = null;
      try {
        hex = normalizeAccount(String(params.account || "")).hex;
      } catch {
        return respond(req, { held: false, shared: false, locked: false });
      }
      const held = !!(findAccount(hex) || vault.multisigs.find((m) => m.typed === hex));
      return respond(req, { held, shared: held && site.accounts.includes(hex), locked: false });
    }
    case "zbc_disconnect": {
      if (unlocked && vault.sites[origin]) {
        delete vault.sites[origin];
        await saveVault();
        emitToOrigin(origin, "accountsChanged", []);
      }
      return respond(req, true);
    }
    case "zbc_getSigningRule": {
      const chain2 = await resolveChain(params.node ? { node: String(params.node) } : {});
      return respond(req, { genesis: chain2.genesis, tag: chain2.tag, chain: chain2.id });
    }
    default:
      if (!PROMPT_METHODS.has(method)) throw rpcError(ERR.UNSUPPORTED, `Method ${method} not supported`);
      return enqueue(req, unlocked);
  }
}
async function pendingMap() {
  const { pending } = await SESSION.get("pending");
  return pending || {};
}
async function setPending(p) {
  await SESSION.set({ pending: p });
}
async function enqueue(req, unlocked) {
  const pending = await pendingMap();
  const mine = Object.values(pending).filter((p) => p.origin === req.origin);
  if (mine.length >= MAX_QUEUE_PER_ORIGIN) throw rpcError(ERR.REJECTED, "Too many pending requests from this site");
  preValidate(req);
  if (unlocked && req.method === "zbc_signTransaction") {
    const auto = await trySessionKey(req);
    if (auto) return;
  }
  const entry = { id: req.id, origin: req.origin, portId: req.portId, tabId: req.tabId, method: req.method, params: req.params || {}, createdAt: now(), view: null, error: null };
  inflight.set(req.id, entry);
  if (unlocked) {
    try {
      entry.view = await buildView(entry);
    } catch (e) {
      inflight.delete(req.id);
      throw e;
    }
  }
  pending[req.id] = entry;
  await setPending(pending);
  await openApproval();
}
function preValidate(req) {
  const p = req.params || {};
  switch (req.method) {
    case "zbc_signTransaction":
    case "zbc_submitTransaction":
      normalizeAccount(String(p.account || ""));
      if (typeof p.unsignedTx !== "string") throw rpcError(ERR.BAD_REQUEST, "unsignedTx is required");
      decodeOrThrow(p.unsignedTx);
      break;
    case "zbc_signDigest":
      normalizeAccount(String(p.account || ""));
      if (typeof p.digest !== "string") throw rpcError(ERR.BAD_REQUEST, "digest is required");
      break;
    case "zbc_signMessage":
      normalizeAccount(String(p.account || ""));
      if (typeof p.message !== "string") throw rpcError(ERR.BAD_REQUEST, "message is required");
      break;
    case "zbc_signMultisig":
      normalizeAccount(String(p.multisig || ""));
      if (typeof p.inner !== "string") throw rpcError(ERR.BAD_REQUEST, "inner is required");
      decodeOrThrow(p.inner);
      break;
  }
}
function decodeOrThrow(hex) {
  try {
    return decodeTransaction(hexToBytes(hex));
  } catch (e) {
    throw rpcError(ERR.BAD_REQUEST, "The transaction bytes do not decode: " + e.message);
  }
}
async function buildView(entry) {
  const p = entry.params, origin = entry.origin;
  const of = originFlags(origin);
  const base = { origin, originFlags: of, method: entry.method, createdAt: entry.createdAt };
  if (entry.method === "zbc_requestAccounts") {
    const site2 = vault.sites[origin];
    const accounts = vault.accounts.filter((a) => !a.hidden).map((a) => ({ ...accountObject(a), seedId: a.seedId, checked: !!(site2 && site2.lastUsed && site2.lastUsed === a.typed), shared: !!(site2 && site2.accounts.includes(a.typed)) }));
    const multisigs = vault.multisigs.map(multisigObject).filter((m) => m.multisig.held > 0).map((m) => ({ ...m, checked: false, shared: !!(site2 && site2.accounts.includes(m.typed)) }));
    const wantFormats = Array.isArray(p.formats) ? p.formats.map(String) : null;
    const chain3 = await resolveChain(p.chain ? { id: String(p.chain) } : {}).catch(() => null);
    return { ...base, kind: "connect", accounts: wantFormats ? accounts.filter((a) => wantFormats.includes(a.format)) : accounts, multisigs, groups: vault.seeds.map((s) => ({ id: s.id, name: s.name })), network: chain3 ? { id: chain3.id, label: chain3.label } : null };
  }
  const chain2 = await resolveChain(p.chain || {});
  const network = { id: chain2.id, label: chain2.label, genesis: chain2.genesis, short: genesisShort(chain2.genesis), unverified: chain2.unverified };
  if (entry.method === "zbc_signMultisig") {
    const ms = normalizeAccount(String(p.multisig));
    const setup = vault.multisigs.find((m) => m.typed === ms.hex);
    if (!setup) return { ...base, kind: "not-held", account: { address: ms.display, typed: ms.hex, format: "ZBC", multisig: true }, network };
    const held2 = vault.accounts.filter((a) => setup.participants.includes(a.typed)).map((a) => ({ hex: a.typed, label: a.label, format: a.format, btc: a.btc, address: a.address }));
    if (!held2.length) return { ...base, kind: "not-held", account: { address: ms.display, typed: ms.hex, format: "ZBC", multisig: true }, network };
    const view = buildMultisigView(p, setup, held2, { origin, labelFor, chain: chain2, now: now() });
    const shared = !!(vault.sites[origin] && vault.sites[origin].accounts.includes(ms.hex));
    return { ...base, ...view, network, share: !shared, account: { label: setup.label, address: setup.address, typed: setup.typed, format: "ZBC" } };
  }
  const account3 = normalizeAccount(String(p.account));
  const held = findAccount(account3.hex);
  if (!held) return { ...base, kind: "not-held", account: { address: account3.display, typed: account3.hex, format: FORMAT_OF_TYPE(account3.type), type: account3.type }, network };
  const site = vault.sites[origin];
  const share = !(site && site.accounts.includes(account3.hex));
  const accView = { label: held.label, address: held.address, typed: held.typed, format: held.format, btc: held.btc, nodeKey: !!held.nodeKey };
  const ctx = { origin, labelFor, chain: chain2, now: now(), nodeKey: !!held.nodeKey, blindDigest: !!vault.settings.blindDigest };
  if (entry.method === "zbc_signTransaction" || entry.method === "zbc_submitTransaction") {
    const enriched = await enrichContext(p, chain2, ctx);
    const { view } = buildTxView({ ...p, mode: entry.method === "zbc_submitTransaction" ? "submit" : p.mode }, account3, enriched);
    if (view.described.category === 8 && view.type === 51 && !held.nodeKey) view.described.canSign = false;
    if (entry.method === "zbc_submitTransaction") view.submitNode = await submitNodeFor(p.node, chain2);
    return { ...base, ...view, network, share, account: accView, sessionKeysEnabled: !!vault.settings.sessionKeys };
  }
  if (entry.method === "zbc_signDigest") return { ...base, ...buildDigestView(p, account3, ctx), network, share, account: accView };
  if (entry.method === "zbc_signMessage") return { ...base, ...buildMessageView(p, account3, ctx), network, share, account: accView };
  throw rpcError(ERR.UNSUPPORTED);
}
var FORMAT_OF_TYPE = (t) => ({ 0: "ZBC", 4: "ETH", 5: "BTC", 7: "BTC", 9: "BTC", 11: "SOL", 12: "DOT", 13: "ADA", 14: "XRP", 15: "TRX", 16: "XTZ" })[t] || null;
async function submitNodeFor(requested, chain2) {
  if (requested) {
    const n = normalizeNodeUrl(requested);
    if (!n) throw rpcError(ERR.BAD_REQUEST, "node must be https");
    if (!await hostPermitted(n)) throw rpcError(ERR.BAD_REQUEST, "node is not in the signer's host permissions");
    return n;
  }
  return chain2.node;
}
async function enrichContext(p, chain2, ctx) {
  const out = { ...ctx, tokens: {}, context: p.context && typeof p.context === "object" ? { ...p.context } : {} };
  let tx;
  try {
    tx = decodeTransaction(hexToBytes(p.unsignedTx));
  } catch {
    return out;
  }
  const nodeUrl = chain2.node;
  const withTimeout = (pr) => Promise.race([pr, new Promise((r) => setTimeout(() => r(null), 4e3))]).catch(() => null);
  const tasks = [];
  const tokenIds = /* @__PURE__ */ new Set();
  const f = tx.fields || {};
  for (const k of ["tokenId", "giveToken", "wantToken", "baseToken", "quoteToken", "stakeToken"]) if (f[k] !== void 0 && f[k] !== 0n) tokenIds.add(BigInt.asIntN(64, f[k]).toString());
  if (tx.fields && tx.fields.inner && tx.fields.inner.fields) for (const k of ["tokenId", "giveToken", "wantToken"]) {
    const v = tx.fields.inner.fields[k];
    if (v !== void 0 && v !== 0n) tokenIds.add(BigInt.asIntN(64, v).toString());
  }
  if (nodeUrl) {
    for (const id of tokenIds) tasks.push(withTimeout(token(nodeUrl, id)).then((t) => {
      if (t) {
        out.tokens[id] = t;
        if (t.persist_height && chain2.height && Number(t.persist_height) <= chain2.height && [11, 12, 13, 14].includes(tx.type)) out.tokenExpired = true;
      }
    }));
    if (tx.type === 4 && !out.context.escrow) tasks.push(withTimeout(escrowDetails(nodeUrl, tx.fields.escrowTxHash)).then((e) => {
      if (e) out.context.escrow = e;
    }));
    if (tx.type === 19 && !out.context.offer) tasks.push(withTimeout(offer(nodeUrl, tx.fields.offerId.toString())).then((o) => {
      if (o) out.context.offer = o;
    }));
    if (tx.type === 22 && !out.context.market) tasks.push(withTimeout(market(nodeUrl, tx.fields.marketId.toString())).then((m) => {
      if (m) out.context.market = m;
    }));
    if ([25, 26].includes(tx.type) && !out.context.game) tasks.push(withTimeout(game(nodeUrl, tx.fields.gameId.toString())).then((g) => {
      if (g) out.context.game = g;
    }));
    tasks.push(withTimeout(estimateFee(nodeUrl, { type: tx.type, bodyLength: tx.body.length, messageLength: tx.message.length })).then((fee) => {
      if (fee === null) out.feeCheckFailed = true;
      else out.feeMinimum = fee;
    }));
  } else out.feeCheckFailed = true;
  await Promise.all(tasks);
  return out;
}
async function injectIntoActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  if (!tab || !tab.id) return { injected: false, reason: "No active tab" };
  let origin = null;
  try {
    const u = new URL(tab.url || "");
    if (u.protocol === "https:" || u.protocol === "http:") origin = u.origin;
  } catch {
  }
  if (!origin) return { injected: false, reason: "Not a web page" };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"], injectImmediately: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["inpage.js"], world: "MAIN", injectImmediately: true });
    return { injected: true, origin };
  } catch (e) {
    return { injected: false, origin, reason: e && e.message || "Injection failed" };
  }
}
async function openApproval() {
  const s = await SESSION.get(["approvalWindow", "lastOpen"]);
  const t = Date.now();
  if (s.approvalWindow) {
    try {
      await chrome.windows.update(s.approvalWindow, { focused: true, drawAttention: true });
      await chrome.runtime.sendMessage({ type: "approve:refresh" }).catch(() => {
      });
      return;
    } catch {
      await SESSION.remove("approvalWindow");
    }
  }
  if (s.lastOpen && t - s.lastOpen < 1e3) return;
  await SESSION.set({ lastOpen: t });
  const w = await chrome.windows.create({ url: APPROVE_URL, type: "popup", width: 380, height: 640, focused: true });
  await SESSION.set({ approvalWindow: w.id });
}
chrome.windows.onRemoved.addListener(async (id) => {
  const s = await SESSION.get(["approvalWindow", "showing"]);
  if (s.approvalWindow !== id) return;
  await SESSION.remove(["approvalWindow", "showing"]);
  if (s.showing) await decide(s.showing, false, {}, "window closed");
  const pending = await pendingMap();
  if (Object.keys(pending).length) {
    await SESSION.remove("lastOpen");
    await openApproval();
  }
});
async function trySessionKey(req) {
  if (!vault.settings.sessionKeys) return false;
  let tx;
  try {
    tx = decodeTransaction(hexToBytes(req.params.unsignedTx));
  } catch {
    return false;
  }
  if (![26, 27, 28].includes(tx.type)) return false;
  const account3 = normalizeAccount(String(req.params.account));
  if (tx.sender.hex !== account3.hex) return false;
  const { sessionKeys } = await SESSION.get("sessionKeys");
  const key = `${req.origin}|${account3.hex}|${tx.fields.gameId.toString()}`;
  const grant2 = sessionKeys && sessionKeys[key];
  if (!grant2 || grant2.expires < now()) return false;
  const held = findAccount(account3.hex);
  if (!held) return false;
  const chain2 = await resolveChain(req.params.chain || {});
  const result2 = await signTx(held, tx, chain2);
  log({ origin: req.origin, type: tx.type, title: `Auto-signed move in game #${tx.fields.gameId}`, hash: result2.txHash, account: held.typed, auto: true });
  await saveVault();
  respond(req, result2);
  try {
    chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title: "ZooBC Signer", message: `Signed a move in game #${tx.fields.gameId} for ${req.origin} (session key)` });
  } catch {
  }
  return true;
}
async function signTx(held, tx, chain2) {
  const digest = txDigest(tx.unsigned, chain2.genesisBytes, chain2.tag);
  const secret = secretFor(held);
  try {
    const sig = signDigest(secret, held.format, held.btc, digest);
    const hash = txHash(tx.unsigned, sig);
    const payloadJson = buildPayload(tx, bytesToHex(sig));
    return { signature: bytesToHex(sig), txHash: bytesToHex(hash), payload: JSON.parse(payloadJson), payloadJson };
  } finally {
    zero(secret);
  }
}
async function decide(id, approved, options = {}, reason = "") {
  const pending = await pendingMap();
  const entry = pending[id];
  if (!entry) return { done: false };
  const finishWith = async (result2, error) => {
    delete pending[id];
    await setPending(pending);
    inflight.delete(id);
    respond({ id, portId: (inflight.get(id) || entry).portId }, result2, error);
  };
  if (!approved) {
    const notHeld = entry.view && entry.view.kind === "not-held";
    await finishWith(void 0, notHeld ? rpcError(ERR.NOT_HELD) : rpcError(ERR.REJECTED, reason ? `User rejected (${reason})` : "User rejected"));
    return { done: true };
  }
  if (!await ensureUnlocked()) return { done: false, locked: true };
  const view = entry.view || (entry.view = await buildView(entry).catch((e) => ({ kind: "error", error: asRpcError(e).toJSON() })));
  try {
    if (view.kind === "error") throw new class extends Error {
      constructor() {
        super(view.error.message);
        this.code = view.error.code;
      }
    }();
    if (view.kind === "not-held") throw rpcError(ERR.NOT_HELD);
    if (view.share) {
      if (!options.shareAccount) throw rpcError(ERR.NOT_SHARED);
      grant(entry.origin, [view.account.typed]);
    }
    let result2;
    switch (view.kind) {
      case "connect": {
        const chosen = Array.isArray(options.accounts) ? options.accounts.filter((h) => typeof h === "string") : [];
        if (!chosen.length) throw rpcError(ERR.REJECTED, "No account shared");
        grant(entry.origin, chosen);
        result2 = sharedAccounts(entry.origin);
        log({ origin: entry.origin, type: null, title: `Connected ${chosen.length} account(s)` });
        emitToOrigin(entry.origin, "accountsChanged", result2);
        break;
      }
      case "tx": {
        if (view.described.canSign === false) throw rpcError(ERR.CANNOT_SIGN, "This transaction cannot be signed");
        if (!view.match.ok && !options.checkedMismatch) throw rpcError(ERR.REJECTED, "Mismatch not acknowledged");
        const held = findAccount(view.account.typed);
        const chain2 = await resolveChain(entry.params.chain || {});
        const tx = decodeTransaction(hexToBytes(view.unsignedTx));
        result2 = await signTx(held, tx, chain2);
        if (options.sessionKey && vault.settings.sessionKeys && [26, 27, 28].includes(tx.type)) {
          const { sessionKeys } = await SESSION.get("sessionKeys");
          await SESSION.set({ sessionKeys: { ...sessionKeys || {}, [`${entry.origin}|${held.typed}|${tx.fields.gameId.toString()}`]: { expires: now() + 7200 } } });
        }
        if (view.mode === "submit") {
          const r = await submit(view.submitNode, result2.payloadJson);
          result2.response = r.response;
          result2.submitted = r.ok;
          result2.duplicate = r.duplicate;
          if (!r.ok) result2.error = r.error;
        }
        log({ origin: entry.origin, type: tx.type, title: view.described.title, hash: result2.txHash, account: held.typed, submitted: view.mode === "submit" ? !!result2.submitted : void 0 });
        break;
      }
      case "multisig": {
        if (view.canSign === false) throw rpcError(ERR.CANNOT_SIGN);
        if (!view.match.ok && !options.checkedMismatch) throw rpcError(ERR.REJECTED, "Mismatch not acknowledged");
        const chain2 = await resolveChain(entry.params.chain || {});
        const inner = hexToBytes(view.innerHex);
        const digest = txDigest(inner, chain2.genesisBytes, chain2.tag);
        const signatures = [];
        for (const p of view.participants) {
          if (!p.held || signatures.length >= view.need) continue;
          const held = findAccount(p.hex);
          const secret = secretFor(held);
          try {
            signatures.push({ signer: held.typed, address: held.address, format: held.format, ...held.format === "BTC" ? { btc: held.btc } : {}, signature: bytesToHex(signDigest(secret, held.format, held.btc, digest)) });
          } finally {
            zero(secret);
          }
        }
        result2 = { signatures, need: view.need };
        log({ origin: entry.origin, type: 5, title: `${view.title} (${signatures.length} keys)`, hash: bytesToHex(txHash(inner, new Uint8Array(0))), account: view.setup.hex });
        break;
      }
      case "digest": {
        const held = findAccount(view.account.typed);
        const secret = secretFor(held);
        try {
          if (view.scheme === "raw") {
            if (held.format !== "ZBC") throw rpcError(ERR.CANNOT_SIGN);
            result2 = { signature: bytesToHex(signRawEd25519(secret, hexToBytes(view.digest))) };
          } else {
            const sig = signDigest(secret, held.format, held.btc, hexToBytes(view.digest));
            result2 = { signature: bytesToHex(sig) };
            if (view.proofKind !== void 0) result2.proof = bytesToHex(consentProof(view.proofKind, sig));
          }
        } finally {
          zero(secret);
        }
        log({ origin: entry.origin, type: null, title: view.title, account: held.typed });
        break;
      }
      case "message": {
        const held = findAccount(view.account.typed);
        const secret = secretFor(held);
        try {
          result2 = { signature: bytesToHex(signDigest(secret, held.format, held.btc, hexToBytes(view.digest))) };
        } finally {
          zero(secret);
        }
        log({ origin: entry.origin, type: null, title: "Signed a message", account: held.typed });
        break;
      }
      default:
        throw rpcError(ERR.INTERNAL, "unknown view");
    }
    if (vault.sites[entry.origin] && view.account) vault.sites[entry.origin].lastUsed = view.account.typed;
    await saveVault();
    await finishWith(result2);
    return { done: true, result: { txHash: result2.txHash, signature: result2.signature } };
  } catch (e) {
    await finishWith(void 0, e);
    return { done: true, error: asRpcError(e).toJSON() };
  }
}
function grant(origin, hexes2) {
  const site = vault.sites[origin] || { accounts: [], grantedAt: now(), lastUsed: null };
  for (const h of hexes2) if (!site.accounts.includes(h)) site.accounts.push(h);
  vault.sites[origin] = site;
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender || !sender.url || !sender.url.startsWith(chrome.runtime.getURL(""))) return false;
  const fromApprove = sender.url.startsWith(APPROVE_URL);
  const fromPopup = sender.url.startsWith(POPUP_URL);
  handleUi(msg, { fromApprove, fromPopup, url: sender.url }).then((r) => sendResponse({ ok: true, result: r })).catch((e) => sendResponse({ ok: false, error: asRpcError(e).toJSON() }));
  return true;
});
async function handleUi(msg, who) {
  const type = msg && msg.type;
  const unlocked = await ensureUnlocked();
  if (unlocked) await touch();
  switch (type) {
    // ---- status / lock
    case "status": {
      const pending = await pendingMap();
      const s = await SESSION.get(["showing"]);
      return { exists: await vaultExists(), locked: !unlocked, network: unlocked ? vault.settings.network : "testnet", pending: Object.keys(pending).length, showing: s.showing || null, passkey: !!(await LOCAL.get("passkey")).passkey };
    }
    case "vault:create": {
      if (await vaultExists()) throw new Error("A vault already exists");
      if (String(msg.password).length < 10) throw new Error("Password must be at least 10 characters");
      const { blob, keyRaw: k } = await createVault(String(msg.password));
      await LOCAL.set({ vault: blob });
      keyRaw = k;
      salt = fromBase64(blob.salt);
      vault = emptyVault();
      migrate();
      await SESSION.set({ keyRaw: toBase64(keyRaw) });
      await touch();
      return true;
    }
    case "vault:unlock": {
      await unlock(String(msg.password));
      await rebuildPendingViews();
      return true;
    }
    case "vault:lock":
      await lock();
      return true;
    case "vault:reset": {
      await LOCAL.remove(["vault", "passkey"]);
      await lock();
      await SESSION.clear();
      return true;
    }
    case "vault:export": {
      requireUnlocked(unlocked);
      await unlock(String(msg.password));
      return { seeds: vault.seeds, keys: vault.keys, accounts: vault.accounts.map((a) => ({ label: a.label, source: a.source, seedId: a.seedId, keyId: a.keyId, format: a.format, btc: a.btc, index: a.index, typed: a.typed, address: a.address })), multisigs: vault.multisigs };
    }
    // ---- passkey (WebAuthn PRF) wrapping of the vault key
    case "passkey:wrap": {
      requireUnlocked(unlocked);
      const prf = fromBase64(String(msg.prf));
      const wk = await importAesKey(prf.slice(0, 32));
      const iv = randomBytes(12);
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wk, keyRaw));
      await LOCAL.set({ passkey: { credId: String(msg.credId), iv: toBase64(iv), ct: toBase64(ct) } });
      return true;
    }
    case "passkey:get": {
      const { passkey } = await LOCAL.get("passkey");
      return passkey ? { credId: passkey.credId } : null;
    }
    case "passkey:unlock": {
      const { passkey } = await LOCAL.get("passkey");
      if (!passkey) throw new Error("No passkey registered");
      const prf = fromBase64(String(msg.prf));
      const wk = await importAesKey(prf.slice(0, 32));
      const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(passkey.iv) }, wk, fromBase64(passkey.ct)));
      const { vault: blob } = await LOCAL.get("vault");
      vault = await decryptVault(raw, blob);
      keyRaw = raw;
      salt = fromBase64(blob.salt);
      migrate();
      await SESSION.set({ keyRaw: toBase64(keyRaw) });
      await touch();
      await rebuildPendingViews();
      return true;
    }
    case "passkey:remove":
      await LOCAL.remove("passkey");
      return true;
    // ---- accounts
    case "accounts:list": {
      requireUnlocked(unlocked);
      return {
        seeds: vault.seeds.map((s) => ({ id: s.id, name: s.name, words: normalizeMnemonic(s.mnemonic).split(" ").length, hasPassphrase: !!s.passphrase, createdAt: s.createdAt, accounts: vault.accounts.filter((a) => a.seedId === s.id).map(publicAccount) })),
        keys: vault.accounts.filter((a) => a.source === "key").map(publicAccount),
        multisigs: vault.multisigs.map((m) => ({ ...multisigObject(m), id: m.id, participants: m.participants.map((h) => ({ hex: h, label: labelFor(h), display: safeDisplay(h), held: !!findAccount(h) })) })),
        settings: vault.settings
      };
    }
    case "mnemonic:new":
      return newMnemonic(Number(msg.words) === 12 ? 12 : 24);
    case "seed:preview": {
      const mnemonic = normalizeMnemonic(msg.mnemonic);
      if (!isValidMnemonic(mnemonic)) throw new Error("Not a valid BIP-39 phrase");
      const seed = { mnemonic, passphrase: String(msg.passphrase || "") };
      return (msg.formats || []).map((f) => {
        const a = deriveAccount(seed, f.format, f.btc, Number(f.index || 0));
        return { format: f.format, btc: f.btc, index: Number(f.index || 0), address: a.address, typed: a.hex, path: a.path };
      });
    }
    case "seed:add": {
      requireUnlocked(unlocked);
      const mnemonic = normalizeMnemonic(msg.mnemonic);
      if (!isValidMnemonic(mnemonic)) throw new Error("Not a valid BIP-39 phrase");
      const passphrase = String(msg.passphrase || "");
      let seed = vault.seeds.find((s) => normalizeMnemonic(s.mnemonic) === mnemonic && (s.passphrase || "") === passphrase);
      if (!seed) {
        seed = { id: uid(), name: String(msg.name || `Seed ${vault.seeds.length + 1}`).slice(0, 40), mnemonic, passphrase, createdAt: now() };
        vault.seeds.push(seed);
      }
      const added = addDerived(seed, msg.formats || []);
      await saveVault();
      return { seedId: seed.id, added };
    }
    case "seed:derive": {
      requireUnlocked(unlocked);
      const seed = seedById(msg.seedId);
      const added = addDerived(seed, msg.formats || []);
      await saveVault();
      return added;
    }
    case "seed:nextIndex": {
      requireUnlocked(unlocked);
      const idx = vault.accounts.filter((a) => a.seedId === msg.seedId && a.format === msg.format && (a.format !== "BTC" || a.btc === msg.btc)).map((a) => a.index);
      return idx.length ? Math.max(...idx) + 1 : 0;
    }
    case "seed:rename": {
      requireUnlocked(unlocked);
      seedById(msg.seedId).name = String(msg.name).slice(0, 40);
      await saveVault();
      return true;
    }
    case "seed:delete": {
      requireUnlocked(unlocked);
      await unlock(String(msg.password));
      vault.accounts = vault.accounts.filter((a) => a.seedId !== msg.seedId);
      vault.seeds = vault.seeds.filter((s) => s.id !== msg.seedId);
      await saveVault();
      return true;
    }
    case "key:preview": {
      const raw = parseRawKey(msg.hex);
      if (!raw) throw new Error("A private key is 64 hex characters");
      const a = accountFromSecret(raw, msg.format, msg.btc);
      return { address: a.address, typed: a.hex };
    }
    case "key:import": {
      requireUnlocked(unlocked);
      const raw = parseRawKey(msg.hex);
      if (!raw) throw new Error("A private key is 64 hex characters");
      const a = accountFromSecret(raw, msg.format, msg.btc);
      if (vault.accounts.some((x) => x.typed === a.hex)) throw new Error("This account is already in the vault");
      const key = { id: uid(), name: String(msg.name || a.format).slice(0, 40), format: msg.format, btc: a.btc, hex: bytesToHex(raw), nodeKey: !!msg.nodeKey };
      vault.keys.push(key);
      vault.accounts.push({ id: uid(), label: key.name, source: "key", keyId: key.id, format: a.format, btc: a.btc, typed: a.hex, address: a.address, nodeKey: !!msg.nodeKey });
      await saveVault();
      return publicAccount(vault.accounts[vault.accounts.length - 1]);
    }
    case "account:update": {
      requireUnlocked(unlocked);
      const a = vault.accounts.find((x) => x.id === msg.id);
      if (!a) throw new Error("no such account");
      if (msg.label !== void 0) a.label = String(msg.label).slice(0, 40);
      if (msg.hidden !== void 0) a.hidden = !!msg.hidden;
      await saveVault();
      return true;
    }
    case "account:delete": {
      requireUnlocked(unlocked);
      const a = vault.accounts.find((x) => x.id === msg.id);
      if (!a) throw new Error("no such account");
      vault.accounts = vault.accounts.filter((x) => x.id !== msg.id);
      if (a.source === "key") vault.keys = vault.keys.filter((k) => k.id !== a.keyId);
      for (const s of Object.values(vault.sites)) s.accounts = s.accounts.filter((h) => h !== a.typed);
      await saveVault();
      return true;
    }
    case "reveal": {
      requireUnlocked(unlocked);
      await unlock(String(msg.password));
      if (msg.seedId) {
        const s = seedById(msg.seedId);
        return { mnemonic: s.mnemonic, passphrase: s.passphrase || "" };
      }
      const a = vault.accounts.find((x) => x.id === msg.accountId);
      if (!a) throw new Error("no such account");
      const secret = secretFor(a);
      const hex = bytesToHex(secret);
      zero(secret);
      return { hex, path: a.source === "seed" ? deriveAccount(seedById(a.seedId), a.format, a.btc, a.index).path : null };
    }
    case "balance": {
      requireUnlocked(unlocked);
      const n = nodeFor(vault.settings.network);
      if (!n) return null;
      const acc = await account2(n, msg.address).catch(() => null);
      return acc ? String(acc.balance) : null;
    }
    // ---- multisig setups (§9.10)
    case "multisig:add": {
      requireUnlocked(unlocked);
      const parts = (msg.participants || []).map((p) => normalizeAccount(String(p)));
      if (parts.length < 1 || parts.length > 64) throw new Error("1\u201364 participants");
      const min = Number(msg.min);
      if (!Number.isInteger(min) || min < 1 || min > parts.length) throw new Error("Threshold must be between 1 and the number of participants");
      const nonce = BigInt(msg.nonce || 0);
      const sorted = parts.map((p) => p.typed).sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
        return a.length - b.length;
      });
      const t = typed(0, multisigAddress(min, nonce, sorted));
      const hex = bytesToHex(t);
      if (vault.multisigs.some((m2) => m2.typed === hex)) throw new Error("This multisig is already set up");
      const m = { id: uid(), label: String(msg.label || "Multisig").slice(0, 40), address: display(t), typed: hex, min, nonce: nonce.toString(), participants: sorted.map(bytesToHex) };
      vault.multisigs.push(m);
      await saveVault();
      return multisigObject(m);
    }
    case "multisig:preview": {
      const parts = (msg.participants || []).map((p) => normalizeAccount(String(p)));
      const sorted = parts.map((p) => p.typed).sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
        return a.length - b.length;
      });
      return display(typed(0, multisigAddress(Number(msg.min), BigInt(msg.nonce || 0), sorted)));
    }
    case "multisig:delete": {
      requireUnlocked(unlocked);
      vault.multisigs = vault.multisigs.filter((m) => m.id !== msg.id);
      await saveVault();
      return true;
    }
    case "multisig:createTx": {
      requireUnlocked(unlocked);
      const m = vault.multisigs.find((x) => x.id === msg.id);
      if (!m) throw new Error("no such multisig");
      const first = vault.accounts.find((a) => m.participants.includes(a.typed));
      if (!first) throw new Error("No participant key held");
      const chain2 = await resolveChain({});
      const parts = m.participants.map((h) => hexToBytes(h));
      const body = concatBytes2(u322(1), u322(m.min), u64(BigInt(m.nonce)), u322(parts.length), ...parts, u322(0), u322(0));
      const fee = BigInt(msg.fee || 5e6);
      const unsigned = concatBytes2(u322(5), new Uint8Array([2]), u64(BigInt(now())), hexToBytes(first.typed), new Uint8Array([2, 0, 0, 0]), u64(fee), u64(0n), u322(body.length), body, new Uint8Array([2, 0, 0, 0]), u322(0));
      return { unsignedTx: bytesToHex(unsigned), account: first.typed, chain: { genesis: chain2.genesis, tag: chain2.tag, id: chain2.id, node: chain2.node } };
    }
    case "wallet:import": {
      requireUnlocked(unlocked);
      const b = msg.backup || {};
      const added = [];
      for (const s of b.seeds || []) {
        const mnemonic = normalizeMnemonic(s.mnemonic || s.phrase);
        if (!isValidMnemonic(mnemonic)) continue;
        if (!vault.seeds.some((x) => normalizeMnemonic(x.mnemonic) === mnemonic && (x.passphrase || "") === (s.passphrase || ""))) vault.seeds.push({ id: uid(), name: String(s.name || "Imported seed").slice(0, 40), mnemonic, passphrase: s.passphrase || "", createdAt: now(), imported: s.id });
      }
      for (const k of b.keys || []) {
        const raw = parseRawKey(k.hex || k.key);
        if (!raw) continue;
        const fmt = (k.format || k.fmt || "ZBC").toUpperCase();
        try {
          const a = accountFromSecret(raw, fmt, k.btc);
          if (vault.accounts.some((x) => x.typed === a.hex)) continue;
          const key = { id: uid(), name: String(k.name || fmt).slice(0, 40), format: fmt, btc: a.btc, hex: bytesToHex(raw), nodeKey: !!k.nodeKey };
          vault.keys.push(key);
          vault.accounts.push({ id: uid(), label: key.name, source: "key", keyId: key.id, format: fmt, btc: a.btc, typed: a.hex, address: a.address });
          added.push(a.address);
        } catch {
        }
      }
      for (const a of b.accounts || []) {
        if (!(a.source === "seed" || a.seedId !== void 0 || a.seed !== void 0)) continue;
        const seedRef = vault.seeds.find((s) => s.imported === (a.seedId ?? a.seed)) || vault.seeds[vault.seeds.length - 1];
        if (!seedRef) continue;
        const fmt = (a.format || a.fmt || "ZBC").toUpperCase();
        const idx = Number(a.index ?? a.idx ?? 0);
        try {
          const acc = deriveAccount(seedRef, fmt, a.btc, idx);
          if (vault.accounts.some((x) => x.typed === acc.hex)) continue;
          vault.accounts.push({ id: uid(), label: String(a.label || a.name || `${fmt} #${idx}`).slice(0, 40), source: "seed", seedId: seedRef.id, format: fmt, btc: acc.btc, index: idx, typed: acc.hex, address: acc.address });
          added.push(acc.address);
        } catch {
        }
      }
      await saveVault();
      return added;
    }
    // ---- sites, log, settings
    case "sites:list": {
      requireUnlocked(unlocked);
      return Object.entries(vault.sites).map(([origin, s]) => ({ origin, accounts: s.accounts.map((h) => ({ hex: h, label: labelFor(h), display: safeDisplay(h) })), grantedAt: s.grantedAt, lastUsed: s.lastUsed, lastActivity: (vault.log.find((l) => l.origin === origin) || {}).at || s.grantedAt }));
    }
    case "sites:disconnect": {
      requireUnlocked(unlocked);
      delete vault.sites[msg.origin];
      await saveVault();
      emitToOrigin(msg.origin, "accountsChanged", []);
      return true;
    }
    case "log:list":
      requireUnlocked(unlocked);
      return vault.log.slice(0, Number(msg.limit) || 100).map((l) => ({ ...l, accountLabel: l.account ? labelFor(l.account) : null }));
    case "settings:set": {
      requireUnlocked(unlocked);
      const prev = vault.settings.network;
      const next = sanitizeSettings(msg.settings || {});
      if (next.nodes) {
        for (const n of Object.values(next.nodes)) if (!await hostPermitted(n)) throw new Error(`Personal nodes must be on one of the signer's hosts: ${HOST_LIST}`);
      }
      vault.settings = { ...vault.settings, ...next };
      await saveVault();
      await touch();
      if (prev !== vault.settings.network) {
        const c = await genesisCache();
        const g = c[vault.settings.network];
        for (const [, p] of ports) safePost(p.port, { kind: "event", event: "chainChanged", data: { genesis: g ? g.genesis : null, id: vault.settings.network } });
      }
      return vault.settings;
    }
    case "network:info": {
      const id = msg.id || (unlocked ? vault.settings.network : "testnet");
      const c = await resolveChain({ id }).catch((e) => ({ error: e.message }));
      return c.error ? c : { id: c.id, label: c.label, genesis: c.genesis, short: genesisShort(c.genesis), tag: c.tag, node: c.node, height: c.height };
    }
    case "selftest":
      return runSelfTests();
    // ---- pending / approval
    case "pending:list": {
      const pending = await pendingMap();
      return Object.values(pending).sort((a, b) => a.createdAt - b.createdAt).map((p) => ({ id: p.id, origin: p.origin, method: p.method, createdAt: p.createdAt, title: p.view && (p.view.title || p.view.described && p.view.described.title) }));
    }
    case "pending:open":
      await openApproval();
      return true;
    case "approve:list": {
      if (!who.fromApprove) throw new Error("not allowed");
      if (unlocked) await rebuildPendingViews();
      const pending = await pendingMap();
      const list = Object.values(pending).sort((a, b) => a.createdAt - b.createdAt);
      const head = list[0] || null;
      if (head) await SESSION.set({ showing: head.id });
      else await SESSION.remove("showing");
      return { locked: !unlocked, head: head ? { id: head.id, origin: head.origin, method: head.method, view: head.view, error: head.error } : null, waiting: Math.max(0, list.length - 1), waitingSameOrigin: head ? list.filter((p) => p.origin === head.origin).length - 1 : 0 };
    }
    case "approve:decide": {
      if (!who.fromApprove) throw new Error("Only the approval window can sign");
      return decide(String(msg.id), !!msg.approved, msg.options || {}, msg.reason || "");
    }
    case "approve:rejectOrigin": {
      if (!who.fromApprove) throw new Error("not allowed");
      const pending = await pendingMap();
      for (const p of Object.values(pending)) if (p.origin === msg.origin) await decide(p.id, false, {}, "all from this site");
      return true;
    }
    case "permissions:request": {
      const n = normalizeNodeUrl(msg.node);
      if (!n) throw new Error("https URL required");
      if (!await hostPermitted(n)) throw new Error(`Personal nodes must be on one of the signer's hosts: ${HOST_LIST}`);
      return true;
    }
    case "site:inject": {
      if (!who.fromPopup) throw new Error("not allowed");
      return injectIntoActiveTab();
    }
    default:
      throw new Error("unknown message " + type);
  }
}
function requireUnlocked(u) {
  if (!u) throw rpcError(ERR.LOCKED, "Signer locked");
}
function publicAccount(a) {
  return { id: a.id, label: a.label, source: a.source, seedId: a.seedId, format: a.format, btc: a.btc, index: a.index, typed: a.typed, address: a.address, hidden: !!a.hidden, nodeKey: !!a.nodeKey, broken: a.broken || null };
}
function safeDisplay(hex) {
  const p = parseTypedHex(hex);
  return p ? p.display : hex;
}
function sanitizeSettings(s) {
  const out = {};
  if (s.autoLockMinutes !== void 0) out.autoLockMinutes = Math.min(240, Math.max(1, Number(s.autoLockMinutes) || 15));
  if (s.network !== void 0 && NETWORKS[s.network]) out.network = s.network;
  if (s.nodes !== void 0) {
    out.nodes = {};
    for (const [k, v] of Object.entries(s.nodes)) {
      const n = normalizeNodeUrl(v);
      if (n && NETWORKS[k]) out.nodes[k] = n;
    }
  }
  for (const k of ["blindDigest", "sessionKeys", "trustPageGenesis"]) if (s[k] !== void 0) out[k] = !!s[k];
  if (s.language !== void 0) out.language = String(s.language).slice(0, 5);
  return out;
}
function addDerived(seed, formats) {
  const added = [];
  for (const f of formats) {
    if (!FORMATS.includes(f.format)) continue;
    const index = Number(f.index || 0);
    const a = deriveAccount(seed, f.format, f.btc, index);
    if (vault.accounts.some((x) => x.typed === a.hex)) continue;
    const acc = { id: uid(), label: String(f.label || `${f.format}${index ? " #" + index : ""}`).slice(0, 40), source: "seed", seedId: seed.id, format: f.format, btc: a.btc, index, typed: a.hex, address: a.address };
    vault.accounts.push(acc);
    added.push(publicAccount(acc));
  }
  return added;
}
async function rebuildPendingViews() {
  const pending = await pendingMap();
  let changed = false;
  for (const p of Object.values(pending)) {
    if (p.view) continue;
    try {
      p.view = await buildView(p);
    } catch (e) {
      delete pending[p.id];
      inflight.delete(p.id);
      respond({ id: p.id, portId: p.portId }, void 0, e);
    }
    changed = true;
  }
  if (changed) await setPending(pending);
}
var u322 = (v) => new Uint8Array([v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255]);
var u64 = (v) => {
  v = BigInt.asUintN(64, v);
  const o = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    o[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return o;
};
function concatBytes2(...a) {
  let n = 0;
  for (const x of a) n += x.length;
  const o = new Uint8Array(n);
  let i = 0;
  for (const x of a) {
    o.set(x, i);
    i += x.length;
  }
  return o;
}
