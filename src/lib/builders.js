// Unsigned transaction builders for every §6 type (used by the test dapp and the round-trip tests).
import { concat, u8, u16le, u32le, u64le, lp4, lp2, utf8, hexToBytes } from './bytes.js';
import { parseAddress, parseTypedHex, EMPTY_TYPED } from './address.js';
import { compareBytes as cmp } from './bytes.js';
import { sha3_256 } from '@noble/hashes/sha3';

export function typedOf(a) { if (a instanceof Uint8Array) return a; if (!a) return EMPTY_TYPED; const p = parseTypedHex(a) || parseAddress(a); if (!p) throw new Error('bad address ' + a); return p.typed; }
const str4 = (s) => lp4(utf8(s || ''));
const str2 = (s) => lp2(utf8(s || ''));
const hex = (h, n) => { const b = hexToBytes(h); if (n !== undefined && b.length !== n) throw new Error(`expected ${n} bytes`); return b; };
const big = (v) => u64le(BigInt(v));

/** Build the unsigned envelope (§3.1). escrow: { approver, commission, timeout, instruction, multiParty?, cosig?, requestId? } */
export function buildEnvelope({ type, version = 2, timestamp = Math.floor(Date.now() / 1000), sender, recipient, fee = 5000000n, survival = 0n, body = new Uint8Array(0), escrow = null, message = null }) {
  const parts = [u32le(type), u8(version), big(timestamp), typedOf(sender), typedOf(recipient), big(fee)];
  if (version >= 2) parts.push(big(survival));
  parts.push(lp4(body));
  if (escrow) {
    parts.push(typedOf(escrow.approver), big(escrow.commission || 0), big(escrow.timeout || 0), str4(escrow.instruction || ''), u8(escrow.multiParty ? 1 : 0));
    if (escrow.multiParty) parts.push(lp4(escrow.cosig ? hexToBytes(escrow.cosig) : new Uint8Array(0)), big(escrow.requestId || 0));
  } else parts.push(EMPTY_TYPED);
  const msg = message == null ? new Uint8Array(0) : typeof message === 'string' ? utf8(message) : message;
  parts.push(lp4(msg));
  return concat(...parts);
}

export function multisigAddressTyped(min, nonce, participants) {
  const sorted = participants.map(typedOf).sort(cmp);
  return concat(u32le(0), sha3_256(concat(u32le(min), big(nonce), u32le(sorted.length), ...sorted)));
}

