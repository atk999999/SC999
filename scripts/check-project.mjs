import fs from 'node:fs';
import path from 'node:path';
const required=['index.html','src/main.jsx','public/legacy/index.html','public/legacy/runtime-config.js'];
let failed=0;
for(const f of required){const ok=fs.existsSync(f);console.log(`${ok?'OK':'MISSING'} ${f}`);if(!ok)failed++}
const html=fs.readFileSync('public/legacy/index.html','utf8');
const paths=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(x=>x[1]);
const local=paths.filter(p=>!(/^(https?:|data:|blob:|#|\/\/)/i.test(p)));
for(const p of local){const cleaned=decodeURIComponent(p.split(/[?#]/)[0]);if(!cleaned)continue;const full=path.resolve('public/legacy',cleaned.replace(/^\//,''));if(!fs.existsSync(full)){console.log('MISSING REF',p);failed++}}
console.log(`Checked ${local.length} local HTML references; missing ${failed}`);
process.exitCode=failed?1:0;
