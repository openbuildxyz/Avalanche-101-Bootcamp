import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Explicit allowlist keeps learner profile, environment files, and arbitrary files private.
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let relative;
    if (name === '/') relative = 'web/index.html';
    else if (/^\/web\/[\w.-]+$/.test(name)) relative = name.slice(1);
    else if (/^\/artifacts\/[A-Za-z]+\.json$/.test(name)) relative = name.slice(1);
    else if (name === '/task7/engine.mjs') relative = 'task7/engine.mjs';
    else if (name === '/ethers.js') relative = 'node_modules/ethers/dist/ethers.min.js';
    else if (name === '/fuji/deployment.json') relative = '../../public/evidence/fuji/deployment.json';
    else { res.writeHead(404).end(); return; }
    const file = path.join(root, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'text/plain', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400).end(); }
});
server.listen(4173, '127.0.0.1', () => console.log('Homework DApp: http://127.0.0.1:4173 — Fuji / local Anvil only'));
