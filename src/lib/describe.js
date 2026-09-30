// What to show for each transaction type (spec §6, §7.2): title, rows, warnings, total.
import { formatZBC, formatUnits, formatToken, formatDuration, formatBytes, percentOfBp, blockDate, ATOMIC } from './format.js';
import { bytesToHex, hexToBytes, fromUtf8 } from './bytes.js';
import { multisigAddress, zbcEncode, typed, display, ACCOUNT_TYPES } from './address.js';
import { sha3_256 } from '@noble/hashes/sha3';
import { verifyRawEd25519 } from './sign.js';

export const CATEGORIES = ['Payments', 'Apps & games', 'Tokens', 'Exchange', 'Data & storage', 'Escrow & multisig', 'Node & infrastructure', 'Bridge', 'Governance'];

/** Canonical type names and accepted aliases (case-insensitive, spaces/underscores ignored). */
export const TYPE_NAMES = {
  0: ['Message', 'MessageOnly', 'SendMessage'],
  1: ['SendZBC', 'Transfer', 'Send ZBC', 'Send', 'SendFunds', 'Send funds', 'Payment'],
  2: ['NodeRegistration', 'RegisterNode'], 258: ['NodeRegistrationUpdate', 'UpdateNode'], 514: ['RemoveNodeRegistration', 'RemoveNode'], 770: ['ClaimNodeRegistration', 'ClaimNode'],
  3: ['SetupAccountDataset', 'SaveDataset', 'SetupDataset', 'Dataset'], 259: ['RemoveAccountDataset', 'RemoveDataset'],
  4: ['ApprovalEscrow', 'EscrowApproval', 'Escrow decision', 'ApproveEscrow'],
  5: ['MultiSignature', 'Multisig', 'MultiSig'],
  6: ['LiquidPayment', 'Stream', 'LiquidPay'], 262: ['LiquidPaymentStop', 'StopLiquidPayment', 'StopStream'],
  7: ['FeeVoteCommitment', 'FeeVoteCommit'], 263: ['FeeVoteReveal'],
  8: ['DFSCreateFile', 'CreateFile'], 264: ['DFSUpdateFile', 'UpdateFile'], 520: ['DFSDeleteFile', 'DeleteFile'],
  9: ['AddPrepaidStorage', 'PrepaidStorage'],
  10: ['IssueToken', 'CreateToken'], 11: ['TransferToken', 'SendToken'], 12: ['MintToken'], 13: ['BurnToken'], 14: ['FinanceToken', 'ExtendTokenLife'],
  15: ['CreateTrigger'], 16: ['CancelTrigger'], 17: ['AttestEvent', 'EventAttested'],
  18: ['CreateSwapOffer', 'SwapCreate'], 19: ['AcceptSwapOffer', 'SwapAccept'], 20: ['CancelSwapOffer', 'SwapCancel'],
  21: ['CreateMarket', 'MarketCreate'], 22: ['PlaceOrder', 'OrderPlace'], 23: ['CancelOrder', 'OrderCancel'],
  24: ['CreateApp', 'CreateGame', 'AppCreate'], 25: ['JoinApp', 'JoinGame'], 26: ['AppMove', 'GameMove', 'Move'], 27: ['ResignApp', 'Resign'], 28: ['ClaimAppTimeout', 'ClaimTimeout'],
  29: ['ScheduledTransfer', 'SchedulePayment', 'Vesting'], 30: ['CancelSchedule'], 31: ['ReassignSchedule', 'RedirectSchedule'],
  40: ['StoreFile'], 296: ['FundStoredFile', 'AddToStoredFile'], 42: ['TransferDataset'], 43: ['SetDatasetPolicy'], 44: ['AcceptDataset'], 45: ['DeleteDataset'],
  50: ['TransactPolicy'], 51: ['SetConsensusParam', 'GovernanceVote', 'EconomicsVote'], 52: ['FundLongevity', 'KeepOnChain'], 53: ['CancelLongevity'], 309: ['CloseLongevity', 'ClosePaidLife'], 54: ['SplitPolicy'],
  55: ['GroupLink', 'LinkToGroup'], 56: ['GroupRemove', 'RemoveFromGroup'], 57: ['GroupPermissions', 'SetMemberPermissions'], 58: ['GroupHandover', 'HandOverControl'],
  36: ['RegisterGateway'], 38: ['UnregisterGateway'], 46: ['RegisterArchival'], 47: ['UnregisterArchival'], 48: ['RegisterRelay'], 49: ['UnregisterRelay'],
  260: ['EscrowRequest', 'RequestEscrow'], 516: ['DeclineRequest', 'DeclineEscrow'],
};
export const TYPE_CATEGORY = {
  0: 0, 1: 0, 6: 0, 262: 0, 15: 0, 16: 0, 29: 0, 30: 0, 31: 0,
  24: 1, 25: 1, 26: 1, 27: 1, 28: 1,
  10: 2, 11: 2, 12: 2, 13: 2, 14: 2,
  18: 3, 19: 3, 20: 3, 21: 3, 22: 3, 23: 3,
  3: 4, 259: 4, 8: 4, 264: 4, 520: 4, 9: 4, 40: 4, 296: 4, 52: 4, 309: 4, 53: 4, 42: 4, 43: 4, 44: 4, 45: 4,
  4: 5, 260: 5, 516: 5, 5: 5, 55: 5, 56: 5, 57: 5, 58: 5,
  2: 6, 258: 6, 514: 6, 770: 6, 36: 6, 38: 6, 46: 6, 47: 6, 48: 6, 49: 6,
  17: 7,
  7: 8, 263: 8, 51: 8,
};
export const GAME_TYPES = { 1: 'tic-tac-toe', 2: 'chess', 3: 'connect four', 4: 'checkers', 5: 'reversi', 6: 'gomoku', 7: 'battleship', 8: 'dots and boxes', 16: 'dice', 17: 'coin flip', 18: 'roulette', 19: 'slots', 20: 'lottery', 21: 'crash', 32: 'ludo', 33: 'pig', 34: 'race', 35: 'monopoly' };

