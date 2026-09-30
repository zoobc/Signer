// ZooBC Signer service worker: vault, permissions, request queue, approval window and signing (spec §1, §7, §8, §9).
import { hexToBytes, bytesToHex, toBase64, fromBase64, utf8, zero, randomBytes } from './lib/bytes.js';
import { parseTypedHex, parseAddress, multisigAddress, typed, display, FORMATS, typeForFormat } from './lib/address.js';
import { deriveAccount, deriveSecret, accountFromSecret, parseRawKey, isValidMnemonic, newMnemonic, normalizeMnemonic } from './lib/keys.js';
import { signDigest, signRawEd25519 } from './lib/sign.js';
import { txDigest, txHash, buildPayload, consentProof, genesisShort } from './lib/zbc.js';
import { decodeTransaction } from './lib/decoder.js';
import { createVault, unlockVault, encryptVault, decryptVault, emptyVault, importAesKey } from './lib/vault.js';
import { normalizeAccount, buildTxView, buildDigestView, buildMessageView, buildMultisigView, originFlags } from './lib/requests.js';
import { rpcError, asRpcError, ERR } from './lib/errors.js';
import * as node from './lib/node.js';
import { NETWORKS } from './lib/node.js';
import { runSelfTests } from './lib/selftest.js';
import { formatZBC } from './lib/format.js';

const SESSION = chrome.storage.session;
const LOCAL = chrome.storage.local;
const APPROVE_URL = chrome.runtime.getURL('approve.html');
const POPUP_URL = chrome.runtime.getURL('popup.html');
const OPTIONS_URL = chrome.runtime.getURL('options.html');
const PROMPT_METHODS = new Set(['zbc_requestAccounts', 'zbc_signTransaction', 'zbc_signDigest', 'zbc_signMultisig', 'zbc_signMessage', 'zbc_submitTransaction']);
const MAX_QUEUE_PER_ORIGIN = 20;

// ---------------------------------------------------------------- state
let vault = null;      // decrypted vault (memory only)
let keyRaw = null;     // AES key bytes (memory; mirrored in chrome.storage.session)
let salt = null;
const ports = new Map(); // portId → { port, origin, tabId }
let portSeq = 0;
const inflight = new Map(); // request id → { portId }
let building = Promise.resolve();

const uid = () => bytesToHex(randomBytes(8));
const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------- vault lifecycle
async function vaultExists() { const { vault: blob } = await LOCAL.get('vault'); return !!blob; }

async function ensureUnlocked() {
  if (vault && keyRaw) return true;
  const s = await SESSION.get(['keyRaw']);
  if (!s.keyRaw) return false;
  const { vault: blob } = await LOCAL.get('vault');
  if (!blob) return false;
  try {
    keyRaw = fromBase64(s.keyRaw);
    vault = await decryptVault(keyRaw, blob);
    salt = fromBase64(blob.salt);
    migrate();
    return true;
  } catch (e) { keyRaw = null; vault = null; await SESSION.remove('keyRaw'); return false; }
}
function migrate() {
  vault.settings = { ...emptyVault().settings, ...(vault.settings || {}) };
  vault.multisigs = vault.multisigs || []; vault.log = vault.log || []; vault.sites = vault.sites || {}; vault.contacts = vault.contacts || {};
}
async function saveVault() {
  if (!vault || !keyRaw) throw rpcError(ERR.LOCKED);
  const blob = await encryptVault(keyRaw, vault, salt);
  await LOCAL.set({ vault: blob });
}
async function unlock(password) {
  const { vault: blob } = await LOCAL.get('vault');
  if (!blob) throw new Error('No vault yet');
  const u = await unlockVault(password, blob);
  keyRaw = u.keyRaw; vault = u.data; salt = u.salt; migrate();
  await SESSION.set({ keyRaw: toBase64(keyRaw) });
  await touch();
  await verifyCachedAddresses();
  return true;
}
async function lock() {
  if (keyRaw) zero(keyRaw);
  vault = null; keyRaw = null; salt = null;
  await SESSION.remove(['keyRaw']);
  await chrome.alarms.clear('autolock');
  for (const [, p] of ports) { safePost(p.port, { kind: 'event', event: 'lock', data: {} }); safePost(p.port, { kind: 'event', event: 'accountsChanged', data: [] }); }
}
async function touch() {
  const minutes = Math.min(240, Math.max(1, Number((vault && vault.settings.autoLockMinutes) || 15)));
  await chrome.alarms.create('autolock', { delayInMinutes: minutes });
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'autolock') lock(); });
chrome.runtime.onStartup.addListener(() => { SESSION.remove(['keyRaw']); });

async function verifyCachedAddresses() {
  // §9.2: typed/address are cached at derive time and re-verified on unlock.
  let changed = false;
  for (const a of vault.accounts) {
    try {
      const acc = a.source === 'seed' ? deriveAccount(seedById(a.seedId), a.format, a.btc, a.index) : accountFromSecret(hexToBytes(keyById(a.keyId).hex), a.format, a.btc);
      if (acc.hex !== a.typed || acc.address !== a.address) { a.typed = acc.hex; a.address = acc.address; changed = true; }
    } catch (e) { a.broken = e.message; }
  }
  if (changed) await saveVault();
}
const seedById = (id) => { const s = vault.seeds.find((x) => x.id === id); if (!s) throw new Error('seed missing'); return s; };
const keyById = (id) => { const k = vault.keys.find((x) => x.id === id); if (!k) throw new Error('key missing'); return k; };

/** 32-byte secret for a vault account; caller zeroes it. */
function secretFor(acc) {
  if (acc.source === 'seed') return deriveSecret(seedById(acc.seedId), acc.format, acc.btc, acc.index);
  return hexToBytes(keyById(acc.keyId).hex);
}
function findAccount(hex) { return vault.accounts.find((a) => a.typed === hex && !a.hidden) || vault.accounts.find((a) => a.typed === hex) || null; }
function labelFor(hex) { const a = vault && vault.accounts.find((x) => x.typed === hex); if (a) return a.label; const m = vault && vault.multisigs.find((x) => x.typed === hex); if (m) return m.label; const c = vault && vault.contacts && vault.contacts[hex]; return c || null; }

function accountObject(a) {
  return { address: a.address, typed: a.typed, format: a.format, ...(a.format === 'BTC' ? { btc: a.btc } : {}), label: a.label, source: a.source, canSignDigest: true, ...(a.nodeKey ? { nodeKey: true } : {}) };
}
function multisigObject(m) {
  const held = m.participants.filter((p) => findAccount(p)).length;
  return { address: m.address, typed: m.typed, format: 'ZBC', label: m.label, source: 'key', canSignDigest: false, multisig: { min: m.min, nonce: String(m.nonce), participants: m.participants, held } };
}
function sharedAccounts(origin) {
  if (!vault) return [];
  const site = vault.sites[origin]; if (!site) return [];
  const out = [];
  for (const hex of site.accounts) {
    const a = findAccount(hex); if (a) { out.push(accountObject(a)); continue; }
    const m = vault.multisigs.find((x) => x.typed === hex); if (m && multisigObject(m).multisig.held > 0) out.push(multisigObject(m));
  }
  return out;
}
function log(entry) { vault.log.unshift({ at: now(), ...entry }); if (vault.log.length > 500) vault.log.length = 500; }

