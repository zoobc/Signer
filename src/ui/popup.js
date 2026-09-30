// Toolbar popup and options page (spec §9, §10): accounts, connected sites, activity, settings.
import { send, el, clear, coin, mono, copyButton, watchDecimals, toast, timeAgo, fmtDate, passwordField, passkeyRegister, shortAddr } from './ui.js';

const app = document.getElementById('app');
const isOptions = document.body.classList.contains('options');
watchDecimals(app);
const FORMATS = [
  { format: 'ZBC', name: 'ZooBC', hint: 'ZBC_…' }, { format: 'ETH', name: 'Ethereum', hint: '0x…' }, { format: 'BNB', name: 'BNB', hint: '0x…' },
  { format: 'BTC', name: 'Bitcoin', hint: '1… · bc1q… · bc1p…' }, { format: 'SOL', name: 'Solana', hint: 'base58' }, { format: 'DOT', name: 'Polkadot', hint: 'SS58' },
  { format: 'ADA', name: 'Cardano', hint: 'addr1…' }, { format: 'XTZ', name: 'Tezos', hint: 'tz1…' }, { format: 'TRX', name: 'Tron', hint: 'T…' }, { format: 'XRP', name: 'Ripple', hint: 'r…' },
];
const LANGS = { en: 'English', zh: '中文', ru: 'Русский', it: 'Italiano', es: 'Español', fr: 'Français', ja: '日本語', ko: '한국어' };
let state = { tab: isOptions ? 'settings' : 'accounts', status: null, data: null, balances: {} };

async function refresh() {
  try { state.status = await send({ type: 'status' }); } catch (e) { return render(el('div', { class: 'content' }, el('div', { class: 'warn red', text: e.message }))); }
  if (!state.status.exists) return render(createVaultScreen());
  if (state.status.locked) return render(lockedScreen());
  try { state.data = await send({ type: 'accounts:list' }); } catch (e) { return render(lockedScreen()); }
  const hint = (await chrome.storage.session.get('importHint')).importHint;
  if (hint) { await chrome.storage.session.remove('importHint'); return render(importKeyScreen(hint)); }
  showTab(state.tab);
}
function render(node) { clear(app); app.append(node); }
function frame(main, tab) {
  const s = state.status;
  const head = el('div', { class: 'header' }, el('img', { class: 'logo', src: 'icons/logo.png', alt: 'ZooBC' }), el('span', { class: 'origin', text: 'ZooBC Signer' }),
    el('button', { class: 'small pill ' + (state.data.settings.network), style: 'border:0', text: (state.data.settings.network === 'mainnet' ? 'MainNet' : 'TestNet') + ' ▾', onclick: async () => { const n = state.data.settings.network === 'mainnet' ? 'testnet' : 'mainnet'; await send({ type: 'settings:set', settings: { network: n } }); toast(`Default network: ${n}`); refresh(); } }),
    el('button', { class: 'small ghost', title: 'Lock', text: '🔒', onclick: async () => { await send({ type: 'vault:lock' }); refresh(); } }));
  const pendingBar = s.pending ? el('div', { class: 'card flex', style: 'margin:10px 14px 0;cursor:pointer', onclick: () => send({ type: 'pending:open' }) }, el('span', { class: 'grow', text: `${s.pending} request${s.pending === 1 ? '' : 's'} waiting` }), el('span', { class: 'link', text: 'Review ▸' })) : null;
  const tabs = el('div', { class: 'tabs' }, ...['accounts', 'sites', 'activity', 'settings'].map((t) => el('button', { class: t === tab ? 'on' : '', text: t[0].toUpperCase() + t.slice(1), onclick: () => showTab(t) })));
  return el('div', { id: 'app' }, head, pendingBar, el('div', { id: 'main' }, main), tabs);
}
async function showTab(tab) {
  state.tab = tab;
  const screens = { accounts: accountsScreen, sites: sitesScreen, activity: activityScreen, settings: settingsScreen };
  render(frame(await screens[tab](), tab));
}

