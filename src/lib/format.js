// Amount, duration and date formatting (spec §6 intro, §7.1).
export const ATOMIC = 100000000n;
const THIN = ' '; // narrow no-break space as thousands separator

/** Format an atomic amount with `decimals` places: trim trailing zeros, group thousands. */
export function formatUnits(atomic, decimals = 8) {
  let v = BigInt(atomic);
  const neg = v < 0n; if (neg) v = -v;
  const base = 10n ** BigInt(decimals);
  const whole = v / base, frac = v % base;
  let w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  let f = decimals ? frac.toString().padStart(decimals, '0').replace(/0+$/, '') : '';
  return (neg ? '-' : '') + w + (f ? '.' + f : '');
}
export function formatZBC(atomic) { return formatUnits(atomic, 8) + ' ZBC'; }
export function formatToken(atomic, token) {
  if (!token || token.decimals === undefined) return `${formatUnits(atomic, 0)} units of #${token && token.id !== undefined ? token.id : '?'}`;
  return `${formatUnits(atomic, token.decimals)} ${token.symbol || '#' + token.id}`;
}

/** Parse "1.5" into atomic units (bigint). */
export function parseUnits(str, decimals = 8) {
  const s = String(str).trim().replace(/[\s, ]/g, '');
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const whole = m[2] || '0', frac = (m[3] || '').slice(0, decimals).padEnd(decimals, '0');
  const v = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || '0');
  return m[1] ? -v : v;
}

export function formatDuration(seconds) {
  let s = Number(seconds);
  if (!isFinite(s) || s < 0) return String(seconds);
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  const parts = [];
  if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(' ') || `${Math.round(s)} s`;
}

export function formatDate(unixSeconds) {
  const n = Number(unixSeconds);
  if (!isFinite(n) || n <= 0) return '—';
  try { return new Date(n * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return new Date(n * 1000).toISOString(); }
}
export function formatDateOnly(unixSeconds) {
  const n = Number(unixSeconds);
  if (!isFinite(n) || n <= 0) return '—';
  try { return new Date(n * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' }); } catch { return new Date(n * 1000).toISOString().slice(0, 10); }
}

/** Estimate the wall-clock date of a block height. chain = { height, avgBlockSeconds, at }. */
export function blockDate(height, chain) {
  if (!chain || !chain.height || !chain.avgBlockSeconds) return null;
  const now = chain.at || Math.floor(Date.now() / 1000);
  return now + (Number(height) - Number(chain.height)) * chain.avgBlockSeconds;
}

export function formatBytes(n) {
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function percentOfBp(bp) { return (Number(bp) / 100).toFixed(2).replace(/\.?0+$/, '') + '%'; }
