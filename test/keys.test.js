import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveAccount, deriveSecret, accountFromSecret, parseRawKey } from '../src/lib/keys.js';
import { signDigest, verifyDigest, signRawEd25519 } from '../src/lib/sign.js';
import { txDigest, txDigestV1, txHash, txIdFromHash, messageDigestV1, groupConsentDigest, feeVoteInfo } from '../src/lib/zbc.js';
import { hexToBytes, bytesToHex, utf8, randomBytes } from '../src/lib/bytes.js';

const keys = JSON.parse(readFileSync(new URL('./fixtures/keys.json', import.meta.url)));
const txs = JSON.parse(readFileSync(new URL('./fixtures/transactions.json', import.meta.url))).vectors;
const txsAll = JSON.parse(readFileSync(new URL('./fixtures/transactions-all.json', import.meta.url))).vectors;
const msgs = JSON.parse(readFileSync(new URL('./fixtures/messages.json', import.meta.url))).vectors;
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('SLIP-10 m/44\'/883\'/i\' accounts from keys.json wallets', () => {
  for (const w of keys.wallets) for (const a of w.accounts) {
    const acc = deriveAccount({ mnemonic: w.mnemonic, passphrase: w.passphrase }, 'ZBC', undefined, a.index);
    assert.equal(bytesToHex(acc.signingSecret), a.seed, `${w.passphrase} #${a.index}`);
    assert.equal(bytesToHex(acc.publicKey), a.public_key);
    assert.equal(acc.address, a.address);
    assert.equal(acc.path, a.path);
  }
});

test('raw seeds from keys.json', () => {
  for (const s of keys.seeds) {
    const acc = accountFromSecret(parseRawKey(s.seed), 'ZBC');
    assert.equal(acc.address, s.address);
  }
});

