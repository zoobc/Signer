// Developer self-tests (spec §12 item 1 + §4.6), runnable from the options page. Returns [{ name, ok, detail }].
import vectors from './vectors.json' with { type: 'json' };
import { parseAddress, zbcEncode, display } from './address.js';
import { deriveAccount, accountFromSecret, deriveSecret } from './keys.js';
import { signDigest, verifyDigest } from './sign.js';
import { txDigest, txDigestV1, txHash, groupConsentDigest } from './zbc.js';
import { decodeTransaction } from './decoder.js';
import { describe } from './describe.js';
import * as decoder from './decoder.js';
import { hexToBytes, bytesToHex, randomBytes, DecodeError } from './bytes.js';
import { Transcript } from './sr25519.js';

export async function runSelfTests() {
  const results = [];
  const t = (name, fn) => { try { const d = fn(); results.push({ name, ok: true, detail: d || '' }); } catch (e) { results.push({ name, ok: false, detail: e.message }); } };
  const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  t('§4.6 digest + signature vector', () => {
    const acc = deriveAccount({ mnemonic: ABANDON }, 'ZBC', undefined, 0);
    const unsigned = hexToBytes(vectors.transactions[0].unsigned);
    const d = txDigest(unsigned, new Uint8Array(32).fill(0x5a));
    if (bytesToHex(d) !== '55f3ed31e5896bb127dfa7db19f3eb1d6e35a8e49e29fcbdca24acd84c9ab955') throw new Error('digest ' + bytesToHex(d));
    const s = bytesToHex(signDigest(acc.signingSecret, 'ZBC', undefined, d));
    if (s !== '8934cb7019641f7be76e1fec2a7e94395140da90cfc4dad041aee5f28479eac2f86460393d9a2ea6ab246300b3531338c25e64765df25ed9b7852d681ec8bc0b') throw new Error('signature ' + s);
    return acc.address;
  });
  t('group consent vectors', () => {
    const genesis = new Uint8Array(32).fill(0x5a), controller = hexToBytes('00000000' + '11'.repeat(32)), member = hexToBytes('04000000' + '22'.repeat(20));
    const a = bytesToHex(groupConsentDigest('group-link', { controller, member, validUntil: 1000, seq: 0, genesis }));
    const b = bytesToHex(groupConsentDigest('group-control', { controller, member, validUntil: 1000, seq: 3, genesis }));
    if (a !== '999e96f16db8bf3be83b59fce3dfc56f3cc7fa0397dc80bcbaa502f24ff66120' || b !== '7b3637c306eff8f6ffefc9bc316263c292a2fbf6f4a5e01c6dba57b70278334d') throw new Error(a + ' ' + b);
  });
  t(`${vectors.addresses.length} address vectors round-trip`, () => {
    let n = 0;
    for (const v of vectors.addresses) {
      const r = parseAddress(v.input, v.chain);
      if (!v.valid) { if (r) throw new Error('accepted invalid ' + v.input); continue; }
      if (!r || r.hex !== v.address_bytes || r.type !== v.account_type) throw new Error('mismatch ' + v.input);
      const back = parseAddress(r.display); if (!back || back.hex !== v.address_bytes) throw new Error('round trip ' + v.input);
      n++;
    }
    return `${n} valid`;
  });
  t('keys.json wallets (SLIP-10 m/44\'/883\')', () => {
    for (const w of vectors.wallets) for (const a of w.accounts) { const acc = deriveAccount({ mnemonic: w.mnemonic, passphrase: w.passphrase }, 'ZBC', undefined, a.index); if (acc.address !== a.address) throw new Error(a.address); }
    for (const s of vectors.seeds) if (accountFromSecret(hexToBytes(s.seed), 'ZBC').address !== s.address) throw new Error(s.address);
  });
  t('reference transactions: decode, digest, sign, hash', () => {
    for (const v of vectors.transactions) {
      const u = hexToBytes(v.unsigned); const tx = decodeTransaction(u); describe(tx, { decoder, now: 1700000000 });
      const d = v.genesis === 'v1' ? txDigestV1(u) : txDigest(u, hexToBytes(v.genesis));
      if (bytesToHex(d) !== v.digest) throw new Error(v.name + ' digest');
      const s = signDigest(hexToBytes(v.key), 'ZBC', undefined, d);
      if (bytesToHex(s) !== v.signature || bytesToHex(txHash(u, s)) !== v.hash) throw new Error(v.name + ' signature');
      let threw = false; try { decodeTransaction(u.slice(0, -1)); } catch (e) { threw = e instanceof DecodeError; }
      if (!threw) throw new Error(v.name + ' truncation not detected');
    }
    return `${vectors.transactions.length} vectors`;
  });
  t('Merlin transcript vector (sr25519)', () => {
    const tr = new Transcript('test protocol'); tr.appendMessage('some label', 'some data');
    const c = bytesToHex(tr.challengeBytes('challenge', 32));
    if (c !== 'd5a21972d0d5fe320c0d263fac7fffb8145aa640af6e9bca177c03c7efcf0615') throw new Error(c);
  });
  t('every format signs and verifies a random digest', () => {
    const digest = randomBytes(32); const seed = { mnemonic: ABANDON };
    for (const [f, b] of [['ZBC'], ['ETH'], ['BNB'], ['BTC', 'legacy'], ['BTC', 'segwit'], ['BTC', 'taproot'], ['SOL'], ['DOT'], ['ADA'], ['XTZ'], ['TRX'], ['XRP']]) {
      const acc = deriveAccount(seed, f, b, 0); const sig = signDigest(deriveSecret(seed, f, b, 0), f, b, digest);
      if (!verifyDigest(f, b, acc.payload, digest, sig)) throw new Error(f + ' ' + (b || ''));
    }
    return '12 envelopes';
  });
  t('known foreign addresses from the test mnemonic', () => {
    const seed = { mnemonic: ABANDON };
    const exp = { ETH: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', 'BTC/legacy': '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'BTC/segwit': 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', 'BTC/taproot': 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr' };
    for (const [k, v] of Object.entries(exp)) { const [f, b] = k.split('/'); const a = deriveAccount(seed, f, b, 0).address; if (a !== v) throw new Error(`${k}: ${a}`); }
  });
  t('ZBC_ text form of a Solana key matches zbc-cli', () => { const s = zbcEncode(new Uint8Array(32), 'ZBC'); if (s !== 'ZBC_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAAAAAA_AAAHKJF5') throw new Error(s); void display; });
  return results;
}