// ---------------------------------------------------------------- chain resolution (§4.1)
async function genesisCache() { const { genesisCache: g } = await LOCAL.get('genesisCache'); return g || {}; }
async function rememberGenesis(id, info, nodeUrl) { const g = await genesisCache(); g[id] = { genesis: info.genesis, tag: info.tag, node: nodeUrl, height: info.height, at: now() }; await LOCAL.set({ genesisCache: g }); }
function nodeFor(id) { const custom = vault && vault.settings.nodes && vault.settings.nodes[id]; return node.normalizeNodeUrl(custom) || (NETWORKS[id] && NETWORKS[id].node) || null; }
async function hostPermitted(url) { try { const u = new URL(url); if (u.protocol !== 'https:') return false; return await chrome.permissions.contains({ origins: [`${u.origin}/*`] }); } catch { return false; } }

/** Resolve the chain a request names. Returns { id, label, genesis, genesisBytes, tag, node, height, avgBlockSeconds, unverified }. */
async function resolveChain(chainParam = {}) {
  const requested = String(chainParam.genesis || '').toLowerCase().replace(/^0x/, '');
  const wantId = chainParam.id && NETWORKS[chainParam.id] ? chainParam.id : null;
  const cache = await genesisCache();
  const finish = (id, c, unverified = false) => ({ id, label: NETWORKS[id] ? NETWORKS[id].label : id, genesis: c.genesis, genesisBytes: hexToBytes(c.genesis), tag: c.tag || 'ZBC-TX', node: c.node, height: c.height || null, avgBlockSeconds: 60, unverified });
  const ids = [wantId, vault ? vault.settings.network : 'testnet', ...Object.keys(NETWORKS)].filter((x, i, a) => x && a.indexOf(x) === i);
  // 1. fresh-enough cache
  for (const id of ids) { const c = cache[id]; if (c && (!requested || c.genesis === requested) && now() - c.at < 3600) return finish(id, c); }
  // 2. fetch
  const candidates = [];
  for (const id of ids) { const n = nodeFor(id); if (n) candidates.push({ id, node: n }); }
  if (chainParam.node && await hostPermitted(chainParam.node)) candidates.unshift({ id: wantId || ids[0], node: node.normalizeNodeUrl(chainParam.node) });
  let lastErr = null;
  for (const cnd of candidates) {
    try {
      const info = await node.nodeInfo(cnd.node);
      await rememberGenesis(cnd.id, info, cnd.node);
      if (!requested || info.genesis === requested) return finish(cnd.id, { ...info, node: cnd.node });
    } catch (e) { lastErr = e; }
  }
  // 3. stale cache
  for (const id of ids) { const c = cache[id]; if (c && (!requested || c.genesis === requested)) return finish(id, c); }
  // 4. developer escape hatch
  if (requested && /^[0-9a-f]{64}$/.test(requested) && vault && vault.settings.trustPageGenesis) return finish(wantId || 'unknown', { genesis: requested, tag: chainParam.tag || 'ZBC-TX', node: nodeFor(wantId || 'testnet') }, true);
  if (requested) throw rpcError(ERR.WRONG_CHAIN, 'This page is on a different network than your signer' + (lastErr ? ` (${lastErr.message})` : ''));
  throw rpcError(ERR.WRONG_CHAIN, 'Could not read the network\'s genesis hash' + (lastErr ? `: ${lastErr.message}` : ''));
}

// ---------------------------------------------------------------- ports (content scripts)
function safePost(port, msg) { try { port.postMessage(msg); } catch {} }
function respond(req, result, error) {
  const msg = { kind: 'response', id: req.id, ...(error ? { error: asRpcError(error).toJSON() } : { result }) };
  const p = ports.get(req.portId);
  if (p) safePost(p.port, msg); else SESSION.get('results').then(({ results }) => SESSION.set({ results: { ...(results || {}), [req.id]: msg } }));
}
function emitToOrigin(origin, event, data) { for (const [, p] of ports) if (p.origin === origin) safePost(p.port, { kind: 'event', event, data }); }

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'zoobc-signer' || !port.sender || !port.sender.tab) return;
  const origin = port.sender.origin || (port.sender.url ? new URL(port.sender.url).origin : null);
  if (!origin || origin === 'null') return;
  const portId = `p${++portSeq}`;
  ports.set(portId, { port, origin, tabId: port.sender.tab.id });
  port.onDisconnect.addListener(() => ports.delete(portId));
  port.onMessage.addListener((m) => {
    if (!m || typeof m !== 'object') return;
    if (m.kind === 'resume' && Array.isArray(m.ids)) return resume(portId, m.ids.filter((x) => typeof x === 'string').slice(0, 50));
    if (m.kind !== 'request' || typeof m.id !== 'string' || typeof m.method !== 'string') return;
    handleRequest({ id: m.id.slice(0, 64), method: m.method, params: m.params, origin, portId, tabId: port.sender.tab.id }).catch((e) => respond({ id: m.id, portId }, undefined, e));
  });
});

async function resume(portId, ids) {
  const { results, pending } = await SESSION.get(['results', 'pending']);
  for (const id of ids) {
    if (results && results[id]) { safePost(ports.get(portId).port, results[id]); delete results[id]; }
    else if (pending && pending[id]) pending[id].portId = portId;
    else safePost(ports.get(portId).port, { kind: 'response', id, error: { code: 5000, message: 'Request lost' } });
  }
  await SESSION.set({ results: results || {}, pending: pending || {} });
  for (const id of ids) { const f = inflight.get(id); if (f) f.portId = portId; }
}

