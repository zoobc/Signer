// Key derivation for every account format (spec §4.2) from BIP-39 seeds or raw 32-byte secrets.
import { mnemonicToSeedSync, mnemonicToEntropy, validateMnemonic, generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { keccak_256 } from '@noble/hashes/sha3';
import { blake2b } from '@noble/hashes/blake2b';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { sr25519FromMiniSecret, sr25519HardDerive, junctionIndex } from './sr25519.js';
import { typed, typeForFormat, display } from './address.js';
import { concat, utf8, hexToBytes, bytesToHex, zero } from './bytes.js';

export { wordlist };
export function newMnemonic(words = 24) { return generateMnemonic(wordlist, words === 12 ? 128 : words === 15 ? 160 : words === 18 ? 192 : words === 21 ? 224 : 256); }
export function isValidMnemonic(m) { return validateMnemonic(normalizeMnemonic(m), wordlist); }
export function normalizeMnemonic(m) { return String(m || '').normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' '); }

/** BIP-39 seed (64 bytes). */
export function bip39Seed(mnemonic, passphrase = '') { return mnemonicToSeedSync(normalizeMnemonic(mnemonic), passphrase.normalize('NFKD')); }

/** SLIP-0010 Ed25519, hardened-only path (array of indices without the hardened bit). */
export function slip10Ed25519(seed, indices) {
  let I = hmac(sha512, utf8('ed25519 seed'), seed);
  let k = I.slice(0, 32), c = I.slice(32);
  for (const idx of indices) {
    const i = (idx >>> 0) | 0x80000000;
    const data = concat(new Uint8Array([0]), k, new Uint8Array([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff]));
    I = hmac(sha512, c, data);
    k = I.slice(0, 32); c = I.slice(32);
  }
  return k;
}

/** Derivation path per format (spec §4.2). */
export function derivationPath(format, btc, index) {
  switch (format) {
    case 'ZBC': return `m/44'/883'/${index}'`;
    case 'SOL': return `m/44'/501'/${index}'/0'`;
    case 'ADA': return `m/44'/1815'/${index}'`;
    case 'XTZ': return `m/44'/1729'/${index}'`;
    case 'DOT': return index ? `//${index}` : '(mini secret, no path)';
    case 'ETH': case 'BNB': return `m/44'/60'/0'/0/${index}`;
    case 'TRX': return `m/44'/195'/0'/0/${index}`;
    case 'XRP': return `m/44'/144'/0'/0/${index}`;
    case 'BTC': return btc === 'legacy' ? `m/44'/0'/0'/0/${index}` : btc === 'taproot' ? `m/86'/0'/0'/0/${index}` : `m/84'/0'/0'/0/${index}`;
    default: throw new Error('unknown format ' + format);
  }
}

function hardenedIndices(path) { return path.split('/').slice(1).map((p) => parseInt(p, 10)); }

/** The 32-byte secret of a derived account. */
export function deriveSecret({ mnemonic, passphrase = '' }, format, btc, index = 0) {
  const path = derivationPath(format, btc, index);
  switch (format) {
    case 'ZBC': case 'SOL': case 'ADA': case 'XTZ': {
      const seed = bip39Seed(mnemonic, passphrase);
      const k = slip10Ed25519(seed, hardenedIndices(path));
      zero(seed); return k;
    }
    case 'DOT': {
      const entropy = mnemonicToEntropy(normalizeMnemonic(mnemonic), wordlist);
      let mini = pbkdf2(sha512, entropy, utf8('mnemonic' + passphrase.normalize('NFKD')), { c: 2048, dkLen: 64 }).slice(0, 32);
      if (index) mini = sr25519HardDerive(mini, junctionIndex(index));
      return mini;
    }
    default: {
      const seed = bip39Seed(mnemonic, passphrase);
      const hd = HDKey.fromMasterSeed(seed);
      const child = hd.derive(path);
      const k = new Uint8Array(child.privateKey);
      zero(seed); child.wipePrivateData();
      return k;
    }
  }
}

function hash160(b) { return ripemd160(sha256(b)); }
const N = secp256k1.CURVE.n;
function bytesToBig(b) { let v = 0n; for (const x of b) v = (v << 8n) | BigInt(x); return v; }
function bigToBytes32(v) { return hexToBytes(v.toString(16).padStart(64, '0')); }

/** Taproot key-path tweak (BIP-341, no script tree). Returns { secret: tweaked 32-byte scalar, outputKey: x-only 32 }. */
export function taprootTweak(priv) {
  const comp = secp256k1.getPublicKey(priv, true);
  let d = bytesToBig(priv);
  if (comp[0] === 3) d = N - d;
  const internal = comp.slice(1);
  const t = bytesToBig(schnorr.utils.taggedHash('TapTweak', internal));
  const tweaked = bigToBytes32((d + t) % N);
  return { secret: tweaked, outputKey: schnorr.getPublicKey(tweaked) };
}

/** Public key material and typed account for a 32-byte secret in a format. */
export function accountFromSecret(secret, format, btc) {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new Error('secret must be 32 bytes');
  const type = typeForFormat(format, btc);
  let publicKey, payload, signingSecret = secret;
  switch (format) {
    case 'ZBC': case 'SOL': publicKey = ed25519.getPublicKey(secret); payload = publicKey; break;
    case 'ADA': publicKey = ed25519.getPublicKey(secret); payload = blake2b(publicKey, { dkLen: 28 }); break;
    case 'XTZ': publicKey = ed25519.getPublicKey(secret); payload = blake2b(publicKey, { dkLen: 20 }); break;
    case 'DOT': publicKey = sr25519FromMiniSecret(secret).publicKey; payload = publicKey; break;
    case 'ETH': case 'BNB': case 'TRX': {
      if (bytesToBig(secret) === 0n || bytesToBig(secret) >= N) throw new Error('invalid secp256k1 key');
      publicKey = secp256k1.getPublicKey(secret, false);
      payload = keccak_256(publicKey.slice(1)).slice(12); break;
    }
    case 'XRP': publicKey = secp256k1.getPublicKey(secret, true); payload = hash160(publicKey); break;
    case 'BTC': {
      if (btc === 'taproot') { const t = taprootTweak(secret); signingSecret = t.secret; publicKey = t.outputKey; payload = t.outputKey; }
      else { publicKey = secp256k1.getPublicKey(secret, true); payload = hash160(publicKey); }
      break;
    }
    default: throw new Error('unknown format ' + format);
  }
  const t = typed(type, payload);
  return { format, btc: format === 'BTC' ? (btc || 'segwit') : undefined, type, publicKey, payload, typed: t, hex: bytesToHex(t), address: display(t), signingSecret };
}

/** Parse a raw private key (64 hex, 0x optional). */
export function parseRawKey(hex) {
  const s = String(hex || '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(s)) return null;
  return hexToBytes(s);
}

export function deriveAccount(seed, format, btc, index) {
  const secret = deriveSecret(seed, format, btc, index);
  const acc = accountFromSecret(secret, format, btc);
  return { ...acc, index, path: derivationPath(format, btc, index) };
}
