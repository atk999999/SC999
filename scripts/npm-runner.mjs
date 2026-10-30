import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const cmd = process.argv[2] || 'dev';
const extraArgs = process.argv.slice(3);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.fnt': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// Lightweight, DOM-diffing React 19 compatible runtime for offline execution
// Preserves DOM elements (including <iframe>, <textarea>, <input>) across re-renders!
const REACT_RUNTIME_SOURCE = `
let currentInstance = null;
let hookCursor = 0;

export function createElement(type, props, ...children) {
  const normalizedProps = Object.assign({}, props || {});
  const flatChildren = [];
  const pushChild = (c) => {
    if (Array.isArray(c)) c.forEach(pushChild);
    else if (c === null || c === undefined || typeof c === 'boolean') flatChildren.push(null);
    else flatChildren.push(typeof c === 'object' ? c : String(c));
  };
  if (normalizedProps.children !== undefined) {
    pushChild(normalizedProps.children);
  }
  children.forEach(pushChild);
  normalizedProps.children = flatChildren;
  return { type, props: normalizedProps, key: normalizedProps.key ?? null };
}

export const Fragment = Symbol.for('react.fragment');

export function useState(initialValue) {
  const inst = currentInstance;
  const idx = hookCursor++;
  if (inst.hooks.length <= idx) {
    const val = typeof initialValue === 'function' ? initialValue() : initialValue;
    inst.hooks[idx] = { type: 'state', value: val };
  }
  const hook = inst.hooks[idx];
  const setState = (next) => {
    const nextVal = typeof next === 'function' ? next(hook.value) : next;
    if (!Object.is(nextVal, hook.value)) {
      hook.value = nextVal;
      inst.scheduleUpdate();
    }
  };
  return [hook.value, setState];
}

export function useRef(initialValue) {
  const inst = currentInstance;
  const idx = hookCursor++;
  if (inst.hooks.length <= idx) {
    inst.hooks[idx] = { type: 'ref', current: initialValue };
  }
  return inst.hooks[idx];
}

export function useCallback(fn, deps) {
  return useMemo(() => fn, deps);
}

export function useMemo(factory, deps) {
  const inst = currentInstance;
  const idx = hookCursor++;
  const prev = inst.hooks[idx];
  if (!prev || !deps || !prev.deps || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
    const value = factory();
    inst.hooks[idx] = { type: 'memo', value, deps };
    return value;
  }
  return prev.value;
}

export function useEffect(effect, deps) {
  const inst = currentInstance;
  const idx = hookCursor++;
  const prev = inst.hooks[idx];
  const changed = !prev || !deps || !prev.deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
  inst.hooks[idx] = {
    type: 'effect',
    effect,
    deps,
    cleanup: prev ? prev.cleanup : null,
    pending: changed
  };
}

function expandVNode(vnode, inst) {
  if (vnode === null || vnode === undefined || typeof vnode === 'boolean') return null;
  if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
  if (vnode.type === Fragment) {
    return { type: Fragment, props: vnode.props, children: (vnode.props.children || []).map((c) => expandVNode(c, inst)) };
  }
  if (typeof vnode.type === 'function') {
    const prevInst = currentInstance;
    currentInstance = inst;
    const out = vnode.type(vnode.props || {});
    currentInstance = prevInst;
    return expandVNode(out, inst);
  }
  const kids = [];
  for (const c of vnode.props.children || []) {
    const ex = expandVNode(c, inst);
    if (ex && typeof ex === 'object' && ex.type === Fragment) {
      kids.push(...ex.children);
    } else {
      kids.push(ex);
    }
  }
  return { type: vnode.type, props: vnode.props, children: kids };
}

function applyProps(dom, oldProps, newProps) {
  const o = oldProps || {};
  const n = newProps || {};
  for (const k of Object.keys(o)) {
    if (k === 'children' || k === 'key' || k === 'ref') continue;
    if (!(k in n)) {
      if (k.startsWith('on') && dom.__handlers && dom.__handlers[k]) {
        dom.removeEventListener(k.slice(2).toLowerCase(), dom.__handlers[k]);
        delete dom.__handlers[k];
      } else if (k === 'className') {
        dom.removeAttribute('class');
      } else {
        dom.removeAttribute(k);
      }
    }
  }
  for (const [k, val] of Object.entries(n)) {
    if (k === 'children' || k === 'key') continue;
    if (k === 'ref') {
      if (typeof val === 'function') val(dom);
      else if (val && typeof val === 'object') val.current = dom;
      continue;
    }
    if (k.startsWith('on') && typeof val === 'function') {
      const evt = k.slice(2).toLowerCase();
      dom.__handlers = dom.__handlers || {};
      if (dom.__handlers[k] !== val) {
        if (dom.__handlers[k]) dom.removeEventListener(evt, dom.__handlers[k]);
        dom.__handlers[k] = val;
        dom.addEventListener(evt, val);
      }
    } else if (k === 'className') {
      if (dom.className !== (val || '')) dom.className = val || '';
    } else if (k === 'style' && val && typeof val === 'object') {
      Object.assign(dom.style, val);
    } else if (k === 'value' && ('value' in dom)) {
      if (dom.value !== val) dom.value = val ?? '';
    } else if (k === 'checked' && ('checked' in dom)) {
      dom.checked = !!val;
    } else if (val !== false && val !== null && val !== undefined) {
      if (dom.getAttribute(k) !== String(val)) {
        dom.setAttribute(k, val === true ? '' : String(val));
      }
    }
  }
}

function createDom(vnode) {
  if (vnode === null || vnode === undefined) {
    const node = document.createComment('empty');
    node.__vnode = null;
    return node;
  }
  if (typeof vnode === 'string') {
    const node = document.createTextNode(vnode);
    node.__vnode = vnode;
    return node;
  }
  const el = document.createElement(vnode.type);
  applyProps(el, {}, vnode.props);
  for (const child of vnode.children || []) {
    el.appendChild(createDom(child));
  }
  el.__vnode = vnode;
  return el;
}

function syncNode(parent, domNode, newVNode) {
  if (!domNode) {
    const created = createDom(newVNode);
    parent.appendChild(created);
    return created;
  }
  const oldVNode = domNode.__vnode;
  if (newVNode === null || newVNode === undefined) {
    if (domNode.nodeType === 8) {
      domNode.__vnode = null;
      return domNode;
    }
    const commentNode = createDom(null);
    parent.replaceChild(commentNode, domNode);
    return commentNode;
  }
  if (typeof newVNode === 'string') {
    if (domNode.nodeType === 3) {
      if (domNode.nodeValue !== newVNode) domNode.nodeValue = newVNode;
      domNode.__vnode = newVNode;
      return domNode;
    }
    const textNode = createDom(newVNode);
    parent.replaceChild(textNode, domNode);
    return textNode;
  }
  if (!oldVNode || typeof oldVNode === 'string' || oldVNode.type !== newVNode.type) {
    const replacement = createDom(newVNode);
    parent.replaceChild(replacement, domNode);
    return replacement;
  }
  applyProps(domNode, oldVNode.props, newVNode.props);
  syncChildren(domNode, newVNode.children || []);
  domNode.__vnode = newVNode;
  return domNode;
}

function syncChildren(parent, newChildren) {
  const existing = Array.from(parent.childNodes);
  for (let i = 0; i < newChildren.length; i++) {
    syncNode(parent, existing[i] || null, newChildren[i]);
  }
  while (parent.childNodes.length > newChildren.length) {
    parent.removeChild(parent.lastChild);
  }
}

export function createRoot(container) {
  const inst = {
    hooks: [],
    rootElement: null,
    scheduled: false,
    scheduleUpdate() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        this.commit();
      });
    },
    commit() {
      if (!this.rootElement) return;
      hookCursor = 0;
      const tree = expandVNode(this.rootElement, this);
      const children = tree === null ? [] : (typeof tree === 'object' && tree.type === Fragment ? tree.children : [tree]);
      syncChildren(container, children);
      for (const h of this.hooks) {
        if (h && h.type === 'effect' && h.pending) {
          h.pending = false;
          if (typeof h.cleanup === 'function') {
            try { h.cleanup(); } catch (e) {}
          }
          const clean = h.effect();
          h.cleanup = typeof clean === 'function' ? clean : null;
        }
      }
    }
  };
  return {
    render(element) {
      inst.rootElement = element;
      inst.commit();
    }
  };
}

export const jsx = createElement;
export const jsxs = createElement;
const React = { createElement, Fragment, useState, useEffect, useRef, useCallback, useMemo, createRoot };
export default React;
`;