async function handleRequest(req) {
  const { method, params = {}, origin } = req;
  if (params !== undefined && (typeof params !== 'object' || params === null)) throw rpcError(ERR.BAD_REQUEST, 'params must be an object');
  const unlocked = await ensureUnlocked();
  switch (method) {
    case 'zbc_accounts': return respond(req, unlocked ? sharedAccounts(origin) : []);
    case 'zbc_hasAccount': {
      if (!unlocked) return respond(req, { held: false, shared: false, locked: true });
      const site = vault.sites[origin];
      if (!site) return respond(req, { held: false, shared: false, locked: false });
      let hex = null; try { hex = normalizeAccount(String(params.account || '')).hex; } catch { return respond(req, { held: false, shared: false, locked: false }); }
      const held = !!(findAccount(hex) || vault.multisigs.find((m) => m.typed === hex));
      return respond(req, { held, shared: held && site.accounts.includes(hex), locked: false });
    }
    case 'zbc_disconnect': {
      if (unlocked && vault.sites[origin]) { delete vault.sites[origin]; await saveVault(); emitToOrigin(origin, 'accountsChanged', []); }
      return respond(req, true);
    }
    case 'zbc_getSigningRule': {
      const chain = await resolveChain(params.node ? { node: String(params.node) } : {});
      return respond(req, { genesis: chain.genesis, tag: chain.tag, chain: chain.id });
    }
    default:
      if (!PROMPT_METHODS.has(method)) throw rpcError(ERR.UNSUPPORTED, `Method ${method} not supported`);
      return enqueue(req, unlocked);
  }
}

// ---------------------------------------------------------------- request queue (§7, §8.3)
async function pendingMap() { const { pending } = await SESSION.get('pending'); return pending || {}; }
async function setPending(p) { await SESSION.set({ pending: p }); }

async function enqueue(req, unlocked) {
  const pending = await pendingMap();
  const mine = Object.values(pending).filter((p) => p.origin === req.origin);
  if (mine.length >= MAX_QUEUE_PER_ORIGIN) throw rpcError(ERR.REJECTED, 'Too many pending requests from this site');
  // cheap validation that needs no vault
  preValidate(req);
  // session keys (§8.4): auto-sign a permitted game move
  if (unlocked && req.method === 'zbc_signTransaction') { const auto = await trySessionKey(req); if (auto) return; }
  const entry = { id: req.id, origin: req.origin, portId: req.portId, tabId: req.tabId, method: req.method, params: req.params || {}, createdAt: now(), view: null, error: null };
  inflight.set(req.id, entry);
  if (unlocked) { try { entry.view = await buildView(entry); } catch (e) { inflight.delete(req.id); throw e; } }
  pending[req.id] = entry;
  await setPending(pending);
  await openApproval();
}

function preValidate(req) {
  const p = req.params || {};
  switch (req.method) {
    case 'zbc_signTransaction': case 'zbc_submitTransaction':
      normalizeAccount(String(p.account || '')); if (typeof p.unsignedTx !== 'string') throw rpcError(ERR.BAD_REQUEST, 'unsignedTx is required'); decodeOrThrow(p.unsignedTx); break;
    case 'zbc_signDigest': normalizeAccount(String(p.account || '')); if (typeof p.digest !== 'string') throw rpcError(ERR.BAD_REQUEST, 'digest is required'); break;
    case 'zbc_signMessage': normalizeAccount(String(p.account || '')); if (typeof p.message !== 'string') throw rpcError(ERR.BAD_REQUEST, 'message is required'); break;
    case 'zbc_signMultisig': normalizeAccount(String(p.multisig || '')); if (typeof p.inner !== 'string') throw rpcError(ERR.BAD_REQUEST, 'inner is required'); decodeOrThrow(p.inner); break;
  }
}
function decodeOrThrow(hex) { try { return decodeTransaction(hexToBytes(hex)); } catch (e) { throw rpcError(ERR.BAD_REQUEST, 'The transaction bytes do not decode: ' + e.message); } }

/** Build the approval view for a pending entry (vault must be unlocked). Throws RpcError to reject outright. */
async function buildView(entry) {
  const p = entry.params, origin = entry.origin;
  const of = originFlags(origin);
  const base = { origin, originFlags: of, method: entry.method, createdAt: entry.createdAt };
  if (entry.method === 'zbc_requestAccounts') {
    const site = vault.sites[origin];
    const accounts = vault.accounts.filter((a) => !a.hidden).map((a) => ({ ...accountObject(a), seedId: a.seedId, checked: !!(site && site.lastUsed && site.lastUsed === a.typed), shared: !!(site && site.accounts.includes(a.typed)) }));
    const multisigs = vault.multisigs.map(multisigObject).filter((m) => m.multisig.held > 0).map((m) => ({ ...m, checked: false, shared: !!(site && site.accounts.includes(m.typed)) }));
    const wantFormats = Array.isArray(p.formats) ? p.formats.map(String) : null;
    const chain = await resolveChain(p.chain ? { id: String(p.chain) } : {}).catch(() => null);
    return { ...base, kind: 'connect', accounts: wantFormats ? accounts.filter((a) => wantFormats.includes(a.format)) : accounts, multisigs, groups: vault.seeds.map((s) => ({ id: s.id, name: s.name })), network: chain ? { id: chain.id, label: chain.label } : null };
  }
  const chain = await resolveChain(p.chain || {});
  const network = { id: chain.id, label: chain.label, genesis: chain.genesis, short: genesisShort(chain.genesis), unverified: chain.unverified };
  if (entry.method === 'zbc_signMultisig') {
    const ms = normalizeAccount(String(p.multisig));
    const setup = vault.multisigs.find((m) => m.typed === ms.hex);
    if (!setup) return { ...base, kind: 'not-held', account: { address: ms.display, typed: ms.hex, format: 'ZBC', multisig: true }, network };
    const held = vault.accounts.filter((a) => setup.participants.includes(a.typed)).map((a) => ({ hex: a.typed, label: a.label, format: a.format, btc: a.btc, address: a.address }));
    if (!held.length) return { ...base, kind: 'not-held', account: { address: ms.display, typed: ms.hex, format: 'ZBC', multisig: true }, network };
    const view = buildMultisigView(p, setup, held, { origin, labelFor, chain, now: now() });
    const shared = !!(vault.sites[origin] && vault.sites[origin].accounts.includes(ms.hex));
    return { ...base, ...view, network, share: !shared, account: { label: setup.label, address: setup.address, typed: setup.typed, format: 'ZBC' } };
  }
  const account = normalizeAccount(String(p.account));
  const held = findAccount(account.hex);
  if (!held) return { ...base, kind: 'not-held', account: { address: account.display, typed: account.hex, format: FORMAT_OF_TYPE(account.type), type: account.type }, network };
  const site = vault.sites[origin];
  const share = !(site && site.accounts.includes(account.hex));
  const accView = { label: held.label, address: held.address, typed: held.typed, format: held.format, btc: held.btc, nodeKey: !!held.nodeKey };
  const ctx = { origin, labelFor, chain, now: now(), nodeKey: !!held.nodeKey, blindDigest: !!vault.settings.blindDigest };
  if (entry.method === 'zbc_signTransaction' || entry.method === 'zbc_submitTransaction') {
    const enriched = await enrichContext(p, chain, ctx);
    const { view } = buildTxView({ ...p, mode: entry.method === 'zbc_submitTransaction' ? 'submit' : p.mode }, account, enriched);
    if (view.described.category === 8 && view.type === 51 && !held.nodeKey) view.described.canSign = false;
    if (entry.method === 'zbc_submitTransaction') view.submitNode = await submitNodeFor(p.node, chain);
    return { ...base, ...view, network, share, account: accView, sessionKeysEnabled: !!vault.settings.sessionKeys };
  }
  if (entry.method === 'zbc_signDigest') return { ...base, ...buildDigestView(p, account, ctx), network, share, account: accView };
  if (entry.method === 'zbc_signMessage') return { ...base, ...buildMessageView(p, account, ctx), network, share, account: accView };
  throw rpcError(ERR.UNSUPPORTED);
}
const FORMAT_OF_TYPE = (t) => ({ 0: 'ZBC', 4: 'ETH', 5: 'BTC', 7: 'BTC', 9: 'BTC', 11: 'SOL', 12: 'DOT', 13: 'ADA', 14: 'XRP', 15: 'TRX', 16: 'XTZ' })[t] || null;