export function canonicalTypeName(type) { return (TYPE_NAMES[type] || [`Type${type}`])[0]; }
export function normName(s) { return String(s || '').toLowerCase().replace(/[\s_\-]/g, ''); }
export function typeNameMatches(type, name) { const n = normName(name); if (!n) return true; return (TYPE_NAMES[type] || []).some((a) => normName(a) === n) || n === `type${type}` || n === String(type); }

const zbc = (atomic) => ({ kind: 'amount', atomic: BigInt(atomic), decimals: 8, unit: 'ZBC', text: formatZBC(atomic) });
const signedId = (u) => BigInt.asIntN(64, BigInt(u));
const idText = (u) => signedId(u).toString();

function tokenOf(ctx, tokenId) {
  const id = idText(tokenId);
  if (BigInt(tokenId) === 0n) return { id: '0', symbol: 'ZBC', name: 'ZooBC', decimals: 8, native: true };
  const t = (ctx.tokens && ctx.tokens[id]) || (ctx.context && ctx.context.token && idText(ctx.context.token.id ?? ctx.context.token.token_id ?? '0') === id ? ctx.context.token : null);
  if (t) return { id, symbol: t.symbol, name: t.name, decimals: Number(t.decimals ?? 0), redeemable: t.redeemable, mintable: t.mintable, supply: t.supply, backing: t.backing, persistHeight: t.persist_height ?? t.persistHeight };
  return { id, symbol: `#${id}`, name: null, decimals: undefined, unknown: true };
}
const tok = (atomic, token) => ({ kind: 'amount', atomic: BigInt(atomic), decimals: token.decimals, unit: token.symbol, text: token.native ? formatZBC(atomic) : formatToken(atomic, token), unknownDecimals: token.decimals === undefined });
const amountText = (atomic, token) => tok(atomic, token).text;

function addr(ctx, a) {
  if (!a) return { kind: 'text', text: '—' };
  const label = ctx.labelFor ? ctx.labelFor(a.hex) : null;
  return { kind: 'address', hex: a.hex, display: a.display, label, text: label ? `${label} · ${a.display}` : a.display };
}
const text = (t) => ({ kind: 'text', text: String(t) });
const date = (unix) => ({ kind: 'date', unix: Number(unix), text: String(unix) });
const dur = (seconds) => ({ kind: 'text', text: formatDuration(seconds) });
const quote = (t) => ({ kind: 'quote', text: String(t) });
const code = (t) => ({ kind: 'code', text: String(t) });
const blockRow = (ctx, height) => { const d = blockDate(height, ctx.chain); return { kind: 'block', height: Number(height), approxUnix: d, text: `block ${formatUnits(height, 0)}` + (d ? ` (≈ ${new Date(d * 1000).toLocaleString()})` : '') }; };
const yesno = (b) => text(b ? 'Yes' : 'No');
const znk = (hex) => code(zbcEncode(hexToBytes(hex), 'ZNK'));

/**
 * Describe a decoded transaction.
 * ctx: { context?, tokens?, labelFor?, chain?, origin?, nodeAccount?, now? }
 */
