// Node / gateway HTTP client (spec §4.1, §7.6, §7.7). Every call is bounded and best-effort.
import { hexToBytes } from './bytes.js';

export const NETWORKS = {
  testnet: { id: 'testnet', label: 'TestNet', node: 'https://zoobc.net', genesisHint: '6E75CA67A798331A' },
  mainnet: { id: 'mainnet', label: 'MainNet', node: 'https://zoobc.network', genesisHint: null },
};
export const DEFAULT_GATEWAYS = ['https://zoobc.network', 'https://zoobc.net'];

const infoCache = new Map(); // url → { at, info }

async function getJson(url, { timeout = 6000, method = 'GET', body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method, body, signal: ctl.signal, headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' } });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, json, text };
  } finally { clearTimeout(t); }
}

export function normalizeNodeUrl(u) {
  const s = String(u || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+/.test(s)) return null;
  return s;
}

/** GET /api/v1/node/info with a 60 s cache. Returns { genesis (lowercase hex), tag, signingVersion, height, raw }. */
export async function nodeInfo(node, { force = false } = {}) {
  const base = normalizeNodeUrl(node);
  if (!base) throw new Error('node URL must be https');
  const c = infoCache.get(base);
  if (!force && c && Date.now() - c.at < 60000) return c.info;
  const r = await getJson(base + '/api/v1/node/info');
  if (!r.ok || !r.json) throw new Error(`node/info failed (${r.status})`);
  const g = String(r.json.genesis_hash || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(g)) throw new Error('node/info has no 32-byte genesis_hash');
  const info = { genesis: g, tag: r.json.signing_tag || 'ZBC-TX', signingVersion: r.json.signing_version || 1, height: r.json.blockchain_height || r.json.height || null, raw: r.json };
  infoCache.set(base, { at: Date.now(), info });
  return info;
}

export async function token(node, id) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/tokens/${encodeURIComponent(id)}`);
  if (!r.ok || !r.json) return null;
  const t = r.json.token || r.json;
  return { id: String(t.id ?? t.token_id ?? id), symbol: t.symbol, name: t.name, decimals: Number(t.decimals ?? 0), supply: t.supply, backing: t.backing ?? t.backing_locked, redeemable: t.redeemable ?? (t.flags !== undefined ? !!(t.flags & 1) : undefined), mintable: t.mintable ?? (t.flags !== undefined ? !!(t.flags & 2) : undefined), persist_height: t.persist_height ?? t.persistHeight ?? null };
}

export async function transaction(node, hash) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions/${hash}`);
  return r.ok ? r.json : null;
}

export async function escrowDetails(node, hash) {
  const t = await transaction(node, hash);
  if (!t) return null;
  const e = t.escrow || {};
  return { payer: t.sender || t.sender_account_address, recipient: t.recipient || t.recipient_account_address, amount: t.amount ?? (t.detail && t.detail.amount), commission: e.commission, instruction: e.instruction, timeout: e.timeout, status: e.status || t.escrow_status || 'pending', raw: t };
}

export async function offer(node, id) { const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/offers/${id}`); return r.ok ? (r.json.offer || r.json) : null; }
export async function market(node, id) { const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/markets/${id}`); return r.ok ? (r.json.market || r.json) : null; }
export async function game(node, id) { const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/apps/${id}`); return r.ok ? (r.json.app || r.json) : null; }

export async function estimateFee(node, { type, bodyLength, messageLength }) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions/estimate-fee?type=${type}&body_length=${bodyLength}&message_length=${messageLength}`);
  if (!r.ok || !r.json) return null;
  const v = r.json.fee ?? r.json.min_fee ?? r.json.estimated_fee;
  return v === undefined ? null : BigInt(v);
}

export async function latestBlock(node) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/blocks/latest`);
  if (!r.ok || !r.json) return null;
  const b = r.json.block || r.json;
  return { height: Number(b.height), hash: b.block_hash || b.hash, timestamp: b.timestamp };
}

export async function account(node, address) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/accounts/${encodeURIComponent(address)}`);
  if (!r.ok || !r.json) return null;
  return { balance: r.json.spendable_balance ?? r.json.balance ?? 0, total: r.json.total_balance ?? r.json.balance ?? 0, raw: r.json };
}

/** POST /api/v1/transactions with the exact payload string. */
export async function submit(node, payloadJson) {
  const r = await getJson(`${normalizeNodeUrl(node)}/api/v1/transactions`, { method: 'POST', body: payloadJson, timeout: 15000 });
  const j = r.json || {};
  const ok = r.ok || j.status === 'success';
  return { ok, status: r.status, duplicate: !!j.duplicate, hash: j.transaction_hash || null, error: ok ? null : (j.error || r.text || `HTTP ${r.status}`), response: j };
}

export function genesisBytes(hex) { return hexToBytes(String(hex).toLowerCase()); }
