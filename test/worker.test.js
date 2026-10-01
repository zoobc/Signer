// End-to-end flow through the service worker with a stubbed chrome.* API (spec §12 items 4–7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyDigest } from '../src/lib/sign.js';
import { messageDigest, groupConsentDigest } from '../src/lib/zbc.js';
import { hexToBytes, bytesToHex, utf8 } from '../src/lib/bytes.js';

const core = JSON.parse(readFileSync(new URL('./fixtures/transactions.json', import.meta.url))).vectors;
const plain = core.find((v) => v.name === 'send-zbc/plain'), otherSender = core.find((v) => v.name === 'send-zbc/other-sender');
const A_HEX = '000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152';
const B_HEX = '00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737';
const GENESIS = '5a'.repeat(32);
const ORIGIN = 'https://shop.example.com';

// ---- chrome stub
function memStore() { let data = {}; return { async get(keys) { if (!keys) return { ...data }; const ks = Array.isArray(keys) ? keys : [keys]; const o = {}; for (const k of ks) if (k in data) o[k] = structuredClone(data[k]); return o; }, async set(obj) { for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v); }, async remove(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]; }, async clear() { data = {}; } }; }
const L = { injected: [], activeTab: null };
globalThis.chrome = {
  storage: { session: memStore(), local: memStore() },
  alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener() {} } },
  runtime: { getURL: (p) => 'chrome-extension://abc/' + p, onConnect: { addListener(fn) { L.connect = fn; } }, onMessage: { addListener(fn) { L.message = fn; } }, onStartup: { addListener() {} }, sendMessage: async () => {}, getManifest: () => ({ version: '1.0.0', host_permissions: ['https://zoobc.network/*', 'https://zoobc.net/*'] }) },
  windows: { create: async () => ({ id: 1 }), update: async () => {}, onRemoved: { addListener(fn) { L.removed = fn; } } },
  permissions: { contains: async ({ origins }) => origins.every((o) => ['https://zoobc.network/*', 'https://zoobc.net/*'].includes(o)) },
  tabs: { query: async () => [L.activeTab] },
  scripting: { executeScript: async (opts) => { L.injected.push(opts); return [{}]; } },
  notifications: { create() {} },
};
globalThis.fetch = async () => { throw new Error('offline'); };
let modv = 0;
async function loadWorker() { await import(`../src/background.js?v=${++modv}`); }
const ui = (msg, fromApprove = false) => new Promise((resolve) => L.message(msg, { url: chrome.runtime.getURL(fromApprove ? 'approve.html?x' : 'popup.html') }, resolve));
const ok = async (msg, fromApprove) => { const r = await ui(msg, fromApprove); if (!r.ok) throw Object.assign(new Error(r.error.message), { code: r.error.code }); return r.result; };
function makePort() { const p = { name: 'zoobc-signer', sender: { tab: { id: 1 }, origin: ORIGIN }, inbox: [], onMessage: { addListener(fn) { p.handler = fn; } }, onDisconnect: { addListener() {} }, postMessage(m) { p.inbox.push(m); } }; L.connect(p); return p; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(port, id, method, params) { port.handler({ kind: 'request', id, method, params }); return waitResponse(port, id, 300); }
async function waitResponse(port, id, tries = 100) { for (let i = 0; i < tries; i++) { const m = port.inbox.find((x) => x.kind === 'response' && x.id === id); if (m) return m; await sleep(20); } return null; }
async function head() { return ok({ type: 'approve:list' }, true); }

test('vault, connect, sign, checks, lock/unlock, restart', { timeout: 60000 }, async () => {
  await loadWorker();
  await ok({ type: 'vault:create', password: 'correct horse battery' });
  await ok({ type: 'settings:set', settings: { trustPageGenesis: true } });
  const added = await ok({ type: 'seed:add', name: 'Main', mnemonic: 'abandon '.repeat(11) + 'about', formats: [{ format: 'ZBC', index: 0 }, { format: 'ETH', index: 0 }] });
  assert.equal(added.added[0].typed, A_HEX);
  const port = makePort();

  // not connected yet
  assert.deepEqual((await request(port, 'r1', 'zbc_accounts')).result, []);
  assert.deepEqual((await request(port, 'r2', 'zbc_hasAccount', { account: A_HEX })).result, { held: false, shared: false, locked: false });
  assert.equal((await request(port, 'r3', 'zbc_bogus', {})).error.code, 4200);
  assert.equal((await request(port, 'r4', 'zbc_signTransaction', { account: 'nope', unsignedTx: 'zz' })).error.code, 4300);
  // an unshared account is offered for sharing first (§7.4 step 3); declining is 4405
  port.handler({ kind: 'request', id: 'r4b', method: 'zbc_signTransaction', params: { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain: { genesis: GENESIS } } });
  await sleep(50);
  assert.equal((await head()).head.view.share, true);
  await ok({ type: 'approve:decide', id: 'r4b', approved: true, options: { shareAccount: false } }, true);
  assert.equal((await waitResponse(port, 'r4b')).error.code, 4405);

  // connect
  port.handler({ kind: 'request', id: 'c1', method: 'zbc_requestAccounts', params: {} });
  await sleep(50);
  let h = await head();
  assert.equal(h.head.view.kind, 'connect'); assert.equal(h.head.view.accounts.length, 2);
  await ok({ type: 'approve:decide', id: 'c1', approved: true, options: { accounts: [A_HEX] } }, true);
  const c1 = await waitResponse(port, 'c1');
  assert.equal(c1.result.length, 1); assert.equal(c1.result[0].typed, A_HEX); assert.equal(c1.result[0].format, 'ZBC');
  assert.deepEqual((await request(port, 'r5', 'zbc_hasAccount', { account: 'ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX' })).result, { held: true, shared: true, locked: false });
  // only the approval window may decide
  assert.equal((await ui({ type: 'approve:decide', id: 'x', approved: true })).ok, false);

  // sign the §4.6 vector
  const chain = { genesis: GENESIS, tag: 'ZBC-TX', id: 'testnet' };
  port.handler({ kind: 'request', id: 's1', method: 'zbc_signTransaction', params: { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain, intent: { title: 'Pay order', typeName: 'SendZBC', rows: [['Amount', '1 ZBC']] } } });
  await sleep(50);
  h = await head();
  assert.equal(h.head.view.kind, 'tx'); assert.equal(h.head.view.described.title, 'Send 1 ZBC'); assert.equal(h.head.view.match.ok, true); assert.equal(h.head.view.network.unverified, true);
  await ok({ type: 'approve:decide', id: 's1', approved: true, options: {} }, true);
  const s1 = await waitResponse(port, 's1');
  assert.equal(s1.result.signature, '8934cb7019641f7be76e1fec2a7e94395140da90cfc4dad041aee5f28479eac2f86460393d9a2ea6ab246300b3531338c25e64765df25ed9b7852d681ec8bc0b');
  assert.equal(s1.result.payload.transaction_type, 1); assert.ok(s1.result.txHash.length === 64);

  // sender ≠ requested account → 4300 before any prompt
  assert.equal((await request(port, 's2', 'zbc_signTransaction', { account: A_HEX, unsignedTx: otherSender.expected.unsigned_bytes, chain })).error.code, 4300);
  // account not held → 4404 screen
  port.handler({ kind: 'request', id: 's3', method: 'zbc_signTransaction', params: { account: B_HEX, unsignedTx: otherSender.expected.unsigned_bytes, chain } });
  await sleep(50); h = await head(); assert.equal(h.head.view.kind, 'not-held');
  await ok({ type: 'approve:decide', id: 's3', approved: false }, true);
  assert.equal((await waitResponse(port, 's3')).error.code, 4404);
  // intent mismatch: sign needs the checkbox
  port.handler({ kind: 'request', id: 's4', method: 'zbc_signTransaction', params: { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain, intent: { rows: [['Amount', '100 ZBC']] } } });
  await sleep(50); h = await head(); assert.equal(h.head.view.match.ok, false); assert.equal(h.head.view.match.diffs[0].site, '100 ZBC');
  const r4 = await ok({ type: 'approve:decide', id: 's4', approved: true, options: {} }, true); assert.equal(r4.error.code, 4001);
  port.handler({ kind: 'request', id: 's5', method: 'zbc_signTransaction', params: { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain, intent: { rows: [['Amount', '100 ZBC']] } } });
  await sleep(50); await ok({ type: 'approve:decide', id: 's5', approved: true, options: { checkedMismatch: true } }, true);
  assert.ok((await waitResponse(port, 's5')).result.signature);
  // wrong chain without trust → 4901
  await ok({ type: 'settings:set', settings: { trustPageGenesis: false } });
  assert.equal((await request(port, 's6', 'zbc_signTransaction', { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain: { genesis: 'ab'.repeat(32) } })).error.code, 4901);
  await ok({ type: 'settings:set', settings: { trustPageGenesis: true } });

  // message + digest
  port.handler({ kind: 'request', id: 'm1', method: 'zbc_signMessage', params: { account: A_HEX, message: 'login 42', chain } });
  await sleep(50); h = await head(); assert.equal(h.head.view.kind, 'message');
  await ok({ type: 'approve:decide', id: 'm1', approved: true }, true);
  const m1 = await waitResponse(port, 'm1');
  assert.ok(verifyDigest('ZBC', undefined, hexToBytes(A_HEX).slice(4), messageDigest(utf8('login 42'), hexToBytes(GENESIS)), hexToBytes(m1.result.signature)));
  const digest = bytesToHex(groupConsentDigest('group-link', { controller: hexToBytes(B_HEX), member: hexToBytes(A_HEX), validUntil: 1000, seq: 0, genesis: hexToBytes(GENESIS) }));
  port.handler({ kind: 'request', id: 'd1', method: 'zbc_signDigest', params: { account: A_HEX, kind: 'group-link', preimage: { controller: B_HEX, member: A_HEX, validUntil: 1000, seq: 0 }, digest, chain } });
  await sleep(50); h = await head(); assert.equal(h.head.view.title, 'Join an account group');
  await ok({ type: 'approve:decide', id: 'd1', approved: true }, true);
  const d1 = await waitResponse(port, 'd1'); assert.equal(d1.result.proof.slice(0, 6), '004000'); assert.equal(d1.result.signature.length, 128);
  assert.equal((await request(port, 'd2', 'zbc_signDigest', { account: A_HEX, kind: 'group-link', preimage: { controller: B_HEX, member: A_HEX, validUntil: 1000, seq: 0 }, digest: 'aa'.repeat(32), chain })).error.code, 4300);

  // lock while a request is pending: it waits for the unlock (§12 item 7)
  await ok({ type: 'vault:lock' });
  assert.deepEqual((await request(port, 'l0', 'zbc_accounts')).result, []);
  port.handler({ kind: 'request', id: 'l1', method: 'zbc_signTransaction', params: { account: A_HEX, unsignedTx: plain.expected.unsigned_bytes, chain } });
  await sleep(50);
  assert.equal((await ok({ type: 'status' })).pending, 1);
  assert.equal((await head()).locked, true);
  await ok({ type: 'vault:unlock', password: 'correct horse battery' });
  h = await head(); assert.equal(h.locked, false); assert.equal(h.head.id, 'l1'); assert.equal(h.head.view.kind, 'tx');

  // worker restart during the open approval (§12 item 6): a fresh module instance resolves it from session storage
  await loadWorker();
  h = await head(); assert.equal(h.head.id, 'l1');
  await ok({ type: 'approve:decide', id: 'l1', approved: true }, true);
  const port2 = makePort();
  port2.handler({ kind: 'resume', ids: ['l1'] });
  const l1 = await waitResponse(port2, 'l1');
  assert.equal(l1.result.signature, s1.result.signature);
  // nothing secret in local storage
  const local = JSON.stringify(await chrome.storage.local.get(null));
  assert.ok(!local.includes('abandon') && !local.includes('51bae95d'));
  const log = await ok({ type: 'log:list' }); assert.ok(log.length >= 5);
  // disconnect
  assert.equal((await request(port2, 'x1', 'zbc_disconnect')).result, true);
  assert.deepEqual((await request(port2, 'x2', 'zbc_accounts')).result, []);
});

test('activeTab injection and personal-node host rule', { timeout: 20000 }, async () => {
  await loadWorker();
  L.injected.length = 0;
  L.activeTab = { id: 7, url: 'https://shop.example.com/checkout?x=1' };
  let r = await ok({ type: 'site:inject' });
  assert.deepEqual(r, { injected: true, origin: 'https://shop.example.com' });
  assert.equal(L.injected.length, 2);
  assert.deepEqual(L.injected[0].files, ['content.js']); assert.equal(L.injected[0].world, undefined); assert.equal(L.injected[0].target.tabId, 7);
  assert.deepEqual(L.injected[1].files, ['inpage.js']); assert.equal(L.injected[1].world, 'MAIN');
  L.activeTab = { id: 8, url: 'chrome://extensions/' };
  r = await ok({ type: 'site:inject' });
  assert.equal(r.injected, false); assert.equal(L.injected.length, 2);
  await assert.rejects(ok({ type: 'site:inject' }, true), /not allowed/);

  await ok({ type: 'vault:reset' });
  await ok({ type: 'vault:create', password: 'correct horse battery' });
  const s = await ok({ type: 'settings:set', settings: { nodes: { testnet: 'https://zoobc.net/' } } });
  assert.equal(s.nodes.testnet, 'https://zoobc.net');
  await assert.rejects(ok({ type: 'settings:set', settings: { nodes: { mainnet: 'https://evil.example.com' } } }), /zoobc\.network, https:\/\/zoobc\.net/);
  await assert.rejects(ok({ type: 'permissions:request', node: 'https://evil.example.com' }), /Personal nodes/);
  assert.equal(await ok({ type: 'permissions:request', node: 'https://zoobc.network' }), true);
});
