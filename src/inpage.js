// window.zoobc provider (spec §2). Runs in the page's MAIN world; holds no secrets.
(() => {
  if (window.zoobc && window.zoobc.isZooBCSigner) return;
  const VERSION = '1.0.0';
  const CHANNEL = 'zoobc-signer';
  const pending = new Map();
  const listeners = new Map();
  let seq = 0;
  const newId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.channel !== CHANNEL || ev.data.dir !== 'to-page') return;
    const m = ev.data;
    if (m.kind === 'response') {
      const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
      if (m.error) { const e = new Error(m.error.message || 'Error'); e.code = m.error.code || 5000; p.reject(e); } else p.resolve(m.result);
    } else if (m.kind === 'event') {
      const cbs = listeners.get(m.event) || [];
      for (const cb of [...cbs]) { try { cb(m.data); } catch (e) { console.error(e); } }
    }
  });

  const provider = Object.freeze({
    isZooBCSigner: true,
    version: VERSION,
    request(args) {
      return new Promise((resolve, reject) => {
        if (!args || typeof args.method !== 'string') { const e = new Error('request({ method, params })'); e.code = 4300; return reject(e); }
        const id = newId();
        pending.set(id, { resolve, reject });
        let params;
        try { params = args.params === undefined ? undefined : JSON.parse(JSON.stringify(args.params)); } catch { const e = new Error('params must be JSON-serialisable'); e.code = 4300; pending.delete(id); return reject(e); }
        window.postMessage({ channel: CHANNEL, dir: 'to-extension', kind: 'request', id, method: args.method, params }, window.location.origin);
      });
    },
    on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb); },
    removeListener(event, cb) { const l = listeners.get(event); if (l) listeners.set(event, l.filter((x) => x !== cb)); },
  });
  Object.defineProperty(window, 'zoobc', { value: provider, writable: false, configurable: false, enumerable: true });
  window.dispatchEvent(new Event('zoobc#initialized'));
})();
