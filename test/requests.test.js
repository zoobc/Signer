import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTxView, buildDigestView, buildMessageView, normalizeAccount, isDisguisedTransaction } from '../src/lib/requests.js';
import { hexToBytes, bytesToHex, utf8 } from '../src/lib/bytes.js';

const core = JSON.parse(readFileSync(new URL('./fixtures/transactions.json', import.meta.url))).vectors;
const plain = core.find((v) => v.name === 'send-zbc/plain');
const other = core.find((v) => v.name === 'send-zbc/other-sender');
const genesis = plain.genesis;
const chain = { genesis, genesisBytes: hexToBytes(genesis), tag: 'ZBC-TX', id: 'testnet' };
const ctx = { origin: 'https://shop.example.com', chain, now: 1700000000 };
const SENDER = '000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152';

test('sign-transaction view: sender must equal the requested account (4300)', () => {
  const acc = normalizeAccount('ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX');
  assert.equal(acc.hex, SENDER);
  const { view } = buildTxView({ unsignedTx: plain.expected.unsigned_bytes, intent: { title: 'Pay', typeName: 'SendZBC', rows: [['Amount', '1 ZBC']] } }, acc, ctx);
  assert.equal(view.kind, 'tx'); assert.equal(view.described.title, 'Send 1 ZBC'); assert.ok(view.match.ok);
  assert.throws(() => buildTxView({ unsignedTx: other.expected.unsigned_bytes, intent: {} }, acc, ctx), (e) => e.code === 4300);
  assert.throws(() => buildTxView({ unsignedTx: plain.expected.unsigned_bytes.slice(0, -2), intent: {} }, acc, ctx), (e) => e.code === 4300);
  const mismatch = buildTxView({ unsignedTx: plain.expected.unsigned_bytes, intent: { rows: [['Amount', '100 ZBC']] } }, acc, ctx);
  assert.equal(mismatch.view.match.ok, false);
});

test('digest views recompute and compare the digest', () => {
  const member = normalizeAccount('04000000' + '22'.repeat(20));
  const pre = { controller: '00000000' + '11'.repeat(32), member: '04000000' + '22'.repeat(20), validUntil: 1000, seq: 0 };
  const c2 = { ...ctx, chain: { ...chain, genesis: '5a'.repeat(32), genesisBytes: new Uint8Array(32).fill(0x5a) } };
  const v = buildDigestView({ kind: 'group-link', preimage: pre, digest: '999e96f16db8bf3be83b59fce3dfc56f3cc7fa0397dc80bcbaa502f24ff66120' }, member, c2);
  assert.equal(v.title, 'Join an account group'); assert.equal(v.proofKind, 2);
  assert.throws(() => buildDigestView({ kind: 'group-link', preimage: pre, digest: 'aa'.repeat(32) }, member, c2), (e) => e.code === 4300);
  assert.throws(() => buildDigestView({ kind: 'nope', digest: 'aa'.repeat(32) }, member, c2), (e) => e.code === 4300);
  const blind = buildDigestView({ kind: 'nope', digest: 'aa'.repeat(32) }, member, { ...c2, blindDigest: true });
  assert.equal(blind.blind, true);
  const zbc = normalizeAccount(SENDER);
  const fv = buildDigestView({ kind: 'fee-vote-reveal', preimage: { recentBlockHash: '11'.repeat(32), height: 1000, feeVote: 3 }, digest: '11'.repeat(32) + 'e803000003000000' + '00000000' }, zbc, c2);
  assert.equal(fv.scheme, 'raw'); assert.equal(fv.rows[0].value.text, '0×');
  assert.throws(() => buildDigestView({ kind: 'fee-vote-reveal', preimage: { recentBlockHash: '11'.repeat(32), height: 1000, feeVote: 3 }, digest: '00'.repeat(44) }, member, c2), (e) => e.code === 4406);
});

test('message signing refuses disguised transactions and digests', () => {
  const acc = normalizeAccount(SENDER);
  const v = buildMessageView({ message: 'log in to shop #42' }, acc, ctx);
  assert.equal(v.message, 'log in to shop #42'); assert.equal(v.digest.length, 64);
  assert.throws(() => buildMessageView({ message: 'aa'.repeat(32) }, acc, ctx), (e) => e.code === 4300);
  assert.throws(() => buildMessageView({ message: plain.expected.unsigned_bytes, encoding: 'hex' }, acc, ctx), (e) => e.code === 4300);
  assert.ok(isDisguisedTransaction(hexToBytes(plain.expected.unsigned_bytes)));
  assert.ok(!isDisguisedTransaction(utf8('hello')));
});