function loadBabel() {
  const req = createRequire(import.meta.url);
  const searchPaths = [
    path.join(root, 'node_modules'),
    '/usr/share/nodejs',
    '/usr/lib/nodejs'
  ];
  try {
    const babelPath = req.resolve('@babel/core', { paths: searchPaths });
    const presetReactPath = req.resolve('@babel/preset-react', { paths: searchPaths });
    const babel = req(babelPath);
    return { babel, presetReactPath };
  } catch (e) {
    return null;
  }
}

function transpileJSX(code, filename) {
  const b = loadBabel();
  if (b) {
    const res = b.babel.transformSync(code, {
      filename,
      presets: [[b.presetReactPath, { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' }]],
      sourceMaps: false,
      compact: false
    });
    return res.code;
  }
  return code;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

const viteBin = path.join(root, 'node_modules', '.bin', 'vite');
const hasVite = fs.existsSync(viteBin);

if (cmd === 'build') {
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/check-project.mjs')], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);

  if (hasVite) {
    const res = spawnSync(viteBin, ['build', ...extraArgs], { stdio: 'inherit' });
    process.exit(res.status || 0);
  }

  console.log('[npm-runner] Building React AI Studio bundle (offline mode)...');
  const distDir = path.join(root, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });
  copyDirRecursive(path.join(root, 'public'), distDir);

  const assetsOut = path.join(distDir, 'assets');
  fs.mkdirSync(assetsOut, { recursive: true });
  fs.copyFileSync(path.join(root, 'src/style.css'), path.join(assetsOut, 'style.css'));

  // Compile App.jsx and main.jsx into a self-contained ESM bundle
  const appRaw = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
  const appBody = appRaw
    .replace(/^\s*import\s+.*?from\s+['"]react['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+function\s+App\b/m, 'function App');
  const appCompiled = transpileJSX(appBody, 'App.jsx');

  const bundleCode = `${REACT_RUNTIME_SOURCE}\n\n${appCompiled}\n\nconst __rootEl = document.getElementById('root');\nif (__rootEl) {\n  createRoot(__rootEl).render(React.createElement(App, null));\n}\n`;
  fs.writeFileSync(path.join(assetsOut, 'app.bundle.js'), bundleCode, 'utf8');

  const distHtml = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#120e0a" />
    <title>Tu Tiên 2D — React AI Studio</title>
    <link rel="icon" type="image/webp" href="./legacy/landing-assets/tu-tien-2d-icon.webp" />
    <link rel="stylesheet" href="./assets/style.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/app.bundle.js"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(distDir, 'index.html'), distHtml, 'utf8');
  console.log('✓ Built React AI Studio application into dist/ (dist/index.html, dist/assets/app.bundle.js, dist/legacy/...)');
  process.exit(0);
}

if (cmd === 'dev' || cmd === 'start' || cmd === 'preview') {
  if (hasVite && !extraArgs.includes('--offline')) {
    const child = spawn(viteBin, [cmd === 'preview' ? 'preview' : 'dev', ...extraArgs], { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
  } else {
    const isPreview = cmd === 'preview';
    const port = Number(process.env.PORT || (isPreview ? 4173 : 3000));
    const host = process.env.HOST || '0.0.0.0';

    const server = http.createServer((req, res) => {
      const reqUrl = (req.url || '/').split('?')[0];

      if (reqUrl === '/@react-esm.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(REACT_RUNTIME_SOURCE);
        return;
      }

      if (!isPreview && (reqUrl === '/' || reqUrl === '/index.html')) {
        let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        // Point importmap to local /@react-esm.js so browser runs 100% offline
        html = html.replace(
          /<script type="importmap">[\s\S]*?<\/script>/,
          `<script type="importmap">{"imports":{"react":"/@react-esm.js","react-dom":"/@react-esm.js","react-dom/client":"/@react-esm.js","react/jsx-runtime":"/@react-esm.js"}}</script>`
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(html);
        return;
      }

      if (!isPreview && reqUrl.startsWith('/src/') && (reqUrl.endsWith('.jsx') || reqUrl.endsWith('.js'))) {
        const filePath = path.join(root, reqUrl.slice(1));
        if (fs.existsSync(filePath)) {
          let srcCode = fs.readFileSync(filePath, 'utf8');
          // Strip CSS imports inside ESM modules for native browser ESM loading
          srcCode = srcCode.replace(/^\s*import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
          const compiled = transpileJSX(srcCode, path.basename(filePath));
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(compiled);
          return;
        }
      }

      // Resolve static file from dist/ (in preview) or root / public/ (in dev)
      const baseDirs = isPreview ? [path.join(root, 'dist')] : [path.join(root, 'public'), root];
      let targetFile = null;
      const relReq = decodeURIComponent(reqUrl).replace(/^\/+/, '') || 'index.html';

      for (const bDir of baseDirs) {
        const candidate = path.join(bDir, relReq);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          targetFile = candidate;
          break;
        }
        const indexCand = path.join(candidate, 'index.html');
        if (fs.existsSync(indexCand) && fs.statSync(indexCand).isFile()) {
          targetFile = indexCand;
          break;
        }
      }

      if (!targetFile) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${reqUrl}`);
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      fs.createReadStream(targetFile).pipe(res);
    });

    server.listen(port, host, () => {
      console.log(`\n  ➜  Tu Tiên 2D (React AI Studio ${isPreview ? 'Preview' : 'Dev Server'}) ready`);
      console.log(`  ➜  Local:   http://localhost:${port}/`);
      console.log(`  ➜  Network: http://127.0.0.2:${port}/\n`);
      if (extraArgs.includes('--smoke')) {
        setTimeout(() => {
          server.close(() => process.exit(0));
        }, 500);
      }
    });
  }
}
