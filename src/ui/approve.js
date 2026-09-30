// Approval window (spec §7): renders the pending request the worker built and posts back the decision.
import { send, el, clear, coin, mono, copyButton, renderRows, renderValue, watchDecimals, toast, holdButton, networkPill, passwordField, passkeyAssert, shortAddr } from './ui.js';

const app = document.getElementById('app');
watchDecimals(app);
let current = null;
chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'approve:refresh') load(); });

async function load() {
  let data;
  try { data = await send({ type: 'approve:list' }); } catch (e) { return render(errorScreen(e.message)); }
  if (data.locked) return render(lockedScreen(data));
  if (!data.head) {
    render(el('div', { class: 'content center', style: 'padding-top:120px' }, el('img', { class: 'logo', src: 'icons/logo.png', alt: 'ZooBC' }), el('p', { class: 'muted', text: 'Nothing to approve.' })));
    // a request may arrive while this window is still open: re-check before closing
    setTimeout(async () => { try { const d = await send({ type: 'approve:list' }); if (d.head || d.locked) return load(); } catch {} window.close(); }, 900);
    return;
  }
  current = data.head;
  const v = current.view;
  if (!v) return render(errorScreen((current.error && current.error.message) || 'This request could not be prepared.'));
  const screen = { connect: connectScreen, tx: txScreen, digest: digestScreen, message: messageScreen, multisig: multisigScreen, 'not-held': notHeldScreen, error: (v) => errorScreen(v.error.message) }[v.kind];
  render(screen ? screen(v, data) : errorScreen('Unknown request kind'), data);
}
function render(node, data) { clear(app); app.append(node); if (data && data.waiting) app.prepend(el('div', { class: 'warn note tiny', style: 'margin:0;border-radius:0', text: `${data.waiting} more waiting` })); }

function header(v) {
  const of = v.originFlags || { shown: v.origin };
  return el('div', { class: 'header' },
    el('span', { class: 'favicon', text: (of.host || '?').replace(/^www\./, '')[0].toUpperCase() }),
    el('span', { class: 'origin' + (of.insecure ? ' insecure' : ''), title: v.origin, text: (of.insecure ? 'http: ' : '') + (of.host || v.origin) + (of.ip ? ' (IP address)' : '') }),
    networkPill(v.network));
}
const accountChip = (a) => el('div', { style: 'margin:6px 0 12px' }, el('span', { class: 'chip' }, coin(a.multisig ? 'MULTISIG' : a.format), el('span', { text: a.label || (a.format + ' account') }), el('span', { class: 'mono', text: '· ' + shortAddr(a.address) })));
const warnings = (list) => el('div', {}, ...(list || []).map((w) => el('div', { class: 'warn ' + (w.level || 'note'), text: w.text })));
const notes = (list) => el('div', {}, ...(list || []).map((n) => el('div', { class: 'note', text: n })));

