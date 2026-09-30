// sr25519 (schnorrkel) for Polkadot accounts: STROBE-128 + Merlin transcripts over Ristretto255.
// Signing context "substrate", as every Substrate chain verifies it.
import { keccakP } from '@noble/hashes/sha3';
import { sha512 } from '@noble/hashes/sha512';
import { RistrettoPoint, ed25519 } from '@noble/curves/ed25519';
import { utf8, concat, u32le, u64le, randomBytes } from './bytes.js';

const L = ed25519.CURVE.n;
const STROBE_R = 166;
const FLAG_I = 1, FLAG_A = 2, FLAG_C = 4, FLAG_T = 8, FLAG_M = 16, FLAG_K = 32;

class Strobe128 {
  constructor(label) {
    this.state = new Uint8Array(200);
    this.words = new Uint32Array(this.state.buffer);
    this.pos = 0; this.posBegin = 0; this.curFlags = 0;
    this.state.set([1, STROBE_R + 2, 1, 0, 1, 96], 0);
    this.state.set(utf8('STROBEv1.0.2'), 6);
    this.runF(true);
    this.metaAd(label, false);
  }
  runF(init = false) {
    if (!init) {
      this.state[this.pos] ^= this.posBegin;
      this.state[this.pos + 1] ^= 0x04;
      this.state[STROBE_R + 1] ^= 0x80;
    }
    keccakP(this.words, 24);
    this.pos = 0; this.posBegin = 0;
  }
  absorb(data) { for (let i = 0; i < data.length; i++) { this.state[this.pos++] ^= data[i]; if (this.pos === STROBE_R) this.runF(); } }
  overwrite(data) { for (let i = 0; i < data.length; i++) { this.state[this.pos++] = data[i]; if (this.pos === STROBE_R) this.runF(); } }
  squeeze(n) { const out = new Uint8Array(n); for (let i = 0; i < n; i++) { out[i] = this.state[this.pos]; this.state[this.pos++] = 0; if (this.pos === STROBE_R) this.runF(); } return out; }
  beginOp(flags, more) {
    if (more) { if (this.curFlags !== flags) throw new Error('strobe: flag mismatch'); return; }
    if (flags & FLAG_T) throw new Error('strobe: T flag unsupported');
    const oldBegin = this.posBegin;
    this.posBegin = this.pos + 1; this.curFlags = flags;
    this.absorb(new Uint8Array([oldBegin, flags]));
    const forceF = (flags & (FLAG_C | FLAG_K)) !== 0;
    if (forceF && this.pos !== 0) this.runF();
  }
  metaAd(data, more) { this.beginOp(FLAG_M | FLAG_A, more); this.absorb(data); }
  ad(data, more) { this.beginOp(FLAG_A, more); this.absorb(data); }
  prf(n, more) { this.beginOp(FLAG_I | FLAG_A | FLAG_C, more); return this.squeeze(n); }
  key(data, more) { this.beginOp(FLAG_A | FLAG_C, more); this.overwrite(data); }
  clone() { const c = Object.create(Strobe128.prototype); c.state = this.state.slice(); c.words = new Uint32Array(c.state.buffer); c.pos = this.pos; c.posBegin = this.posBegin; c.curFlags = this.curFlags; return c; }
}

export class Transcript {
  constructor(label) { this.s = new Strobe128(utf8('Merlin v1.0')); this.appendMessage('dom-sep', label); }
  appendMessage(label, message) {
    if (typeof label === 'string') label = utf8(label);
    if (typeof message === 'string') message = utf8(message);
    this.s.metaAd(label, false); this.s.metaAd(u32le(message.length), true); this.s.ad(message, false);
  }
  challengeBytes(label, n) {
    if (typeof label === 'string') label = utf8(label);
    this.s.metaAd(label, false); this.s.metaAd(u32le(n), true); return this.s.prf(n, false);
  }
  /** Merlin TranscriptRng: rekeyed with witness bytes and fresh randomness. */
  witnessBytes(label, nonceSeeds, n, rng = randomBytes) {
    if (typeof label === 'string') label = utf8(label);
    const s = this.s.clone();
    for (const ns of nonceSeeds) { s.metaAd(label, false); s.metaAd(u32le(ns.length), true); s.key(ns, false); }
    const r = rng(32);
    s.metaAd(utf8('rng'), false); s.key(r, false);
    s.metaAd(u32le(n), false);
    return s.prf(n, false);
  }
}