async function submitNodeFor(requested, chain) {
  if (requested) { const n = node.normalizeNodeUrl(requested); if (!n) throw rpcError(ERR.BAD_REQUEST, 'node must be https'); if (!(await hostPermitted(n))) throw rpcError(ERR.BAD_REQUEST, 'node is not in the signer\'s host permissions'); return n; }
  return chain.node;
}

/** Pre-sign checks and context enrichment (§7.7): tokens, escrow, fee minimum. Network failures never block. */
async function enrichContext(p, chain, ctx) {
  const out = { ...ctx, tokens: {}, context: p.context && typeof p.context === 'object' ? { ...p.context } : {} };
  let tx; try { tx = decodeTransaction(hexToBytes(p.unsignedTx)); } catch { return out; }
  const nodeUrl = chain.node;
  const withTimeout = (pr) => Promise.race([pr, new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null);
  const tasks = [];
  const tokenIds = new Set();
  const f = tx.fields || {};
  for (const k of ['tokenId', 'giveToken', 'wantToken', 'baseToken', 'quoteToken', 'stakeToken']) if (f[k] !== undefined && f[k] !== 0n) tokenIds.add(BigInt.asIntN(64, f[k]).toString());
  if (tx.fields && tx.fields.inner && tx.fields.inner.fields) for (const k of ['tokenId', 'giveToken', 'wantToken']) { const v = tx.fields.inner.fields[k]; if (v !== undefined && v !== 0n) tokenIds.add(BigInt.asIntN(64, v).toString()); }
  if (nodeUrl) {
    for (const id of tokenIds) tasks.push(withTimeout(node.token(nodeUrl, id)).then((t) => { if (t) { out.tokens[id] = t; if (t.persist_height && chain.height && Number(t.persist_height) <= chain.height && [11, 12, 13, 14].includes(tx.type)) out.tokenExpired = true; } }));
    if (tx.type === 4 && !out.context.escrow) tasks.push(withTimeout(node.escrowDetails(nodeUrl, tx.fields.escrowTxHash)).then((e) => { if (e) out.context.escrow = e; }));
    if (tx.type === 19 && !out.context.offer) tasks.push(withTimeout(node.offer(nodeUrl, tx.fields.offerId.toString())).then((o) => { if (o) out.context.offer = o; }));
    if (tx.type === 22 && !out.context.market) tasks.push(withTimeout(node.market(nodeUrl, tx.fields.marketId.toString())).then((m) => { if (m) out.context.market = m; }));
    if ([25, 26].includes(tx.type) && !out.context.game) tasks.push(withTimeout(node.game(nodeUrl, tx.fields.gameId.toString())).then((g) => { if (g) out.context.game = g; }));
    tasks.push(withTimeout(node.estimateFee(nodeUrl, { type: tx.type, bodyLength: tx.body.length, messageLength: tx.message.length })).then((fee) => { if (fee === null) out.feeCheckFailed = true; else out.feeMinimum = fee; }));
  } else out.feeCheckFailed = true;
  await Promise.all(tasks);
  return out;
}

// ---------------------------------------------------------------- approval window (§1, §13)
async function openApproval() {
  const s = await SESSION.get(['approvalWindow', 'lastOpen']);
  const t = Date.now();
  if (s.approvalWindow) {
    try { await chrome.windows.update(s.approvalWindow, { focused: true, drawAttention: true }); await chrome.runtime.sendMessage({ type: 'approve:refresh' }).catch(() => {}); return; }
    catch { await SESSION.remove('approvalWindow'); }
  }
  if (s.lastOpen && t - s.lastOpen < 1000) return; // click-jacking guard: at most one open per second
  await SESSION.set({ lastOpen: t });
  const w = await chrome.windows.create({ url: APPROVE_URL, type: 'popup', width: 380, height: 640, focused: true });
  await SESSION.set({ approvalWindow: w.id });
}
chrome.windows.onRemoved.addListener(async (id) => {
  const s = await SESSION.get(['approvalWindow', 'showing']);
  if (s.approvalWindow !== id) return;
  await SESSION.remove(['approvalWindow', 'showing']);
  // closing the window on a shown request rejects that request only; anything still queued gets a fresh window
  if (s.showing) await decide(s.showing, false, {}, 'window closed');
  const pending = await pendingMap();
  if (Object.keys(pending).length) { await SESSION.remove('lastOpen'); await openApproval(); }
});

async function trySessionKey(req) {
  if (!vault.settings.sessionKeys) return false;
  let tx; try { tx = decodeTransaction(hexToBytes(req.params.unsignedTx)); } catch { return false; }
  if (![26, 27, 28].includes(tx.type)) return false;
  const account = normalizeAccount(String(req.params.account));
  if (tx.sender.hex !== account.hex) return false;
  const { sessionKeys } = await SESSION.get('sessionKeys');
  const key = `${req.origin}|${account.hex}|${tx.fields.gameId.toString()}`;
  const grant = sessionKeys && sessionKeys[key];
  if (!grant || grant.expires < now()) return false;
  const held = findAccount(account.hex); if (!held) return false;
  const chain = await resolveChain(req.params.chain || {});
  const result = await signTx(held, tx, chain);
  log({ origin: req.origin, type: tx.type, title: `Auto-signed move in game #${tx.fields.gameId}`, hash: result.txHash, account: held.typed, auto: true });
  await saveVault();
  respond(req, result);
  try { chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'ZooBC Signer', message: `Signed a move in game #${tx.fields.gameId} for ${req.origin} (session key)` }); } catch {}
  return true;
}

// ---------------------------------------------------------------- signing (only reachable from decide())
async function signTx(held, tx, chain) {
  const digest = txDigest(tx.unsigned, chain.genesisBytes, chain.tag);
  const secret = secretFor(held);
  try {
    const sig = signDigest(secret, held.format, held.btc, digest);
    const hash = txHash(tx.unsigned, sig);
    const payloadJson = buildPayload(tx, bytesToHex(sig));
    return { signature: bytesToHex(sig), txHash: bytesToHex(hash), payload: JSON.parse(payloadJson), payloadJson };
  } finally { zero(secret); }
}

