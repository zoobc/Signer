// Shared UI helpers for the popup, approval window and options page.
export const send = (msg) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(msg, (r) => {
    if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
    if (!r) return reject(new Error('No response from the signer'));
    if (r.ok) resolve(r.result); else { const e = new Error(r.error.message); e.code = r.error.code; reject(e); }
  });
});

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

export function coin(format, small) { const f = format === 'MULTISIG' ? 'MS' : format; return el('span', { class: 'coin ' + f + (small ? ' small' : ''), 'data-no-dec': true, text: format === 'MULTISIG' ? 'MS' : format }); }
export function shortAddr(s, head = 8, tail = 4) { if (!s) return ''; if (s.length <= head + tail + 1) return s; return s.slice(0, head) + '…' + s.slice(-tail); }
export function mono(text, short = true) { return el('span', { class: 'mono', 'data-no-dec': true, title: text, text: short ? shortAddr(text) : text }); }
export function copyButton(text) { return el('button', { class: 'small ghost', 'data-no-dec': true, text: 'Copy', onclick: async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy'; }, 1200); } }); }

export function timeAgo(unix) {
  const d = Math.floor(Date.now() / 1000) - unix;
  if (d < 60) return 'just now'; if (d < 3600) return `${Math.floor(d / 60)} min ago`; if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  if (d < 86400 * 2) return 'yesterday'; return new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function fmtDate(unix) { const n = Number(unix); if (!n) return '—'; return new Date(n * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

/** Render a describe() row value. */
export function renderValue(v, labelFor) {
  if (!v) return el('span', { text: '—' });
  switch (v.kind) {
    case 'amount': return el('span', { text: v.text });
    case 'address': { const label = v.label || (labelFor && labelFor(v.hex)); return el('span', { class: 'flex', style: 'justify-content:flex-end' }, label ? el('span', { text: label + ' · ' }) : null, mono(v.display), copyButton(v.display)); }
    case 'date': return el('span', { text: (v.approx ? '≈ ' : '') + fmtDate(v.unix) });
    case 'block': return el('span', { text: v.approxUnix ? `block ${v.height} (≈ ${fmtDate(v.approxUnix)})` : v.text });
    case 'quote': return el('div', { class: 'quote', text: v.full ? v.text.slice(0, 200) + '…' : v.text }, v.full ? el('button', { class: 'link small', text: 'show all', onclick: (e) => { e.target.parentNode.textContent = v.text; } }) : null);
    case 'json': return el('pre', { class: 'quote', style: 'max-height:160px;overflow:auto', text: v.text });
    case 'code': return mono(v.text, v.text.length > 40);
    case 'list': return el('div', {}, ...v.items.map((i) => el('div', {}, renderValue(i, labelFor))));
    default: return el('span', { text: v.text });
  }
}
export function renderRows(rows, labelFor) {
  return el('div', { class: 'rows' }, ...rows.map((r) => el('div', { class: 'row' + (r.bold ? ' bold' : '') }, el('div', { class: 'k', text: r.label }), el('div', { class: 'v' }, renderValue(r.value, labelFor)))));
}

/** §7.1: render the decimal point and following digits at .85em/65% wherever an amount appears. */
const DEC_RE = /(\d)(\.\d+)/g;
export function applyDecimals(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('input,textarea,script,style,.mono,.dec,[data-no-dec],code,pre')) return NodeFilter.FILTER_REJECT;
      return DEC_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment(); let last = 0; const s = n.nodeValue; DEC_RE.lastIndex = 0; let m;
    while ((m = DEC_RE.exec(s))) { frag.append(s.slice(last, m.index + 1)); frag.append(el('span', { class: 'dec', text: m[2] })); last = m.index + m[0].length; }
    frag.append(s.slice(last)); n.parentNode.replaceChild(frag, n);
  }
}
export function watchDecimals(root) { applyDecimals(root); const mo = new MutationObserver(() => { mo.disconnect(); applyDecimals(root); mo.observe(root, { childList: true, subtree: true, characterData: true }); }); mo.observe(root, { childList: true, subtree: true, characterData: true }); }

export function toast(msg, isError = false) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast' + (isError ? ' error' : ''), text: msg });
  document.body.append(t); setTimeout(() => t.remove(), isError ? 5000 : 2500);
}

/** Hold-to-confirm button: fires onConfirm after 2 s of continuous press. */
export function holdButton(label, onConfirm, cls = 'primary') {
  const bar = el('div', { class: 'bar' });
  const b = el('button', { class: cls + ' hold' }, bar, el('span', { text: label }));
  let timer = null, start = 0, raf = null;
  const stop = () => { clearTimeout(timer); cancelAnimationFrame(raf); timer = null; bar.style.width = '0'; };
  const tick = () => { bar.style.width = Math.min(100, (Date.now() - start) / 20) + '%'; raf = requestAnimationFrame(tick); };
  b.addEventListener('pointerdown', (e) => { if (b.disabled) return; e.preventDefault(); start = Date.now(); tick(); timer = setTimeout(() => { stop(); onConfirm(); }, 2000); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!timer) { start = Date.now(); tick(); timer = setTimeout(() => { stop(); onConfirm(); }, 2000); } } });
  b.addEventListener('keyup', stop);
  return b;
}
export const networkPill = (net) => el('span', { class: 'pill ' + (net && net.id === 'mainnet' ? 'mainnet' : net && net.id === 'testnet' ? 'testnet' : 'unknown'), 'data-no-dec': true, text: net ? net.label + (net.unverified ? ' ?' : '') : '—' });
export function passwordField(placeholder = 'Password') { return el('input', { type: 'password', placeholder, autocomplete: 'current-password' }); }

/** WebAuthn PRF helpers for passkey unlock (§9.1). Returns base64 PRF output or throws. */
export async function passkeyRegister() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name: 'ZooBC Signer' }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'zoobc-signer', displayName: 'ZooBC Signer vault' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, extensions: { prf: { eval: { first: prfSalt() } } } } });
  const ext = cred.getClientExtensionResults();
  const credId = b64(new Uint8Array(cred.rawId));
  if (!ext.prf || !ext.prf.results) { const a = await passkeyAssert(credId); return { credId, prf: a }; }
  return { credId, prf: b64(new Uint8Array(ext.prf.results.first)) };
}
export async function passkeyAssert(credId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await navigator.credentials.get({ publicKey: { challenge, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: unb64(credId) }], extensions: { prf: { eval: { first: prfSalt() } } } } });
  const ext = a.getClientExtensionResults();
  if (!ext.prf || !ext.prf.results) throw new Error('This passkey does not support the PRF extension');
  return b64(new Uint8Array(ext.prf.results.first));
}
function prfSalt() { return new TextEncoder().encode('zoobc-signer-vault-v1').slice(0, 32); }
export function b64(b) { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }
export function unb64(s) { const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < o.length; i++) o[i] = bin.charCodeAt(i); return o; }
