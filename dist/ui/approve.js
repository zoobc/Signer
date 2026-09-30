// src/ui/ui.js
var send = (msg) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(msg, (r) => {
    if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
    if (!r) return reject(new Error("No response from the signer"));
    if (r.ok) resolve(r.result);
    else {
      const e = new Error(r.error.message);
      e.code = r.error.code;
      reject(e);
    }
  });
});
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === void 0 || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== void 0 && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
var clear = (n) => {
  while (n.firstChild) n.removeChild(n.firstChild);
  return n;
};
function coin(format, small) {
  const f = format === "MULTISIG" ? "MS" : format;
  return el("span", { class: "coin " + f + (small ? " small" : ""), "data-no-dec": true, text: format === "MULTISIG" ? "MS" : format });
}
function shortAddr(s, head = 8, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return s.slice(0, head) + "\u2026" + s.slice(-tail);
}
function mono(text, short = true) {
  return el("span", { class: "mono", "data-no-dec": true, title: text, text: short ? shortAddr(text) : text });
}
function copyButton(text) {
  return el("button", { class: "small ghost", "data-no-dec": true, text: "Copy", onclick: async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    e.target.textContent = "Copied";
    setTimeout(() => {
      e.target.textContent = "Copy";
    }, 1200);
  } });
}
function fmtDate(unix) {
  const n = Number(unix);
  if (!n) return "\u2014";
  return new Date(n * 1e3).toLocaleString(void 0, { dateStyle: "medium", timeStyle: "short" });
}
function renderValue(v, labelFor) {
  if (!v) return el("span", { text: "\u2014" });
  switch (v.kind) {
    case "amount":
      return el("span", { text: v.text });
    case "address": {
      const label = v.label || labelFor && labelFor(v.hex);
      return el("span", { class: "flex", style: "justify-content:flex-end" }, label ? el("span", { text: label + " \xB7 " }) : null, mono(v.display), copyButton(v.display));
    }
    case "date":
      return el("span", { text: (v.approx ? "\u2248 " : "") + fmtDate(v.unix) });
    case "block":
      return el("span", { text: v.approxUnix ? `block ${v.height} (\u2248 ${fmtDate(v.approxUnix)})` : v.text });
    case "quote":
      return el("div", { class: "quote", text: v.full ? v.text.slice(0, 200) + "\u2026" : v.text }, v.full ? el("button", { class: "link small", text: "show all", onclick: (e) => {
        e.target.parentNode.textContent = v.text;
      } }) : null);
    case "json":
      return el("pre", { class: "quote", style: "max-height:160px;overflow:auto", text: v.text });
    case "code":
      return mono(v.text, v.text.length > 40);
    case "list":
      return el("div", {}, ...v.items.map((i) => el("div", {}, renderValue(i, labelFor))));
    default:
      return el("span", { text: v.text });
  }
}
function renderRows(rows, labelFor) {
  return el("div", { class: "rows" }, ...rows.map((r) => el("div", { class: "row" + (r.bold ? " bold" : "") }, el("div", { class: "k", text: r.label }), el("div", { class: "v" }, renderValue(r.value, labelFor)))));
}
var DEC_RE = /(\d)(\.\d+)/g;
function applyDecimals(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("input,textarea,script,style,.mono,.dec,[data-no-dec],code,pre")) return NodeFilter.FILTER_REJECT;
      return DEC_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    let last = 0;
    const s = n.nodeValue;
    DEC_RE.lastIndex = 0;
    let m;
    while (m = DEC_RE.exec(s)) {
      frag.append(s.slice(last, m.index + 1));
      frag.append(el("span", { class: "dec", text: m[2] }));
      last = m.index + m[0].length;
    }
    frag.append(s.slice(last));
    n.parentNode.replaceChild(frag, n);
  }
}
function watchDecimals(root) {
  applyDecimals(root);
  const mo = new MutationObserver(() => {
    mo.disconnect();
    applyDecimals(root);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
}
function toast(msg, isError = false) {
  document.querySelectorAll(".toast").forEach((t2) => t2.remove());
  const t = el("div", { class: "toast" + (isError ? " error" : ""), text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), isError ? 5e3 : 2500);
}
function holdButton(label, onConfirm, cls = "primary") {
  const bar = el("div", { class: "bar" });
  const b = el("button", { class: cls + " hold" }, bar, el("span", { text: label }));
  let timer = null, start = 0, raf = null;
  const stop = () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    timer = null;
    bar.style.width = "0";
  };
  const tick = () => {
    bar.style.width = Math.min(100, (Date.now() - start) / 20) + "%";
    raf = requestAnimationFrame(tick);
  };
  b.addEventListener("pointerdown", (e) => {
    if (b.disabled) return;
    e.preventDefault();
    start = Date.now();
    tick();
    timer = setTimeout(() => {
      stop();
      onConfirm();
    }, 2e3);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
  b.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!timer) {
        start = Date.now();
        tick();
        timer = setTimeout(() => {
          stop();
          onConfirm();
        }, 2e3);
      }
    }
  });
  b.addEventListener("keyup", stop);
  return b;
}
var networkPill = (net) => el("span", { class: "pill " + (net && net.id === "mainnet" ? "mainnet" : net && net.id === "testnet" ? "testnet" : "unknown"), "data-no-dec": true, text: net ? net.label + (net.unverified ? " ?" : "") : "\u2014" });
function passwordField(placeholder = "Password") {
  return el("input", { type: "password", placeholder, autocomplete: "current-password" });
}
async function passkeyAssert(credId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await navigator.credentials.get({ publicKey: { challenge, userVerification: "required", allowCredentials: [{ type: "public-key", id: unb64(credId) }], extensions: { prf: { eval: { first: prfSalt() } } } } });
  const ext = a.getClientExtensionResults();
  if (!ext.prf || !ext.prf.results) throw new Error("This passkey does not support the PRF extension");
  return b64(new Uint8Array(ext.prf.results.first));
}
function prfSalt() {
  return new TextEncoder().encode("zoobc-signer-vault-v1").slice(0, 32);
}
function b64(b) {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < o.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}