function siteSays(v) {
  const i = v.intent || {}; const m = v.match || { ok: true, diffs: [] };
  const box = el('div', { class: 'card', style: 'margin-top:12px;background:var(--ink2)' }, el('div', { class: 'kicker', text: `What the site says · ${v.originFlags ? v.originFlags.host : v.origin}` }));
  if (i.title) box.append(el('div', { style: 'margin-top:4px;font-weight:600', text: i.title }));
  if (i.summary) box.append(el('div', { class: 'muted small', text: i.summary }));
  if (i.rows && i.rows.length && m.ok) box.append(el('div', { class: 'small muted', style: 'margin-top:4px' }, ...i.rows.map((r) => el('div', { text: `${r[0]}: ${r[1]}` }))));
  if (!i.title && !i.summary && !(i.rows && i.rows.length) && !i.typeName) box.append(el('div', { class: 'muted small', text: 'The site gave no description.' }));
  box.append(el('div', { class: 'badge ' + (m.ok ? 'ok' : 'warn'), text: m.ok ? '✓ Matches what the site says' + (i.title ? `: “${i.title}”` : '') : '⚠ Differs from what the site says' }));
  if (!m.ok) {
    const t = el('table', { class: 'diff' }, el('tr', {}, el('th', { text: '' }), el('th', { text: 'Site says' }), el('th', { text: 'Transaction does' })));
    for (const d of m.diffs) t.append(el('tr', {}, el('td', { class: 'muted', text: d.label }), el('td', { class: 'site', text: d.site }), el('td', { class: 'tx' + (d.severity === 'red' ? ' red' : ''), style: d.severity === 'red' ? 'color:#ffb3b3' : '', text: d.tx })));
    box.append(t);
  }
  return box;
}
function mismatchCheckbox(v, onChange) {
  if (!v.match || v.match.ok) return null;
  const c = el('span', { class: 'check' });
  const box = el('label', { class: 'flex', style: 'margin:10px 0;cursor:pointer' }, c, el('span', { class: 'small', text: 'I have checked the details above' }));
  let on = false; box.addEventListener('click', () => { on = !on; c.classList.toggle('on', on); c.textContent = on ? '✓' : ''; onChange(on); });
  return box;
}
function shareBox(v) {
  if (!v.share) return null;
  return el('div', { class: 'warn note', text: `Signing will also share ${v.account.label || 'this account'} with ${v.originFlags ? v.originFlags.host : v.origin}.` });
}
function rawBytes(raw, extra) {
  if (!raw) return null;
  return el('details', { class: 'raw' }, el('summary', { text: 'Show raw bytes ▸' }), el('pre', { text: raw.hex }), el('pre', { text: raw.fields.map(([k, v]) => `${k}: ${v}`).join('\n') + (extra ? '\n' + extra : '') }));
}
function actions(v, { primary = 'Sign', onApprove, hold = false, danger = false, disabled = () => false }) {
  const reject = el('button', { class: 'ghost', text: 'Reject', onclick: () => decide(false) });
  const btn = hold ? holdButton(danger ? primary : `Hold to ${primary.toLowerCase()}`, onApprove, danger ? 'danger' : 'primary') : el('button', { class: danger ? 'danger' : 'primary', text: primary, onclick: onApprove });
  const bar = el('div', { class: 'actions' }, reject, btn);
  bar.update = () => { btn.disabled = disabled(); };
  bar.update();
  return bar;
}
async function decide(approved, options = {}) {
  const id = current.id;
  let r;
  try { r = await send({ type: 'approve:decide', id, approved, options }); } catch (e) { toast(e.message, true); return; }
  if (r && r.locked) return load();
  if (approved && r && r.error) { toast(r.error.message, true); setTimeout(load, 1800); return; }
  if (approved && r && r.result) {
    const hash = r.result.txHash;
    render(el('div', { class: 'content center', style: 'padding-top:100px' }, el('div', { class: 'logo', style: 'background:var(--green)', text: '✓' }), el('h2', { text: 'Signed' }), hash ? el('div', { class: 'flex', style: 'justify-content:center' }, mono(hash), copyButton(hash)) : null));
    setTimeout(load, 1500); return;
  }
  load();
}

function lockedScreen(data) {
  const pw = passwordField(); pw.autofocus = true;
  const root = el('div', { class: 'content', style: 'padding-top:60px' },
    el('div', { class: 'center' }, el('img', { class: 'logo', src: 'icons/logo.png', alt: 'ZooBC' }), el('h2', { style: 'margin:10px 0 4px', text: 'ZooBC Signer' })),
    el('div', { class: 'warn note', text: data.head ? `${data.head.origin.replace(/^https?:\/\//, '')} is waiting for a signature. Unlock to review it.` : 'Unlock to continue.' }),
    el('label', { class: 'field', text: 'Password' }, pw),
    el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Unlock', onclick: doUnlock }),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Use passkey', onclick: async () => { try { const pk = await send({ type: 'passkey:get' }); if (!pk) return toast('No passkey registered', true); const prf = await passkeyAssert(pk.credId); await send({ type: 'passkey:unlock', prf }); load(); } catch (e) { toast(e.message, true); } } }),
    el('p', { class: 'dim tiny center', text: 'Forgot password? Reset and restore from phrases in the toolbar popup.' }));
  async function doUnlock() { try { await send({ type: 'vault:unlock', password: pw.value }); load(); } catch (e) { toast('Wrong password', true); } }
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') doUnlock(); });
  return root;
}
function errorScreen(msg) { return el('div', { class: 'content', style: 'padding-top:80px' }, el('div', { class: 'warn red', text: msg }), el('button', { class: 'ghost', style: 'width:100%', text: 'Close', onclick: () => decide(false) })); }

