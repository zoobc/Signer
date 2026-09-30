// Bundles the extension into dist/ with esbuild (no CDN, no remote code).
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/ui', { recursive: true });
for (const f of ['manifest.json', 'popup.html', 'approve.html', 'options.html']) cpSync(`src/${f}`, `dist/${f}`);
cpSync('src/ui/common.css', 'dist/ui/common.css');
if (existsSync('icons')) cpSync('icons', 'dist/icons', { recursive: true });

const common = { bundle: true, format: 'esm', target: ['chrome111'], sourcemap: false, minify: false, legalComments: 'none', logLevel: 'info' };
const jobs = [
  { entryPoints: ['src/background.js'], outfile: 'dist/background.js' },
  { entryPoints: ['src/ui/popup.js'], outfile: 'dist/ui/popup.js' },
  { entryPoints: ['src/ui/approve.js'], outfile: 'dist/ui/approve.js' },
  { entryPoints: ['src/content.js'], outfile: 'dist/content.js', format: 'iife' },
  { entryPoints: ['src/inpage.js'], outfile: 'dist/inpage.js', format: 'iife' },
  { entryPoints: ['src/dapp.js'], outfile: 'test/dapp.js', format: 'iife', globalName: 'ZBCDapp' },
];
if (watch) { for (const j of jobs) { const c = await context({ ...common, ...j }); await c.watch(); } console.log('watching…'); }
else { for (const j of jobs) await build({ ...common, ...j }); console.log('built dist/'); }