// ---------------------------------------------------------------- vault
function createVaultScreen() {
  const pw = passwordField('At least 10 characters'), pw2 = passwordField('Repeat');
  const meter = el('div', { class: 'progress' }, el('div', { style: 'width:0' }));
  pw.addEventListener('input', () => { const n = strength(pw.value); meter.firstChild.style.width = `${n * 25}%`; meter.firstChild.style.background = n >= 3 ? 'var(--green)' : n === 2 ? 'var(--amber)' : 'var(--red)'; });
  return el('div', { class: 'content', style: 'padding-top:40px' }, el('div', { class: 'center' }, el('img', { class: 'logo', src: 'icons/logo.png', alt: 'ZooBC' }), el('h2', { text: 'Create your signer vault' }), el('p', { class: 'muted small', text: 'One password encrypts every seed phrase and key on this browser profile. It never leaves this computer.' })),
    el('label', { class: 'field', text: 'Password' }, pw), meter, el('label', { class: 'field', text: 'Repeat password' }, pw2),
    el('button', { class: 'primary', style: 'width:100%;margin-top:14px', text: 'Create vault', onclick: async () => { if (pw.value.length < 10) return toast('At least 10 characters', true); if (pw.value !== pw2.value) return toast('Passwords differ', true); if (strength(pw.value) < 3) { if (!confirm('This password is weak. Use it anyway?')) return; } try { await send({ type: 'vault:create', password: pw.value }); refresh(); } catch (e) { toast(e.message, true); } } }));
}
function strength(s) { let n = 0; if (s.length >= 10) n++; if (s.length >= 14) n++; if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++; if (/\d/.test(s)) n++; if (/[^\w]/.test(s)) n++; if (/^(.)\1+$/.test(s)) n = 1; return Math.min(4, n); }
function lockedScreen() {
  const pw = passwordField(); setTimeout(() => pw.focus(), 50);
  const go = async () => { try { await send({ type: 'vault:unlock', password: pw.value }); refresh(); } catch { toast('Wrong password', true); } };
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return el('div', { class: 'content', style: 'padding-top:70px' }, el('div', { class: 'center' }, el('img', { class: 'logo', src: 'icons/logo.png', alt: 'ZooBC' }), el('h2', { style: 'margin:10px 0', text: 'ZooBC Signer' })),
    state.status.pending ? el('div', { class: 'warn note', text: `${state.status.pending} request${state.status.pending === 1 ? ' is' : 's are'} waiting for a signature. Unlock to review.` }) : null,
    el('label', { class: 'field', text: 'Password' }, pw), el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Unlock', onclick: go }),
    state.status.passkey ? el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Use passkey', onclick: async () => { try { const pk = await send({ type: 'passkey:get' }); const { passkeyAssert } = await import('./ui.js'); const prf = await passkeyAssert(pk.credId); await send({ type: 'passkey:unlock', prf }); refresh(); } catch (e) { toast(e.message, true); } } }) : null,
    el('p', { class: 'center', style: 'margin-top:16px' }, el('button', { class: 'link small', text: 'Forgot password? Reset and restore from phrases.', onclick: async () => { if (confirm('This deletes the vault on this browser. You will need your seed phrases and keys to restore. Continue?')) { await send({ type: 'vault:reset' }); refresh(); } } })));
}

// ---------------------------------------------------------------- accounts
const collapsed = new Set(JSON.parse(localStorage.getItem('collapsedSeeds') || '[]'));
async function accountsScreen() {
  const d = state.data;
  const main = el('div', { class: 'content' });
  const accountRow = (a) => {
    const bal = state.balances[a.address];
    const r = el('div', { class: 'list-item', style: a.hidden ? 'opacity:.5' : '' }, coin(a.format), el('div', { class: 'grow' }, el('div', { class: 'name', text: a.label + (a.nodeKey ? ' · node key' : '') + (a.btc ? ` · ${a.btc[0].toUpperCase() + a.btc.slice(1)}` : '') }), el('div', { class: 'sub mono', text: shortAddr(a.address, 10, 4) })),
      el('span', { class: 'balance', text: bal === undefined ? '' : bal === null ? '' : bal }), copyButton(a.address), el('button', { class: 'small ghost', text: '⋯', onclick: () => render(accountMenu(a)) }));
    if (a.format === 'ZBC' && bal === undefined) { state.balances[a.address] = null; send({ type: 'balance', address: a.address }).then((b) => { if (b !== null) { state.balances[a.address] = fmtZbc(b); r.querySelector('.balance').textContent = state.balances[a.address]; } }).catch(() => {}); }
    return r;
  };
  for (const s of d.seeds) {
    const open = !collapsed.has(s.id);
    main.append(el('div', { class: 'section' }, el('span', { style: 'cursor:pointer', text: `${open ? '▾' : '▸'} ${s.name} · ${s.words} words${s.hasPassphrase ? ' · passphrase' : ''}${open ? '' : ` · ${s.accounts.length} accounts`}`, onclick: () => { if (collapsed.has(s.id)) collapsed.delete(s.id); else collapsed.add(s.id); localStorage.setItem('collapsedSeeds', JSON.stringify([...collapsed])); showTab('accounts'); } }),
      el('span', {}, el('button', { class: 'link small', text: '+ Derive', onclick: () => render(deriveScreen(s)) }), ' ', el('button', { class: 'link small', text: '⋯', onclick: () => render(seedMenu(s)) }))));
    if (open) for (const a of s.accounts) main.append(accountRow(a));
  }
  if (d.keys.length) { main.append(el('div', { class: 'section', text: 'Imported keys' })); for (const a of d.keys) main.append(accountRow(a)); }
  if (d.multisigs.length) {
    main.append(el('div', { class: 'section', text: 'Multisig' }));
    for (const m of d.multisigs) main.append(el('div', { class: 'list-item' }, el('span', { class: 'coin MS', 'data-no-dec': true, text: `${m.multisig.min}/${m.multisig.participants.length}` }), el('div', { class: 'grow' }, el('div', { class: 'name', text: `${m.label} · multisig ${m.multisig.min}/${m.multisig.participants.length} · ${m.multisig.held} key${m.multisig.held === 1 ? '' : 's'} held` }), el('div', { class: 'sub mono', text: shortAddr(m.address, 10, 4) })), copyButton(m.address), el('button', { class: 'small ghost', text: '⋯', onclick: () => render(multisigMenu(m)) })));
  }
  if (!d.seeds.length && !d.keys.length) main.append(el('p', { class: 'muted center', style: 'margin-top:60px', text: 'No keys yet. Add a seed phrase or import a private key.' }));
  main.append(el('div', { class: 'flex', style: 'margin-top:16px;gap:8px;flex-wrap:wrap' }, el('button', { class: 'primary grow', text: 'Add seed', onclick: () => render(addSeedScreen()) }), el('button', { class: 'ghost grow', text: 'Import key', onclick: () => render(importKeyScreen()) }), el('button', { class: 'ghost grow', text: 'Add multisig', onclick: () => render(addMultisigScreen()) })));
  return main;
}
function fmtZbc(atomic) { const v = BigInt(atomic); const w = (v / 100000000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); const f = (v % 100000000n).toString().padStart(8, '0').replace(/0+$/, ''); return w + (f ? '.' + f : ''); }
function back(title, body, onBack = refresh) { return el('div', { id: 'app' }, el('div', { class: 'header' }, el('button', { class: 'small ghost', text: '←', onclick: onBack }), el('span', { class: 'origin', text: title })), el('div', { id: 'main', class: 'content' }, body)); }

