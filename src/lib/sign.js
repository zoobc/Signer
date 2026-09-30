// Signature envelopes per account format (spec §4.2) and their verification (self-tests).
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { sha256 } from '@noble/hashes/sha256';
import { sr25519FromMiniSecret, sr25519Sign, sr25519Verify } from './sr25519.js';
import { accountFromSecret } from './keys.js';
import { concat, u16le } from './bytes.js';

function sha256d(b) { return sha256(sha256(b)); }

/** Sign a 32-byte digest with the format's envelope. `secret` is the 32-byte account secret. */
export function signDigest(secret, format, btc, digest) {
  const acc = accountFromSecret(secret, format, btc);
  switch (format) {
    case 'ZBC': case 'SOL': return ed25519.sign(digest, secret);
    case 'ADA': case 'XTZ': return concat(u16le(32), acc.publicKey, ed25519.sign(digest, secret));
    case 'DOT': return sr25519Sign(sr25519FromMiniSecret(secret), digest);
    case 'ETH': case 'BNB': case 'TRX': {
      const sig = secp256k1.sign(keccak_256(digest), secret, { lowS: true });
      return concat(sig.toCompactRawBytes(), new Uint8Array([sig.recovery + 27]));
    }
    case 'XRP': {
      const sig = secp256k1.sign(sha256d(digest), secret, { lowS: true });
      return concat(u16le(33), acc.publicKey, sig.toCompactRawBytes());
    }
    case 'BTC': {
      if (btc === 'taproot') return schnorr.sign(digest, acc.signingSecret);
      const sig = secp256k1.sign(sha256d(digest), secret, { lowS: true });
      return concat(u16le(33), acc.publicKey, sig.toCompactRawBytes());
    }
    default: throw new Error('unknown format ' + format);
  }
}

/** Raw Ed25519 over arbitrary bytes (fee-vote reveal, relay permit). ZBC only. */
export function signRawEd25519(secret, bytes) { return ed25519.sign(bytes, secret); }
export function verifyRawEd25519(publicKey, bytes, sig) { try { return ed25519.verify(sig, bytes, publicKey); } catch { return false; } }

/** Verify an envelope signature against a typed account payload (used by the self-tests). */
export function verifyDigest(format, btc, payload, digest, sig) {
  try {
    switch (format) {
      case 'ZBC': case 'SOL': return sig.length === 64 && ed25519.verify(sig, digest, payload);
      case 'ADA': case 'XTZ': {
        if (sig.length !== 98 || sig[0] !== 32 || sig[1] !== 0) return false;
        const pub = sig.slice(2, 34), s = sig.slice(34);
        const acc = pubToPayload(format, pub);
        return acc.every((b, i) => b === payload[i]) && ed25519.verify(s, digest, pub);
      }
      case 'DOT': return sr25519Verify(payload, digest, sig);
      case 'ETH': case 'BNB': case 'TRX': {
        if (sig.length !== 65) return false;
        const s = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(sig[64] - 27);
        const pub = s.recoverPublicKey(keccak_256(digest)).toRawBytes(false);
        const addr = keccak_256(pub.slice(1)).slice(12);
        return addr.every((b, i) => b === payload[i]);
      }
      case 'XRP': case 'BTC': {
        if (btc === 'taproot') return sig.length === 64 && schnorr.verify(sig, digest, payload);
        if (sig.length !== 99 || sig[0] !== 33 || sig[1] !== 0) return false;
        const pub = sig.slice(2, 35), s = sig.slice(35);
        const h = pubToPayload(format === 'XRP' ? 'XRP' : 'BTC', pub);
        return h.every((b, i) => b === payload[i]) && secp256k1.verify(s, sha256d(digest), pub);
      }
      default: return false;
    }
  } catch { return false; }
}

import { blake2b } from '@noble/hashes/blake2b';
import { ripemd160 } from '@noble/hashes/ripemd160';
function pubToPayload(format, pub) {
  if (format === 'ADA') return blake2b(pub, { dkLen: 28 });
  if (format === 'XTZ') return blake2b(pub, { dkLen: 20 });
  return ripemd160(sha256(pub));
}
