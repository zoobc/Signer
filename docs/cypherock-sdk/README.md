# Cypherock SDK documentation (local mirror)

Local copy of the Cypherock SDK documentation published at
<https://docs-sdk.cypherock.com/>.

The site is an [mdBook](https://rust-lang.github.io/mdBook/) built from the
`apps/docs` directory of <https://github.com/Cypherock/sdk>. This mirror was
taken from that source rather than scraped from the rendered site, so it holds
the Markdown the site is generated from.

| | |
| --- | --- |
| Source repository | `https://github.com/Cypherock/sdk`, path `apps/docs` |
| Source commit | `f831d7e5a7d3b5eca52e430f69741b33f7ea3a4d` (main, 2026-08-20) |
| Mirrored on | 2026-10-02 |

## Contents

Start at [`src/SUMMARY.md`](src/SUMMARY.md), the table of contents:

- [Introduction](src/introduction.md): connectivity options and supported coins
- [Architecture](src/architecture.md): SDK applications, core and HW connect layers
- [HW Connect](src/hw_connect.md): WebUSB and HID transports
- Applications: [overview](src/apps/index.md), [Manager](src/apps/manager.md),
  [Bitcoin](src/apps/bitcoin.md), [EVM](src/apps/evm.md), [Near](src/apps/near.md),
  [Solana](src/apps/solana.md)
- Integration: [overview](src/integration/index.md),
  [WebApp](src/integration/webapp.md), [NodeJS](src/integration/node.md)

## Rendering as a website

With `mdbook` installed (`cargo install mdbook`), run from this directory:

```sh
mdbook serve --open
```

The output goes to `book/`, which is ignored by git.

## Local changes

The only edit to the upstream content is the image path in
`src/architecture.md`, changed from `../assets/architecture.png` to
`./assets/architecture.png` so the diagram resolves relative to the page.
