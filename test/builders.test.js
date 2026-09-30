import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTx, buildEnvelope, bodies, multisigAddressTyped } from '../src/lib/builders.js';
import { decodeTransaction } from '../src/lib/decoder.js';
import * as decoder from '../src/lib/decoder.js';
import { describe } from '../src/lib/describe.js';
import { bytesToHex, hexToBytes, DecodeError } from '../src/lib/bytes.js';

const A = 'ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX';
const B = 'ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I';
const ETH = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const H = '11'.repeat(32);
const env = { sender: A, recipient: B, timestamp: 1700000000, fee: 2550000n, survival: 0n };
const ctx = { decoder, now: 1700000000, origin: 'test', tokens: { '7': { id: '7', symbol: 'GOLD', name: 'Gold', decimals: 2 } } };

const cases = [
  [0, {}, { message: 'hello' }, 'Send a message (no coins)'],
  [1, { amount: 2500000000n }, {}, 'Send 25 ZBC'],
  [1, { amount: 12000000000n }, { escrow: { approver: B, commission: 120000000n, timeout: 1700100000, instruction: 'Release when delivered', multiParty: true, requestId: -5n } }, 'Send 120 ZBC in escrow'],
  [1, { amount: 1n }, { recipient: ETH }, 'Send 0.00000001 ZBC'],
  [6, { amount: 500000000000n, minutes: 43200 }, {}, 'Stream 5 000 ZBC over 30 days'],
  [6, { amount: 1000n, minutes: 60, tokenId: 7, feeInToken: true }, {}, 'Stream 10 GOLD over 1 h'],
  [262, { txId: -123n }, { recipient: null }, 'Stop a liquid payment'],
  [15, { fireHeight: 812440, amount: 100000000n, eventId: 'match-1' }, {}, 'Lock 1 ZBC until block 812 440'],
  [16, { triggerId: 77n }, { recipient: null }, 'Cancel a trigger'],
  [29, { perTranche: 100000000n, intervalS: 86400, fires: 3, cancelPolicy: 1 }, {}, 'Schedule 3 payments of 1 ZBC'],
  [30, { scheduleId: 11n }, { recipient: null }, 'Cancel a scheduled payment'],
  [31, { scheduleId: 11n, newRecipient: B }, { recipient: null }, 'Redirect scheduled payments to a new address'],
  [10, { decimals: 2, flags: 3, supply: 10000000n, backing: 100000000n, symbol: 'GOLD', name: 'Gold token', survival: 5n }, { recipient: null }, 'Create token GOLD'],
  [11, { tokenId: 7, amount: 12345n, feeInToken: true, survival: 1n }, {}, 'Send 123.45 GOLD'],
  [12, { tokenId: 7, amount: 100n }, { recipient: null }, 'Mint 1 GOLD'],
  [13, { tokenId: 7, amount: 100n, survival: 0n }, { recipient: null }, 'Burn 1 GOLD'],
  [14, { tokenId: 7, amount: 300000000n }, { recipient: null }, 'Pay 3 ZBC to keep GOLD alive'],
  [18, { giveAmount: 100000000n, wantToken: 7, wantAmount: 500n, counterparty: B }, { recipient: null }, 'Offer 1 ZBC for 5 GOLD'],
  [19, { offerId: 42n }, { recipient: null }, 'Accept offer #42'],
  [20, { offerId: 42n }, { recipient: null }, 'Cancel your offer #42'],
  [21, { baseToken: 7, deposit: 100000000n }, { recipient: null }, 'Open market GOLD/ZBC'],
  [22, { marketId: 3n, side: 1, price: 150000000n, amount: 1000n }, { recipient: null }, 'Sell 0.00001 base at 1.5 quote'],
  [23, { orderId: 9n }, { recipient: null }, 'Cancel order #9'],
  [3, { property: 'poe:doc', value: '{"a":1}', setter: A, about: B }, {}, 'Anchor a document (notary)'],
  [259, { property: 'role', value: 'tester' }, {}, 'Remove data "role"'],
  [8, { path: '/docs/x.txt', content: 'hi' }, { recipient: null }, 'Create file /docs/x.txt'],
  [264, { path: '/docs/x.txt', content: new Uint8Array([0, 1]) }, { recipient: null }, 'Replace file /docs/x.txt'],
  [520, { path: '/docs/x.txt' }, { recipient: null }, 'Delete file /docs/x.txt'],
  [9, { amount: 100000000n }, { recipient: null }, 'Prepay 1 ZBC of storage'],
  [40, { fileRoot: H, totalSize: 4096, pieceSize: 2048, deposit: 1000000n, pieces: [H, H] }, { recipient: null }, 'Store a 4.0 KB file'],
  [296, { fileRoot: H, amount: 1000000n }, { recipient: null }, 'Add 0.01 ZBC to a stored file'],
  [52, { targetTxId: -1n, amount: 10000000n, targetHeight: 100, targetBytes: 500n }, { recipient: null }, 'Keep a record on chain — add 0.1 ZBC'],
  [309, { targetId: -1n }, { recipient: null }, 'Close a record\'s paid life'],
  [42, { objectId: H, newOwner: B }, { recipient: null }, 'Transfer a data object'],
  [43, { objectId: H, mode: 1, add: [B], remove: [ETH] }, { recipient: null }, 'Change who may write to a data object'],
  [44, { objectId: H }, { recipient: null }, 'Accept a data object'],
  [45, { objectId: H }, { recipient: null }, 'Delete a data object'],
  [4, { decision: 1, escrowTxHash: H }, { recipient: null }, 'Reject escrow'],
  [260, { payer: B, amount: 250000000n, approver: A, commission: 1000n, timeout: 1800000000, instruction: 'pay on delivery' }, {}, null],
  [516, { id: 5n, reason: 'no', isEscrow: true }, {}, 'Refuse an escrow'],
  [55, { member: ETH, validUntil: 1000, seq: 0, proofKind: 2, sig: 'ab'.repeat(65) }, { recipient: null }, null],
  [56, { member: A }, { recipient: null }, 'Leave the account group'],
  [57, { member: ETH, flags: 1, limit: 0n }, { recipient: null }, null],
  [58, { member: ETH, validUntil: 1000, seq: 1, proofKind: 0, sig: 'ab'.repeat(64) }, { recipient: null }, null],
  [2, { nodePub: H, owner: A, locked: 100000000000n, poown: '00'.repeat(136) }, { recipient: null }, null],
  [258, { nodePub: H, locked: 200000000000n, poown: '00'.repeat(136) }, { recipient: null }, 'Update node stake to 2 000 ZBC'],
  [514, { nodePub: H }, { recipient: null }, 'Remove node registration'],
  [770, { nodePub: H, poown: '00'.repeat(136) }, { recipient: null }, 'Claim node ownership'],
  [36, { gatewayKey: H, domain: 'gw.example.org', url: 'https://gw.example.org' }, { recipient: null }, 'Register gateway gw.example.org'],
  [38, { gatewayKey: H }, { recipient: null }, 'Unregister gateway'],
  [46, { nodePub: H, domain: 'a.example.org', url: 'https://a.example.org' }, { recipient: null }, 'Register archival a.example.org'],
  [47, { nodePub: H }, { recipient: null }, 'Unregister archival node'],
  [48, { relayKey: H, gatewayKey: H, domain: 'r.example.org', url: 'https://r.example.org' }, { recipient: null }, 'Register relay r.example.org'],
  [49, { relayKey: H }, { recipient: null }, 'Unregister relay'],
  [7, { voteHash: H }, { recipient: null }, 'Commit a fee vote'],
  [51, { parameter: 'min_fee', value: 2500000n }, { recipient: null }, 'Vote min_fee = 2500000'],
  [50, { mask: 0b101 }, { recipient: null }, 'Change what this account transacts with'],
  [54, { recipients: [{ account: B, shareBp: 2500 }, { account: ETH, shareBp: 500 }] }, { recipient: null }, 'Forward incoming money: 2 recipients'],
  [54, { recipients: [] }, { recipient: null }, 'Clear your split policy'],
  [24, { gameType: 2, stake: 100000000n, opponent: B, channel: 1 }, { recipient: null }, 'Start a chess game — stake 1 ZBC'],
  [25, { gameId: 5n }, { recipient: null }, 'Join game #5'],
  [26, { gameId: 5n, move: '04' }, { recipient: null }, 'Play a move in game #5'],
  [27, { gameId: 5n }, { recipient: null }, 'Resign game #5'],
  [28, { gameId: 5n }, { recipient: null }, 'Claim a timeout win in game #5'],
  [17, { eventId: 'e', value: 'v' }, { recipient: null }, 'Event attested (oracle/bridge)'],
  [999, { raw: '010203' }, { recipient: null }, 'Unknown transaction type 999'],
];

