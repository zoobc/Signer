// Request validation and view models for every prompting method (spec §2, §5, §7.4). No chrome.* here.
import { hexToBytes, bytesToHex, utf8, fromUtf8, isHex, DecodeError } from './bytes.js';
import { parseAddress, parseTypedHex, multisigAddress, typed, display, ACCOUNT_TYPES, formatOfType } from './address.js';
import * as decoder from './decoder.js';
import { decodeTransaction, fieldTree } from './decoder.js';
import { describe, describeParticipant, canonicalTypeName } from './describe.js';
import { compareIntent } from './intent.js';
import { groupConsentDigest, feeVoteInfo, relayPermitMessage, txDigest, messageDigest, genesisShort } from './zbc.js';
import { rpcError, ERR } from './errors.js';
import { formatZBC } from './format.js';
import { jsonSafe } from './serialize.js';

/** Normalise request.account (typed hex or display) → { hex, type, display } or throw 4300. */
export function normalizeAccount(input) {
  if (typeof input !== 'string' || !input.trim()) throw rpcError(ERR.BAD_REQUEST, 'account is required');
  const p = parseTypedHex(input.trim()) || parseAddress(input.trim());
  if (!p) throw rpcError(ERR.BAD_REQUEST, 'account is not a recognised address');
  return p;
}

export function parseUnsigned(hex) {
  if (typeof hex !== 'string' || !isHex(hex.replace(/^0x/, '')) || !hex.length) throw rpcError(ERR.BAD_REQUEST, 'unsignedTx must be hex');
  const bytes = hexToBytes(hex);
  try { return decodeTransaction(bytes); }
  catch (e) { throw rpcError(ERR.BAD_REQUEST, 'The transaction bytes do not decode: ' + e.message); }
}

/** Does this message look like a transaction envelope or a bare digest? (§4.4) */
export function isDisguisedTransaction(bytes) {
  if (bytes.length === 32) return true;
  const t = fromUtf8(bytes);
  if (t && /^[0-9a-fA-F]{64}$/.test(t.trim())) return true;
  try { decodeTransaction(bytes); return true; } catch {}
  if (t && /^[0-9a-fA-F]+$/.test(t.trim()) && t.trim().length % 2 === 0) { try { decodeTransaction(hexToBytes(t.trim())); return true; } catch {} }
  return false;
}