export function describe(tx, ctx = {}) {
  const f = tx.fields || {};
  const out = {
    type: tx.type, typeName: canonicalTypeName(tx.type), category: TYPE_CATEGORY[tx.type], kicker: '',
    title: '', rows: [], warnings: [], notes: [], total: null, canSign: true, hold: false, nested: null,
    canonical: { amounts: {}, recipients: [], ids: {} }, unknown: !tx.known, retired: false, extras: {},
  };
  const warn = (level, t) => out.warnings.push({ level, text: t });
  const row = (label, value) => out.rows.push({ label, value });
  const rec = tx.recipient;
  const recip = () => { if (rec) out.canonical.recipients.push(rec.hex); return addr(ctx, rec); };
  const amt = (label, value) => { out.canonical.amounts[label.toLowerCase()] = value; };
  const c = ctx.context || {};
  let total = tx.fee + (tx.survival || 0n);
  if (tx.escrow) total += tx.escrow.commission;
  out.kicker = CATEGORIES[out.category] ? CATEGORIES[out.category].toUpperCase() : 'TRANSACTION';

  switch (tx.type) {
    case 0: {
      out.kicker = 'MESSAGE'; out.title = 'Send a message (no coins)';
      row('To', recip());
      if (tx.encrypted) row('Message', text('Encrypted note (only the recipient can read it)')); else row('Message', quote(tx.messageText ?? bytesToHex(tx.message)));
      out.notes.push('Only the message is stored on-chain. No ZBC moves.');
      break;
    }
    case 1: {
      out.kicker = 'TRANSFER';
      const a = f.amount; amt('amount', a);
      out.title = tx.escrow ? `Send ${formatZBC(a)} in escrow` : `Send ${formatZBC(a)}`;
      row('To', recip()); row('Amount', zbc(a));
      total += a;
      if (rec && [2, 3, 6, 8].includes(rec.type)) warn('red', 'ZBC cannot be sent to this kind of address — the node rejects it.');
      if (rec && rec.type === 10) out.notes.push('Funds a dataset\'s storage balance.');
      break;
    }
    case 6: {
      const token = tokenOf(ctx, f.tokenId); const minutes = f.completeMinutes; const seconds = minutes * 60n;
      amt('amount', f.amount);
      out.kicker = 'STREAM'; out.title = `Stream ${amountText(f.amount, token)} over ${formatDuration(seconds)}`;
      row('To', recip()); row('Amount', tok(f.amount, token)); row('Duration', dur(seconds));
      if (minutes > 0n) { const perHour = (f.amount * 60n) / minutes; row('Rate per hour', { ...tok(perHour, token), text: '≈ ' + amountText(perHour, token) + ' / hour' }); }
      row('Ends', { kind: 'date', unix: Number(tx.timestamp + seconds), approx: true, text: '≈' });
      row('Fee paid in token', yesno(f.feeInToken));
      if (token.native) total += f.amount;
      out.notes.push('The recipient receives it gradually. You can stop it; the unstreamed part returns to you.');
      break;
    }
    case 262: {
      out.title = 'Stop a liquid payment'; row('Stream id', code(f.txId.toString())); out.canonical.ids.stream = f.txId.toString();
      if (c.stream) { if (c.stream.recipient) row('Recipient', text(c.stream.recipient)); if (c.stream.remaining !== undefined) row('Remaining', zbc(c.stream.remaining)); }
      out.notes.push('Nothing more flows after the block this is included in.');
      break;
    }
    case 15: {
      amt('amount', f.amount); out.title = `Lock ${formatZBC(f.amount)} until block ${formatUnits(f.fireHeight, 0)}`;
      row('Beneficiary', recip()); row('Amount', zbc(f.amount)); row('Fires at', blockRow(ctx, f.fireHeight)); if (f.eventId) row('Event id', text(f.eventId));
      total += f.amount; out.notes.push('Locked until the trigger fires.');
      break;
    }
    case 16: out.title = 'Cancel a trigger'; row('Trigger id', code(f.triggerId.toString())); out.notes.push('The locked amount returns to you.'); break;
    case 29: {
      const token = tokenOf(ctx, f.tokenId);
      amt('per payment', f.perTranche);
      out.kicker = 'SCHEDULE'; out.title = `Schedule ${f.fires} payment${f.fires === 1 ? '' : 's'} of ${amountText(f.perTranche, token)}`;
      row('To', recip()); row('Per payment', tok(f.perTranche, token)); row('Every', dur(f.intervalS));
      row('First after', f.cliffS > 0n ? dur(f.cliffS) : text('No cliff'));
      row('Ends', f.endTime > 0n ? date(f.endTime) : text('After the last payment'));
      const lockedAll = f.perTranche * BigInt(f.fires);
      row('Funding', text(f.fundingMode === 0 ? `Locked now: ${amountText(lockedAll, token)}` : 'Paid from your balance each time'));
      row('Revocable', yesno(f.cancelPolicy === 1));
      if (f.fundingMode === 0 && token.native) total += lockedAll;
      if (f.cancelPolicy === 0) warn('amber', 'You cannot cancel this later.');
      if (f.fires < 1 || f.fires > 520) warn('red', 'The number of payments must be 1–520; the node will refuse this.');
      break;
    }
    case 30: out.title = 'Cancel a scheduled payment'; row('Schedule id', code(f.scheduleId.toString())); out.notes.push('Sender revoke or recipient decline.'); break;
    case 31: out.title = 'Redirect scheduled payments to a new address'; row('Schedule', code(f.scheduleId.toString())); row('New recipient', addr(ctx, f.newRecipient)); out.canonical.recipients.push(f.newRecipient.hex); break;
    case 10: {
      out.kicker = 'TOKEN'; out.title = `Create token ${f.symbol}`;
      const redeemable = !!(f.flags & 1), mintable = !!(f.flags & 2);
      row('Name', text(f.name)); row('Symbol', text(f.symbol)); row('Supply', text(formatUnits(f.supply, f.decimals) + ' ' + f.symbol)); row('Decimals', text(f.decimals));
      row('Backing locked', zbc(f.backing)); row('Redeemable', yesno(redeemable)); row('Mintable', yesno(mintable));
      if (f.survival !== null) row('Token life paid', zbc(f.survival));
      if (tx.messageText) { try { const meta = JSON.parse(tx.messageText); if (meta && meta.d) row('Description', quote(meta.d)); } catch {} }
      total += f.backing + (f.survival || 0n); amt('backing', f.backing);
      break;
    }
    case 11: {
      const token = tokenOf(ctx, f.tokenId); amt('amount', f.amount);
      out.kicker = 'TOKEN'; out.title = `Send ${amountText(f.amount, token)}`;
      row('To', recip()); row('Token', text(token.name ? `${token.name} (#${token.id})` : `#${token.id}`)); row('Amount', tok(f.amount, token)); row('Fee paid in token', yesno(f.feeInToken));
      if (f.survival !== null && f.survival > 0n) { row('Kept on chain', zbc(f.survival)); total += f.survival; }
      if (token.unknown) out.notes.push('Token details could not be loaded; the amount is shown in raw units.');
      break;
    }
    case 12: {
      const token = tokenOf(ctx, f.tokenId); amt('amount', f.amount);
      out.kicker = 'TOKEN'; out.title = `Mint ${amountText(f.amount, token)}`;
      row('Token', text(token.name ? `${token.name} (#${token.id})` : `#${token.id}`)); row('Amount', tok(f.amount, token));
      let backing = c.backingAdded !== undefined ? BigInt(c.backingAdded) : null;
      if (backing === null && token.supply && token.backing) { const s = BigInt(token.supply), b = BigInt(token.backing); if (s > 0n) backing = (f.amount * b + s - 1n) / s; }
      if (backing !== null) { row('Backing added', zbc(backing)); total += backing; } else row('Backing added', text('Estimated at signing time'));
      if (f.survival) { row('Kept on chain', zbc(f.survival)); total += f.survival; }
      out.notes.push('Issuer only. Locks more backing so unit value stays the same.');
      break;
    }
    case 13: {
      const token = tokenOf(ctx, f.tokenId); amt('amount', f.amount);
      out.kicker = 'TOKEN'; out.title = `Burn ${amountText(f.amount, token)}`;
      row('Token', text(token.name ? `${token.name} (#${token.id})` : `#${token.id}`)); row('Amount', tok(f.amount, token));
      if (token.supply && token.backing) { const s = BigInt(token.supply); if (s > 0n) { const back = (f.amount * BigInt(token.backing)) / s; out.notes.push(`Returns your share of the backing: ≈ ${formatZBC(back)}.`); } }
      else out.notes.push('Returns your share of the backing.');
      if (token.redeemable === false) warn('amber', 'This token is not redeemable: burning returns no backing.');
      if (f.survival) { row('Kept on chain', zbc(f.survival)); total += f.survival; }
      break;
    }
    case 14: {
      const token = tokenOf(ctx, f.tokenId); amt('amount', f.amount);
      out.kicker = 'TOKEN'; out.title = `Pay ${formatZBC(f.amount)} to keep ${token.symbol} alive`;
      row('Token', text(token.name ? `${token.name} (#${token.id})` : `#${token.id}`)); row('Amount', zbc(f.amount));
      total += f.amount; out.notes.push('The amount buys blocks; the fee buys none.');
      break;
    }
    case 18: {
      const give = tokenOf(ctx, f.giveToken), want = tokenOf(ctx, f.wantToken);
      out.kicker = 'EXCHANGE'; out.title = `Offer ${amountText(f.giveAmount, give)} for ${amountText(f.wantAmount, want)}`;
      row('You give', tok(f.giveAmount, give)); row('You get', tok(f.wantAmount, want));
      if (f.giveAmount > 0n && give.decimals !== undefined && want.decimals !== undefined) {
        const price = (f.wantAmount * 10n ** BigInt(give.decimals) * 10n ** 8n) / (f.giveAmount * 10n ** BigInt(want.decimals));
        row('Price', text(`${formatUnits(price, 8)} ${want.symbol} per ${give.symbol}`));
      }
      row('Expires', f.expiry > 0n ? date(f.expiry) : text('Never'));
      row('Reserved for', f.counterparty ? addr(ctx, f.counterparty) : text('Anyone'));
      if (give.native) total += f.giveAmount; amt('amount', f.giveAmount);
      out.notes.push('The offered amount is locked until the offer is accepted or cancelled.');
      break;
    }
    case 19: {
      out.kicker = 'EXCHANGE'; out.title = `Accept offer #${f.offerId}`; out.canonical.ids.offer = f.offerId.toString();
      const o = c.offer;
      if (o) {
        const give = tokenOf(ctx, BigInt(o.give_token ?? o.giveToken ?? 0)), want = tokenOf(ctx, BigInt(o.want_token ?? o.wantToken ?? 0));
        row('You pay', tok(BigInt(o.want_amount ?? o.wantAmount ?? 0), want)); row('You receive', tok(BigInt(o.give_amount ?? o.giveAmount ?? 0), give));
        if (o.maker) row('Maker', text(o.maker));
        if (want.native) total += BigInt(o.want_amount ?? o.wantAmount ?? 0);
      } else warn('amber', 'Could not load the offer — check it on the site.');
      break;
    }
    case 20: out.kicker = 'EXCHANGE'; out.title = `Cancel your offer #${f.offerId}`; out.canonical.ids.offer = f.offerId.toString(); break;
    case 21: {
      const base = tokenOf(ctx, f.baseToken), q = tokenOf(ctx, f.quoteToken);
      out.kicker = 'EXCHANGE'; out.title = `Open market ${base.symbol}/${q.symbol}`;
      const cost = c.marketCreationCost !== undefined ? BigInt(c.marketCreationCost) : 50n * ATOMIC;
      row('Market creation cost', { ...zbc(cost), text: formatZBC(cost) + (c.marketCreationCost === undefined ? ' (default)' : '') }); row('Deposit', zbc(f.deposit));
      out.notes.push('The creation cost is not refunded.');
      total += cost + f.deposit;
      break;
    }
    case 22: {
      const m = c.market || {};
      const base = tokenOf(ctx, BigInt(m.base_token ?? m.baseToken ?? -1n)), q = tokenOf(ctx, BigInt(m.quote_token ?? m.quoteToken ?? -1n));
      const baseSym = m.base_token !== undefined || m.baseToken !== undefined ? base.symbol : 'base', quoteSym = m.quote_token !== undefined || m.quoteToken !== undefined ? q.symbol : 'quote';
      const isMarket = !!(f.flags & 1), side = f.side === 0 ? 'Buy' : 'Sell';
      const baseDec = base.decimals ?? 8;
      out.kicker = 'EXCHANGE';
      out.title = `${side} ${formatUnits(f.amount, baseDec)} ${baseSym} ${isMarket ? 'at market price' : `at ${formatUnits(f.price, 8)} ${quoteSym}`}`;
      row('Market', text(`#${f.marketId}${baseSym !== 'base' ? ` · ${baseSym}/${quoteSym}` : ''}`)); row('Side', text(side));
      row('Price', text(isMarket ? 'Market' : `${formatUnits(f.price, 8)} ${quoteSym} per ${baseSym}`)); row('Amount', text(`${formatUnits(f.amount, baseDec)} ${baseSym}`));
      if (!isMarket) { const t = (f.price * f.amount) / 10n ** BigInt(baseDec); row('Total', text(`≈ ${formatUnits(t, 8)} ${quoteSym}`)); if (f.side === 0 && q.native) total += t; }
      if (f.side === 1 && base.native) total += f.amount;
      row('Expires', f.expiry > 0n ? date(f.expiry) : text('Never'));
      amt('amount', f.amount); out.canonical.ids.market = f.marketId.toString();
      out.notes.push('Funds are locked until it fills or you cancel.');
      break;
    }
    case 23: out.kicker = 'EXCHANGE'; out.title = `Cancel order #${f.orderId}`; out.canonical.ids.order = f.orderId.toString(); out.notes.push('The unfilled part returns to you.'); break;
    case 3: case 259: {
      out.kicker = 'DATA';
      const p = f.property || '';
      if (tx.type === 259) out.title = `Remove data "${p}"`;
      else if (p.startsWith('poe:')) out.title = 'Anchor a document (notary)';
      else if (p.startsWith('form:')) out.title = 'Publish a form';
      else if (p.startsWith('formreply:')) out.title = 'Submit a form reply';
      else if (p.startsWith('inv')) out.title = 'Create an invoice';
      else if (p.startsWith('poll:')) out.title = 'Publish a poll';
      else if (p.startsWith('pollvote:')) out.title = 'Vote in a poll';
      else if (p.startsWith('tokenicon:')) out.title = 'Publish a token icon';
      else out.title = 'Save data on-chain';
      row('About', f.about ? addr(ctx, f.about) : recip()); row('Property', text(p));
      let v = f.value; let kind = 'quote';
      try { const j = JSON.parse(v); v = JSON.stringify(j, null, 2); kind = 'json'; } catch {}
      row('Value', { kind, text: v, full: v.length > 200 });
      break;
    }
    case 8: case 264: {
      out.kicker = 'FILE'; out.title = `${tx.type === 8 ? 'Create' : 'Replace'} file ${f.path}`;
      row('Path', text(f.path)); row('Size', text(formatBytes(f.content.length)));
      const t = fromUtf8(f.content); row('Preview', t !== null ? { kind: 'quote', text: t.slice(0, 200), full: t.length > 200 } : text('binary'));
      if (f.content.length > 65536) warn('red', 'Files above 64 KB are refused by the node.');
      out.notes.push('Rent is paid from the file\'s own ZBS_ deposit.');
      break;
    }
    case 520: out.kicker = 'FILE'; out.title = `Delete file ${f.path}`; row('Path', text(f.path)); warn('amber', 'The deposit remainder goes to the node pool.'); break;
    case 9: out.kicker = 'STORAGE'; out.title = `Prepay ${formatZBC(f.amount)} of storage`; row('Amount', zbc(f.amount)); total += f.amount; amt('amount', f.amount); break;
    case 40: {
      out.kicker = 'STORAGE'; out.title = `Store a ${formatBytes(f.totalSize)} file`;
      row('File root', code(f.fileRoot)); row('Size', text(formatBytes(f.totalSize))); row('Pieces', text(`${f.pieces.length} × ${formatBytes(f.pieceSize)}`)); row('Storage deposit', zbc(f.deposit));
      if (tx.survival) row('Kept for', zbc(tx.survival));
      if (f.deposit < ATOMIC / 100n) warn('amber', 'The deposit is below the 0.01 ZBC minimum.');
      total += f.deposit; amt('deposit', f.deposit);
      break;
    }
    case 296: out.kicker = 'STORAGE'; out.title = `Add ${formatZBC(f.amount)} to a stored file`; row('File root', code(f.fileRoot)); row('Amount', zbc(f.amount)); total += f.amount; amt('amount', f.amount); out.notes.push('Anyone may add; nothing comes back.'); break;
    case 52: {
      out.kicker = 'STORAGE'; out.title = `Keep a record on chain — add ${formatZBC(f.amount)}`;
      row('Record id', code(f.targetTxId.toString())); if (f.targetBytes !== undefined) row('Stated size', text(formatBytes(f.targetBytes))); if (f.targetHeight !== undefined) row('Until', blockRow(ctx, f.targetHeight));
      row('Amount', zbc(f.amount)); total += f.amount; amt('amount', f.amount);
      if (f.amount < ATOMIC / 10n) warn('amber', 'The amount is below the 0.1 ZBC minimum.');
      break;
    }
    case 309: out.kicker = 'STORAGE'; out.title = 'Close a record\'s paid life'; row('Record id', code(f.targetId.toString())); warn('amber', 'The rest goes to the node pool.'); break;
    case 53: out.kicker = 'RETIRED'; out.title = 'Retired transaction type 53'; row('Target id', code(f.targetTxId.toString())); warn('red', 'Retired transaction type — the network rejects it.'); out.canSign = false; out.retired = true; break;
    case 42: out.kicker = 'DATA OBJECT'; out.title = 'Transfer a data object'; row('Object', code(f.objectId)); row('New owner', addr(ctx, f.newOwner)); out.canonical.recipients.push(f.newOwner.hex); out.notes.push('Two-step: the recipient must accept it.'); break;
    case 43: {
      out.kicker = 'DATA OBJECT'; out.title = 'Change who may write to a data object';
      row('Object', code(f.objectId)); row('Mode', text(f.mode));
      row('Added', f.add.length ? { kind: 'list', items: f.add.map((a) => addr(ctx, a)), text: f.add.map((a) => a.display).join(', ') } : text('None'));
      row('Removed', f.remove.length ? { kind: 'list', items: f.remove.map((a) => addr(ctx, a)), text: f.remove.map((a) => a.display).join(', ') } : text('None'));
      break;
    }
    case 44: out.kicker = 'DATA OBJECT'; out.title = 'Accept a data object'; row('Object', code(f.objectId)); break;
    case 45: out.kicker = 'DATA OBJECT'; out.title = 'Delete a data object'; row('Object', code(f.objectId)); warn('red', 'Deleting a data object is permanent.'); out.hold = true; break;
    case 4: {
      const approve = f.decision === 0, reject = f.decision === 1;
      out.kicker = 'ESCROW APPROVAL'; out.title = approve ? 'Approve escrow' : reject ? 'Reject escrow' : 'Expire escrow';
      out.extras.danger = !approve; out.extras.primaryLabel = approve ? 'Approve & sign' : reject ? 'Reject & sign' : 'Sign';
      const e = c.escrow;
      out.canonical.ids.escrow = f.escrowTxHash;
      if (e) {
        const amount = e.amount !== undefined ? BigInt(e.amount) : null, commission = e.commission !== undefined ? BigInt(e.commission) : null;
        if (e.payer || e.sender) row('Payer', text(e.payer || e.sender)); if (e.recipient) row('Recipient', text(e.recipient));
        if (amount !== null) row('Amount', zbc(amount)); if (commission !== null) row('Your commission', zbc(commission));
        if (e.instruction) row('Instruction', quote(e.instruction));
        if (approve) out.notes.push(`${amount !== null ? formatZBC(amount) : 'The amount'} is released to ${e.recipient || 'the recipient'}.${commission !== null ? ` You receive ${formatZBC(commission)}.` : ''}`);
        else if (reject) out.notes.push(`${amount !== null ? formatZBC(amount) : 'The amount'} returns to ${e.payer || e.sender || 'the payer'}.`);
        if (e.status && e.status !== 'pending') warn('red', `This escrow is ${e.status}; the node will refuse the decision.`);
      } else { row('Escrow', code(f.escrowTxHash)); warn('amber', 'Could not load the escrow — check it on the site.'); }
      break;
    }
    case 260: {
      out.kicker = 'ESCROW REQUEST'; out.title = `Ask ${f.payer.display.slice(0, 12)}… to pay ${formatZBC(f.amount)} into escrow`;
      row('Payer', addr(ctx, f.payer)); row('Amount', zbc(f.amount)); row('Approver', addr(ctx, f.approver)); row('Commission', zbc(f.commission)); row('Timeout', date(f.timeout)); row('Instruction', quote(f.instruction)); row('Request expires', f.expiry > 0n ? date(f.expiry) : text('With the timeout'));
      amt('amount', f.amount); out.canonical.recipients.push(f.payer.hex);
      break;
    }
    case 516: {
      out.kicker = 'ESCROW'; out.title = f.isEscrow ? 'Refuse an escrow' : 'Decline a payment request';
      row('From', recip()); row('Reason', quote(f.reason)); row(f.isEscrow ? 'Escrow id' : 'Request id', code(f.id.toString()));
      if (f.isEscrow) { warn('red', 'The money goes back to the sender. The approver is not paid. This cannot be undone.'); out.hold = true; }
      break;
    }
    case 5: describeMultisig(tx, ctx, out, warn, row); break;
    case 55: case 58: {
      const m = f.member;
      out.kicker = 'ACCOUNT GROUP';
      if (tx.type === 55) { out.title = `Link ${shortLabel(ctx, m)} to your account group`; warn('amber', 'Linking is public and permanent. Everything the member owns moves into the group.'); }
      else { out.title = `Make ${shortLabel(ctx, m)} the controller of your group`; warn('red', 'You lose control of the group.'); out.hold = true; }
      row('Member', addr(ctx, m)); row('Consent proof kind', text(f.proof.kind === 0 ? 'Raw signature' : f.proof.kind === 2 ? 'Ethereum personal_sign' : 'Multisig')); row('Valid until', blockRow(ctx, f.validUntil)); row('Link sequence', text(f.seq));
      out.canonical.recipients.push(m.hex);
      break;
    }
    case 56: {
      const m = f.member; out.kicker = 'ACCOUNT GROUP';
      out.title = m.hex === tx.sender.hex ? 'Leave the account group' : `Remove ${shortLabel(ctx, m)} from the group`;
      row('Member', addr(ctx, m)); out.notes.push('It leaves with nothing and becomes an empty address.');
      break;
    }
    case 57: {
      const m = f.member; out.kicker = 'ACCOUNT GROUP'; out.title = `Set ${shortLabel(ctx, m)}'s permissions`;
      row('Member', addr(ctx, m));
      const maySpend = !!(f.flags & 1), tokens = !!(f.flags & 2);
      if (!maySpend) row('Spending', text('Receive only'));
      else if (f.limit > 0n) row('Spending', text(`May spend up to ${formatZBC(f.limit)} per ${formatDuration(Number(f.periodBlocks) * (ctx.chain && ctx.chain.avgBlockSeconds || 60))} (${f.periodBlocks} blocks)`));
      else { row('Spending', text('May spend without limit')); warn('red', 'This member may spend everything the group holds.'); }
      row('May move tokens', yesno(tokens));
      break;
    }
    case 2: {
      out.kicker = 'NODE'; out.title = `Register node ${zbcEncode(hexToBytes(f.nodePub), 'ZNK').slice(0, 17)}…`;
      row('Node key', znk(f.nodePub)); row('Owner', text(f.owner.display)); row('Locked stake', zbc(f.locked));
      if (f.owner.hex !== tx.sender.hex) warn('red', 'The owner in the body is not the sender.');
      total += f.locked; amt('stake', f.locked); nodeSenderCheck(tx, warn);
      break;
    }
    case 258: out.kicker = 'NODE'; out.title = `Update node stake to ${formatZBC(f.locked)}`; row('Node key', znk(f.nodePub)); row('Locked stake', zbc(f.locked)); out.notes.push('The stake may only stay or increase.'); amt('stake', f.locked); nodeSenderCheck(tx, warn); break;
    case 514: out.kicker = 'NODE'; out.title = 'Remove node registration'; row('Node key', znk(f.nodePub)); out.notes.push('The stake returns after the unlock period.'); nodeSenderCheck(tx, warn); break;
    case 770: out.kicker = 'NODE'; out.title = 'Claim node ownership'; row('Node key', znk(f.nodePub)); row('Proof block', blockRow(ctx, f.poown.height)); nodeSenderCheck(tx, warn); break;
    case 36: out.kicker = 'GATEWAY'; out.title = `Register gateway ${f.domain}`; row('Gateway key', znk(f.gatewayKey)); row('Domain', text(f.domain)); row('URL', text(f.url)); out.notes.push('Locks a 10 ZBC stake (refunded on unregister).'); total += 10n * ATOMIC; nodeSenderCheck(tx, warn); break;
    case 38: out.kicker = 'GATEWAY'; out.title = 'Unregister gateway'; row('Gateway key', znk(f.gatewayKey)); nodeSenderCheck(tx, warn); break;
    case 46: out.kicker = 'ARCHIVAL'; out.title = `Register archival ${f.domain}`; row('Node key', znk(f.nodePub)); row('Domain', text(f.domain)); row('URL', text(f.url)); nodeSenderCheck(tx, warn); break;
    case 47: out.kicker = 'ARCHIVAL'; out.title = 'Unregister archival node'; row('Node key', znk(f.nodePub)); nodeSenderCheck(tx, warn); break;
    case 48: out.kicker = 'RELAY'; out.title = `Register relay ${f.domain}`; row('Relay key', znk(f.relayKey)); row('Gateway key', znk(f.gatewayKey)); row('Domain', text(f.domain)); row('URL', text(f.url)); nodeSenderCheck(tx, warn); break;
    case 49: out.kicker = 'RELAY'; out.title = 'Unregister relay'; row('Relay key', znk(f.relayKey)); nodeSenderCheck(tx, warn); break;
    case 7: out.kicker = 'GOVERNANCE'; out.title = 'Commit a fee vote'; row('Vote hash', code(f.voteHash)); out.notes.push('The value stays hidden until you reveal it.'); break;
    case 263: {
      out.kicker = 'GOVERNANCE'; out.title = `Reveal your fee vote: ${scaleText(f.feeVote)} fee scale`;
      row('Fee scale', text(scaleText(f.feeVote))); row('Committed at', blockRow(ctx, f.height)); row('Block hash', code(f.blockHash));
      if (c.feeVoteInfo && String(c.feeVoteInfo).toLowerCase() !== f.info) { warn('red', 'The body does not embed the fee vote info the page named.'); out.canSign = false; }
      if (tx.sender.type === 0 && !verifyRawEd25519(tx.sender.payload, hexToBytes(f.info), hexToBytes(f.voterSig))) { warn('red', 'The embedded voter signature does not verify against this account.'); out.canSign = false; }
      break;
    }
    case 51: {
      out.kicker = 'GOVERNANCE'; out.title = `Vote ${f.parameter} = ${f.value}`;
      row('Parameter', text(f.parameter)); row('Value', text(f.value.toString())); row('As node', tx.sender.type === 0 ? znk(bytesToHex(tx.sender.payload)) : text(tx.sender.display));
      if (!ctx.nodeKey) { warn('red', 'Only an imported node key may sign a blockchain economics vote.'); out.canSign = false; }
      break;
    }
    case 50: {
      out.kicker = 'POLICY'; out.title = 'Change what this account transacts with';
      const off = CATEGORIES.filter((_, i) => f.mask & (1 << i));
      row('Turned off', off.length ? { kind: 'list', items: off.map(text), text: off.join(', ') } : text('Nothing — everything allowed'));
      if (off.length) warn('amber', 'A category turned off is refused both ways.');
      break;
    }
    case 54: {
      out.kicker = 'POLICY';
      const n = f.recipients.length;
      out.title = n ? `Forward incoming money: ${n} recipient${n === 1 ? '' : 's'}` : 'Clear your split policy';
      let sum = 0;
      for (const r of f.recipients) { sum += r.shareBp; row(percentOfBp(r.shareBp), addr(ctx, r.account)); out.canonical.recipients.push(r.account.hex); }
      if (n) out.notes.push(`Unassigned ${percentOfBp(10000 - sum)} stays in this account.`);
      if (sum > 10000 || n > 10) warn('red', 'Shares above 100% or more than 10 recipients — the node refuses this.');
      break;
    }
    case 24: {
      const token = tokenOf(ctx, f.stakeToken); const game = GAME_TYPES[f.gameType] || `type ${f.gameType}`;
      out.kicker = 'GAME'; out.title = `Start a ${game} game — stake ${amountText(f.stake, token)}`;
      row('Opponent', f.opponent ? addr(ctx, f.opponent) : rec ? recip() : text('Open challenge')); row('Seats', text(f.seats)); row('Stake', tok(f.stake, token));
      if (f.channel !== null) row('Payment channel', text(f.channel));
      if (token.native) total += f.stake; amt('stake', f.stake);
      out.notes.push('Each move also pays the network fee.');
      break;
    }
    case 25: { out.kicker = 'GAME'; out.title = `Join game #${f.gameId}`; out.canonical.ids.game = f.gameId.toString(); const g = c.game; if (g && g.stake !== undefined) { const token = tokenOf(ctx, BigInt(g.stake_token ?? g.stakeToken ?? 0)); row('Stake', tok(BigInt(g.stake), token)); if (token.native) total += BigInt(g.stake); } else warn('amber', 'Stake unknown — could not load the game.'); break; }
    case 26: {
      out.kicker = 'GAME'; out.title = `Play a move in game #${f.gameId}`; out.canonical.ids.game = f.gameId.toString();
      const g = c.game || {}; const kind = g.type || g.game_type || g.gameType;
      let moveText = f.move;
      if ((kind === 1 || kind === 'tic-tac-toe') && f.move.length === 2) moveText = `cell ${parseInt(f.move, 16)}`;
      else if ((kind === 2 || kind === 'chess') && f.move.length === 4) { const b = hexToBytes(f.move); moveText = `${sq(b[0])} → ${sq(b[1])}`; }
      row('Move', code(moveText)); out.extras.sessionKeyEligible = true;
      break;
    }
    case 27: out.kicker = 'GAME'; out.title = `Resign game #${f.gameId}`; out.canonical.ids.game = f.gameId.toString(); warn('red', 'The stake goes to your opponent.'); out.extras.sessionKeyEligible = true; break;
    case 28: out.kicker = 'GAME'; out.title = `Claim a timeout win in game #${f.gameId}`; out.canonical.ids.game = f.gameId.toString(); out.extras.sessionKeyEligible = true; break;
    case 17: default: {
      out.kicker = tx.known ? 'EVENT' : 'UNKNOWN';
      out.title = tx.type === 17 ? 'Event attested (oracle/bridge)' : `Unknown transaction type ${tx.type}`;
      if (tx.type === 17) { row('Event id', text(f.eventId)); row('Value', quote(f.value)); }
      row('Body', code(bytesToHex(tx.body) || '(empty)')); row('Sender', text(tx.sender.display)); row('Recipient', rec ? recip() : text('—'));
      warn('amber', `The signer cannot describe this transaction. Sign only if you trust ${ctx.origin || 'this site'} completely.`);
      out.hold = true; out.unknown = true;
      break;
    }
  }

  // escrow rows (§6 type 1 with escrow, and any escrowed transfer)
  if (tx.escrow) {
    const e = tx.escrow;
    row('Approver', addr(ctx, e.approver)); row('Commission', zbc(e.commission)); row('Timeout', date(e.timeout)); if (e.instruction) row('Instruction', quote(e.instruction));
    if (e.multiParty && e.requestId !== 0n) row('Pays escrow request', code('#' + e.requestId.toString()));
    amt('commission', e.commission);
  }
  if (tx.message && tx.message.length && tx.type !== 0) row('Message', tx.encrypted ? text('Encrypted note (only the recipient can read it)') : quote(tx.messageText ?? bytesToHex(tx.message)));
  if (tx.message && tx.message.length > 256) warn('amber', 'The message is longer than 256 bytes; the node may refuse it.');
  if (tx.version === 1 && !tx.inner) warn('amber', 'Version 1 envelope (no survival field); current nodes expect version 2.');
  // common rows §7.2
  out.common = [];
  out.common.push({ label: tx.type === 5 ? 'Your network fee' : 'Network fee', value: zbc(tx.fee) });
  if (tx.survival && tx.survival > 0n) out.common.push({ label: 'Kept on chain', value: zbc(tx.survival) });
  if (tx.escrow) out.common.push({ label: 'Escrow commission', value: zbc(tx.escrow.commission) });
  out.total = total; amt('total', total);
  out.common.push({ label: 'Total leaving the account', value: zbc(total), bold: true });
  const now = ctx.now || Math.floor(Date.now() / 1000);
  const ts = Number(tx.timestamp);
  if (ts < now - 3600) warn('amber', 'Old request — the network may refuse it.');
  if (ts > now + 300) warn('amber', 'The timestamp is more than 5 minutes in the future.');
  if (tx.fee === 0n) warn('amber', 'Zero fee; the node will refuse it.');
  return out;
}