function leToBigInt(b) { let v = 0n; for (let i = b.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]); return v; }
function bigIntToLe32(v) { const out = new Uint8Array(32); for (let i = 0; i < 32; i++) { out[i] = Number(v & 0xffn); v >>= 8n; } return out; }
const mod = (a) => ((a % L) + L) % L;
function scalarFromWide(b64) { return mod(leToBigInt(b64)); }

/** Expand a 32-byte mini secret (ExpansionMode::Ed25519) → { key: scalar, nonce: 32 bytes, publicKey: 32 bytes }. */
export function sr25519FromMiniSecret(mini) {
  if (mini.length !== 32) throw new Error('mini secret must be 32 bytes');
  const r = sha512(mini);
  const key = r.slice(0, 32);
  key[0] &= 248; key[31] &= 63; key[31] |= 64;
  // divide by the cofactor: the clamped value is a multiple of 8
  const scalar = mod(leToBigInt(key) >> 3n);
  const nonce = r.slice(32, 64);
  const publicKey = RistrettoPoint.BASE.multiply(scalar).toRawBytes();
  return { key: scalar, nonce, publicKey };
}

function signingTranscript(context, message, publicKey) {
  const t = new Transcript('SigningContext');
  t.appendMessage('', context);
  t.appendMessage('sign-bytes', message);
  t.appendMessage('proto-name', 'Schnorr-sig');
  t.appendMessage('sign:pk', publicKey);
  return t;
}

/** Sign `message` under `context` (default "substrate"). Returns 64 bytes: R ‖ s (with the schnorrkel marker bit). */
export function sr25519Sign(secret, message, context = 'substrate') {
  const t = signingTranscript(utf8(context), message, secret.publicKey);
  const rBytes = t.witnessBytes('signing', [secret.nonce], 64);
  const r = scalarFromWide(rBytes);
  const R = RistrettoPoint.BASE.multiply(r).toRawBytes();
  t.appendMessage('sign:R', R);
  const k = scalarFromWide(t.challengeBytes('sign:c', 64));
  const s = mod(k * secret.key + r);
  const sig = concat(R, bigIntToLe32(s));
  sig[63] |= 128;
  return sig;
}

export function sr25519Verify(publicKey, message, signature, context = 'substrate') {
  if (signature.length !== 64 || !(signature[63] & 128)) return false;
  const R = signature.slice(0, 32);
  const sBytes = signature.slice(32, 64); sBytes[31] &= 127;
  const s = leToBigInt(sBytes);
  if (s >= L) return false;
  const t = signingTranscript(utf8(context), message, publicKey);
  t.appendMessage('sign:R', R);
  const k = scalarFromWide(t.challengeBytes('sign:c', 64));
  let pk; try { pk = RistrettoPoint.fromHex(publicKey); } catch { return false; }
  const Rp = RistrettoPoint.BASE.multiply(s).subtract(pk.multiply(k)).toRawBytes();
  return Rp.every((b, i) => b === R[i]);
}

/** Hard derivation (Substrate "//junction") from a mini secret: Substrate feeds the expanded secret scalar to the transcript. cc = 32-byte chain code. Returns the child mini secret. */
export function sr25519HardDerive(mini, chainCode) {
  const secret = sr25519FromMiniSecret(mini);
  const t = new Transcript('SchnorrRistrettoHDKD');
  t.appendMessage('sign-bytes', new Uint8Array(0));
  t.appendMessage('chain-code', chainCode);
  t.appendMessage('secret-key', bigIntToLe32(secret.key));
  const msk = t.challengeBytes('HDKD-hard', 32);
  t.challengeBytes('HDKD-chaincode', 32);
  return msk;
}

/** Chain code of a numeric junction (//<n>): SCALE u64 LE padded to 32 bytes. */
export function junctionIndex(n) { const cc = new Uint8Array(32); cc.set(u64le(n), 0); return cc; }
/** Chain code of a string junction (//Alice): SCALE-encoded string padded to 32 bytes (or its blake2b-256 when longer). */
export function junctionString(s) {
  const b = utf8(s);
  const len = b.length << 2; // compact-encoded length for < 64
  const enc = concat(new Uint8Array([len]), b);
  const cc = new Uint8Array(32);
  if (enc.length > 32) throw new Error('long junction unsupported');
  cc.set(enc, 0);
  return cc;
}