/** Body builders keyed by type. Each takes a plain object and returns bytes. */
export const bodies = {
  0: () => new Uint8Array(0),
  1: ({ amount }) => big(amount),
  6: ({ amount, minutes, tokenId = 0, feeInToken }) => concat(big(amount), big(minutes), ...(BigInt(tokenId) ? [big(tokenId)] : []), ...(feeInToken ? [u8(1)] : [])),
  262: ({ txId }) => big(txId),
  15: ({ fireHeight, amount, eventId }) => concat(big(fireHeight), big(amount), ...(eventId ? [str4(eventId)] : [])),
  16: ({ triggerId }) => big(triggerId),
  29: ({ tokenId = 0, perTranche, intervalS, fires, cliffS = 0, fundingMode = 0, cancelPolicy = 0, endTime = 0 }) => concat(big(tokenId), big(perTranche), big(intervalS), u32le(fires), big(cliffS), u8(fundingMode), u8(cancelPolicy), big(endTime), u8(0)),
  30: ({ scheduleId }) => big(scheduleId),
  31: ({ scheduleId, newRecipient }) => concat(big(scheduleId), typedOf(newRecipient)),
  10: ({ decimals, flags, supply, backing, symbol, name, survival }) => concat(u8(decimals), u8(flags), big(supply), big(backing), str2(symbol), str2(name), ...(survival !== undefined ? [big(survival)] : [])),
  11: ({ tokenId, amount, feeInToken = false, survival }) => concat(big(tokenId), big(amount), u8(feeInToken ? 1 : 0), ...(survival !== undefined ? [big(survival)] : [])),
  12: ({ tokenId, amount, survival }) => concat(big(tokenId), big(amount), u8(0), ...(survival !== undefined ? [big(survival)] : [])),
  13: ({ tokenId, amount, survival }) => concat(big(tokenId), big(amount), ...(survival !== undefined ? [u8(0), big(survival)] : [])),
  14: ({ tokenId, amount }) => concat(big(tokenId), big(amount)),
  18: ({ giveToken = 0, giveAmount, wantToken = 0, wantAmount, expiry = 0, counterparty }) => concat(big(giveToken), big(giveAmount), big(wantToken), big(wantAmount), big(expiry), ...(counterparty ? [typedOf(counterparty)] : [])),
  19: ({ offerId }) => big(offerId), 20: ({ offerId }) => big(offerId),
  21: ({ baseToken, quoteToken = 0, deposit }) => concat(big(baseToken), big(quoteToken), big(deposit)),
  22: ({ marketId, side, price, amount, flags = 0, expiry = 0 }) => concat(big(marketId), u8(side), big(price), big(amount), u8(flags), big(expiry)),
  23: ({ orderId }) => big(orderId),
  3: ({ property, value, setter, about }) => concat(str4(property), str4(value), ...(setter ? [typedOf(setter), typedOf(about)] : [])),
  259: (p) => bodies[3](p),
  8: ({ path, content }) => concat(str4(path), lp4(typeof content === 'string' ? utf8(content) : content)),
  264: (p) => bodies[8](p),
  520: ({ path }) => str4(path),
  9: ({ amount }) => big(amount),
  40: ({ fileRoot, totalSize, pieceSize, deposit, pieces }) => concat(hex(fileRoot, 32), big(totalSize), u32le(pieceSize), big(deposit), u32le(pieces.length), ...pieces.map((p) => hex(p, 32))),
  296: ({ fileRoot, amount }) => concat(hex(fileRoot, 32), big(amount)),
  52: ({ targetTxId, amount, targetHeight, targetBytes }) => concat(big(targetTxId), big(amount), ...(targetHeight !== undefined ? [u32le(targetHeight), big(targetBytes)] : [])),
  309: ({ targetId }) => big(targetId),
  53: ({ targetTxId }) => big(targetTxId),
  42: ({ objectId, newOwner }) => concat(hex(objectId, 32), typedOf(newOwner)),
  43: ({ objectId, mode, add = [], remove = [] }) => concat(hex(objectId, 32), u8(mode), u8(add.length), ...add.map(typedOf), u8(remove.length), ...remove.map(typedOf)),
  44: ({ objectId }) => hex(objectId, 32), 45: ({ objectId }) => hex(objectId, 32),
  4: ({ decision, escrowTxHash }) => concat(u32le(decision), hex(escrowTxHash, 32)),
  260: ({ payer, amount, approver, commission = 0, timeout, instruction = '', expiry = 0 }) => concat(typedOf(payer), big(amount), typedOf(approver), big(commission), big(timeout), str4(instruction), big(expiry)),
  516: ({ id, reason = '', isEscrow = false }) => concat(big(id), str2(reason), ...(isEscrow ? [u8(1)] : [])),
  5: ({ info, inner, sigs }) => concat(
    info ? concat(u32le(1), u32le(info.min), big(info.nonce), u32le(info.participants.length), ...info.participants.map(typedOf)) : u32le(0),
    lp4(inner || new Uint8Array(0)),
    sigs ? concat(u32le(1), hex(sigs.hash, 32), u32le(sigs.list.length), ...sigs.list.map((s) => concat(typedOf(s.signer), lp4(hexToBytes(s.sig))))) : u32le(0)),
  55: ({ member, validUntil, seq = 0, proofKind = 0, sig }) => concat(u8(1), lenTyped(member), u32le(validUntil), u32le(seq), u8(proofKind), lp2(hexToBytes(sig || ''))),
  56: ({ member }) => concat(u8(1), lenTyped(member)),
  57: ({ member, flags, limit = 0, periodBlocks = 0 }) => concat(u8(1), lenTyped(member), u8(flags), big(limit), u32le(periodBlocks)),
  58: (p) => bodies[55](p),
  2: ({ nodePub, owner, locked, poown }) => concat(hex(nodePub, 32), typedOf(owner), big(locked), hex(poown, 136)),
  258: ({ nodePub, locked, poown }) => concat(hex(nodePub, 32), big(locked), hex(poown, 136)),
  514: ({ nodePub }) => hex(nodePub, 32),
  770: ({ nodePub, poown }) => concat(hex(nodePub, 32), hex(poown, 136)),
  36: ({ gatewayKey, domain, url }) => concat(hex(gatewayKey, 32), str4(domain), str4(url)),
  38: ({ gatewayKey }) => hex(gatewayKey, 32),
  46: ({ nodePub, domain, url }) => concat(hex(nodePub, 32), str4(domain), str4(url)),
  47: ({ nodePub }) => hex(nodePub, 32),
  48: ({ relayKey, gatewayKey, domain, url }) => concat(hex(relayKey, 32), hex(gatewayKey, 32), str4(domain), str4(url)),
  49: ({ relayKey }) => hex(relayKey, 32),
  7: ({ voteHash }) => hex(voteHash, 32),
  263: ({ blockHash, height, feeVote, voterSig }) => concat(hex(blockHash, 32), u32le(height), big(feeVote), lp4(hex(voterSig, 64))),
  51: ({ parameter, value }) => concat(str4(parameter), big(value)),
  50: ({ mask }) => u16le(mask),
  54: ({ recipients = [] }) => concat(u8(recipients.length), ...recipients.map((r) => concat(lenTyped(r.account), u16le(r.shareBp)))),
  24: ({ gameType, stakeToken = 0, stake, seats = 2, params = '', opponent, channel }) => concat(u8(gameType), big(stakeToken), big(stake), u8(seats), lp2(hexToBytes(params)), ...(opponent ? [typedOf(opponent)] : []), ...(channel !== undefined ? [u8(channel)] : [])),
  25: ({ gameId }) => big(gameId), 26: ({ gameId, move }) => concat(big(gameId), lp2(hexToBytes(move))), 27: ({ gameId }) => big(gameId), 28: ({ gameId }) => big(gameId),
  17: ({ eventId, value }) => concat(str4(eventId), str4(value)),
};
function lenTyped(a) { const t = typedOf(a); return concat(u8(t.length), t); }

export function buildTx(type, params, env) { return buildEnvelope({ ...env, type, body: bodies[type] ? bodies[type](params) : (params.raw ? hexToBytes(params.raw) : new Uint8Array(0)) }); }