function formatPicker(preselect = ['ZBC'], allowIndex = true) {
  const chosen = new Map(); const nodes = [];
  const btcFlavour = { v: 'segwit' };
  const preview = el('div', { class: 'card small', style: 'margin-top:10px;display:none' });
  const list = el('div', {});
  const idx = el('input', { type: 'number', min: 0, value: 0, style: 'width:90px' });
  const item = (f) => {
    const c = el('span', { class: 'check' }); const addr = el('span', { class: 'mono tiny muted', text: '' });
    const row = el('div', { class: 'list-item selectable' }, c, el('div', { class: 'grow' }, el('div', { class: 'name', text: f.name }), el('div', { class: 'sub', text: f.hint })), addr);
    if (f.format === 'BTC') { const seg = el('span', { class: 'seg' }, ...['legacy', 'segwit', 'taproot'].map((b) => el('button', { class: b === btcFlavour.v ? 'on' : '', text: b[0].toUpperCase() + b.slice(1), onclick: (e) => { e.stopPropagation(); btcFlavour.v = b; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.textContent.toLowerCase() === b)); chosen.set('BTC', { format: 'BTC', btc: b }); c.classList.add('on'); c.textContent = '✓'; row.classList.add('on'); picker.onchange && picker.onchange(); } }))); row.insertBefore(seg, addr); }
    row.addEventListener('click', () => { if (chosen.has(f.format)) chosen.delete(f.format); else chosen.set(f.format, { format: f.format, btc: f.format === 'BTC' ? btcFlavour.v : undefined }); c.classList.toggle('on', chosen.has(f.format)); c.textContent = chosen.has(f.format) ? '✓' : ''; row.classList.toggle('on', chosen.has(f.format)); picker.onchange && picker.onchange(); });
    if (preselect.includes(f.format)) { chosen.set(f.format, { format: f.format, btc: f.format === 'BTC' ? btcFlavour.v : undefined }); c.classList.add('on'); c.textContent = '✓'; row.classList.add('on'); }
    nodes.push({ f, addr }); return row;
  };
  for (const f of FORMATS) list.append(item(f));
  const picker = el('div', {}, el('p', { class: 'muted small', text: 'Pick the formats to add from this phrase' }), list, allowIndex ? el('div', { class: 'row' }, el('div', { class: 'k', text: 'Account index' }), el('div', { class: 'v' }, idx)) : null, preview);
  picker.selected = () => [...chosen.values()].map((x) => ({ ...x, index: Number(idx.value || 0) }));
  picker.setAddresses = (list) => { for (const n of nodes) { const a = list.find((x) => x.format === n.f.format); n.addr.textContent = a ? shortAddr(a.address, 8, 4) : ''; } };
  idx.addEventListener('change', () => picker.onchange && picker.onchange());
  return picker;
}