function connectScreen(v, data) {
  const chosen = new Set(v.accounts.filter((a) => a.checked).map((a) => a.typed));
  const list = el('div', {});
  const groups = new Map();
  for (const a of v.accounts) { const g = a.source === 'seed' ? (v.groups.find((s) => s.id === a.seedId) || { name: 'Seed' }).name : 'Imported keys'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(a); }
  const rowFor = (a, isMs) => { const c = el('span', { class: 'check' + (chosen.has(a.typed) ? ' on' : ''), text: chosen.has(a.typed) ? '✓' : '' });
    const r = el('div', { class: 'list-item selectable' + (chosen.has(a.typed) ? ' on' : '') }, c, coin(isMs ? 'MULTISIG' : a.format), el('div', { class: 'grow' }, el('div', { class: 'name', text: a.label }), el('div', { class: 'sub mono', text: shortAddr(a.address) + (a.btc ? ` · ${a.btc}` : '') + (isMs ? ` · ${a.multisig.min}/${a.multisig.participants.length}` : '') })), a.checked ? el('span', { class: 'tiny muted', text: 'last used' }) : a.shared ? el('span', { class: 'tiny muted', text: 'shared' }) : null);
    r.addEventListener('click', () => { if (chosen.has(a.typed)) chosen.delete(a.typed); else chosen.add(a.typed); c.classList.toggle('on'); c.textContent = chosen.has(a.typed) ? '✓' : ''; r.classList.toggle('on'); update(); });
    return r; };
  for (const [g, accs] of groups) { list.append(el('div', { class: 'section', text: g })); for (const a of accs) list.append(rowFor(a)); }
  if (v.multisigs.length) { list.append(el('div', { class: 'section', text: 'Multisig (held here)' })); for (const m of v.multisigs) list.append(rowFor(m, true)); }
  if (!v.accounts.length && !v.multisigs.length) list.append(el('p', { class: 'muted', text: 'No accounts yet. Add a seed phrase or import a key in the toolbar popup first.' }));
  const btn = el('button', { class: 'primary', onclick: () => decide(true, { accounts: [...chosen] }) });
  const update = () => { btn.textContent = `Connect ${chosen.size} account${chosen.size === 1 ? '' : 's'}`; btn.disabled = chosen.size === 0; };
  update();
  return el('div', { id: 'app' }, header(v), el('div', { id: 'main', class: 'content' },
    el('h2', { class: 'title', text: 'Connect to this site?' }),
    el('p', { class: 'muted small', text: `${v.originFlags.host} will see the addresses you choose. It cannot move funds without asking you.` }),
    v.originFlags.insecure ? el('div', { class: 'warn red', text: 'This site is not using HTTPS. Anything it sends can be altered on the way.' }) : null,
    list, el('p', { class: 'dim tiny', text: 'Only share addresses; this site cannot move funds without asking you.' })),
    el('div', { class: 'actions' }, el('button', { class: 'ghost', text: 'Cancel', onclick: () => decide(false) }), btn));
}

function notHeldScreen(v) {
  return el('div', { id: 'app' }, header(v), el('div', { id: 'main', class: 'content center', style: 'padding-top:40px' },
    el('div', { class: 'logo', style: 'background:var(--card2);color:var(--muted)', text: '?' }),
    el('h2', { class: 'title', style: 'margin-top:12px', text: 'This signer doesn\'t hold this account' }),
    el('p', { class: 'muted small', text: `${v.originFlags.host} asked for a signature from` }),
    el('div', { class: 'card', style: 'text-align:left' }, el('div', { class: 'flex' }, coin(v.account.multisig ? 'MULTISIG' : (v.account.format || 'ZBC')), el('div', {}, el('div', { class: 'name', text: v.account.multisig ? 'Multisig account' : `${v.account.format || 'Unknown'} account` }), el('div', { class: 'mono', text: v.account.address }))), el('div', { style: 'margin-top:6px' }, copyButton(v.account.address))),
    el('p', { class: 'muted small', text: 'Nothing was signed. Import the seed phrase or private key of this account to sign with it here.' })),
    el('div', { class: 'actions' }, el('button', { class: 'ghost', text: 'Close', onclick: () => decide(false, {}, 'not held') }), el('button', { class: 'primary', text: 'Import it', onclick: async () => { await chrome.storage.session.set({ importHint: { format: v.account.format, address: v.account.address } }); chrome.runtime.openOptionsPage(); decide(false); } })));
}