// src/ui/approve.js
var app = document.getElementById("app");
watchDecimals(app);
var current = null;
chrome.runtime.onMessage.addListener((m) => {
  if (m && m.type === "approve:refresh") load();
});
async function load() {
  let data;
  try {
    data = await send({ type: "approve:list" });
  } catch (e) {
    return render(errorScreen(e.message));
  }
  if (data.locked) return render(lockedScreen(data));
  if (!data.head) {
    render(el("div", { class: "content center", style: "padding-top:120px" }, el("img", { class: "logo", src: "icons/logo.png", alt: "ZooBC" }), el("p", { class: "muted", text: "Nothing to approve." })));
    setTimeout(async () => {
      try {
        const d = await send({ type: "approve:list" });
        if (d.head || d.locked) return load();
      } catch {
      }
      window.close();
    }, 900);
    return;
  }
  current = data.head;
  const v = current.view;
  if (!v) return render(errorScreen(current.error && current.error.message || "This request could not be prepared."));
  const screen = { connect: connectScreen, tx: txScreen, digest: digestScreen, message: messageScreen, multisig: multisigScreen, "not-held": notHeldScreen, error: (v2) => errorScreen(v2.error.message) }[v.kind];
  render(screen ? screen(v, data) : errorScreen("Unknown request kind"), data);
}
function render(node, data) {
  clear(app);
  app.append(node);
  if (data && data.waiting) app.prepend(el("div", { class: "warn note tiny", style: "margin:0;border-radius:0", text: `${data.waiting} more waiting` }));
}
function header(v) {
  const of = v.originFlags || { shown: v.origin };
  return el(
    "div",
    { class: "header" },
    el("span", { class: "favicon", text: (of.host || "?").replace(/^www\./, "")[0].toUpperCase() }),
    el("span", { class: "origin" + (of.insecure ? " insecure" : ""), title: v.origin, text: (of.insecure ? "http: " : "") + (of.host || v.origin) + (of.ip ? " (IP address)" : "") }),
    networkPill(v.network)
  );
}
var accountChip = (a) => el("div", { style: "margin:6px 0 12px" }, el("span", { class: "chip" }, coin(a.multisig ? "MULTISIG" : a.format), el("span", { text: a.label || a.format + " account" }), el("span", { class: "mono", text: "\xB7 " + shortAddr(a.address) })));
var warnings = (list) => el("div", {}, ...(list || []).map((w) => el("div", { class: "warn " + (w.level || "note"), text: w.text })));
var notes = (list) => el("div", {}, ...(list || []).map((n) => el("div", { class: "note", text: n })));
function siteSays(v) {
  const i = v.intent || {};
  const m = v.match || { ok: true, diffs: [] };
  const box = el("div", { class: "card", style: "margin-top:12px;background:var(--ink2)" }, el("div", { class: "kicker", text: `What the site says \xB7 ${v.originFlags ? v.originFlags.host : v.origin}` }));
  if (i.title) box.append(el("div", { style: "margin-top:4px;font-weight:600", text: i.title }));
  if (i.summary) box.append(el("div", { class: "muted small", text: i.summary }));
  if (i.rows && i.rows.length && m.ok) box.append(el("div", { class: "small muted", style: "margin-top:4px" }, ...i.rows.map((r) => el("div", { text: `${r[0]}: ${r[1]}` }))));
  if (!i.title && !i.summary && !(i.rows && i.rows.length) && !i.typeName) box.append(el("div", { class: "muted small", text: "The site gave no description." }));
  box.append(el("div", { class: "badge " + (m.ok ? "ok" : "warn"), text: m.ok ? "\u2713 Matches what the site says" + (i.title ? `: \u201C${i.title}\u201D` : "") : "\u26A0 Differs from what the site says" }));
  if (!m.ok) {
    const t = el("table", { class: "diff" }, el("tr", {}, el("th", { text: "" }), el("th", { text: "Site says" }), el("th", { text: "Transaction does" })));
    for (const d of m.diffs) t.append(el("tr", {}, el("td", { class: "muted", text: d.label }), el("td", { class: "site", text: d.site }), el("td", { class: "tx" + (d.severity === "red" ? " red" : ""), style: d.severity === "red" ? "color:#ffb3b3" : "", text: d.tx })));
    box.append(t);
  }
  return box;
}
function mismatchCheckbox(v, onChange) {
  if (!v.match || v.match.ok) return null;
  const c = el("span", { class: "check" });
  const box = el("label", { class: "flex", style: "margin:10px 0;cursor:pointer" }, c, el("span", { class: "small", text: "I have checked the details above" }));
  let on = false;
  box.addEventListener("click", () => {
    on = !on;
    c.classList.toggle("on", on);
    c.textContent = on ? "\u2713" : "";
    onChange(on);
  });
  return box;
}
function shareBox(v) {
  if (!v.share) return null;
  return el("div", { class: "warn note", text: `Signing will also share ${v.account.label || "this account"} with ${v.originFlags ? v.originFlags.host : v.origin}.` });
}
function rawBytes(raw, extra) {
  if (!raw) return null;
  return el("details", { class: "raw" }, el("summary", { text: "Show raw bytes \u25B8" }), el("pre", { text: raw.hex }), el("pre", { text: raw.fields.map(([k, v]) => `${k}: ${v}`).join("\n") + (extra ? "\n" + extra : "") }));
}
function actions(v, { primary = "Sign", onApprove, hold = false, danger = false, disabled = () => false }) {
  const reject = el("button", { class: "ghost", text: "Reject", onclick: () => decide(false) });
  const btn = hold ? holdButton(danger ? primary : `Hold to ${primary.toLowerCase()}`, onApprove, danger ? "danger" : "primary") : el("button", { class: danger ? "danger" : "primary", text: primary, onclick: onApprove });
  const bar = el("div", { class: "actions" }, reject, btn);
  bar.update = () => {
    btn.disabled = disabled();
  };
  bar.update();
  return bar;
}
async function decide(approved, options = {}) {
  const id = current.id;
  let r;
  try {
    r = await send({ type: "approve:decide", id, approved, options });
  } catch (e) {
    toast(e.message, true);
    return;
  }
  if (r && r.locked) return load();
  if (approved && r && r.error) {
    toast(r.error.message, true);
    setTimeout(load, 1800);
    return;
  }
  if (approved && r && r.result) {
    const hash = r.result.txHash;
    render(el("div", { class: "content center", style: "padding-top:100px" }, el("div", { class: "logo", style: "background:var(--green)", text: "\u2713" }), el("h2", { text: "Signed" }), hash ? el("div", { class: "flex", style: "justify-content:center" }, mono(hash), copyButton(hash)) : null));
    setTimeout(load, 1500);
    return;
  }
  load();
}
function lockedScreen(data) {
  const pw = passwordField();
  pw.autofocus = true;
  const root = el(
    "div",
    { class: "content", style: "padding-top:60px" },
    el("div", { class: "center" }, el("img", { class: "logo", src: "icons/logo.png", alt: "ZooBC" }), el("h2", { style: "margin:10px 0 4px", text: "ZooBC Signer" })),
    el("div", { class: "warn note", text: data.head ? `${data.head.origin.replace(/^https?:\/\//, "")} is waiting for a signature. Unlock to review it.` : "Unlock to continue." }),
    el("label", { class: "field", text: "Password" }, pw),
    el("button", { class: "primary", style: "width:100%;margin-top:12px", text: "Unlock", onclick: doUnlock }),
    el("button", { class: "ghost", style: "width:100%;margin-top:8px", text: "Use passkey", onclick: async () => {
      try {
        const pk = await send({ type: "passkey:get" });
        if (!pk) return toast("No passkey registered", true);
        const prf = await passkeyAssert(pk.credId);
        await send({ type: "passkey:unlock", prf });
        load();
      } catch (e) {
        toast(e.message, true);
      }
    } }),
    el("p", { class: "dim tiny center", text: "Forgot password? Reset and restore from phrases in the toolbar popup." })
  );
  async function doUnlock() {
    try {
      await send({ type: "vault:unlock", password: pw.value });
      load();
    } catch (e) {
      toast("Wrong password", true);
    }
  }
  pw.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doUnlock();
  });
  return root;
}
function errorScreen(msg) {
  return el("div", { class: "content", style: "padding-top:80px" }, el("div", { class: "warn red", text: msg }), el("button", { class: "ghost", style: "width:100%", text: "Close", onclick: () => decide(false) }));
}
function connectScreen(v, data) {
  const chosen = new Set(v.accounts.filter((a) => a.checked).map((a) => a.typed));
  const list = el("div", {});
  const groups = /* @__PURE__ */ new Map();
  for (const a of v.accounts) {
    const g = a.source === "seed" ? (v.groups.find((s) => s.id === a.seedId) || { name: "Seed" }).name : "Imported keys";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(a);
  }
  const rowFor = (a, isMs) => {
    const c = el("span", { class: "check" + (chosen.has(a.typed) ? " on" : ""), text: chosen.has(a.typed) ? "\u2713" : "" });
    const r = el("div", { class: "list-item selectable" + (chosen.has(a.typed) ? " on" : "") }, c, coin(isMs ? "MULTISIG" : a.format), el("div", { class: "grow" }, el("div", { class: "name", text: a.label }), el("div", { class: "sub mono", text: shortAddr(a.address) + (a.btc ? ` \xB7 ${a.btc}` : "") + (isMs ? ` \xB7 ${a.multisig.min}/${a.multisig.participants.length}` : "") })), a.checked ? el("span", { class: "tiny muted", text: "last used" }) : a.shared ? el("span", { class: "tiny muted", text: "shared" }) : null);
    r.addEventListener("click", () => {
      if (chosen.has(a.typed)) chosen.delete(a.typed);
      else chosen.add(a.typed);
      c.classList.toggle("on");
      c.textContent = chosen.has(a.typed) ? "\u2713" : "";
      r.classList.toggle("on");
      update();
    });
    return r;
  };
  for (const [g, accs] of groups) {
    list.append(el("div", { class: "section", text: g }));
    for (const a of accs) list.append(rowFor(a));
  }
  if (v.multisigs.length) {
    list.append(el("div", { class: "section", text: "Multisig (held here)" }));
    for (const m of v.multisigs) list.append(rowFor(m, true));
  }
  if (!v.accounts.length && !v.multisigs.length) list.append(el("p", { class: "muted", text: "No accounts yet. Add a seed phrase or import a key in the toolbar popup first." }));
  const btn = el("button", { class: "primary", onclick: () => decide(true, { accounts: [...chosen] }) });
  const update = () => {
    btn.textContent = `Connect ${chosen.size} account${chosen.size === 1 ? "" : "s"}`;
    btn.disabled = chosen.size === 0;
  };
  update();
  return el(
    "div",
    { id: "app" },
    header(v),
    el(
      "div",
      { id: "main", class: "content" },
      el("h2", { class: "title", text: "Connect to this site?" }),
      el("p", { class: "muted small", text: `${v.originFlags.host} will see the addresses you choose. It cannot move funds without asking you.` }),
      v.originFlags.insecure ? el("div", { class: "warn red", text: "This site is not using HTTPS. Anything it sends can be altered on the way." }) : null,
      list,
      el("p", { class: "dim tiny", text: "Only share addresses; this site cannot move funds without asking you." })
    ),
    el("div", { class: "actions" }, el("button", { class: "ghost", text: "Cancel", onclick: () => decide(false) }), btn)
  );
}
function notHeldScreen(v) {
  return el(
    "div",
    { id: "app" },
    header(v),
    el(
      "div",
      { id: "main", class: "content center", style: "padding-top:40px" },
      el("div", { class: "logo", style: "background:var(--card2);color:var(--muted)", text: "?" }),
      el("h2", { class: "title", style: "margin-top:12px", text: "This signer doesn't hold this account" }),
      el("p", { class: "muted small", text: `${v.originFlags.host} asked for a signature from` }),
      el("div", { class: "card", style: "text-align:left" }, el("div", { class: "flex" }, coin(v.account.multisig ? "MULTISIG" : v.account.format || "ZBC"), el("div", {}, el("div", { class: "name", text: v.account.multisig ? "Multisig account" : `${v.account.format || "Unknown"} account` }), el("div", { class: "mono", text: v.account.address }))), el("div", { style: "margin-top:6px" }, copyButton(v.account.address))),
      el("p", { class: "muted small", text: "Nothing was signed. Import the seed phrase or private key of this account to sign with it here." })
    ),
    el("div", { class: "actions" }, el("button", { class: "ghost", text: "Close", onclick: () => decide(false, {}, "not held") }), el("button", { class: "primary", text: "Import it", onclick: async () => {
      await chrome.storage.session.set({ importHint: { format: v.account.format, address: v.account.address } });
      chrome.runtime.openOptionsPage();
      decide(false);
    } }))
  );
}
function txScreen(v) {
  const d = v.described;
  let checked = false, sessionKey = false;
  const main = el("div", { id: "main", class: "content" });
  main.append(el("div", { class: "kicker", text: d.kicker + (v.participantOf ? " \xB7 PARTICIPANT" : "") }), el("h2", { class: "title", text: d.title }), accountChip(v.account));
  if (v.participantOf) main.append(el("div", { class: "note", text: `Multisig ${shortAddr(v.participantOf.address)} \xB7 role: ${v.participantOf.role}` }));
  main.append(warnings(d.warnings), warnings(v.checks));
  if (d.nested) main.append(nestedCard(d.nested));
  main.append(renderRows(d.rows));
  if (d.common && d.common.length) main.append(el("hr"), renderRows(d.common));
  main.append(el("div", { class: "row" }, el("div", { class: "k", text: "Created" }), el("div", { class: "v", text: new Date(Number(v.timestamp) * 1e3).toLocaleString() })));
  main.append(el("div", { class: "row" }, el("div", { class: "k", text: "Network" }), el("div", { class: "v mono", text: v.network.short })));
  main.append(notes(d.notes), siteSays(v), shareBox(v));
  const cb = mismatchCheckbox(v, (on) => {
    checked = on;
    bar.update();
  });
  if (cb) main.append(cb);
  if (d.extras && d.extras.sessionKeyEligible && v.sessionKeysEnabled) {
    const c = el("span", { class: "check" });
    const box = el("label", { class: "flex", style: "margin:8px 0;cursor:pointer" }, c, el("span", { class: "small muted", text: "Allow moves in this game from this site without asking for 2 hours" }));
    box.addEventListener("click", () => {
      sessionKey = !sessionKey;
      c.classList.toggle("on", sessionKey);
      c.textContent = sessionKey ? "\u2713" : "";
    });
    main.append(box);
  }
  if (v.mode === "submit") main.append(el("div", { class: "note", text: `After signing, the signer will broadcast it to ${v.submitNode}.` }));
  main.append(rawBytes(v.raw, `digest input: ${v.network.tag || "ZBC-TX"} \u2016 ${v.network.genesis} \u2016 unsigned`));
  const danger = !!(d.extras && d.extras.danger);
  const bar = actions(v, { primary: d.extras && d.extras.primaryLabel || (v.mode === "submit" ? "Sign & send" : "Sign"), hold: d.hold || d.warnings.some((w) => w.level === "red"), danger, onApprove: () => decide(true, { checkedMismatch: checked, shareAccount: true, sessionKey }), disabled: () => d.canSign === false || !v.match.ok && !checked });
  return el("div", { id: "app" }, header(v), main, bar);
}
function nestedCard(n) {
  return el("div", { class: "nested" }, el("div", { class: "kicker", text: `The multisig ${shortAddr(n.senderAddress || "")} will` }), el("div", { style: "font-weight:700;font-size:16px;margin:2px 0 6px", text: n.title }), warnings(n.warnings), renderRows(n.rows), n.common ? renderRows(n.common.filter((r) => /fee/i.test(r.label)).map((r) => ({ ...r, label: "Inner fee" }))) : null);
}
function multisigScreen(v) {
  let checked = false;
  const main = el("div", { id: "main", class: "content" });
  main.append(
    el("div", { class: "kicker", text: "Multisig \xB7 held in this signer" }),
    el("h2", { class: "title", text: v.title }),
    el("div", { style: "margin:6px 0 12px" }, el("span", { class: "chip" }, el("span", { class: "coin MS", "data-no-dec": true, text: `${v.setup.min}/${v.setup.n}` }), el("span", { text: v.setup.label }), el("span", { class: "mono", text: "\xB7 " + shortAddr(v.setup.address) })))
  );
  main.append(nestedCard({ ...v.nested, senderAddress: v.setup.address }));
  main.append(el("div", { class: "section", text: `Signing with ${v.signWith} of ${v.setup.n} participant keys` }));
  for (const p of v.participants) main.append(el("div", { class: "list-item" + (p.held ? " selectable on" : ""), style: p.held ? "" : "opacity:.55" }, el("span", { class: "check" + (p.held ? " on" : ""), text: p.held ? "\u2713" : "" }), coin(p.format.length <= 3 ? p.format : "ZBC"), el("div", { class: "grow" }, el("div", { class: "name", text: p.label || p.format })), el("span", { class: "mono tiny", text: p.held ? shortAddr(p.display) : "not held" })));
  main.append(el("div", { class: "row" }, el("div", { class: "k", text: "Required" }), el("div", { class: "v", text: `${v.need} signature${v.need === 1 ? "" : "s"} \xB7 ${v.remaining === 0 ? "met after this step" : `${v.remaining} more needed`}` })));
  main.append(warnings(v.nested.warnings.filter((w) => w.level === "red")));
  main.append(el("p", { class: "dim tiny", text: `Setup hash \u2713 matches the sender \xB7 next: sign the outer from ${v.firstHeld ? v.firstHeld.label : "a participant"}` }));
  main.append(siteSays(v), shareBox(v));
  const cb = mismatchCheckbox(v, (on) => {
    checked = on;
    bar.update();
  });
  if (cb) main.append(cb);
  main.append(rawBytes(v.raw));
  const bar = actions(v, { primary: `Sign with ${v.signWith} key${v.signWith === 1 ? "" : "s"}`, onApprove: () => decide(true, { checkedMismatch: checked, shareAccount: true }), disabled: () => v.canSign === false || !v.match.ok && !checked });
  return el("div", { id: "app" }, header(v), main, bar);
}
function digestScreen(v) {
  const main = el("div", { id: "main", class: "content" });
  main.append(el("div", { class: "kicker", text: "Consent \xB7 " + v.digestKind.replace(/-/g, " ") }), el("h2", { class: "title", text: v.title }), accountChip(v.account));
  if (v.blind) main.append(el("div", { class: "warn red", style: "font-size:14px;padding:16px", text: v.warnings[0].text }));
  else main.append(warnings(v.warnings));
  if (v.nested) main.append(nestedCard({ ...v.nested, senderAddress: v.nested.rows.length ? void 0 : "" }));
  main.append(renderRows(v.rows));
  main.append(el("div", { class: "row" }, el("div", { class: "k", text: v.scheme === "raw" ? "Bytes" : "Digest" }), el("div", { class: "v flex", style: "justify-content:flex-end" }, mono(v.digest), el("span", { class: "badge ok", style: "margin:0", text: "\u2713" }))));
  main.append(notes(v.notes), shareBox(v));
  const bar = actions(v, { primary: "Sign", hold: v.hold || v.blind, onApprove: () => decide(true, { shareAccount: true }) });
  return el("div", { id: "app" }, header(v), main, bar);
}
function messageScreen(v) {
  const main = el("div", { id: "main", class: "content" });
  main.append(
    el("div", { class: "kicker", text: "Message" }),
    el("h2", { class: "title", text: v.title }),
    accountChip(v.account),
    el("div", { class: "quote", "data-no-dec": true, style: v.isHexShown ? "font-family:var(--mono)" : "", text: v.message }),
    v.isHexShown ? el("div", { class: "note", text: "The message is not valid text; shown as hex." }) : null,
    notes(v.notes),
    shareBox(v)
  );
  const bar = actions(v, { primary: "Sign", onApprove: () => decide(true, { shareAccount: true }) });
  return el("div", { id: "app" }, header(v), main, bar);
}
load();
export {
  renderValue
};
