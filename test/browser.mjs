// Drives the built extension in real Chromium with Playwright (npm run browser). Needs `npm run build` first and a Chromium (CHROME_PATH or Playwright's).
// Drives the built extension in real Chromium: vault → seed → dapp connect → sign flows, with screenshots.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const EXT = new URL('../dist/', import.meta.url).pathname;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const server = spawn('node', [new URL('../scripts/serve.mjs', import.meta.url).pathname], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const GENESIS = '5a'.repeat(32);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

const ctx = await chromium.launchPersistentContext(SHOTS + '/../.profile-' + Date.now(), { headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chromium' }), args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 380, height: 640 } });
try {
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(sw.url()).host;
  console.log('extension id', id);
  sw.on('console', (m) => console.log('[sw]', m.text()));

  // ---- popup: create vault
  const popup = await ctx.newPage();
  popup.on('console', (m) => { if (m.type() === 'error') console.log('[popup]', m.text()); });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForSelector('text=Create your signer vault');
  const pws = popup.locator('input[type=password]');
  await pws.nth(0).fill('correct horse battery staple'); await pws.nth(1).fill('correct horse battery staple');
  await popup.click('button:has-text("Create vault")');
  await popup.waitForSelector('text=No keys yet', { timeout: 10000 });
  check('vault created via popup UI', true);
  // add seed through the UI: Add seed → Import phrase → Continue → Add accounts
  await popup.click('button:has-text("Add seed")');
  await popup.click('button:has-text("Import phrase")');
  await popup.fill('input[placeholder="Main seed"]', 'Main seed');
  await popup.fill('textarea', MNEMONIC);
  await popup.click('button:has-text("Continue")');
  await popup.waitForSelector('text=Pick the formats');
  await popup.click('.list-item:has-text("Ethereum")');
  await popup.click('.list-item:has-text("Bitcoin") .seg button:has-text("SegWit")');
  await popup.click('.list-item:has-text("Polkadot")');
  await sleep(600);
  await popup.screenshot({ path: `${SHOTS}/11-derive.png` });
  await popup.click('button:has-text("Add 4 accounts")');
  await popup.waitForSelector('text=Main seed', { timeout: 10000 });
  await sleep(500);
  const addrs = await popup.locator('.list-item .sub.mono').allTextContents();
  check('4 accounts derived in the popup', addrs.length === 4, addrs.join(' | '));
  await popup.screenshot({ path: `${SHOTS}/10-popup-accounts.png` });
  // settings via the extension page context (trust page genesis: no node reachable here) + a multisig setup
  const zbcTyped = await popup.evaluate(async () => { const r = await chrome.runtime.sendMessage({ type: 'accounts:list' }); return r.result.seeds[0].accounts.find((a) => a.format === 'ZBC').typed; });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'settings:set', settings: { trustPageGenesis: true } }));
  const ms = await popup.evaluate(async (zbc) => (await chrome.runtime.sendMessage({ type: 'multisig:add', label: 'Treasury', participants: [zbc, 'ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I', '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'], min: 2, nonce: 0 })).result, zbcTyped);
  check('multisig setup stored (2 of 3, 2 keys held)', ms && ms.multisig.held === 2, ms && ms.address);
  await popup.click('.tabs button:has-text("Settings")'); await sleep(400);
  await popup.screenshot({ path: `${SHOTS}/12-settings.png`, fullPage: true });
  await popup.click('.tabs button:has-text("Accounts")'); await sleep(300);

  // ---- dapp
  const dapp = await ctx.newPage();
  await dapp.setViewportSize({ width: 1200, height: 900 });
  dapp.on('console', (m) => { if (m.type() === 'error') console.log('[dapp]', m.text()); });
  await dapp.goto('http://localhost:8787/dapp.html');
  await dapp.waitForSelector('text=window.zoobc found');
  check('window.zoobc injected', true);
  await dapp.fill('#genesis', GENESIS);
  const approval = async (action) => {
    await mark(); await action();
    for (let i = 0; i < 150; i++) {
      for (const p of ctx.pages()) {
        if (p.isClosed() || !p.url().includes('/approve.html')) continue;
        const ready = await p.locator('.actions, button:has-text("Unlock")').count().catch(() => 0);
        if (ready) { await sleep(700); return p; }
      }
      await sleep(100);
    }
    throw new Error('no approval screen appeared');
  };
  let logMark = 0;
  const mark = async () => { logMark = await dapp.locator('#log div').count(); };
  const lastLog = async (re, tries = 60) => { for (let i = 0; i < tries; i++) { const n = await dapp.locator('#log div').count(); if (n > logMark) { const items = await dapp.locator('#log div').allTextContents(); const fresh = items.slice(0, n - logMark).join('\n'); if (re.test(fresh)) return fresh; } await sleep(250); } const items = await dapp.locator('#log div').allTextContents(); return items.slice(0, Math.max(1, (await dapp.locator('#log div').count()) - logMark)).join('\n'); };

  // connect
  let ap = await approval(() => dapp.click('#connect'));
  await ap.click('.list-item.selectable:has-text("ZBC")');
  await ap.click('.list-item.selectable:has-text("Treasury")');
  await ap.screenshot({ path: `${SHOTS}/02-connect.png` });
  await ap.click('button:has-text("Connect 2 accounts")');
  let logText = await lastLog(/← zbc_requestAccounts/);
  check('zbc_requestAccounts returned accounts', /"format":"ZBC"/.test(logText) && /"multisig"/.test(logText));

  // sign type 1
  ap = await approval(() => dapp.click('button:has-text("1 · Send 25 ZBC")'));
  const title = await ap.locator('.title').textContent();
  check('approval shows the signer\'s own title', title === 'Send 25 ZBC', title);
  const badge = await ap.locator('.badge').textContent();
  check('match badge', /Matches/.test(badge), badge);
  await ap.screenshot({ path: `${SHOTS}/03-sign-transfer.png` });
  await mark(); await ap.click('.actions button.primary');
  logText = await lastLog(/local verify/);
  check('type 1 signature verifies locally and hash matches', /signature verifies[^\n]*\(matches\)/.test(logText));

  // escrow approval with context
  ap = await approval(() => dapp.click('button:has-text("4 · Approve escrow")'));
  await ap.screenshot({ path: `${SHOTS}/04-escrow-approval.png` });
  check('escrow approval title', (await ap.locator('.title').textContent()) === 'Approve escrow');
  await mark(); await ap.click('.actions button.primary'); await lastLog(/local verify/);

  // mismatch
  ap = await approval(() => dapp.click('#mismatch'));
  const diffs = await ap.locator('table.diff tr').count();
  check('mismatch table shows differences', diffs >= 3, `${diffs - 1} rows`);
  await ap.screenshot({ path: `${SHOTS}/05-mismatch.png` });
  const disabledBefore = await ap.locator('.actions button.primary').isDisabled();
  await ap.click('label:has-text("I have checked")');
  const disabledAfter = await ap.locator('.actions button.primary').isDisabled();
  check('Sign disabled until the checkbox is ticked', disabledBefore && !disabledAfter);
  await mark(); await ap.click('.actions button.primary'); await lastLog(/local verify/);

  // not held
  ap = await approval(() => dapp.click('#notHeld'));
  await ap.screenshot({ path: `${SHOTS}/06-not-held.png` });
  check('not-held screen', /doesn't hold/.test(await ap.locator('.title').textContent()));
  await mark(); await ap.click('button:has-text("Close")');
  logText = await lastLog(/✗ zbc_signTransaction 4404/);
  check('4404 returned to the page', /4404/.test(logText));

  // errors without prompt
  await mark(); await dapp.click('#wrongSender'); logText = await lastLog(/4300/); check('sender ≠ account → 4300', /4300/.test(logText));
  await mark(); await dapp.click('#truncated'); logText = await lastLog(/4300[^\n]*decode/); check('truncated → 4300', /decode/.test(logText));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'settings:set', settings: { trustPageGenesis: false } }));
  await mark(); await dapp.click('#wrongChain'); logText = await lastLog(/4901|4300/); check('wrong genesis → 4901', /4901/.test(logText));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'settings:set', settings: { trustPageGenesis: true } }));
  await mark(); await dapp.click('#signMessageBad'); logText = await lastLog(/zbc_signMessage 4300/); check('32-byte hex message refused (4300)', /4300/.test(logText));

  // multisig propose (type 5, info + inner)
  ap = await approval(() => dapp.click('button:has-text("5 · Multisig: propose")'));
  await ap.screenshot({ path: `${SHOTS}/07-multisig-propose-type5.png` });
  check('type 5 nested card', (await ap.locator('.nested .kicker').count()) === 1 && /Propose/.test(await ap.locator('.title').textContent()));
  await mark(); await ap.click('.actions button.primary'); await lastLog(/local verify/);

  // zbc_signMultisig (signer-held multisig)
  ap = await approval(() => dapp.click('#signMultisig'));
  await ap.screenshot({ path: `${SHOTS}/08-multisig-held.png` });
  const held = await ap.locator('.list-item .check.on').count();
  check('zbc_signMultisig shows 2 held participant keys', held === 2, String(held));
  const ap2 = await approval(() => ap.click('.actions button.primary'));
  check('second prompt is the type-5 outer', /Propose a multisig/.test(await ap2.locator('.title').textContent()));
  await mark(); await ap2.click('.actions button.primary'); logText = await lastLog(/local verify/);
  check('outer signed and verified', /signature verifies/.test(logText));

  // group-link consent (hold to sign)
  ap = await approval(() => dapp.click('button[data-digest="group-link"]'));
  await ap.screenshot({ path: `${SHOTS}/09-consent.png` });
  check('consent title', (await ap.locator('.title').textContent()) === 'Join an account group');
  const hold = ap.locator('.actions button.primary'); const box = await hold.boundingBox();
  await ap.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await ap.mouse.down(); await sleep(2300); await mark(); await ap.mouse.up();
  logText = await lastLog(/← zbc_signDigest/);
  check('group-link digest signed with proof', /"proof":"00/.test(logText));

  // message
  ap = await approval(() => dapp.click('#signMessage'));
  await mark(); await ap.click('.actions button.primary'); logText = await lastLog(/← zbc_signMessage/);
  check('zbc_signMessage signature returned', /"signature":"[0-9a-f]{128}"/.test(logText));

  // unknown type: hold-to-sign
  ap = await approval(() => dapp.click('#unknownType'));
  check('unknown type warning', /cannot describe/.test(await ap.locator('.warn.amber').first().textContent()));
  await mark(); await ap.click('button:has-text("Reject")'); await lastLog(/4001/);

  // lock → request waits → unlock in the approval window
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'vault:lock' }));
  ap = await approval(() => dapp.evaluate((zbc) => { const Z = window.ZBCDapp; const u = Z.buildTx(1, { amount: 2500000000n }, { sender: zbc, recipient: 'ZBC_2BFLEMTU_FO2KWOQT_NC6UMFPE_43ICESVX_DIAWXL4F_ECRTFSLX_Q43UIV2I', fee: 2550000n, survival: 0n }); window.__locked = window.zoobc.request({ method: 'zbc_signTransaction', params: { account: zbc, unsignedTx: Z.bytesToHex(u), chain: { genesis: '5a'.repeat(32), tag: 'ZBC-TX' }, intent: { typeName: 'SendZBC' } } }).then((r) => ({ ok: r.signature })).catch((e) => ({ err: e.code })); }, zbcTyped));
  let warnText = '';
  for (let i = 0; i < 40; i++) { warnText = (await ap.locator('.warn').first().textContent().catch(() => '')) || ''; if (/waiting for a signature/.test(warnText)) break; await sleep(250); }
  check('locked screen names the waiting origin', /waiting for a signature/.test(warnText), warnText);
  await ap.screenshot({ path: `${SHOTS}/12-locked.png` });
  await ap.fill('input[type=password]', 'correct horse battery staple'); await ap.click('button:has-text("Unlock")');
  let shown = null;
  for (let i = 0; i < 60 && !shown; i++) { for (const p of ctx.pages()) { if (p.isClosed() || !p.url().includes('/approve.html')) continue; const t = await p.locator('.title').textContent().catch(() => null); if (t) { shown = t; ap = p; } } if (!shown) await sleep(250); }
  check('after unlock the waiting request is shown', shown === 'Send 25 ZBC', String(shown));
  if (!shown) console.log('dapp log:', (await dapp.locator('#log').textContent()).slice(0, 600));
  await ap.click('.actions button.primary');
  let lockedResult = null; for (let i = 0; i < 40 && !lockedResult; i++) { lockedResult = await dapp.evaluate(() => window.__locked); if (!lockedResult) await sleep(250); }
  check('request that waited through the lock was signed', !!(lockedResult && lockedResult.ok), JSON.stringify(lockedResult));

  // activity + sites tabs
  await popup.reload(); await popup.waitForSelector('.tabs'); await popup.click('.tabs button:has-text("Sites")'); await sleep(300);
  check('connected site listed', /localhost:8787/.test(await popup.locator('#main').textContent()));
  await popup.screenshot({ path: `${SHOTS}/12-sites.png` });
  await popup.click('.tabs button:has-text("Activity")'); await sleep(300);
  await popup.screenshot({ path: `${SHOTS}/13-activity.png` });
  // self-tests from the settings tab
  await popup.click('.tabs button:has-text("Settings")'); await popup.click('button:has-text("Run self-tests")');
  await popup.waitForSelector('text=§4.6 digest', { timeout: 30000 });
  const st = await popup.locator('.card.small').last().textContent();
  check('self-tests pass in the extension', !/✗/.test(st) && /✓/.test(st));
  // no secret in local storage
  const local = await popup.evaluate(() => chrome.storage.local.get(null));
  check('no secret in chrome.storage.local', !JSON.stringify(local).includes('abandon'));
} catch (e) { console.error('ERROR', e); results.push({ name: 'script', ok: false, detail: e.message }); }
finally { await ctx.close(); server.kill(); }
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