async function decide(id, approved, options = {}, reason = '') {
  const pending = await pendingMap();
  const entry = pending[id];
  if (!entry) return { done: false };
  const finishWith = async (result, error) => {
    delete pending[id]; await setPending(pending); inflight.delete(id);
    respond({ id, portId: (inflight.get(id) || entry).portId }, result, error);
  };
  if (!approved) {
    const notHeld = entry.view && entry.view.kind === 'not-held';
    await finishWith(undefined, notHeld ? rpcError(ERR.NOT_HELD) : rpcError(ERR.REJECTED, reason ? `User rejected (${reason})` : 'User rejected'));
    return { done: true };
  }
  if (!(await ensureUnlocked())) return { done: false, locked: true };
  const view = entry.view || (entry.view = await buildView(entry).catch((e) => ({ kind: 'error', error: asRpcError(e).toJSON() })));
  try {
    if (view.kind === 'error') throw new (class extends Error { constructor() { super(view.error.message); this.code = view.error.code; } })();
    if (view.kind === 'not-held') throw rpcError(ERR.NOT_HELD);
    if (view.share) {
      if (!options.shareAccount) throw rpcError(ERR.NOT_SHARED);
      grant(entry.origin, [view.account.typed]);
    }
    let result;
    switch (view.kind) {
      case 'connect': {
        const chosen = Array.isArray(options.accounts) ? options.accounts.filter((h) => typeof h === 'string') : [];
        if (!chosen.length) throw rpcError(ERR.REJECTED, 'No account shared');
        grant(entry.origin, chosen);
        result = sharedAccounts(entry.origin);
        log({ origin: entry.origin, type: null, title: `Connected ${chosen.length} account(s)` });
        emitToOrigin(entry.origin, 'accountsChanged', result);
        break;
      }
      case 'tx': {
        if (view.described.canSign === false) throw rpcError(ERR.CANNOT_SIGN, 'This transaction cannot be signed');
        if (!view.match.ok && !options.checkedMismatch) throw rpcError(ERR.REJECTED, 'Mismatch not acknowledged');
        const held = findAccount(view.account.typed);
        const chain = await resolveChain(entry.params.chain || {});
        const tx = decodeTransaction(hexToBytes(view.unsignedTx));
        result = await signTx(held, tx, chain);
        if (options.sessionKey && vault.settings.sessionKeys && [26, 27, 28].includes(tx.type)) {
          const { sessionKeys } = await SESSION.get('sessionKeys');
          await SESSION.set({ sessionKeys: { ...(sessionKeys || {}), [`${entry.origin}|${held.typed}|${tx.fields.gameId.toString()}`]: { expires: now() + 7200 } } });
        }
        if (view.mode === 'submit') {
          const r = await node.submit(view.submitNode, result.payloadJson);
          result.response = r.response; result.submitted = r.ok; result.duplicate = r.duplicate;
          if (!r.ok) result.error = r.error;
        }
        log({ origin: entry.origin, type: tx.type, title: view.described.title, hash: result.txHash, account: held.typed, submitted: view.mode === 'submit' ? !!result.submitted : undefined });
        break;
      }
      case 'multisig': {
        if (view.canSign === false) throw rpcError(ERR.CANNOT_SIGN);
        if (!view.match.ok && !options.checkedMismatch) throw rpcError(ERR.REJECTED, 'Mismatch not acknowledged');
        const chain = await resolveChain(entry.params.chain || {});
        const inner = hexToBytes(view.innerHex);
        const digest = txDigest(inner, chain.genesisBytes, chain.tag);
        const signatures = [];
        for (const p of view.participants) {
          if (!p.held || signatures.length >= view.need) continue;
          const held = findAccount(p.hex); const secret = secretFor(held);
          try { signatures.push({ signer: held.typed, address: held.address, format: held.format, ...(held.format === 'BTC' ? { btc: held.btc } : {}), signature: bytesToHex(signDigest(secret, held.format, held.btc, digest)) }); } finally { zero(secret); }
        }
        result = { signatures, need: view.need };
        log({ origin: entry.origin, type: 5, title: `${view.title} (${signatures.length} keys)`, hash: bytesToHex(txHash(inner, new Uint8Array(0))), account: view.setup.hex });
        break;
      }
      case 'digest': {
        const held = findAccount(view.account.typed);
        const secret = secretFor(held);
        try {
          if (view.scheme === 'raw') {
            if (held.format !== 'ZBC') throw rpcError(ERR.CANNOT_SIGN);
            result = { signature: bytesToHex(signRawEd25519(secret, hexToBytes(view.digest))) };
          } else {
            const sig = signDigest(secret, held.format, held.btc, hexToBytes(view.digest));
            result = { signature: bytesToHex(sig) };
            if (view.proofKind !== undefined) result.proof = bytesToHex(consentProof(view.proofKind, sig));
          }
        } finally { zero(secret); }
        log({ origin: entry.origin, type: null, title: view.title, account: held.typed });
        break;
      }
      case 'message': {
        const held = findAccount(view.account.typed);
        const secret = secretFor(held);
        try { result = { signature: bytesToHex(signDigest(secret, held.format, held.btc, hexToBytes(view.digest))) }; } finally { zero(secret); }
        log({ origin: entry.origin, type: null, title: 'Signed a message', account: held.typed });
        break;
      }
      default: throw rpcError(ERR.INTERNAL, 'unknown view');
    }
    if (vault.sites[entry.origin] && view.account) vault.sites[entry.origin].lastUsed = view.account.typed;
    await saveVault();
    await finishWith(result);
    return { done: true, result: { txHash: result.txHash, signature: result.signature } };
  } catch (e) {
    await finishWith(undefined, e);
    return { done: true, error: asRpcError(e).toJSON() };
  }
}
function grant(origin, hexes) {
  const site = vault.sites[origin] || { accounts: [], grantedAt: now(), lastUsed: null };
  for (const h of hexes) if (!site.accounts.includes(h)) site.accounts.push(h);
  vault.sites[origin] = site;
}

// ---------------------------------------------------------------- messages from extension pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender || !sender.url || !sender.url.startsWith(chrome.runtime.getURL(''))) return false;
  const fromApprove = sender.url.startsWith(APPROVE_URL);
  handleUi(msg, { fromApprove, url: sender.url }).then((r) => sendResponse({ ok: true, result: r })).catch((e) => sendResponse({ ok: false, error: asRpcError(e).toJSON() }));
  return true;
});

