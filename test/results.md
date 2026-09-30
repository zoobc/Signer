# §12 item 2 — one type-1 transaction per format on TestNet

Derive account 0 of the `abandon ×11 about` mnemonic in each format, sign a type-1 transaction,
broadcast, confirm on-chain.

| format | account 0 | broadcast hash | status |
|---|---|---|---|
| ZBC | ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX | — | signature matches the spec §4.6 vector; not broadcast |
| ETH / BNB | 0x9858EfFD232B4033E47d90003D41EC34EcaEda94 | — | not broadcast |
| BTC legacy | 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA | — | not broadcast |
| BTC SegWit | bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu | — | not broadcast |
| BTC Taproot | bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr | — | not broadcast |
| SOL | (derived at runtime, m/44'/501'/0'/0') | — | not broadcast |
| DOT | (derived at runtime, mini secret) | — | not broadcast |
| ADA | (derived at runtime, m/44'/1815'/0') | — | not broadcast |
| XTZ | (derived at runtime, m/44'/1729'/0') | — | not broadcast |
| TRX | TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH | — | not broadcast |
| XRP | (derived at runtime, m/44'/144'/0'/0/0) | — | not broadcast |

The build environment had no route to `zoobc.network` / `zoobc.net`, so nothing was broadcast.
Every envelope signs and verifies locally (`npm test`, "every format derives, signs and verifies"),
and the ZBC signature is byte-identical to the spec vector. To fill this table: fund each address
on TestNet, open `npm run dapp`, connect, pick the account, press **1 · Send 25 ZBC** (or the
submit button), and paste the hash the node returns.