function shortLabel(ctx, a) { const l = ctx.labelFor ? ctx.labelFor(a.hex) : null; return l || (a.display.length > 20 ? a.display.slice(0, 12) + '…' : a.display); }
function nodeSenderCheck(tx, warn) { if (tx.sender.type !== 0) warn('red', 'Node and infrastructure transactions must be sent from a ZooBC account.'); }
function scaleText(feeVote) { const v = Number(feeVote) / 10000; return `${v.toFixed(2).replace(/\.?0+$/, '')}×`; }
function sq(b) { return 'abcdefgh'[b % 8] + (Math.floor(b / 8) + 1); }

function describeMultisig(tx, ctx, out, warn, row) {
  const f = tx.fields; out.kicker = 'MULTISIG';
  const c = ctx.context || {};
  const shape = f.info && !f.inner ? 'create' : f.info && f.inner ? 'propose' : !f.info && !f.inner && f.sigs ? 'cosign' : 'other';
  const nestedCtx = { ...ctx, context: c.inner || {} };
  const inner = (innerTx) => { const d = describe(innerTx, nestedCtx); d.senderAddress = innerTx.sender.display; return d; };
  if (f.info) {
    const parts = f.info.participants;
    const addrHash = multisigAddress(f.info.min, f.info.nonce, parts.map((p) => p.typed));
    const addrTyped = typed(0, addrHash);
    out.extras.multisigAddress = display(addrTyped); out.extras.multisigHex = bytesToHex(addrTyped);
    if (shape === 'create') {
      out.title = 'Create a multisig account';
      row('Participants', { kind: 'list', items: parts.map((p) => addr(ctx, p)), text: parts.map((p) => p.display).join(', ') });
      row('Signatures required', text(`${f.info.min} of ${parts.length}`)); row('Nonce', text(f.info.nonce.toString())); row('Resulting address', code(display(addrTyped)));
      return;
    }
    if (shape === 'propose') {
      out.title = 'Propose a multisig transaction';
      if (f.inner.sender.hex !== bytesToHex(addrTyped)) { warn('red', 'The inner transaction\'s sender is not the multisig these participants form.'); out.canSign = false; }
      out.nested = inner(f.inner);
      row('Participants', text(`${parts.length}`)); row('Signatures required', text(`${f.info.min} of ${parts.length}`));
      const have = f.sigs ? f.sigs.list.length : 0;
      row('Signatures so far', text(`${have} of ${f.info.min} · yours makes ${have + 1}`));
      checkInnerHash(f, warn, out);
      return;
    }
  }
  if (shape === 'cosign') {
    out.title = 'Add your signature to a multisig transaction';
    const innerHex = c.multisigInner;
    if (!innerHex) { warn('red', 'The page did not provide what you are signing.'); out.canSign = false; row('Inner hash', code(f.sigs.hash)); }
    else {
      let innerBytes; try { innerBytes = hexToBytes(innerHex); } catch { innerBytes = null; }
      const h = innerBytes ? bytesToHex(sha3_256(innerBytes)) : null;
      if (h !== f.sigs.hash) { warn('red', 'The inner transaction the page provided does not match the hash being signed.'); out.canSign = false; row('Inner hash', code(f.sigs.hash)); }
      else {
        try { const { decodeTransaction } = ctx.decoder; const innerTx = decodeTransaction(innerBytes, { inner: true }); out.nested = inner(innerTx); out.extras.innerBytes = innerBytes; out.notes.push(`Inner hash ${f.sigs.hash.slice(0, 4)}…${f.sigs.hash.slice(-4)} ✓ matches the proposal`); }
        catch (e) { warn('red', 'The inner transaction the page provided does not decode: ' + e.message); out.canSign = false; }
      }
    }
    const have = f.sigs.list.length;
    row('Signatures', text(c.min ? `${have} of ${c.min} · yours makes ${have + 1}` : `${have} so far · yours makes ${have + 1}`));
    return;
  }
  out.title = 'Multisignature transaction'; warn('amber', 'Unusual multisig shape; check the raw bytes.'); out.hold = true;
  if (f.inner) out.nested = inner(f.inner);
}
function checkInnerHash(f, warn, out) {
  if (f.sigs && f.innerBytes) { const h = bytesToHex(sha3_256(f.innerBytes)); if (h !== f.sigs.hash) { warn('red', 'The signature block\'s hash does not match the inner transaction.'); out.canSign = false; } }
}

/** Describe an inner sent with context.multisig (spec §6 type 5 participant signature). */
export function describeParticipant(innerTx, ctx, ms) {
  const d = describe(innerTx, ctx);
  const out = { ...d, rows: [], nested: d, kicker: 'MULTISIG', hold: false };
  out.title = ms.role === 'cosign' ? 'Add your signature to a multisig transaction' : 'Sign as a participant of a multisig account';
  if (ms.participants) out.rows.push({ label: 'Participants', value: text(String(ms.participants.length)) });
  if (ms.min) out.rows.push({ label: 'Signatures required', value: text(String(ms.min)) });
  out.common = []; out.total = 0n; out.notes = []; out.warnings = d.warnings.filter((w) => w.level === 'red');
  return out;
}
