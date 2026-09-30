// Chain-bound digests, hashes, ids, consent digests and the submit payload (spec §3.4, §3.5, §4, §5).
import { sha3_256 } from '@noble/hashes/sha3';
import { concat, utf8, u32le, u64le, u8, u16le, readI64le, bytesToHex, hexToBytes } from './bytes.js';

export const DEFAULT_TAG = 'ZBC-TX';
export const ATOMIC = 100000000n;

export function txDigest(unsigned, genesis, tag = DEFAULT_TAG) {
  if (!genesis || genesis.length !== 32) throw new Error('genesis hash must be 32 bytes');
  return sha3_256(concat(utf8(tag), genesis, unsigned));
}
/** Legacy signing version 1: bare SHA3 of the unsigned bytes. */
export function txDigestV1(unsigned) { return sha3_256(unsigned); }
export function txHash(unsigned, signature) { return sha3_256(concat(unsigned, signature)); }
export function txIdFromHash(hash) { return readI64le(hash, 0); }
export function ztx(hash) { return 'ZTX_' + bytesToHex(hash).toUpperCase(); }

/** Plain message digest (wallet scheme, spec §4.4). */
export function messageDigest(message, genesis) { return sha3_256(concat(utf8('ZBC-MSG'), genesis, u32le(message.length), message)); }
/** zbc-cli ZBC-MSG-v1 (no genesis). */
export function messageDigestV1(message) { return sha3_256(concat(utf8('ZBC-MSG'), message)); }

/** Group consent digest (§5.1). kind: 'group-link' | 'group-control'. */
export function groupConsentDigest(kind, { controller, member, validUntil, seq, genesis }) {
  const tag = kind === 'group-link' ? 'ZBC-GROUP-LINK' : kind === 'group-control' ? 'ZBC-GROUP-CONTROL' : null;
  if (!tag) throw new Error('unknown consent kind');
  return sha3_256(concat(utf8(tag), genesis, u8(controller.length), controller, u8(member.length), member, u32le(validUntil), u32le(seq)));
}

/** Consent proof wrappers (§4.3): kind 0 raw, kind 2 ETH personal_sign. */
export function consentProof(kind, sig) { return concat(u8(kind), u16le(sig.length), sig); }

export function relayPermitMessage({ from, to, exp }) { return utf8(`ZBC-RELAY-PERMIT-v1|${from}|${to}|${exp}`); }

/** FeeVoteInfo = recent_block_hash 32 ‖ height u32 ‖ fee_vote i64 (44 bytes). */
export function feeVoteInfo({ recentBlockHash, height, feeVote }) {
  const h = typeof recentBlockHash === 'string' ? hexToBytes(recentBlockHash) : recentBlockHash;
  if (h.length !== 32) throw new Error('recentBlockHash must be 32 bytes');
  return concat(h, u32le(height), u64le(BigInt(feeVote)));
}

/** Genesis short form for the UI: first 16 hex upper-cased + … */
export function genesisShort(genesisHex) { return (genesisHex || '').toUpperCase().slice(0, 16) + '…'; }

/**
 * Submit payload (§3.5) from a decoded transaction. Returns a JSON string: int64 ids are
 * substituted as bare numbers so values above 2^53 survive.
 */
export function buildPayload(tx, signatureHex) {
  const senderHex = tx.sender.type === 0 ? bytesToHex(tx.sender.payload) : bytesToHex(tx.sender.typed);
  const recipientHex = !tx.recipient ? '' : tx.recipient.type === 0 ? bytesToHex(tx.recipient.payload) : bytesToHex(tx.recipient.typed);
  const obj = {
    version: tx.version,
    ...(tx.version >= 2 ? { survival: (tx.survival ?? 0n).toString() } : {}),
    timestamp: Number(tx.timestamp),
    sender_account_address: senderHex,
    recipient_account_address: recipientHex,
    transaction_type: tx.type,
    fee: '__FEE__',
    transaction_body_bytes: bytesToHex(tx.body),
    signature: signatureHex,
  };
  if (tx.message && tx.message.length) { obj.message_hex = bytesToHex(tx.message); obj.message_encrypted = !!tx.encrypted; }
  if (tx.escrow) {
    obj.escrow = {
      approver_address: bytesToHex(tx.escrow.approver.typed),
      commission: '__COMMISSION__',
      timeout: '__TIMEOUT__',
      instruction: tx.escrow.instruction,
    };
    if (tx.escrow.multiParty) {
      obj.escrow.multi_party = true;
      obj.escrow.escrow_request_id = '__REQID__';
      obj.escrow.co_signer_signature = bytesToHex(tx.escrow.cosig);
    }
  }
  let json = JSON.stringify(obj);
  json = json.replace('"__FEE__"', tx.fee.toString());
  if (tx.escrow) {
    json = json.replace('"__COMMISSION__"', tx.escrow.commission.toString()).replace('"__TIMEOUT__"', tx.escrow.timeout.toString());
    if (tx.escrow.multiParty) json = json.replace('"__REQID__"', tx.escrow.requestId.toString());
  }
  return json;
}