function txScreen(v) {
  const d = v.described; let checked = false, sessionKey = false;
  const main = el('div', { id: 'main', class: 'content' });
  main.append(el('div', { class: 'kicker', text: d.kicker + (v.participantOf ? ' · PARTICIPANT' : '') }), el('h2', { class: 'title', text: d.title }), accountChip(v.account));
  if (v.participantOf) main.append(el('div', { class: 'note', text: `Multisig ${shortAddr(v.participantOf.address)} · role: ${v.participantOf.role}` }));
  main.append(warnings(d.warnings), warnings(v.checks));
  if (d.nested) main.append(nestedCard(d.nested));
  main.append(renderRows(d.rows));
  if (d.common && d.common.length) main.append(el('hr'), renderRows(d.common));
  main.append(el('div', { class: 'row' }, el('div', { class: 'k', text: 'Created' }), el('div', { class: 'v', text: new Date(Number(v.timestamp) * 1000).toLocaleString() })));
  main.append(el('div', { class: 'row' }, el('div', { class: 'k', text: 'Network' }), el('div', { class: 'v mono', text: v.network.short })));
  main.append(notes(d.notes), siteSays(v), shareBox(v));
  const cb = mismatchCheckbox(v, (on) => { checked = on; bar.update(); }); if (cb) main.append(cb);
  if (d.extras && d.extras.sessionKeyEligible && v.sessionKeysEnabled) { const c = el('span', { class: 'check' }); const box = el('label', { class: 'flex', style: 'margin:8px 0;cursor:pointer' }, c, el('span', { class: 'small muted', text: 'Allow moves in this game from this site without asking for 2 hours' })); box.addEventListener('click', () => { sessionKey = !sessionKey; c.classList.toggle('on', sessionKey); c.textContent = sessionKey ? '✓' : ''; }); main.append(box); }
  if (v.mode === 'submit') main.append(el('div', { class: 'note', text: `After signing, the signer will broadcast it to ${v.submitNode}.` }));
  main.append(rawBytes(v.raw, `digest input: ${v.network.tag || 'ZBC-TX'} ‖ ${v.network.genesis} ‖ unsigned`));
  const danger = !!(d.extras && d.extras.danger);
  const bar = actions(v, { primary: (d.extras && d.extras.primaryLabel) || (v.mode === 'submit' ? 'Sign & send' : 'Sign'), hold: d.hold || d.warnings.some((w) => w.level === 'red'), danger, onApprove: () => decide(true, { checkedMismatch: checked, shareAccount: true, sessionKey }), disabled: () => d.canSign === false || (!v.match.ok && !checked) });
  return el('div', { id: 'app' }, header(v), main, bar);
}
function nestedCard(n) {
  return el('div', { class: 'nested' }, el('div', { class: 'kicker', text: `The multisig ${shortAddr(n.senderAddress || '')} will` }), el('div', { style: 'font-weight:700;font-size:16px;margin:2px 0 6px', text: n.title }), warnings(n.warnings), renderRows(n.rows), n.common ? renderRows(n.common.filter((r) => /fee/i.test(r.label)).map((r) => ({ ...r, label: 'Inner fee' }))) : null);
}