async function handleUi(msg, who) {
  const type = msg && msg.type;
  const unlocked = await ensureUnlocked();
  if (unlocked) await touch();
  switch (type) {
    // ---- status / lock
    case 'status': {
      const pending = await pendingMap();
      const s = await SESSION.get(['showing']);
      return { exists: await vaultExists(), locked: !unlocked, network: unlocked ? vault.settings.network : 'testnet', pending: Object.keys(pending).length, showing: s.showing || null, passkey: !!(await LOCAL.get('passkey')).passkey };
    }
    case 'vault:create': {
      if (await vaultExists()) throw new Error('A vault already exists');
      if (String(msg.password).length < 10) throw new Error('Password must be at least 10 characters');
      const { blob, keyRaw: k } = await createVault(String(msg.password));
      await LOCAL.set({ vault: blob });
      keyRaw = k; salt = fromBase64(blob.salt); vault = emptyVault(); migrate();
      await SESSION.set({ keyRaw: toBase64(keyRaw) }); await touch();
      return true;
    }
    case 'vault:unlock': { await unlock(String(msg.password)); await rebuildPendingViews(); return true; }
    case 'vault:lock': await lock(); return true;
    case 'vault:reset': { await LOCAL.remove(['vault', 'passkey']); await lock(); await SESSION.clear(); return true; }
    case 'vault:export': { requireUnlocked(unlocked); await unlock(String(msg.password)); return { seeds: vault.seeds, keys: vault.keys, accounts: vault.accounts.map((a) => ({ label: a.label, source: a.source, seedId: a.seedId, keyId: a.keyId, format: a.format, btc: a.btc, index: a.index, typed: a.typed, address: a.address })), multisigs: vault.multisigs }; }
    // ---- passkey (WebAuthn PRF) wrapping of the vault key
    case 'passkey:wrap': { requireUnlocked(unlocked); const prf = fromBase64(String(msg.prf)); const wk = await importAesKey(prf.slice(0, 32)); const iv = randomBytes(12); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wk, keyRaw)); await LOCAL.set({ passkey: { credId: String(msg.credId), iv: toBase64(iv), ct: toBase64(ct) } }); return true; }
    case 'passkey:get': { const { passkey } = await LOCAL.get('passkey'); return passkey ? { credId: passkey.credId } : null; }
    case 'passkey:unlock': {
      const { passkey } = await LOCAL.get('passkey'); if (!passkey) throw new Error('No passkey registered');
      const prf = fromBase64(String(msg.prf)); const wk = await importAesKey(prf.slice(0, 32));
      const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(passkey.iv) }, wk, fromBase64(passkey.ct)));
      const { vault: blob } = await LOCAL.get('vault'); vault = await decryptVault(raw, blob); keyRaw = raw; salt = fromBase64(blob.salt); migrate();
      await SESSION.set({ keyRaw: toBase64(keyRaw) }); await touch(); await rebuildPendingViews(); return true;
    }
    case 'passkey:remove': await LOCAL.remove('passkey'); return true;
    // ---- accounts
    case 'accounts:list': {
      requireUnlocked(unlocked);
      return {
        seeds: vault.seeds.map((s) => ({ id: s.id, name: s.name, words: normalizeMnemonic(s.mnemonic).split(' ').length, hasPassphrase: !!s.passphrase, createdAt: s.createdAt, accounts: vault.accounts.filter((a) => a.seedId === s.id).map(publicAccount) })),
        keys: vault.accounts.filter((a) => a.source === 'key').map(publicAccount),
        multisigs: vault.multisigs.map((m) => ({ ...multisigObject(m), id: m.id, participants: m.participants.map((h) => ({ hex: h, label: labelFor(h), display: safeDisplay(h), held: !!findAccount(h) })) })),
        settings: vault.settings,
      };
    }
    case 'mnemonic:new': return newMnemonic(Number(msg.words) === 12 ? 12 : 24);
    case 'seed:preview': {
      const mnemonic = normalizeMnemonic(msg.mnemonic); if (!isValidMnemonic(mnemonic)) throw new Error('Not a valid BIP-39 phrase');
      const seed = { mnemonic, passphrase: String(msg.passphrase || '') };
      return (msg.formats || []).map((f) => { const a = deriveAccount(seed, f.format, f.btc, Number(f.index || 0)); return { format: f.format, btc: f.btc, index: Number(f.index || 0), address: a.address, typed: a.hex, path: a.path }; });
    }
    case 'seed:add': {
      requireUnlocked(unlocked);
      const mnemonic = normalizeMnemonic(msg.mnemonic); if (!isValidMnemonic(mnemonic)) throw new Error('Not a valid BIP-39 phrase');
      const passphrase = String(msg.passphrase || '');
      let seed = vault.seeds.find((s) => normalizeMnemonic(s.mnemonic) === mnemonic && (s.passphrase || '') === passphrase);
      if (!seed) { seed = { id: uid(), name: String(msg.name || `Seed ${vault.seeds.length + 1}`).slice(0, 40), mnemonic, passphrase, createdAt: now() }; vault.seeds.push(seed); }
      const added = addDerived(seed, msg.formats || []);
      await saveVault(); return { seedId: seed.id, added };
    }
    case 'seed:derive': { requireUnlocked(unlocked); const seed = seedById(msg.seedId); const added = addDerived(seed, msg.formats || []); await saveVault(); return added; }
    case 'seed:nextIndex': { requireUnlocked(unlocked); const idx = vault.accounts.filter((a) => a.seedId === msg.seedId && a.format === msg.format && (a.format !== 'BTC' || a.btc === msg.btc)).map((a) => a.index); return idx.length ? Math.max(...idx) + 1 : 0; }
    case 'seed:rename': { requireUnlocked(unlocked); seedById(msg.seedId).name = String(msg.name).slice(0, 40); await saveVault(); return true; }
    case 'seed:delete': { requireUnlocked(unlocked); await unlock(String(msg.password)); vault.accounts = vault.accounts.filter((a) => a.seedId !== msg.seedId); vault.seeds = vault.seeds.filter((s) => s.id !== msg.seedId); await saveVault(); return true; }
    case 'key:preview': { const raw = parseRawKey(msg.hex); if (!raw) throw new Error('A private key is 64 hex characters'); const a = accountFromSecret(raw, msg.format, msg.btc); return { address: a.address, typed: a.hex }; }
    case 'key:import': {
      requireUnlocked(unlocked);
      const raw = parseRawKey(msg.hex); if (!raw) throw new Error('A private key is 64 hex characters');
      const a = accountFromSecret(raw, msg.format, msg.btc);
      if (vault.accounts.some((x) => x.typed === a.hex)) throw new Error('This account is already in the vault');
      const key = { id: uid(), name: String(msg.name || a.format).slice(0, 40), format: msg.format, btc: a.btc, hex: bytesToHex(raw), nodeKey: !!msg.nodeKey };
      vault.keys.push(key);
      vault.accounts.push({ id: uid(), label: key.name, source: 'key', keyId: key.id, format: a.format, btc: a.btc, typed: a.hex, address: a.address, nodeKey: !!msg.nodeKey });
      await saveVault(); return publicAccount(vault.accounts[vault.accounts.length - 1]);
    }
    case 'account:update': { requireUnlocked(unlocked); const a = vault.accounts.find((x) => x.id === msg.id); if (!a) throw new Error('no such account'); if (msg.label !== undefined) a.label = String(msg.label).slice(0, 40); if (msg.hidden !== undefined) a.hidden = !!msg.hidden; await saveVault(); return true; }
    case 'account:delete': {
      requireUnlocked(unlocked); const a = vault.accounts.find((x) => x.id === msg.id); if (!a) throw new Error('no such account');
      vault.accounts = vault.accounts.filter((x) => x.id !== msg.id); if (a.source === 'key') vault.keys = vault.keys.filter((k) => k.id !== a.keyId);
      for (const s of Object.values(vault.sites)) s.accounts = s.accounts.filter((h) => h !== a.typed);
      await saveVault(); return true;
    }
    case 'reveal': {
      requireUnlocked(unlocked); await unlock(String(msg.password));
      if (msg.seedId) { const s = seedById(msg.seedId); return { mnemonic: s.mnemonic, passphrase: s.passphrase || '' }; }
      const a = vault.accounts.find((x) => x.id === msg.accountId); if (!a) throw new Error('no such account');
      const secret = secretFor(a); const hex = bytesToHex(secret); zero(secret); return { hex, path: a.source === 'seed' ? deriveAccount(seedById(a.seedId), a.format, a.btc, a.index).path : null };
    }
    case 'balance': {
      requireUnlocked(unlocked); const n = nodeFor(vault.settings.network); if (!n) return null;
      const acc = await node.account(n, msg.address).catch(() => null); return acc ? String(acc.balance) : null;
    }
    // ---- multisig setups (§9.10)
    case 'multisig:add': {
      requireUnlocked(unlocked);
      const parts = (msg.participants || []).map((p) => normalizeAccount(String(p)));
      if (parts.length < 1 || parts.length > 64) throw new Error('1–64 participants');
      const min = Number(msg.min); if (!Number.isInteger(min) || min < 1 || min > parts.length) throw new Error('Threshold must be between 1 and the number of participants');
      const nonce = BigInt(msg.nonce || 0);
      const sorted = parts.map((p) => p.typed).sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; });
      const t = typed(0, multisigAddress(min, nonce, sorted));
      const hex = bytesToHex(t);
      if (vault.multisigs.some((m) => m.typed === hex)) throw new Error('This multisig is already set up');
      const m = { id: uid(), label: String(msg.label || 'Multisig').slice(0, 40), address: display(t), typed: hex, min, nonce: nonce.toString(), participants: sorted.map(bytesToHex) };
      vault.multisigs.push(m); await saveVault(); return multisigObject(m);
    }
    case 'multisig:preview': {
      const parts = (msg.participants || []).map((p) => normalizeAccount(String(p)));
      const sorted = parts.map((p) => p.typed).sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; });
      return display(typed(0, multisigAddress(Number(msg.min), BigInt(msg.nonce || 0), sorted)));
    }
    case 'multisig:delete': { requireUnlocked(unlocked); vault.multisigs = vault.multisigs.filter((m) => m.id !== msg.id); await saveVault(); return true; }
    case 'multisig:createTx': {
      // "Register on-chain": build the type 5 create transaction (info, no inner) from the first held participant; returns unsigned hex for the wallet/page to sign through the normal path.
      requireUnlocked(unlocked); const m = vault.multisigs.find((x) => x.id === msg.id); if (!m) throw new Error('no such multisig');
      const first = vault.accounts.find((a) => m.participants.includes(a.typed)); if (!first) throw new Error('No participant key held');
      const chain = await resolveChain({});
      const parts = m.participants.map((h) => hexToBytes(h));
      const body = concatBytes(u32(1), u32(m.min), u64(BigInt(m.nonce)), u32(parts.length), ...parts, u32(0), u32(0));
      const fee = BigInt(msg.fee || 5000000);
      const unsigned = concatBytes(u32(5), new Uint8Array([2]), u64(BigInt(now())), hexToBytes(first.typed), new Uint8Array([2, 0, 0, 0]), u64(fee), u64(0n), u32(body.length), body, new Uint8Array([2, 0, 0, 0]), u32(0));
      return { unsignedTx: bytesToHex(unsigned), account: first.typed, chain: { genesis: chain.genesis, tag: chain.tag, id: chain.id, node: chain.node } };
    }
    case 'wallet:import': {
      requireUnlocked(unlocked);
      const b = msg.backup || {}; const added = [];
      for (const s of b.seeds || []) { const mnemonic = normalizeMnemonic(s.mnemonic || s.phrase); if (!isValidMnemonic(mnemonic)) continue; if (!vault.seeds.some((x) => normalizeMnemonic(x.mnemonic) === mnemonic && (x.passphrase || '') === (s.passphrase || ''))) vault.seeds.push({ id: uid(), name: String(s.name || 'Imported seed').slice(0, 40), mnemonic, passphrase: s.passphrase || '', createdAt: now(), imported: s.id }); }
      for (const k of b.keys || []) { const raw = parseRawKey(k.hex || k.key); if (!raw) continue; const fmt = (k.format || k.fmt || 'ZBC').toUpperCase(); try { const a = accountFromSecret(raw, fmt, k.btc); if (vault.accounts.some((x) => x.typed === a.hex)) continue; const key = { id: uid(), name: String(k.name || fmt).slice(0, 40), format: fmt, btc: a.btc, hex: bytesToHex(raw), nodeKey: !!k.nodeKey }; vault.keys.push(key); vault.accounts.push({ id: uid(), label: key.name, source: 'key', keyId: key.id, format: fmt, btc: a.btc, typed: a.hex, address: a.address }); added.push(a.address); } catch {} }
      for (const a of b.accounts || []) { if (!(a.source === 'seed' || a.seedId !== undefined || a.seed !== undefined)) continue; const seedRef = vault.seeds.find((s) => s.imported === (a.seedId ?? a.seed)) || vault.seeds[vault.seeds.length - 1]; if (!seedRef) continue; const fmt = (a.format || a.fmt || 'ZBC').toUpperCase(); const idx = Number(a.index ?? a.idx ?? 0); try { const acc = deriveAccount(seedRef, fmt, a.btc, idx); if (vault.accounts.some((x) => x.typed === acc.hex)) continue; vault.accounts.push({ id: uid(), label: String(a.label || a.name || `${fmt} #${idx}`).slice(0, 40), source: 'seed', seedId: seedRef.id, format: fmt, btc: acc.btc, index: idx, typed: acc.hex, address: acc.address }); added.push(acc.address); } catch {} }
      await saveVault(); return added;
    }
    // ---- sites, log, settings
    case 'sites:list': { requireUnlocked(unlocked); return Object.entries(vault.sites).map(([origin, s]) => ({ origin, accounts: s.accounts.map((h) => ({ hex: h, label: labelFor(h), display: safeDisplay(h) })), grantedAt: s.grantedAt, lastUsed: s.lastUsed, lastActivity: (vault.log.find((l) => l.origin === origin) || {}).at || s.grantedAt })); }
    case 'sites:disconnect': { requireUnlocked(unlocked); delete vault.sites[msg.origin]; await saveVault(); emitToOrigin(msg.origin, 'accountsChanged', []); return true; }
    case 'log:list': requireUnlocked(unlocked); return vault.log.slice(0, Number(msg.limit) || 100).map((l) => ({ ...l, accountLabel: l.account ? labelFor(l.account) : null }));
    case 'settings:set': {
      requireUnlocked(unlocked); const prev = vault.settings.network;
      vault.settings = { ...vault.settings, ...sanitizeSettings(msg.settings || {}) }; await saveVault(); await touch();
      if (msg.settings && msg.settings.nodes) for (const u of Object.values(msg.settings.nodes)) { const n = node.normalizeNodeUrl(u); if (n) await chrome.permissions.request({ origins: [`${new URL(n).origin}/*`] }).catch(() => {}); }
      if (prev !== vault.settings.network) { const c = await genesisCache(); const g = c[vault.settings.network]; for (const [, p] of ports) safePost(p.port, { kind: 'event', event: 'chainChanged', data: { genesis: g ? g.genesis : null, id: vault.settings.network } }); }
      return vault.settings;
    }
    case 'network:info': { const id = msg.id || (unlocked ? vault.settings.network : 'testnet'); const c = await resolveChain({ id }).catch((e) => ({ error: e.message })); return c.error ? c : { id: c.id, label: c.label, genesis: c.genesis, short: genesisShort(c.genesis), tag: c.tag, node: c.node, height: c.height }; }
    case 'selftest': return runSelfTests();
    // ---- pending / approval
    case 'pending:list': { const pending = await pendingMap(); return Object.values(pending).sort((a, b) => a.createdAt - b.createdAt).map((p) => ({ id: p.id, origin: p.origin, method: p.method, createdAt: p.createdAt, title: p.view && (p.view.title || (p.view.described && p.view.described.title)) })); }
    case 'pending:open': await openApproval(); return true;
    case 'approve:list': {
      if (!who.fromApprove) throw new Error('not allowed');
      if (unlocked) await rebuildPendingViews();
      const pending = await pendingMap();
      const list = Object.values(pending).sort((a, b) => a.createdAt - b.createdAt);
      const head = list[0] || null;
      if (head) await SESSION.set({ showing: head.id }); else await SESSION.remove('showing');
      return { locked: !unlocked, head: head ? { id: head.id, origin: head.origin, method: head.method, view: head.view, error: head.error } : null, waiting: Math.max(0, list.length - 1), waitingSameOrigin: head ? list.filter((p) => p.origin === head.origin).length - 1 : 0 };
    }
    case 'approve:decide': { if (!who.fromApprove) throw new Error('Only the approval window can sign'); return decide(String(msg.id), !!msg.approved, msg.options || {}, msg.reason || ''); }
    case 'approve:rejectOrigin': { if (!who.fromApprove) throw new Error('not allowed'); const pending = await pendingMap(); for (const p of Object.values(pending)) if (p.origin === msg.origin) await decide(p.id, false, {}, 'all from this site'); return true; }
    case 'permissions:request': { const n = node.normalizeNodeUrl(msg.node); if (!n) throw new Error('https URL required'); return chrome.permissions.request({ origins: [`${new URL(n).origin}/*`] }); }
    default: throw new Error('unknown message ' + type);
  }
}
function requireUnlocked(u) { if (!u) throw rpcError(ERR.LOCKED, 'Signer locked'); }
function publicAccount(a) { return { id: a.id, label: a.label, source: a.source, seedId: a.seedId, format: a.format, btc: a.btc, index: a.index, typed: a.typed, address: a.address, hidden: !!a.hidden, nodeKey: !!a.nodeKey, broken: a.broken || null }; }
function safeDisplay(hex) { const p = parseTypedHex(hex); return p ? p.display : hex; }
function sanitizeSettings(s) {
  const out = {};
  if (s.autoLockMinutes !== undefined) out.autoLockMinutes = Math.min(240, Math.max(1, Number(s.autoLockMinutes) || 15));
  if (s.network !== undefined && NETWORKS[s.network]) out.network = s.network;
  if (s.nodes !== undefined) { out.nodes = {}; for (const [k, v] of Object.entries(s.nodes)) { const n = node.normalizeNodeUrl(v); if (n && NETWORKS[k]) out.nodes[k] = n; } }
  for (const k of ['blindDigest', 'sessionKeys', 'trustPageGenesis']) if (s[k] !== undefined) out[k] = !!s[k];
  if (s.language !== undefined) out.language = String(s.language).slice(0, 5);
  return out;
}
function addDerived(seed, formats) {
  const added = [];
  for (const f of formats) {
    if (!FORMATS.includes(f.format)) continue;
    const index = Number(f.index || 0);
    const a = deriveAccount(seed, f.format, f.btc, index);
    if (vault.accounts.some((x) => x.typed === a.hex)) continue;
    const acc = { id: uid(), label: String(f.label || `${f.format}${index ? ' #' + index : ''}`).slice(0, 40), source: 'seed', seedId: seed.id, format: f.format, btc: a.btc, index, typed: a.hex, address: a.address };
    vault.accounts.push(acc); added.push(publicAccount(acc));
  }
  return added;
}
async function rebuildPendingViews() {
  // After an unlock, build the views of requests that arrived while locked (§12 item 7). Invalid ones are rejected now.
  const pending = await pendingMap();
  let changed = false;
  for (const p of Object.values(pending)) {
    if (p.view) continue;
    try { p.view = await buildView(p); } catch (e) { delete pending[p.id]; inflight.delete(p.id); respond({ id: p.id, portId: p.portId }, undefined, e); }
    changed = true;
  }
  if (changed) await setPending(pending);
}
const u32 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
const u64 = (v) => { v = BigInt.asUintN(64, v); const o = new Uint8Array(8); for (let i = 0; i < 8; i++) { o[i] = Number(v & 0xffn); v >>= 8n; } return o; };
function concatBytes(...a) { let n = 0; for (const x of a) n += x.length; const o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; }

// Serialise view builds so two requests from the same tab do not interleave vault writes.
void building; void utf8; void POPUP_URL; void OPTIONS_URL; void parseAddress; void typeForFormat; void formatZBC;