function addSeedScreen() {
  let mode = 'create', mnemonic = '';
  const body = el('div', {});
  const seg = el('div', { class: 'seg', style: 'margin-bottom:10px' }, el('button', { class: 'on', text: 'Create new', onclick: () => set('create') }), el('button', { text: 'Import phrase', onclick: () => set('import') }));
  const set = (m) => { mode = m; seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 0) === (m === 'create'))); draw(); };
  const name = el('input', { placeholder: 'Main seed', maxlength: 40 }), pass = el('input', { type: 'password', placeholder: 'Optional BIP-39 passphrase', autocomplete: 'off' });
  const area = el('div', {});
  async function draw() {
    clear(area);
    if (mode === 'create') {
      const words = el('div', { class: 'seg' }, el('button', { class: 'on', text: '24 words', onclick: () => gen(24) }), el('button', { text: '12 words', onclick: () => gen(12) }));
      const grid = el('div', { class: 'card mono', style: 'columns:2;margin-top:8px;font-size:12px;line-height:1.7' });
      async function gen(n) { mnemonic = await send({ type: 'mnemonic:new', words: n }); words.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent.startsWith(String(n)))); clear(grid); mnemonic.split(' ').forEach((w, i) => grid.append(el('div', { text: `${i + 1}. ${w}` }))); }
      await gen(24);
      area.append(words, grid, el('p', { class: 'warn amber tiny', text: 'Write these words down in order and keep them offline. Anyone with them controls every account derived from them. They are shown once.' }),
        el('button', { class: 'primary', style: 'width:100%', text: 'I wrote it down — verify', onclick: () => verify() }));
    } else {
      const ta = el('textarea', { placeholder: '12, 15, 18, 21 or 24 words', rows: 4, spellcheck: false });
      area.append(ta, el('button', { class: 'primary', style: 'width:100%;margin-top:8px', text: 'Continue', onclick: async () => { mnemonic = ta.value.trim().toLowerCase().split(/\s+/).join(' '); try { await send({ type: 'seed:preview', mnemonic, passphrase: pass.value, formats: [] }); } catch (e) { return toast(e.message, true); } pickFormats(); } }));
    }
  }
  function verify() {
    const ws = mnemonic.split(' '); const picks = [...new Set([0, 0, 0].map(() => Math.floor(Math.random() * ws.length)))].sort((a, b) => a - b);
    while (picks.length < 3) { const i = Math.floor(Math.random() * ws.length); if (!picks.includes(i)) picks.push(i); }
    picks.sort((a, b) => a - b);
    const inputs = picks.map((i) => el('input', { placeholder: `Word #${i + 1}`, autocomplete: 'off', style: 'margin-top:8px' }));
    render(back('Verify your phrase', el('div', {}, el('p', { class: 'muted small', text: 'Type the requested words to confirm your backup.' }), ...inputs, el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Verify', onclick: () => { if (picks.every((p, k) => inputs[k].value.trim().toLowerCase() === ws[p])) pickFormats(); else toast('One or more words are wrong', true); } })), () => render(screen)));
  }
  function pickFormats() {
    const picker = formatPicker(['ZBC']);
    const btn = el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Add 1 account' });
    const update = async () => { const sel = picker.selected(); btn.textContent = `Add ${sel.length} account${sel.length === 1 ? '' : 's'}`; btn.disabled = !sel.length; try { picker.setAddresses(await send({ type: 'seed:preview', mnemonic, passphrase: pass.value, formats: sel })); } catch (e) { toast(e.message, true); } };
    picker.onchange = update; update();
    btn.addEventListener('click', async () => { try { const r = await send({ type: 'seed:add', name: name.value || 'Seed', mnemonic, passphrase: pass.value, formats: picker.selected() }); toast(`Added ${r.added.length} account(s)`); mnemonic = ''; refresh(); } catch (e) { toast(e.message, true); } });
    render(back(`Derive accounts · ${name.value || 'Seed'}`, el('div', {}, picker, btn)));
  }
  body.append(seg, el('label', { class: 'field', text: 'Name' }, name), el('label', { class: 'field', text: 'Passphrase' }, pass), el('div', { style: 'margin-top:12px' }, area));
  draw();
  const screen = back('Add a seed phrase', body);
  return screen;
}
function deriveScreen(seed) {
  const picker = formatPicker([]);
  const btn = el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Add account', disabled: true });
  const update = async () => { const sel = picker.selected(); btn.textContent = `Add ${sel.length} account${sel.length === 1 ? '' : 's'}`; btn.disabled = !sel.length; };
  picker.onchange = update;
  btn.addEventListener('click', async () => { try { const added = await send({ type: 'seed:derive', seedId: seed.id, formats: picker.selected() }); toast(added.length ? `Added ${added.map((a) => a.label).join(', ')}` : 'Those accounts already exist'); refresh(); } catch (e) { toast(e.message, true); } });
  // next free index hint
  send({ type: 'seed:nextIndex', seedId: seed.id, format: 'ZBC' }).then((n) => { const i = picker.querySelector('input[type=number]'); if (i) i.value = n; });
  return back(`Derive more · ${seed.name}`, el('div', {}, picker, btn));
}
function importKeyScreen(hint) {
  const fmt = el('select', {}, ...FORMATS.map((f) => el('option', { value: f.format, selected: hint && hint.format === f.format, text: `${f.name} (${f.hint})` })));
  const btc = el('span', { class: 'seg' }, ...['legacy', 'segwit', 'taproot'].map((b, i) => el('button', { class: i === 1 ? 'on' : '', text: b[0].toUpperCase() + b.slice(1), onclick: () => { btc.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === event.target)); preview(); } })));
  const key = el('input', { type: 'password', placeholder: '64 hex characters', autocomplete: 'off', spellcheck: false });
  const name = el('input', { placeholder: 'Name', maxlength: 40 }), nodeKey = el('input', { type: 'checkbox' });
  const opens = el('div', { class: 'mono', style: 'color:var(--teal)', text: '—' });
  const flavour = () => btc.querySelector('.on').textContent.toLowerCase();
  const preview = async () => { try { const r = await send({ type: 'key:preview', hex: key.value.trim(), format: fmt.value, btc: flavour() }); opens.textContent = r.address; if (hint && hint.address && hint.address !== r.address) toast('This key opens a different address than the one requested', true); } catch { opens.textContent = '—'; } };
  key.addEventListener('input', preview); fmt.addEventListener('change', () => { btc.style.display = fmt.value === 'BTC' ? '' : 'none'; preview(); });
  btc.style.display = fmt.value === 'BTC' ? '' : 'none';
  return back('Import a private key', el('div', {},
    hint ? el('div', { class: 'warn note', text: `Requested: ${hint.address}` }) : null,
    el('label', { class: 'field', text: 'Format' }, fmt), el('div', { style: 'margin-top:8px' }, btc),
    el('label', { class: 'field', text: 'Private key (64 hex)' }, key), el('label', { class: 'field', text: 'Name' }, name),
    fmt.value === 'ZBC' || true ? el('label', { class: 'flex small muted', style: 'margin-top:10px' }, nodeKey, ' This is a node key (allows blockchain economics votes)') : null,
    el('div', { class: 'card', style: 'margin-top:12px' }, el('div', { class: 'kicker', text: 'Opens' }), opens),
    el('div', { class: 'warn amber', text: 'A key is one account. Back it up yourself; it is not covered by any seed phrase.' }),
    el('button', { class: 'primary', style: 'width:100%', text: 'Import key', onclick: async () => { try { await send({ type: 'key:import', hex: key.value.trim(), format: fmt.value, btc: flavour(), name: name.value, nodeKey: nodeKey.checked }); key.value = ''; toast('Key imported'); refresh(); } catch (e) { toast(e.message, true); } } })));
}
function accountMenu(a) {
  const name = el('input', { value: a.label, maxlength: 40 });
  return back(a.label, el('div', {},
    el('div', { class: 'card' }, el('div', { class: 'flex' }, coin(a.format), el('div', { class: 'grow' }, el('div', { class: 'mono', text: a.address }))), el('div', { class: 'tiny muted', style: 'margin-top:6px', text: `${a.source === 'seed' ? `Seed account · index ${a.index}` : 'Imported key'} · typed ${a.typed.slice(0, 8)}…` }), el('div', { style: 'margin-top:6px' }, copyButton(a.address))),
    el('label', { class: 'field', text: 'Label' }, name), el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Rename', onclick: async () => { await send({ type: 'account:update', id: a.id, label: name.value }); toast('Renamed'); refresh(); } }),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: a.hidden ? 'Unhide' : 'Hide from lists', onclick: async () => { await send({ type: 'account:update', id: a.id, hidden: !a.hidden }); refresh(); } }),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: a.source === 'seed' ? 'Show seed phrase' : 'Show private key', onclick: () => render(revealScreen(a)) }),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Connected sites', onclick: () => showTab('sites') }),
    el('button', { class: 'danger', style: 'width:100%;margin-top:16px', text: a.source === 'seed' ? 'Remove this derived account' : 'Delete this key', onclick: async () => { if (!confirm(a.source === 'seed' ? 'Remove this account from the list? You can derive it again from its seed.' : 'Delete this key? Make sure it is backed up; it cannot be recovered from any phrase.')) return; await send({ type: 'account:delete', id: a.id }); refresh(); } })));
}
function seedMenu(s) {
  const name = el('input', { value: s.name, maxlength: 40 });
  return back(s.name, el('div', {}, el('label', { class: 'field', text: 'Name' }, name), el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Rename', onclick: async () => { await send({ type: 'seed:rename', seedId: s.id, name: name.value }); refresh(); } }),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Show seed phrase', onclick: () => render(revealScreen({ seedId: s.id, label: s.name })) }),
    el('button', { class: 'danger', style: 'width:100%;margin-top:16px', text: `Delete this seed and its ${s.accounts.length} account(s)`, onclick: () => { const pw = passwordField(); render(back('Delete seed', el('div', {}, el('p', { class: 'warn red', text: `Delete this seed and its ${s.accounts.length} account(s)? Keep the phrase to restore them.` }), el('label', { class: 'field', text: 'Password' }, pw), el('button', { class: 'danger', style: 'width:100%;margin-top:12px', text: 'Delete', onclick: async () => { try { await send({ type: 'seed:delete', seedId: s.id, password: pw.value }); refresh(); } catch (e) { toast(e.message, true); } } })))); } })));
}
function revealScreen(a) {
  const pw = passwordField();
  const out = el('div', { class: 'card mono blur', style: 'margin-top:12px;min-height:60px', text: '' });
  const body = el('div', {}, el('p', { class: 'muted small', text: 'Enter your password to reveal. The secret is shown blurred for 5 seconds; nothing is copied automatically.' }), el('label', { class: 'field', text: 'Password' }, pw),
    el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Reveal', onclick: async () => {
      try { const r = await send({ type: 'reveal', password: pw.value, seedId: a.seedId, accountId: a.seedId ? undefined : a.id }); const text = r.mnemonic ? r.mnemonic + (r.passphrase ? `\n\npassphrase: ${r.passphrase}` : '') : r.hex + (r.path ? `\n\npath: ${r.path}` : ''); out.textContent = text; out.classList.remove('show'); setTimeout(() => out.classList.add('show'), 5000);
        const copy = el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Copy (clears after 30 s)', onclick: async () => { await navigator.clipboard.writeText(r.mnemonic || r.hex); toast('Copied; the clipboard clears in 30 s'); setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000); } });
        body.append(copy); } catch (e) { toast('Wrong password', true); } } }), out);
  return back(`Reveal · ${a.label}`, body);
}
function addMultisigScreen() {
  const d = state.data;
  const ta = el('textarea', { placeholder: 'One participant address per line (any format)', rows: 4, spellcheck: false });
  const held = el('div', {}, ...[...d.seeds.flatMap((s) => s.accounts), ...d.keys].map((a) => el('label', { class: 'flex small', style: 'padding:3px 0' }, el('input', { type: 'checkbox', value: a.address, style: 'width:auto' }), coin(a.format), el('span', { class: 'grow', text: a.label }), el('span', { class: 'mono tiny muted', text: shortAddr(a.address) }))));
  const min = el('input', { type: 'number', min: 1, value: 2, style: 'width:90px' }), nonce = el('input', { type: 'number', min: 0, value: 0, style: 'width:120px' }), label = el('input', { placeholder: 'Treasury', maxlength: 40 });
  const preview = el('div', { class: 'mono', style: 'color:var(--teal)', text: '—' });
  const parts = () => [...ta.value.split(/\n/).map((s) => s.trim()).filter(Boolean), ...[...held.querySelectorAll('input:checked')].map((i) => i.value)];
  const upd = async () => { try { preview.textContent = await send({ type: 'multisig:preview', participants: parts(), min: Number(min.value), nonce: nonce.value }); } catch { preview.textContent = '—'; } };
  for (const n of [ta, min, nonce]) n.addEventListener('input', upd); held.addEventListener('change', upd);
  return back('Add multisig', el('div', {}, el('label', { class: 'field', text: 'Label' }, label), el('label', { class: 'field', text: 'Participants (paste)' }, ta), el('div', { class: 'section', text: 'Or tick held accounts' }), held,
    el('div', { class: 'row' }, el('div', { class: 'k', text: 'Signatures required' }), el('div', { class: 'v' }, min)), el('div', { class: 'row' }, el('div', { class: 'k', text: 'Nonce' }), el('div', { class: 'v' }, nonce)),
    el('div', { class: 'card', style: 'margin-top:10px' }, el('div', { class: 'kicker', text: 'Multisig address' }), preview),
    el('button', { class: 'primary', style: 'width:100%;margin-top:12px', text: 'Save multisig', onclick: async () => { try { await send({ type: 'multisig:add', label: label.value, participants: parts(), min: Number(min.value), nonce: nonce.value }); toast('Multisig saved'); refresh(); } catch (e) { toast(e.message, true); } } })));
}
function multisigMenu(m) {
  return back(m.label, el('div', {}, el('div', { class: 'card' }, el('div', { class: 'mono', text: m.address }), el('div', { class: 'tiny muted', style: 'margin-top:6px', text: `${m.multisig.min} of ${m.multisig.participants.length} · nonce ${m.multisig.nonce}` }), copyButton(m.address)),
    el('div', { class: 'section', text: 'Participants' }), ...m.participants.map((p) => el('div', { class: 'list-item' }, el('span', { class: 'check' + (p.held ? ' on' : ''), text: p.held ? '✓' : '' }), el('div', { class: 'grow' }, el('div', { class: 'name', text: p.label || (p.held ? 'Held' : 'Not held') }), el('div', { class: 'sub mono', text: shortAddr(p.display, 10, 4) })))),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:12px', text: 'Register on-chain (copy unsigned bytes)', onclick: async () => { try { const r = await send({ type: 'multisig:createTx', id: m.id }); await navigator.clipboard.writeText(JSON.stringify(r)); toast('Unsigned type-5 transaction copied; sign it from a page (test/dapp.html) or the wallet'); } catch (e) { toast(e.message, true); } } }),
    el('button', { class: 'danger', style: 'width:100%;margin-top:16px', text: 'Delete this setup (keeps participant keys)', onclick: async () => { if (confirm('Delete this multisig setup? Participant keys stay in the vault.')) { await send({ type: 'multisig:delete', id: m.id }); refresh(); } } })));
}

