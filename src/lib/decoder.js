// Transaction decoder: envelope (spec §3.1) and every body in §6. Consumes exactly all bytes.
import { Reader, DecodeError, bytesToHex, fromUtf8, readU32le } from './bytes.js';
import { readTyped, display, ACCOUNT_TYPES } from './address.js';

export const ZBE1 = [0x5a, 0x42, 0x45, 0x31];

function account(r, what) {
  const a = readTyped(r.b, r.o);
  r.o += a.length;
  return { type: a.type, payload: a.payload, typed: a.typed, hex: bytesToHex(a.typed), display: display(a.typed) };
}

/** Decode the unsigned envelope. opts.inner: true when decoding a multisig inner (version 1, no survival). */
export function decodeTransaction(bytes, opts = {}) {
  if (!(bytes instanceof Uint8Array)) throw new DecodeError('bytes expected');
  const r = new Reader(bytes);
  const type = r.u32('type');
  const version = r.u8('version');
  if (version !== 1 && version !== 2) throw new DecodeError(`unsupported envelope version ${version}`);
  const timestamp = r.u64('timestamp');
  const sender = account(r, 'sender');
  if (sender.type === 2) throw new DecodeError('sender cannot be empty');
  const recipientAcc = account(r, 'recipient');
  const recipient = recipientAcc.type === 2 ? null : recipientAcc;
  const fee = r.u64('fee');
  const survival = version >= 2 ? r.u64('survival') : null;
  const body = r.lp4('body');
  // escrow: a typed account; Empty (type 2) means none
  const approver = account(r, 'escrow approver');
  let escrow = null;
  if (approver.type !== 2) {
    const commission = r.u64('commission');
    const timeout = r.u64('timeout');
    const instruction = r.str4('instruction');
    const multiParty = r.u8('multi_party');
    if (multiParty !== 0 && multiParty !== 1) throw new DecodeError('bad multi_party flag');
    let cosig = null, requestId = null;
    if (multiParty === 1) { cosig = r.lp4('co-signature'); requestId = r.i64('escrow request id'); }
    escrow = { approver, commission, timeout, instruction, multiParty: multiParty === 1, cosig, requestId };
  }
  const message = r.lp4('message');
  r.finish('envelope');
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

const hex32 = (r, what) => bytesToHex(r.bytes(32, what));

function typedList8(r, what) { const n = r.u8(what + ' count'); const out = []; for (let i = 0; i < n; i++) out.push(account(r, what)); return out; }

function optional(r, fn) { return r.done ? undefined : fn(); }

// Each decoder receives a Reader over the body and the envelope; it returns the fields object.
export const BODY = {
  0: (r) => ({}),
  1: (r) => ({ amount: r.u64('amount') }),
  6: (r) => { const f = { amount: r.u64('amount'), completeMinutes: r.u64('complete_minutes') }; f.tokenId = r.done ? 0n : r.u64('token_id'); f.feeInToken = r.done ? false : r.u8('fee_in_token') === 1; return f; },
  262: (r) => ({ txId: r.i64('tx_id') }),
  15: (r) => { const f = { fireHeight: r.u64('fire_height'), amount: r.u64('amount') }; f.eventId = r.done ? '' : r.str4('event_id'); return f; },
  16: (r) => ({ triggerId: r.i64('trigger_id') }),
  29: (r) => ({ tokenId: r.u64('token_id'), perTranche: r.u64('per_tranche'), intervalS: r.u64('interval_s'), fires: r.u32('fires'), cliffS: r.u64('cliff_s'), fundingMode: r.u8('funding_mode'), cancelPolicy: r.u8('cancel_policy'), endTime: r.u64('end_time'), reserved: r.u8('reserved') }),
  30: (r) => ({ scheduleId: r.i64('schedule_id') }),
  31: (r) => ({ scheduleId: r.i64('schedule_id'), newRecipient: account(r, 'new recipient') }),
  10: (r) => { const f = { decimals: r.u8('decimals'), flags: r.u8('flags'), supply: r.u64('supply'), backing: r.u64('backing'), symbol: r.str2('symbol'), name: r.str2('name') }; f.survival = r.done ? null : r.u64('survival'); return f; },
  11: (r) => { const f = { tokenId: r.u64('token_id'), amount: r.u64('amount') }; f.feeInToken = r.done ? false : r.u8('fee_in_token') === 1; f.survival = r.done ? null : r.u64('survival'); return f; },
  12: (r) => { const f = { tokenId: r.u64('token_id'), amount: r.u64('amount') }; if (!r.done) r.u8('reserved'); f.survival = r.done ? null : r.u64('survival'); return f; },
  13: (r) => { const f = { tokenId: r.u64('token_id'), amount: r.u64('amount') }; if (!r.done) r.u8('reserved'); f.survival = r.done ? null : r.u64('survival'); return f; },
  14: (r) => { const f = { tokenId: r.u64('token_id') }; f.amount = r.done ? 0n : r.u64('amount'); return f; },
  18: (r) => { const f = { giveToken: r.u64('give_token'), giveAmount: r.u64('give_amount'), wantToken: r.u64('want_token'), wantAmount: r.u64('want_amount'), expiry: r.u64('expiry') }; f.counterparty = r.done ? null : account(r, 'counterparty'); return f; },
  19: (r) => ({ offerId: r.i64('offer_id') }),
  20: (r) => ({ offerId: r.i64('offer_id') }),
  21: (r) => ({ baseToken: r.u64('base_token'), quoteToken: r.u64('quote_token'), deposit: r.u64('deposit') }),
  22: (r) => ({ marketId: r.i64('market_id'), side: r.u8('side'), price: r.i64('price'), amount: r.u64('amount'), flags: r.u8('flags'), expiry: r.u64('expiry') }),
  23: (r) => ({ orderId: r.i64('order_id') }),
  3: (r) => { const f = { property: r.str4('property'), value: r.str4('value') }; if (!r.done) { f.setter = account(r, 'setter'); f.about = account(r, 'recipient'); } return f; },
  259: (r) => BODY[3](r),
  8: (r) => ({ path: r.str4('path'), content: r.lp4('content') }),
  264: (r) => BODY[8](r),
  520: (r) => ({ path: r.str4('path') }),
  9: (r) => ({ amount: r.u64('amount') }),
  40: (r) => { const f = { fileRoot: hex32(r, 'file_root'), totalSize: r.u64('total_size'), pieceSize: r.u32('piece_size'), deposit: r.u64('deposit') }; const n = r.u32('piece count'); f.pieces = []; for (let i = 0; i < n; i++) f.pieces.push(hex32(r, 'piece id')); return f; },
  296: (r) => ({ fileRoot: hex32(r, 'file_root'), amount: r.u64('amount') }),
  52: (r) => { const f = { targetTxId: r.i64('target_tx_id'), amount: r.u64('amount') }; if (!r.done) { f.targetHeight = r.u32('target_height'); f.targetBytes = r.u64('target_bytes'); } return f; },
  309: (r) => ({ targetId: r.i64('target_id') }),
  53: (r) => ({ targetTxId: r.i64('target_tx_id') }),
  42: (r) => ({ objectId: hex32(r, 'object_id'), newOwner: account(r, 'new owner') }),
  43: (r) => ({ objectId: hex32(r, 'object_id'), mode: r.u8('mode'), add: typedList8(r, 'add'), remove: typedList8(r, 'remove') }),
  44: (r) => ({ objectId: hex32(r, 'object_id') }),
  45: (r) => ({ objectId: hex32(r, 'object_id') }),
  4: (r) => ({ decision: r.u32('decision'), escrowTxHash: hex32(r, 'escrow tx hash') }),
  260: (r) => ({ payer: account(r, 'payer'), amount: r.u64('amount'), approver: account(r, 'approver'), commission: r.u64('commission'), timeout: r.u64('timeout'), instruction: r.str4('instruction'), expiry: r.u64('expiry') }),
  516: (r) => { const f = { id: r.i64('id'), reason: r.str2('reason') }; f.isEscrow = r.done ? false : r.u8('target flag') === 1; return f; },
  5: decodeMultisig,
  55: (r) => groupBody(r, (f) => { f.validUntil = r.u32('valid_until'); f.seq = r.u32('seq'); f.proof = decodeProof(r); }),
  56: (r) => groupBody(r, () => {}),
  57: (r) => groupBody(r, (f) => { f.flags = r.u8('flags'); f.limit = r.u64('limit'); f.periodBlocks = r.u32('period_blocks'); }),
  58: (r) => BODY[55](r),
  2: (r) => ({ nodePub: hex32(r, 'node key'), owner: account(r, 'owner'), locked: r.u64('locked'), poown: decodePoown(r) }),
  258: (r) => ({ nodePub: hex32(r, 'node key'), locked: r.u64('locked'), poown: decodePoown(r) }),
  514: (r) => ({ nodePub: hex32(r, 'node key') }),
  770: (r) => ({ nodePub: hex32(r, 'node key'), poown: decodePoown(r) }),
  36: (r) => ({ gatewayKey: hex32(r, 'gateway key'), domain: r.str4('domain'), url: r.str4('url') }),
  38: (r) => ({ gatewayKey: hex32(r, 'gateway key') }),
  46: (r) => ({ nodePub: hex32(r, 'node key'), domain: r.str4('domain'), url: r.str4('url') }),
  47: (r) => ({ nodePub: hex32(r, 'node key') }),
  48: (r) => ({ relayKey: hex32(r, 'relay key'), gatewayKey: hex32(r, 'gateway key'), domain: r.str4('domain'), url: r.str4('url') }),
  49: (r) => ({ relayKey: hex32(r, 'relay key') }),
  7: (r) => ({ voteHash: hex32(r, 'vote hash') }),
  263: (r) => { const info = r.bytes(44, 'FeeVoteInfo'); const sig = r.lp4('voter signature'); if (sig.length !== 64) throw new DecodeError('voter signature must be 64 bytes'); return { info: bytesToHex(info), blockHash: bytesToHex(info.slice(0, 32)), height: readU32le(info, 32), feeVote: new Reader(info, 36).i64(), voterSig: bytesToHex(sig) }; },
  51: (r) => ({ parameter: r.str4('parameter'), value: r.u64('value') }),
  50: (r) => ({ mask: r.u16('mask') }),
  54: (r) => { const n = r.u8('count'); const out = []; for (let i = 0; i < n; i++) { const len = r.u8('addr len'); const start = r.o; const a = account(r, 'split recipient'); if (r.o - start !== len) throw new DecodeError('split address length mismatch'); out.push({ account: a, shareBp: r.u16('share') }); } return { recipients: out }; },
  24: (r) => { const f = { gameType: r.u8('game_type'), stakeToken: r.u64('stake_token'), stake: r.u64('stake'), seats: r.u8('seats'), params: bytesToHex(r.lp2('params')) }; f.opponent = null; f.channel = null; if (r.remaining >= 36) f.opponent = account(r, 'opponent'); if (!r.done) f.channel = r.u8('channel'); return f; },
  25: (r) => ({ gameId: r.i64('game_id') }),
  26: (r) => ({ gameId: r.i64('game_id'), move: bytesToHex(r.lp2('move')) }),
  27: (r) => ({ gameId: r.i64('game_id') }),
  28: (r) => ({ gameId: r.i64('game_id') }),
  17: (r) => ({ eventId: r.str4('event_id'), value: r.str4('value') }),
};

function groupBody(r, rest) {
  const v = r.u8('version'); if (v !== 1) throw new DecodeError('unexpected group body version');
  const len = r.u8('member len'); const start = r.o;
  const f = { member: account(r, 'member') };
  if (r.o - start !== len) throw new DecodeError('member length mismatch');
  rest(f);
  return f;
}

function decodeProof(r) {
  const kind = r.u8('proof kind');
  if (kind === 0 || kind === 2) { const sig = r.lp2('proof signature'); return { kind, sig: bytesToHex(sig) }; }
  if (kind === 1) {
    const min = r.u32('min'); const nonce = r.i64('nonce'); const n = r.u8('n'); const parts = [];
    for (let i = 0; i < n; i++) { const len = r.u8('len'); const start = r.o; const a = account(r, 'participant'); if (r.o - start !== len) throw new DecodeError('participant length mismatch'); parts.push({ account: a, sig: bytesToHex(r.lp2('sig')) }); }
    return { kind, min, nonce, participants: parts };
  }
  throw new DecodeError('unknown proof kind ' + kind);
}

function decodePoown(r) {
  const b = r.bytes(136, 'proof of ownership');
  const owner = readTyped(b, 0);
  return { owner: { type: owner.type, hex: bytesToHex(owner.typed), display: display(owner.typed) }, blockHash: bytesToHex(b.slice(36, 68)), height: readU32le(b, 68), sig: bytesToHex(b.slice(72)) };
}

function decodeMultisig(r, tx) {
  const f = { info: null, inner: null, innerBytes: null, sigs: null };
  const infoPresent = r.u32('info_present');
  if (infoPresent !== 0 && infoPresent !== 1) throw new DecodeError('bad info_present');
  if (infoPresent) {
    const min = r.u32('min'); const nonce = r.u64('nonce'); const n = r.u32('n'); const participants = [];
    for (let i = 0; i < n; i++) participants.push(account(r, 'participant'));
    f.info = { min, nonce, participants };
  }
  const inner = r.lp4('inner');
  if (inner.length) { f.innerBytes = inner; f.inner = decodeTransaction(inner, { inner: true }); }
  const sigPresent = r.u32('sig_present');
  if (sigPresent !== 0 && sigPresent !== 1) throw new DecodeError('bad sig_present');
  if (sigPresent) {
    const hash = hex32(r, 'inner hash'); const count = r.u32('count'); const list = [];
    for (let i = 0; i < count; i++) { const signer = account(r, 'signer'); const sig = r.lp4('signature'); list.push({ signer, sig: bytesToHex(sig) }); }
    f.sigs = { hash, list };
  }
  return f;
}

/** Field tree for the "raw bytes" disclosure. */
export function fieldTree(tx) {
  const rows = [
    ['type', tx.type], ['version', tx.version], ['timestamp', tx.timestamp.toString()],
    ['sender', tx.sender.hex], ['recipient', tx.recipient ? tx.recipient.hex : '02000000 (empty)'], ['fee', tx.fee.toString()],
  ];
  if (tx.survival !== null) rows.push(['survival', tx.survival.toString()]);
  rows.push(['body', bytesToHex(tx.body)]);
  if (tx.escrow) rows.push(['escrow', JSON.stringify(plain(tx.escrow))]);
  rows.push(['message', bytesToHex(tx.message)]);
  rows.push(['fields', JSON.stringify(plain(tx.fields), null, 1)]);
  return rows;
}
export function plain(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return bytesToHex(v);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { if (k === 'typed' || k === 'payload' || k === 'unsigned' || k === 'innerBytes' || k === 'body' || k === 'message') continue; o[k] = plain(v[k]); } return o; }
  return v;
}
export const typeName = (t) => ACCOUNT_TYPES[t] ? ACCOUNT_TYPES[t].name : `type ${t}`;
