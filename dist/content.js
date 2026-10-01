(() => {
  // src/content.js
  (() => {
    if (globalThis.__zoobcSignerRelay) return;
    globalThis.__zoobcSignerRelay = true;
    const CHANNEL = "zoobc-signer";
    const outstanding = /* @__PURE__ */ new Set();
    let port = null;
    function connect() {
      port = chrome.runtime.connect({ name: "zoobc-signer" });
      port.onMessage.addListener((m) => {
        if (!m) return;
        if (m.kind === "response") {
          outstanding.delete(m.id);
          window.postMessage({ channel: CHANNEL, dir: "to-page", kind: "response", id: m.id, result: m.result, error: m.error }, window.location.origin);
        } else if (m.kind === "event") window.postMessage({ channel: CHANNEL, dir: "to-page", kind: "event", event: m.event, data: m.data }, window.location.origin);
      });
      port.onDisconnect.addListener(() => {
        port = null;
        setTimeout(() => {
          try {
            connect();
            if (outstanding.size) port.postMessage({ kind: "resume", ids: [...outstanding] });
          } catch {
          }
        }, 250);
      });
    }
    window.addEventListener("message", (ev) => {
      if (ev.source !== window || !ev.data || ev.data.channel !== CHANNEL || ev.data.dir !== "to-extension" || ev.data.kind !== "request") return;
      const { id, method, params } = ev.data;
      if (typeof id !== "string" || typeof method !== "string") return;
      outstanding.add(id);
      try {
        if (!port) connect();
        port.postMessage({ kind: "request", id, method, params, href: location.href });
      } catch (e) {
        outstanding.delete(id);
        window.postMessage({ channel: CHANNEL, dir: "to-page", kind: "response", id, error: { code: 5e3, message: "Signer unavailable" } }, window.location.origin);
      }
    });
    try {
      connect();
    } catch {
    }
  })();
})();