test('every built type decodes back, consumes all bytes, and truncation fails', () => {
  for (const [type, params, extra, title] of cases) {
    const u = buildTx(type, params, { ...env, ...extra });
    const tx = decodeTransaction(u);
    assert.equal(tx.type, type);
    assert.equal(tx.version, 2);
    const d = describe(tx, ctx);
    if (title) assert.equal(d.title, title, `type ${type}`);
    assert.ok(d.title, `type ${type} title`);
    assert.throws(() => decodeTransaction(u.slice(0, -1)), DecodeError, `type ${type} truncated`);
    assert.throws(() => decodeTransaction(new Uint8Array([...u, 0])), DecodeError, `type ${type} trailing`);
  }
});

test('multisig create / propose / cosign shapes', () => {
  const info = { min: 2, nonce: 0n, participants: [A, B, ETH] };
  const ms = multisigAddressTyped(2, 0n, [A, B, ETH]);
  const create = decodeTransaction(buildTx(5, { info }, { ...env, recipient: null }));
  const dc = describe(create, ctx);
  assert.equal(dc.title, 'Create a multisig account'); assert.equal(dc.extras.multisigHex, bytesToHex(ms));
  const inner = buildEnvelope({ type: 1, version: 1, sender: ms, recipient: B, fee: 10000000n, body: bodies[1]({ amount: 150000000000n }), message: 'Q4 design retainer', timestamp: 1700000000 });
  const propose = decodeTransaction(buildTx(5, { info, inner }, { ...env, recipient: null }));
  const dp = describe(propose, ctx);
  assert.equal(dp.title, 'Propose a multisig transaction'); assert.equal(dp.nested.title, 'Send 1 500 ZBC'); assert.equal(dp.canSign, true);
  const badInner = buildEnvelope({ type: 1, version: 1, sender: A, recipient: B, fee: 1n, body: bodies[1]({ amount: 1n }), timestamp: 1700000000 });
  assert.equal(describe(decodeTransaction(buildTx(5, { info, inner: badInner }, { ...env, recipient: null })), ctx).canSign, false);
});

test('escrow multi-party round trip and payload id above 2^53', () => {
  const u = buildTx(1, { amount: 1n }, { ...env, escrow: { approver: B, commission: 1n, timeout: 1, instruction: 'x', multiParty: true, requestId: 9007199254740993n } });
  const tx = decodeTransaction(u);
  assert.equal(tx.escrow.requestId, 9007199254740993n);
});
