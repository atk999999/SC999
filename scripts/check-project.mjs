import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'metadata.json',
  'package.json',
  'vite.config.js',
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'src/style.css',
  'public/legacy/index.html',
  'public/legacy/runtime-config.js',
  'public/legacy/assets/manifest.js'
];

let failed = false;
for (const rel of required) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  } else {
    console.log(`OK ${rel}`);
  }
}

const legacyHtml = fs.readFileSync(path.join(root, 'public/legacy/index.html'), 'utf8');
const refs = [...legacyHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1]);
let checked = 0;
let missing = 0;
for (const ref of refs) {
  if (/^(https?:|data:|mailto:|tel:|javascript:|#)/i.test(ref)) continue;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) continue;
  checked += 1;
  const target = clean.startsWith('/')
    ? path.join(root, 'public', clean)
    : path.join(root, 'public/legacy', clean);
  if (!fs.existsSync(target)) {
    console.warn(`MISSING REF in public/legacy/index.html: ${ref}`);
    missing += 1;
  }
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else count += 1;
  }
  return count;
}

const totalFiles = countFiles(root);
console.log(`Checked ${checked} local HTML references; missing ${missing}`);
console.log(`Source file count (excluding dist/node_modules): ${totalFiles} (AI Studio limit <= 1000)`);
if (failed || missing > 0 || totalFiles > 1000) process.exit(1);