// ---------------------------------------------------------------- sites / activity
async function sitesScreen() {
  const sites = await send({ type: 'sites:list' });
  const main = el('div', { class: 'content' }, el('h3', { style: 'margin:6px 0 10px', text: 'Connected sites' }));
  if (!sites.length) main.append(el('p', { class: 'muted', text: 'No site is connected yet.' }));
  for (const s of sites) main.append(el('div', { class: 'list-item' }, el('div', { class: 'grow' }, el('div', { class: 'name', text: s.origin.replace(/^https?:\/\//, '') }), el('div', { class: 'sub', text: `${s.accounts.length === 1 ? (s.accounts[0].label || shortAddr(s.accounts[0].display)) : s.accounts.length + ' accounts'} · ${timeAgo(s.lastActivity)}` })), el('button', { class: 'small ghost', text: 'Disconnect', onclick: async () => { await send({ type: 'sites:disconnect', origin: s.origin }); showTab('sites'); } })));
  return main;
}
async function activityScreen() {
  const log = await send({ type: 'log:list', limit: 200 });
  const main = el('div', { class: 'content' }, el('h3', { style: 'margin:6px 0 10px', text: 'Activity' }));
  if (!log.length) main.append(el('p', { class: 'muted', text: 'Nothing signed yet.' }));
  for (const l of log) main.append(el('div', { class: 'list-item' }, el('div', { class: 'grow' }, el('div', { class: 'name', text: l.title }), el('div', { class: 'sub', text: `${l.origin.replace(/^https?:\/\//, '')} · ${l.accountLabel || ''} · ${fmtDate(l.at)}${l.auto ? ' · session key' : ''}${l.submitted === false ? ' · broadcast failed' : ''}` }), l.hash ? el('div', { class: 'sub mono', text: 'ZTX_' + l.hash.slice(0, 16).toUpperCase() + '…' }) : null), l.hash ? copyButton(l.hash) : null));
  return main;
}

// ---------------------------------------------------------------- settings
async function settingsScreen() {
  const s = state.data.settings;
  const main = el('div', { class: 'content' }, el('h3', { style: 'margin:6px 0 10px', text: 'Settings' }));
  const save = async (patch) => { try { state.data.settings = await send({ type: 'settings:set', settings: patch }); toast('Saved'); } catch (e) { toast(e.message, true); } };
  const row = (k, v) => el('div', { class: 'row' }, el('div', { class: 'k', text: k }), el('div', { class: 'v' }, v));
  const autolock = el('input', { type: 'number', min: 1, max: 240, value: s.autoLockMinutes, style: 'width:90px', onchange: (e) => save({ autoLockMinutes: Number(e.target.value) }) });
  const net = el('select', { style: 'width:auto', onchange: (e) => save({ network: e.target.value }) }, el('option', { value: 'testnet', selected: s.network === 'testnet', text: 'TestNet' }), el('option', { value: 'mainnet', selected: s.network === 'mainnet', text: 'MainNet' }));
  const nodeT = el('input', { placeholder: 'https://zoobc.net', value: (s.nodes || {}).testnet || '' }), nodeM = el('input', { placeholder: 'https://zoobc.network', value: (s.nodes || {}).mainnet || '' });
  const toggle = (key, label, hint) => el('label', { class: 'flex', style: 'padding:8px 0;cursor:pointer' }, el('input', { type: 'checkbox', checked: !!s[key], style: 'width:auto', onchange: (e) => save({ [key]: e.target.checked }) }), el('div', { class: 'grow' }, el('div', { text: label }), hint ? el('div', { class: 'tiny muted', text: hint }) : null));
  const lang = el('select', { style: 'width:auto', onchange: (e) => save({ language: e.target.value }) }, ...Object.entries(LANGS).map(([k, v]) => el('option', { value: k, selected: s.language === k, text: v })));
  main.append(row('Auto-lock after (minutes)', autolock), row('Default network', net), row('Language', lang),
    el('div', { class: 'section', text: 'Personal nodes (https, asked for permission)' }), el('label', { class: 'field', text: 'TestNet node URL' }, nodeT), el('label', { class: 'field', text: 'MainNet node URL' }, nodeM),
    el('button', { class: 'ghost', style: 'width:100%;margin-top:8px', text: 'Save node URLs', onclick: async () => { for (const u of [nodeT.value, nodeM.value]) if (u.trim()) { try { await send({ type: 'permissions:request', node: u.trim() }); } catch {} } save({ nodes: { testnet: nodeT.value.trim(), mainnet: nodeM.value.trim() } }); } }),
    el('div', { class: 'section', text: 'Advanced' }),
    toggle('sessionKeys', 'Session keys for game moves', 'Types 26–28 for one game and one site, up to 2 hours, with a notification per auto-signed move. Never for anything that moves value.'),
    toggle('blindDigest', 'Allow blind digest signing', 'Lets a page ask for a signature over a bare 32-byte digest with no preimage. A full-screen red warning is shown each time.'),
    toggle('trustPageGenesis', 'Trust the page\'s genesis when no node is reachable (developer)', 'Off: a request whose genesis the signer cannot verify against a node is refused (4901).'),
    el('div', { class: 'section', text: 'Network status' }), el('div', { class: 'card small', id: 'netinfo', text: 'Loading…' }),
    el('div', { class: 'section', text: 'Passkey unlock' }),
    el('div', { class: 'flex' }, el('button', { class: 'ghost grow', text: state.status.passkey ? 'Replace passkey' : 'Register passkey', onclick: async () => { try { const { credId, prf } = await passkeyRegister(); await send({ type: 'passkey:wrap', credId, prf }); toast('Passkey registered'); refresh(); } catch (e) { toast(e.message, true); } } }), state.status.passkey ? el('button', { class: 'ghost', text: 'Remove', onclick: async () => { await send({ type: 'passkey:remove' }); refresh(); } }) : null),
    el('div', { class: 'section', text: 'Backup' }),
    el('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap' }, el('button', { class: 'ghost grow', text: 'Import ZooBC Wallet backup', onclick: () => render(walletImportScreen()) }), el('button', { class: 'ghost grow', text: 'Export vault (JSON, plain)', onclick: () => render(exportScreen()) })),
    el('div', { class: 'section', text: 'Developer' }),
    el('button', { class: 'ghost', style: 'width:100%', text: 'Run self-tests', onclick: async (e) => { e.target.disabled = true; e.target.textContent = 'Running…'; const r = await send({ type: 'selftest' }); e.target.disabled = false; e.target.textContent = 'Run self-tests'; const box = el('div', { class: 'card small', style: 'margin-top:8px' }, ...r.map((t) => el('div', { style: t.ok ? 'color:var(--green)' : 'color:#ffb3b3', text: `${t.ok ? '✓' : '✗'} ${t.name}${t.detail ? ' — ' + t.detail : ''}` }))); e.target.after(box); } }),
    isOptions ? null : el('button', { class: 'link small', style: 'margin-top:10px', text: 'Open full settings page', onclick: () => chrome.runtime.openOptionsPage() }),
    el('div', { class: 'section', text: 'Danger zone' }),
    el('button', { class: 'danger', style: 'width:100%', text: 'Reset vault (delete everything on this browser)', onclick: async () => { if (confirm('Delete the vault, all seeds, keys and site permissions on this browser? Keep your phrases to restore.')) { await send({ type: 'vault:reset' }); refresh(); } } }),
    el('p', { class: 'dim tiny center', style: 'margin-top:16px', text: `ZooBC Signer ${chrome.runtime.getManifest().version} · spec 1.1` }));
  send({ type: 'network:info' }).then((n) => { const b = main.querySelector('#netinfo'); if (!b) return; b.textContent = n.error ? `Could not read the node: ${n.error}` : `${n.label} · genesis ${n.short} · tag ${n.tag} · ${n.node}${n.height ? ` · height ${n.height}` : ''}`; }).catch(() => {});
  return main;
}
function walletImportScreen() {
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  const list = el('div', {}); let backup = null;
  file.addEventListener('change', async () => { try { backup = JSON.parse(await file.files[0].text()); clear(list); const seeds = backup.seeds || [], keys = backup.keys || [], accounts = backup.accounts || []; list.append(el('p', { class: 'small muted', text: `${seeds.length} seed(s), ${keys.length} key(s), ${accounts.length} account(s) found. Duplicates are skipped.` }), el('button', { class: 'primary', style: 'width:100%', text: 'Import all', onclick: async () => { try { const added = await send({ type: 'wallet:import', backup }); toast(`Imported ${added.length} account(s)`); refresh(); } catch (e) { toast(e.message, true); } } })); } catch (e) { toast('Not a wallet backup: ' + e.message, true); } });
  return back('Import from the ZooBC Wallet', el('div', {}, el('p', { class: 'muted small', text: 'Choose the wallet\'s backup file (seeds with names, keys, accounts with fmt/idx/btc).' }), file, list));
}
function exportScreen() {
  const pw = passwordField();
  return back('Export vault', el('div', {}, el('div', { class: 'warn red', text: 'The export contains every seed phrase and private key in plain text. Store it only on an encrypted disk.' }), el('label', { class: 'field', text: 'Password' }, pw),
    el('button', { class: 'danger', style: 'width:100%;margin-top:12px', text: 'Download JSON', onclick: async () => { try { const data = await send({ type: 'vault:export', password: pw.value }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'zoobc-signer-backup.json'; a.click(); } catch (e) { toast('Wrong password', true); } } })));
}

refresh();
