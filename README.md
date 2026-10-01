# ZooBC Signer

A Chromium (Chrome, Edge, Brave, Opera, Arc) Manifest V3 extension that holds ZooBC keys in every
account format the chain accepts and signs transactions for web pages **after decoding the bytes
itself**. Built to *ZooBC Signer — build specification 1.1* (wallet V1.83) and the V1.1 mockups.

It is a signer, not a wallet: keys never leave the extension, nothing is signed without a prompt,
and the prompt shows what the bytes do — not what the page claims.

## What is here

```
src/
  manifest.json        MV3 manifest (storage, alarms, notifications, activeTab, scripting; two gateway hosts)
  background.js        service worker: vault, permissions, request queue, chain check, signing
  content.js           relay page ↔ worker; stamps the origin itself
  inpage.js            window.zoobc provider (MAIN world, no secrets)
  approve.html + ui/approve.js   approval window (380 × 640): connect, sign tx, digest, message, multisig, not-held
  popup.html  + ui/popup.js      toolbar popup: accounts, sites, activity, settings; options.html reuses it
  ui/common.css, ui/ui.js        design tokens from the wallet, row renderers, the §7.1 decimal walker, hold-to-sign
  lib/
    bytes.js           hex / LE integers / bounds-checked Reader (BigInt for every 64-bit value)
    address.js         typed accounts §3.2, ZBC_/ZNK_/ZBS_ text form §3.3, every foreign encoding, multisig & group addresses
    keys.js            BIP-39, SLIP-0010 ed25519, BIP-32 secp256k1, Substrate mini-secret, Taproot tweak; account payloads §4.2
    sr25519.js         schnorrkel (STROBE-128 + Merlin over Ristretto255) for Polkadot, context "substrate"
    sign.js            signature envelope per format §4.2 (+ verification for self-tests)
    zbc.js             chain-bound digest §4.1, tx hash/id §3.4, consent digests §5, FeeVoteInfo, submit payload §3.5
    decoder.js         envelope §3.1 (v1 and v2, escrow, multi-party) and every body of §6; exact consumption
    describe.js        titles, rows, warnings, notes, totals per type §6/§7.2; nested multisig cards
    intent.js          page-claim comparison §7.3
    requests.js        request validation and view models for every prompting method (§2, §5, §7.4)
    builders.js        unsigned-transaction builders for every type (test dapp, round-trip tests)
    vault.js           PBKDF2-SHA256 600k → AES-GCM 256, fresh IV per write §9.1
    node.js            node/info (60 s cache), tokens, escrow, offers, estimate-fee, submit
    selftest.js        §12 self-tests wired to Settings › Developer › Run self-tests
    vectors.json       reference vectors bundled for the self-tests
test/
  *.test.js            node --test: address vectors, sr25519, keys/signing, decoder, builders, requests, vault, worker e2e
  fixtures/            the zoobc/tools v0.1.1 spec vectors (addresses, keys, transactions, messages)
  dapp.html            test page exercising every provider method and every §6 type (served by `npm run dapp`)
  results.md           §12 item 2 record
scripts/build.mjs      esbuild bundle → dist/ (no CDN, no remote code)
```

## Build and load

```
npm install
npm run build          # → dist/
npm test               # unit + end-to-end worker tests
npm run zip            # → zoobc-signer.zip
```

Load the **`dist/`** folder (not the repository root) as an unpacked extension:
chrome://extensions → Developer mode → Load unpacked → pick `dist/`. A built `dist/` is committed,
so a fresh clone loads without running npm; rebuild after changing anything under `src/`.
The toolbar popup creates the vault (password ≥ 10 characters), then *Add seed* / *Import key* /
*Add multisig*.

## Permissions and how a page gets `window.zoobc`

The manifest asks for `activeTab` instead of broad host permissions, so the extension installs
without a "read and change all your data on all websites" warning and the Web Store does not
flag it for broad host access. The consequence is a click: on any site other than the two declared
hosts (`https://zoobc.network`, `https://zoobc.net`, which get the provider from the static content
scripts) the page sees `window.zoobc` only after the user clicks the ZooBC Signer toolbar icon while
on that page. Opening the popup is the user gesture; the popup asks the service worker to inject
`content.js` (isolated world) and `inpage.js` (MAIN world) into the active tab with
`chrome.scripting.executeScript`, and shows "Signer available to *host*" under the header. The grant
ends when the tab navigates or reloads, so the icon must be clicked again on the new page.

Pages should therefore not assume the provider exists at load time: check `window.zoobc` and also
listen for the `zoobc#initialized` event, which `inpage.js` dispatches the moment it is injected
(the test page does exactly this). If the extension is pinned to the toolbar the click is one
gesture; otherwise it sits behind the puzzle-piece menu.

Personal node URLs in Settings are limited to the hosts the manifest grants (`zoobc.network`,
`zoobc.net`); the worker refuses to fetch from anywhere else, and a page cannot name another node
in `zbc_submitTransaction`.

## Test page

```
npm run dapp           # builds, then serves test/dapp.html on http://localhost:8787
```

The page detects `window.zoobc`, connects, reads the signing rule, and has one button per §6 type
that builds the unsigned bytes locally, sends them with a matching `intent`, and verifies the
returned signature against the account's public key. Extra buttons produce the failure paths:
intent mismatch, sender ≠ account (4300), truncated bytes (4300), account not held (4404), wrong
genesis (4901), unknown type (hold-to-sign), a disguised transaction as a message, a bare digest,
and the two multisig flows (`zbc_signMultisig` + type-5 outer, and the per-participant fallback).

