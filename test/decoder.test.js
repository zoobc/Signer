import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as decoder from '../src/lib/decoder.js';
import { decodeTransaction } from '../src/lib/decoder.js';
import { describe, describeParticipant } from '../src/lib/describe.js';
import { compareIntent } from '../src/lib/intent.js';
import { buildPayload } from '../src/lib/zbc.js';
import { hexToBytes, bytesToHex, DecodeError } from '../src/lib/bytes.js';

const all = JSON.parse(readFileSync(new URL('./fixtures/transactions-all.json', import.meta.url))).vectors;
const core = JSON.parse(readFileSync(new URL('./fixtures/transactions.json', import.meta.url))).vectors;
const ctx = { now: 1700000000, decoder, origin: 'test' };

test('every reference vector decodes, consumes all bytes and describes', () => {
  const titles = {};
  for (const v of [...core, ...all]) {
    let tx; try { tx = decodeTransaction(hexToBytes(v.expected.unsigned_bytes)); } catch (e) { throw new Error(v.name + ': ' + e.message); }
    assert.equal(tx.type, v.type, v.name);
    assert.equal(bytesToHex(tx.body), v.expected.body, v.name);
    assert.equal(Number(tx.timestamp), v.timestamp);
    if (Number.isSafeInteger(v.fee)) assert.equal(tx.fee, BigInt(v.fee));
    const d = describe(tx, ctx);
    assert.ok(d.title && d.title.length > 3, `${v.name}: title`);
    assert.ok(typeof d.total === 'bigint');
    titles[v.name] = d.title;
    if (v.message) assert.equal(tx.messageText, v.message);
    if (v.escrow) { assert.ok(tx.escrow); assert.equal(tx.escrow.instruction, v.escrow.instruction); assert.equal(tx.escrow.commission, BigInt(v.escrow.commission)); }
  }
  assert.equal(titles['send-zbc/plain'], 'Send 1 ZBC');
  assert.equal(titles['send-zbc/escrow'], 'Send 1 ZBC in escrow');
  assert.equal(titles['approve-escrow/approve'], 'Approve escrow');
  assert.equal(titles['approve-escrow/reject'], 'Reject escrow');
  assert.equal(titles['multisig/example'], 'Propose a multisig transaction');
  assert.equal(titles['issue-token/example'], 'Create token GOLD');
  assert.equal(titles['liquid-payment/example'], 'Stream 5 ZBC over 1 h');
  assert.equal(titles['scheduled-transfer/example'], 'Schedule 3 payments of 1 ZBC');
  assert.equal(titles['app-create/example'], 'Start a tic-tac-toe game — stake 1 ZBC');
  assert.equal(titles['fee-vote-reveal/example'], 'Reveal your fee vote: 0×  fee scale'.replace('  ', ' '));
  assert.equal(titles['register-node/example'].startsWith('Register node ZNK_'), true);
  assert.equal(titles['setup-dataset/example'], 'Save data on-chain');
});

test('truncating any vector by one byte is a decode error (4300)', () => {
  for (const v of [...core, ...all]) {
    const b = hexToBytes(v.expected.unsigned_bytes).slice(0, -1);
    assert.throws(() => decodeTransaction(b), (e) => e instanceof DecodeError && e.code === 4300, v.name);
    const extra = new Uint8Array(hexToBytes(v.expected.unsigned_bytes).length + 1); extra.set(hexToBytes(v.expected.unsigned_bytes));
    assert.throws(() => decodeTransaction(extra), DecodeError, v.name + ' trailing');
  }
});

test('multisig vector: inner decoded, address recomputed, hash checked', () => {
  const v = all.find((x) => x.name === 'multisig/example');
  const tx = decodeTransaction(hexToBytes(v.expected.unsigned_bytes));
  const d = describe(tx, ctx);
  assert.ok(d.nested); assert.equal(d.nested.title, 'Send 0.00001 ZBC');
  assert.equal(d.canSign, true);
  assert.equal(d.extras.multisigHex, tx.fields.inner.sender.hex);
  assert.equal(d.rows.find((r) => r.label === 'Signatures so far').value.text, '1 of 1 · yours makes 2');
  // cosign shape: no info, no inner, sigs only → needs context.multisigInner
  const innerHex = bytesToHex(tx.fields.innerBytes);
  const cosignBody = hexToBytes('00000000' + '00000000' + '01000000' + tx.fields.sigs.hash + '00000000');
  const outer = buildEnvelope(5, tx.sender.typed, cosignBody);
  const cosign = decodeTransaction(outer);
  const d1 = describe(cosign, ctx);
  assert.equal(d1.title, 'Add your signature to a multisig transaction'); assert.equal(d1.canSign, false);
  const d2 = describe(cosign, { ...ctx, context: { multisigInner: innerHex } });
  assert.equal(d2.canSign, true); assert.ok(d2.nested); assert.equal(d2.nested.title, 'Send 0.00001 ZBC');
  const d3 = describe(cosign, { ...ctx, context: { multisigInner: innerHex.slice(0, -2) + 'ff' } });
  assert.equal(d3.canSign, false);
  // participant signature over the inner (context.multisig)
  const p = describeParticipant(tx.fields.inner, ctx, { role: 'propose', min: 1, participants: ['a', 'b'] });
  assert.equal(p.title, 'Sign as a participant of a multisig account'); assert.equal(p.nested.title, 'Send 0.00001 ZBC');
});