function multisigScreen(v) {
  let checked = false;
  const main = el('div', { id: 'main', class: 'content' });
  main.append(el('div', { class: 'kicker', text: 'Multisig · held in this signer' }), el('h2', { class: 'title', text: v.title }),
    el('div', { style: 'margin:6px 0 12px' }, el('span', { class: 'chip' }, el('span', { class: 'coin MS', 'data-no-dec': true, text: `${v.setup.min}/${v.setup.n}` }), el('span', { text: v.setup.label }), el('span', { class: 'mono', text: '· ' + shortAddr(v.setup.address) }))));
  main.append(nestedCard({ ...v.nested, senderAddress: v.setup.address }));
  main.append(el('div', { class: 'section', text: `Signing with ${v.signWith} of ${v.setup.n} participant keys` }));
  for (const p of v.participants) main.append(el('div', { class: 'list-item' + (p.held ? ' selectable on' : ''), style: p.held ? '' : 'opacity:.55' }, el('span', { class: 'check' + (p.held ? ' on' : ''), text: p.held ? '✓' : '' }), coin(p.format.length <= 3 ? p.format : 'ZBC'), el('div', { class: 'grow' }, el('div', { class: 'name', text: p.label || p.format })), el('span', { class: 'mono tiny', text: p.held ? shortAddr(p.display) : 'not held' })));
  main.append(el('div', { class: 'row' }, el('div', { class: 'k', text: 'Required' }), el('div', { class: 'v', text: `${v.need} signature${v.need === 1 ? '' : 's'} · ${v.remaining === 0 ? 'met after this step' : `${v.remaining} more needed`}` })));
  main.append(warnings(v.nested.warnings.filter((w) => w.level === 'red')));
  main.append(el('p', { class: 'dim tiny', text: `Setup hash ✓ matches the sender · next: sign the outer from ${v.firstHeld ? v.firstHeld.label : 'a participant'}` }));
  main.append(siteSays(v), shareBox(v));
  const cb = mismatchCheckbox(v, (on) => { checked = on; bar.update(); }); if (cb) main.append(cb);
  main.append(rawBytes(v.raw));
  const bar = actions(v, { primary: `Sign with ${v.signWith} key${v.signWith === 1 ? '' : 's'}`, onApprove: () => decide(true, { checkedMismatch: checked, shareAccount: true }), disabled: () => v.canSign === false || (!v.match.ok && !checked) });
  return el('div', { id: 'app' }, header(v), main, bar);
}

function digestScreen(v) {
  const main = el('div', { id: 'main', class: 'content' });
  main.append(el('div', { class: 'kicker', text: 'Consent · ' + v.digestKind.replace(/-/g, ' ') }), el('h2', { class: 'title', text: v.title }), accountChip(v.account));
  if (v.blind) main.append(el('div', { class: 'warn red', style: 'font-size:14px;padding:16px', text: v.warnings[0].text }));
  else main.append(warnings(v.warnings));
  if (v.nested) main.append(nestedCard({ ...v.nested, senderAddress: v.nested.rows.length ? undefined : '' }));
  main.append(renderRows(v.rows));
  main.append(el('div', { class: 'row' }, el('div', { class: 'k', text: v.scheme === 'raw' ? 'Bytes' : 'Digest' }), el('div', { class: 'v flex', style: 'justify-content:flex-end' }, mono(v.digest), el('span', { class: 'badge ok', style: 'margin:0', text: '✓' }))));
  main.append(notes(v.notes), shareBox(v));
  const bar = actions(v, { primary: 'Sign', hold: v.hold || v.blind, onApprove: () => decide(true, { shareAccount: true }) });
  return el('div', { id: 'app' }, header(v), main, bar);
}

function messageScreen(v) {
  const main = el('div', { id: 'main', class: 'content' });
  main.append(el('div', { class: 'kicker', text: 'Message' }), el('h2', { class: 'title', text: v.title }), accountChip(v.account),
    el('div', { class: 'quote', 'data-no-dec': true, style: v.isHexShown ? 'font-family:var(--mono)' : '', text: v.message }),
    v.isHexShown ? el('div', { class: 'note', text: 'The message is not valid text; shown as hex.' }) : null,
    notes(v.notes), shareBox(v));
  const bar = actions(v, { primary: 'Sign', onApprove: () => decide(true, { shareAccount: true }) });
  return el('div', { id: 'app' }, header(v), main, bar);
}

load();
export { renderValue };