export function originFlags(origin) {
  let host = ''; try { host = new URL(origin).hostname; } catch {}
  const insecure = origin.startsWith('http:');
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[');
  const idn = host.includes('xn--');
  return { host, insecure, ip, idn, shown: origin.replace(/^https?:\/\//, '') };
}

/**
 * Build the sign-transaction view. account = normalised requested account; held = vault account or null.
 * ctx: { origin, tokens, labelFor, chain: {genesis, tag, id, node, height, avgBlockSeconds}, context, nodeKey, feeMinimum, now }
 */
export function buildTxView(params, account, ctx) {
  const tx = parseUnsigned(params.unsignedTx);
  const context = (params.context && typeof params.context === 'object') ? params.context : {};
  const ms = context.multisig;
  let described, participantOf = null;
  if (ms && typeof ms === 'object') {
    // inner sent to a participant (§6 type 5, §7.4 exception)
    if (ms.participants && Array.isArray(ms.participants)) {
      const parts = ms.participants.map((p) => normalizeAccount(String(p)));
      if (!parts.some((p) => p.hex === account.hex)) throw rpcError(ERR.BAD_REQUEST, 'The requested account is not a participant of this multisig.');
      const addrHash = multisigAddress(Number(ms.min), BigInt(ms.nonce ?? 0), parts.map((p) => p.typed));
      const addrTyped = typed(0, addrHash);
      if (bytesToHex(addrTyped) !== tx.sender.hex) throw rpcError(ERR.BAD_REQUEST, 'The inner transaction is not from the multisig these participants form.');
      participantOf = { address: display(addrTyped), hex: bytesToHex(addrTyped), min: Number(ms.min), participants: parts.map((p) => p.hex), role: ms.role || 'propose' };
    } else if (ms.address) {
      const a = normalizeAccount(String(ms.address));
      if (a.hex !== tx.sender.hex) throw rpcError(ERR.BAD_REQUEST, 'The inner transaction is not from the multisig the page named.');
      participantOf = { address: a.display, hex: a.hex, min: ms.min ? Number(ms.min) : undefined, participants: undefined, role: ms.role || 'cosign' };
    } else throw rpcError(ERR.BAD_REQUEST, 'context.multisig needs participants or an address.');
    described = describeParticipant(tx, { ...ctx, decoder, context }, participantOf);
  } else {
    if (tx.type !== 5 && tx.sender.hex !== account.hex) throw rpcError(ERR.BAD_REQUEST, 'The transaction is from a different account than requested.');
    if (tx.type === 5 && tx.sender.hex !== account.hex) throw rpcError(ERR.BAD_REQUEST, 'The multisig outer is from a different account than requested.');
    described = describe(tx, { ...ctx, decoder, context });
  }
  if (tx.type === 263 && context.feeVoteInfo && String(context.feeVoteInfo).toLowerCase() !== tx.fields.info) throw rpcError(ERR.BAD_REQUEST, 'The fee vote info in the body differs from context.feeVoteInfo.');
  const intent = normalizeIntent(params.intent);
  const match = compareIntent(described, intent);
  const view = {
    kind: 'tx', typeName: canonicalTypeName(tx.type), type: tx.type, participantOf,
    described: jsonSafe(described), intent, match, unsignedTx: bytesToHex(tx.unsigned),
    raw: { hex: bytesToHex(tx.unsigned), fields: fieldTree(tx).map(([k, v]) => [k, String(v)]) },
    mode: params.mode === 'submit' ? 'submit' : 'sign',
    node: params.node, timestamp: tx.timestamp.toString(), fee: tx.fee.toString(),
    checks: [],
  };
  if (ctx.feeMinimum !== undefined && ctx.feeMinimum !== null && tx.fee < ctx.feeMinimum) view.checks.push({ level: 'amber', text: `Fee is below the network minimum (${formatZBC(ctx.feeMinimum)}); the node will refuse it.` });
  if (ctx.feeCheckFailed) view.checks.push({ level: 'note', text: 'Could not check the fee — verify on the site.' });
  if ([11, 12, 13, 14].includes(tx.type) && ctx.tokenExpired) { view.checks.push({ level: 'red', text: 'This token has expired.' }); view.described.canSign = false; }
  return { view, tx };
}

export function normalizeIntent(intent) {
  const i = intent && typeof intent === 'object' ? intent : {};
  const rows = Array.isArray(i.rows) ? i.rows.filter((r) => Array.isArray(r) && r.length >= 2).map((r) => [String(r[0]).slice(0, 60), String(r[1]).slice(0, 300)]).slice(0, 30) : [];
  return { title: String(i.title || '').slice(0, 120), summary: String(i.summary || '').slice(0, 600), typeName: i.typeName ? String(i.typeName).slice(0, 60) : '', rows };
}

const DIGEST_KINDS = ['group-link', 'group-control', 'escrow-cosign', 'relay-permit', 'multisig-consent', 'fee-vote-reveal'];

/** Build the sign-digest view; recomputes the digest from the preimage (§5). */
export function buildDigestView(params, account, ctx) {
  const kind = params.kind;
  const pre = params.preimage && typeof params.preimage === 'object' ? params.preimage : null;
  const digestHex = typeof params.digest === 'string' ? params.digest.toLowerCase().replace(/^0x/, '') : '';
  if (!DIGEST_KINDS.includes(kind)) {
    if (!pre && ctx.blindDigest && /^[0-9a-f]{64}$/.test(digestHex)) {
      return { kind: 'digest', digestKind: 'blind', title: 'Sign an opaque 32-byte digest', rows: [{ label: 'Digest', value: { kind: 'code', text: digestHex } }], warnings: [{ level: 'red', text: `You are about to sign bytes the signer cannot describe. ${ctx.origin} could make this mean anything, including moving all your funds.` }], notes: [], digest: digestHex, hold: true, blind: true, scheme: 'envelope' };
    }
    throw rpcError(ERR.BAD_REQUEST, pre ? `Unknown digest kind ${kind}` : 'A bare digest with no preimage is refused (enable blind digest signing in Advanced settings to allow it).');
  }
  if (!pre) throw rpcError(ERR.BAD_REQUEST, 'preimage is required');
  const genesis = ctx.chain.genesisBytes;
  const rows = [], warnings = [], notes = [];
  let title = '', computed, scheme = 'envelope', extra = {};
  switch (kind) {
    case 'group-link': case 'group-control': {
      const controller = normalizeAccount(String(pre.controller || ''));
      const member = normalizeAccount(String(pre.member || ''));
      if (member.hex !== account.hex) throw rpcError(ERR.BAD_REQUEST, 'The consent names a different member than the requested account.');
      const validUntil = Number(pre.validUntil), seq = Number(pre.seq || 0);
      if (!Number.isInteger(validUntil) || validUntil < 0) throw rpcError(ERR.BAD_REQUEST, 'validUntil must be a block height');
      if (pre.genesis && String(pre.genesis).toLowerCase() !== ctx.chain.genesis) throw rpcError(ERR.WRONG_CHAIN, 'The consent is for a different network');
      computed = groupConsentDigest(kind, { controller: controller.typed, member: member.typed, validUntil, seq, genesis });
      title = kind === 'group-link' ? 'Join an account group' : 'Become controller of an account group';
      rows.push({ label: 'Group controller', value: { kind: 'address', hex: controller.hex, display: controller.display, label: ctx.labelFor ? ctx.labelFor(controller.hex) : null, text: controller.display } });
      rows.push({ label: 'Valid until', value: { kind: 'block', height: validUntil, text: `block ${validUntil}` + (ctx.chain.height ? ` (≈ ${Math.max(1, Math.round((validUntil - ctx.chain.height) * (ctx.chain.avgBlockSeconds || 60) / 60))} min)` : '') } });
      rows.push({ label: 'Link sequence', value: { kind: 'text', text: String(seq) } });
      notes.push('Everything this address owns moves into the group. It joins able to receive only. Linking is public and permanent history.');
      extra.proofKind = account.type === 4 ? 2 : 0; extra.hold = true;
      break;
    }
    case 'escrow-cosign': {
      const tx = parseUnsigned(String(pre.unsignedTx || ''));
      if (!tx.escrow) throw rpcError(ERR.BAD_REQUEST, 'The payer transaction carries no escrow.');
      if (!tx.escrow.multiParty || (tx.escrow.cosig && tx.escrow.cosig.length)) throw rpcError(ERR.BAD_REQUEST, 'The co-signature field must be present and empty.');
      if (!tx.recipient || tx.recipient.hex !== account.hex) throw rpcError(ERR.BAD_REQUEST, 'You are not the recipient of this escrow.');
      computed = txDigest(tx.unsigned, genesis, ctx.chain.tag);
      const d = describe(tx, { ...ctx, decoder, context: {} });
      title = 'Co-sign an escrow payment to you';
      extra.nested = jsonSafe(d);
      break;
    }
    case 'relay-permit': {
      const from = String(pre.from || '').toLowerCase(), to = String(pre.to || '').toLowerCase(), exp = Number(pre.exp);
      if (account.type !== 0) throw rpcError(ERR.CANNOT_SIGN, 'Relay permits are signed by ZooBC accounts only');
      if (from !== bytesToHex(account.payload)) throw rpcError(ERR.BAD_REQUEST, 'The permit is for a different key than the requested account.');
      if (!/^[0-9a-f]{64}$/.test(to) || !Number.isFinite(exp)) throw rpcError(ERR.BAD_REQUEST, 'bad relay permit preimage');
      const msg = relayPermitMessage({ from, to, exp });
      computed = msg; scheme = 'raw';
      title = 'Allow a contact to leave you messages';
      const contact = display(typed(0, hexToBytes(to)));
      rows.push({ label: 'Contact', value: { kind: 'address', hex: bytesToHex(typed(0, hexToBytes(to))), display: contact, text: contact } });
      rows.push({ label: 'Expires', value: { kind: 'date', unix: exp, text: String(exp) } });
      extra.digestIsMessage = true;
      break;
    }
    case 'multisig-consent': {
      // The participant signs the group digest computed as group-link over the multisig member; the page assembles kind-1 proof.
      const controller = normalizeAccount(String(pre.controller || ''));
      const member = normalizeAccount(String(pre.member || ''));
      const parts = Array.isArray(pre.participants) ? pre.participants.map((p) => normalizeAccount(String(p))) : null;
      if (!parts || !parts.some((p) => p.hex === account.hex)) throw rpcError(ERR.BAD_REQUEST, 'The requested account is not a participant.');
      const addrHash = multisigAddress(Number(pre.min), BigInt(pre.nonce ?? 0), parts.map((p) => p.typed));
      if (bytesToHex(typed(0, addrHash)) !== member.hex) throw rpcError(ERR.BAD_REQUEST, 'The participants do not form the multisig member named.');
      const validUntil = Number(pre.validUntil), seq = Number(pre.seq || 0);
      computed = groupConsentDigest(pre.control ? 'group-control' : 'group-link', { controller: controller.typed, member: member.typed, validUntil, seq, genesis });
      title = 'Consent for a multisig account to join a group';
      rows.push({ label: 'Multisig', value: { kind: 'address', hex: member.hex, display: member.display, text: member.display } });
      rows.push({ label: 'Group controller', value: { kind: 'address', hex: controller.hex, display: controller.display, text: controller.display } });
      rows.push({ label: 'Valid until', value: { kind: 'block', height: validUntil, text: `block ${validUntil}` } });
      notes.push('Everything the multisig owns moves into the group. Linking is public and permanent history.');
      extra.hold = true;
      break;
    }
    case 'fee-vote-reveal': {
      if (account.type !== 0) throw rpcError(ERR.CANNOT_SIGN, 'Fee vote reveals are signed by ZooBC accounts only');
      let info; try { info = feeVoteInfo({ recentBlockHash: String(pre.recentBlockHash), height: Number(pre.height), feeVote: BigInt(pre.feeVote) }); } catch (e) { throw rpcError(ERR.BAD_REQUEST, 'bad fee vote preimage: ' + e.message); }
      computed = info; scheme = 'raw';
      const scale = (Number(pre.feeVote) / 10000).toFixed(2).replace(/\.?0+$/, '') + '×';
      title = 'Reveal your fee vote';
      rows.push({ label: 'Proposed fee scale', value: { kind: 'text', text: scale } });
      rows.push({ label: 'Committed at', value: { kind: 'block', height: Number(pre.height), text: `block ${pre.height}` } });
      notes.push('This proves the vote you committed earlier. Nothing leaves the account except the network fee of the reveal transaction that follows.');
      break;
    }
  }
  const computedHex = bytesToHex(computed);
  if (digestHex !== computedHex) throw rpcError(ERR.BAD_REQUEST, 'The digest the page sent does not match the recomputed one.');
  return { kind: 'digest', digestKind: kind, title, rows, warnings, notes, digest: computedHex, scheme, hold: !!extra.hold, proofKind: extra.proofKind, nested: extra.nested || null, network: genesisShort(ctx.chain.genesis) };
}

export function buildMessageView(params, account, ctx) {
  let bytes, shown, encoding = params.encoding === 'hex' ? 'hex' : 'utf8';
  const m = params.message;
  if (typeof m !== 'string') throw rpcError(ERR.BAD_REQUEST, 'message must be a string');
  if (encoding === 'hex') { if (!isHex(m.replace(/^0x/, ''))) throw rpcError(ERR.BAD_REQUEST, 'message is not hex'); bytes = hexToBytes(m); }
  else bytes = utf8(m);
  if (!bytes.length) throw rpcError(ERR.BAD_REQUEST, 'message is empty');
  if (bytes.length > 4096) throw rpcError(ERR.BAD_REQUEST, 'message too long');
  if (isDisguisedTransaction(bytes)) throw rpcError(ERR.BAD_REQUEST, 'Refused: the message looks like a transaction or a digest.');
  const text = fromUtf8(bytes);
  shown = text !== null ? text : bytesToHex(bytes);
  const digest = messageDigest(bytes, ctx.chain.genesisBytes);
  return { kind: 'message', title: 'Sign a message', message: shown, isHexShown: text === null, digest: bytesToHex(digest), rows: [], notes: ['Signing a message proves you control this address. It cannot move funds.'], warnings: [] };
}

/** zbc_signMultisig view (§5.7). setup = held multisig from the vault; heldAccounts = [{hex,label,format,btc,address}]. */
export function buildMultisigView(params, setup, heldAccounts, ctx) {
  const inner = parseUnsigned(String(params.inner || ''));
  const parts = setup.participants.map((h) => parseTypedHex(h));
  const addrHash = multisigAddress(setup.min, BigInt(setup.nonce), parts.map((p) => p.typed));
  const hex = bytesToHex(typed(0, addrHash));
  if (hex !== setup.typed) throw rpcError(ERR.INTERNAL, 'stored multisig setup is inconsistent');
  if (inner.sender.hex !== hex) throw rpcError(ERR.BAD_REQUEST, 'The inner transaction is not from this multisig.');
  const described = describe(inner, { ...ctx, decoder, context: (params.context && params.context.inner) || {} });
  const held = parts.map((p) => { const h = heldAccounts.find((a) => a.hex === p.hex); return { hex: p.hex, display: p.display, format: formatOfType(p.type) || ACCOUNT_TYPES[p.type].name, held: !!h, label: h ? h.label : null, btc: h ? h.btc : undefined }; });
  const heldCount = held.filter((h) => h.held).length;
  const signWith = Math.min(heldCount, setup.min);
  const intent = normalizeIntent(params.intent);
  const match = compareIntent(described, intent);
  return {
    kind: 'multisig', title: 'Propose a multisig transaction', setup: { label: setup.label, address: setup.address, hex: setup.typed, min: setup.min, n: parts.length, nonce: String(setup.nonce) },
    nested: jsonSafe(described), participants: held, heldCount, signWith, need: setup.min, remaining: Math.max(0, setup.min - signWith),
    firstHeld: held.find((h) => h.held), innerHex: bytesToHex(inner.unsigned), intent, match, canSign: described.canSign && heldCount > 0,
    raw: { hex: bytesToHex(inner.unsigned), fields: fieldTree(inner).map(([k, v]) => [k, String(v)]) },
  };
}
