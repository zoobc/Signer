// Compare the page's claim (intent) with what the bytes say (spec §7.3).
import { parseAddress } from './address.js';
import { parseUnits } from './format.js';
import { typeNameMatches } from './describe.js';

const AMOUNT_LABELS = /amount|total|stake|pay|price|value|fee|commission|deposit/i;
const ADDRESS_LABELS = /to|recipient|payee|beneficiary|address|payer|approver|member|owner|counterparty|new recipient/i;

/**
 * Returns { ok, diffs: [{ label, site, tx, severity }] }.
 * described: output of describe(); intent: request.intent.
 */
export function compareIntent(described, intent = {}) {
  const diffs = [];
  if (intent.typeName && !typeNameMatches(described.type, intent.typeName)) {
    diffs.push({ label: 'Type', site: intent.typeName, tx: described.typeName, severity: 'warn' });
  }
  const rows = Array.isArray(intent.rows) ? intent.rows : [];
  const amounts = described.canonical.amounts;
  const recipients = described.canonical.recipients;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const label = String(r[0]), val = String(r[1]);
    if (AMOUNT_LABELS.test(label)) {
      const key = Object.keys(amounts).find((k) => label.toLowerCase().includes(k)) || (/total/i.test(label) ? 'total' : 'amount');
      if (amounts[key] === undefined) continue;
      const m = /-?[\d\s, ]*\.?\d+/.exec(val.replace(/[ \s](?=\d{3})/g, ''));
      if (!m) continue;
      const claimed = parseUnits(m[0], 8);
      if (claimed === null) continue;
      const actual = amounts[key];
      if (claimed !== actual) diffs.push({ label, site: val, tx: txAmountText(described, key), severity: 'warn' });
    } else if (ADDRESS_LABELS.test(label)) {
      const p = parseAddress(val.trim());
      if (!p) continue;
      if (recipients.length && !recipients.includes(p.hex)) {
        const shown = described.rows.find((x) => x.value && x.value.kind === 'address');
        diffs.push({ label, site: val, tx: shown ? shown.value.display : recipients[0], severity: 'red' });
      }
    }
  }
  return { ok: diffs.length === 0, diffs };
}

function txAmountText(described, key) {
  const all = [...described.rows, ...(described.common || [])];
  const r = all.find((x) => x.label.toLowerCase().includes(key) && x.value && x.value.kind === 'amount');
  return r ? r.value.text : described.canonical.amounts[key].toString();
}