test('secp256k1 formats: known abandon-mnemonic addresses', () => {
  const seed = { mnemonic: ABANDON };
  assert.equal(deriveAccount(seed, 'ETH', undefined, 0).address, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  assert.equal(deriveAccount(seed, 'BNB', undefined, 0).address, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  assert.equal(deriveAccount(seed, 'BTC', 'legacy', 0).address, '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
  assert.equal(deriveAccount(seed, 'BTC', 'segwit', 0).address, 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  assert.equal(deriveAccount(seed, 'BTC', 'taproot', 0).address, 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr');
  assert.equal(deriveAccount(seed, 'TRX', undefined, 0).address, 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
});

test('every format derives, signs and verifies', () => {
  const seed = { mnemonic: ABANDON, passphrase: '' };
  const digest = randomBytes(32);
  const cases = [['ZBC'], ['ETH'], ['BNB'], ['BTC', 'legacy'], ['BTC', 'segwit'], ['BTC', 'taproot'], ['SOL'], ['DOT'], ['ADA'], ['XTZ'], ['TRX'], ['XRP']];
  const lens = { ZBC: 64, SOL: 64, DOT: 64, ETH: 65, BNB: 65, TRX: 65, ADA: 98, XTZ: 98, XRP: 99, 'BTC/legacy': 99, 'BTC/segwit': 99, 'BTC/taproot': 64 };
  for (const [format, btc] of cases) {
    const acc = deriveAccount(seed, format, btc, 0);
    const sig = signDigest(deriveSecret(seed, format, btc, 0), format, btc, digest);
    assert.equal(sig.length, lens[btc ? `${format}/${btc}` : format], `${format} ${btc || ''}`);
    assert.ok(verifyDigest(format, btc, acc.payload, digest, sig), `verify ${format} ${btc || ''}`);
    const bad = sig.slice(); bad[bad.length - 1] ^= 1;
    assert.ok(!verifyDigest(format, btc, acc.payload, digest, bad) || format === 'ETH' || format === 'BNB' || format === 'TRX', `tamper ${format}`);
    assert.ok(acc.address.length > 20);
  }
  // DOT index 1 uses a hard junction and differs from index 0
  assert.notEqual(deriveAccount(seed, 'DOT', undefined, 1).address, deriveAccount(seed, 'DOT', undefined, 0).address);
});

test('spec §4.6 digest and signature vector', () => {
  const acc = deriveAccount({ mnemonic: ABANDON }, 'ZBC', undefined, 0);
  const unsigned = hexToBytes('010000000100f1536500000000000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152404b4c00000000000800000000e1f505000000000200000000000000');
  const genesis = new Uint8Array(32).fill(0x5a);
  const d = txDigest(unsigned, genesis, 'ZBC-TX');
  assert.equal(bytesToHex(d), '55f3ed31e5896bb127dfa7db19f3eb1d6e35a8e49e29fcbdca24acd84c9ab955');
  assert.equal(bytesToHex(signDigest(acc.signingSecret, 'ZBC', undefined, d)), '8934cb7019641f7be76e1fec2a7e94395140da90cfc4dad041aee5f28479eac2f86460393d9a2ea6ab246300b3531338c25e64765df25ed9b7852d681ec8bc0b');
});

test('reference transaction vectors: digest, signature, hash', () => {
  for (const v of [...txs, ...txsAll]) {
    const unsigned = hexToBytes(v.expected.unsigned_bytes);
    const d = v.genesis === 'v1' ? txDigestV1(unsigned) : txDigest(unsigned, hexToBytes(v.genesis));
    assert.equal(bytesToHex(d), v.expected.digest, v.name);
    const sig = signDigest(hexToBytes(v.key), 'ZBC', undefined, d);
    assert.equal(bytesToHex(sig), v.expected.signature, v.name);
    assert.equal(bytesToHex(txHash(unsigned, sig)), v.expected.transaction_hash, v.name);
  }
});

test('ZBC-MSG-v1 message vectors (zbc-cli scheme)', () => {
  for (const m of msgs) {
    const d = messageDigestV1(hexToBytes(m.message_hex));
    assert.equal(bytesToHex(d), m.digest);
    assert.equal(bytesToHex(signDigest(hexToBytes(m.seed), 'ZBC', undefined, d)), m.signature);
  }
});

test('group consent digests (§4.6)', () => {
  const genesis = new Uint8Array(32).fill(0x5a);
  const controller = hexToBytes('00000000' + '11'.repeat(32));
  const member = hexToBytes('04000000' + '22'.repeat(20));
  assert.equal(bytesToHex(groupConsentDigest('group-link', { controller, member, validUntil: 1000, seq: 0, genesis })), '999e96f16db8bf3be83b59fce3dfc56f3cc7fa0397dc80bcbaa502f24ff66120');
  assert.equal(bytesToHex(groupConsentDigest('group-control', { controller, member, validUntil: 1000, seq: 3, genesis })), '7b3637c306eff8f6ffefc9bc316263c292a2fbf6f4a5e01c6dba57b70278334d');
});

test('fee vote info and raw voter signature match the reference vector', () => {
  const info = feeVoteInfo({ recentBlockHash: '11'.repeat(32), height: 1000, feeVote: 3n });
  assert.equal(bytesToHex(info), '1111111111111111111111111111111111111111111111111111111111111111e803000003000000' + '00000000');
  const sig = signRawEd25519(hexToBytes('51bae95d58f32304a5c9d894819989a4fb04da6115d9a43612a026e7a5dd5d96'), info);
  assert.equal(bytesToHex(sig), '2f1299c979ea987a8512a48a70cbdea547172c86cd487f832520c7b54c752b491365123c0572c858e4e239f563c0a7d6a8ba2263b507fbe4395e9e3bd370630d');
});

test('transaction id is the signed int64 of the hash', () => {
  assert.equal(txIdFromHash(hexToBytes('ffffffffffffffff' + '00'.repeat(24))), -1n);
  assert.equal(txIdFromHash(hexToBytes('0100000000000000' + '00'.repeat(24))), 1n);
});