## Provider (window.zoobc)

Exactly the shapes of spec §2: `zbc_requestAccounts`, `zbc_accounts`, `zbc_hasAccount`,
`zbc_signTransaction`, `zbc_signDigest`, `zbc_signMultisig`, `zbc_signMessage`,
`zbc_submitTransaction`, `zbc_disconnect`, `zbc_getSigningRule`; events `accountsChanged`,
`lock`, `chainChanged`; errors 4001 / 4100 / 4200 / 4300 / 4404 / 4405 / 4406 / 4900 / 4901 / 5000.

`zbc_signTransaction` returns `{ signature, txHash, payload, payloadJson }`. `payload` is the
§3.5 object; `payloadJson` is the exact string with `escrow_request_id` substituted as a bare
number, for ids above 2^53 (post `payloadJson` as the request body).

## How a request is handled

1. `content.js` stamps `sender.origin`; the page cannot set it.
2. The worker validates what needs no vault (account parses, bytes decode) and rejects 4300 early.
3. If locked, the approval window opens on the unlock screen; the request waits (never lost).
4. The view is built: chain resolved (§4.1; 4901 on mismatch), sender checked against the account
   (§7.4; multisig exceptions), every field decoded, tokens / escrow / fee minimum fetched
   best-effort (never blocking), intent compared (§7.3).
5. The approval window renders the signer's own title and rows, the "What the site says" box,
   and the match badge. A mismatch needs the checkbox; red-warning types need a 2-second hold.
6. Only a decision message from `approve.html` reaches the signing code. Secrets are derived on
   demand and zeroed after use.
7. Session storage keeps the unlocked key and the pending queue, so a worker restart during an
   open approval still resolves it (tested).

## What is verified

- 45 address vectors, 6 seeds, 6 HD wallets from `zoobc/tools` spec vectors (all round-trip).
- The §4.6 digest + signature vector and both group-consent vectors.
- All 74 reference transactions (`transactions.json`, `transactions-all.json`): decode, exact byte
  consumption, digest, Ed25519 signature and hash byte-for-byte; truncation by one byte → 4300.
- Every §6 type built → decoded → described with the documented title; multisig create / propose /
  co-sign shapes; multi-party escrow; ids above 2^53.
- BIP-32/84/86 (abandon mnemonic: ETH, BTC legacy/SegWit/Taproot, TRX addresses), SLIP-0010,
  Merlin transcript vector, Polkadot Alice key and `//Alice` hard derivation, sign/verify for all
  12 envelopes.
- Worker end-to-end: vault, connect, sign (produces the §4.6 signature), 4300/4404/4405/4901,
  mismatch gating, lock with a waiting request, restart during an approval.

`test/results.md` records what could **not** be done from the build environment: broadcasting to
TestNet (no route to the gateways here), so on-chain acceptance of the non-ZBC envelopes is still to
be confirmed against a live node.

## Assumptions and deviations (read before shipping)

- **Gateway URLs.** `https://zoobc.network` is used for MainNet and `https://zoobc.net` for TestNet
  by default; both are editable under Settings › Personal nodes. The signer reads `genesis_hash`
  and `signing_tag` from `node/info` and caches per network. If the defaults are the other way
  round, only `NETWORKS` in `src/lib/node.js` changes.
- **Libraries.** `@noble/curves` (Ed25519, secp256k1 + BIP-340, Ristretto255), `@noble/hashes`,
  `@scure/bip39`, `@scure/bip32`, `@scure/base` — instead of tweetnacl / `@noble/secp256k1`.
  Ed25519 output is identical (verified against the vectors). sr25519 is implemented here rather
  than via `@polkadot/wasm-crypto`, so the bundle has no WebAssembly.
- **Message signing** uses the spec's §4.4 scheme (`ZBC-MSG ‖ genesis ‖ u32 len ‖ message`), not
  the zbc-cli `ZBC-MSG-v1` scheme (which is only used in tests).
- **Polkadot index > 0** uses Substrate hard derivation `//<index>` (index 0 is the bare mini secret
  as the spec says).
- **Version 1 envelopes** decode with an amber note; the node decides.
- **Developer switch** *Trust the page's genesis when no node is reachable* (off by default) lets
  the test dapp work offline; with it off, an unverifiable genesis is 4901 as the spec requires.
- **Languages.** The setting exists (en, zh, ru, it, es, fr, ja, ko) but only English strings ship;
  the wallet's dictionaries were not available here.
- **Passkey unlock** (WebAuthn PRF) is implemented but needs a real authenticator to exercise.
- The "Register on-chain" button for a signer-held multisig copies the unsigned type-5 create
  transaction (with the first held participant as sender) so a page or the wallet can send it
  through the normal signing path.

## Security notes

Origin is never taken from the page. Only `approve.html` can trigger signing. No `eval`, no
remote scripts, strict CSP. Nothing secret is written to `chrome.storage.local` unencrypted (the
worker test greps for the phrase and seed). The clipboard is never read. IDN, `http:` and IP
origins are flagged. The approval window is opened at most once per second.

## License

MIT — see [LICENSE](LICENSE).
