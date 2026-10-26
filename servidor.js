/* Servidor local para probar la app (los módulos JS y el service worker
   no funcionan abriendo index.html con doble clic).
   Uso: node servidor.js  →  http://localhost:4174
   Modo local sin Firebase: http://localhost:4174/?local */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PUERTO = 4174;
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const destino = path.join(RAIZ, path.normalize(ruta));
  if (!destino.startsWith(RAIZ)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(destino, (err, datos) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
}).listen(PUERTO, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`\n  Entrenador en marcha\n  → http://localhost:${PUERTO}`);
  ips.forEach(ip => console.log(`  → http://${ip}:${PUERTO}   (desde el móvil, misma wifi)`));
});