function buildEnvelope(type, senderTyped, body) {
  const ts = new Uint8Array(8); ts[0] = 0x00; ts[1] = 0xf1; ts[2] = 0x53; ts[3] = 0x65;
  const parts = [new Uint8Array([type & 255, type >> 8, 0, 0]), new Uint8Array([2]), ts, senderTyped, new Uint8Array([2, 0, 0, 0]), hexToBytes('404b4c0000000000'), new Uint8Array(8), new Uint8Array([body.length, 0, 0, 0]), body, new Uint8Array([2, 0, 0, 0]), new Uint8Array(4)];
  let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

test('version 2 envelope with survival and multi-party escrow decodes and builds the payload', () => {
  const sender = hexToBytes('000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152');
  const body = hexToBytes('00e1f50500000000');
  const escrow = [sender, hexToBytes('e803000000000000'), hexToBytes('d002000000000000'), hexToBytes('0300000061626300'.slice(0, 14)), new Uint8Array([1]), new Uint8Array([2, 0, 0, 0]), new Uint8Array([0xaa, 0xbb]), hexToBytes('ffffffffffffff7f')];
  const parts = [new Uint8Array([1, 0, 0, 0]), new Uint8Array([2]), hexToBytes('00f1536500000000'), sender, sender, hexToBytes('404b4c0000000000'), hexToBytes('0100000000000000'), new Uint8Array([8, 0, 0, 0]), body, ...escrow, new Uint8Array([2, 0, 0, 0]), hexToBytes('6869')];
  let n = 0; for (const p of parts) n += p.length; const u = new Uint8Array(n); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; }
  const tx = decodeTransaction(u);
  assert.equal(tx.version, 2); assert.equal(tx.survival, 1n); assert.equal(tx.escrow.multiParty, true); assert.equal(tx.escrow.requestId, 9223372036854775807n); assert.equal(tx.escrow.instruction, 'abc'); assert.equal(tx.messageText, 'hi');
  const d = describe(tx, ctx);
  assert.equal(d.total, 100000000n + 5000000n + 1n + 1000n);
  const payload = buildPayload(tx, 'ab');
  assert.ok(payload.includes('"escrow_request_id":9223372036854775807'));
  assert.ok(payload.includes('"survival":"1"'));
  assert.ok(payload.includes('"fee":5000000'));
  assert.ok(payload.includes('"multi_party":true'));
  assert.ok(payload.includes('"message_hex":"6869"'));
  assert.equal(JSON.parse(payload).transaction_type, 1);
});

test('intent comparison flags amount and recipient mismatches', () => {
  const v = core.find((x) => x.name === 'send-zbc/plain');
  const tx = decodeTransaction(hexToBytes(v.expected.unsigned_bytes));
  const d = describe(tx, ctx);
  assert.ok(compareIntent(d, { title: 'Pay', typeName: 'Transfer', rows: [['Amount', '1 ZBC'], ['To', tx.recipient.display]] }).ok);
  assert.ok(compareIntent(d, { typeName: 'SendZBC', rows: [['Amount', '1.00000000 ZBC']] }).ok);
  const r = compareIntent(d, { typeName: 'EscrowApproval', rows: [['Amount', '100 ZBC'], ['To', 'ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I']] });
  assert.equal(r.ok, false); assert.equal(r.diffs.length, 3);
  assert.equal(r.diffs.find((x) => x.label === 'To').severity, 'red');
});

test('unknown type and retired type', () => {
  const sender = hexToBytes('000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152');
  const unknown = decodeTransaction(buildEnvelope(999, sender, new Uint8Array([1, 2, 3])));
  const d = describe(unknown, ctx);
  assert.equal(d.unknown, true); assert.equal(d.hold, true); assert.ok(d.title.includes('999'));
  const retired = decodeTransaction(buildEnvelope(53, sender, new Uint8Array(8)));
  assert.equal(describe(retired, ctx).canSign, false);
});
