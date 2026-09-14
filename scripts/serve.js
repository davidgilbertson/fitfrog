import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, sep, extname} from 'node:path';

const PORT = 42187;
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml'};
createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {response.writeHead(403).end(); return;}
  try {
    const file = await readFile(path);
    response.writeHead(200, {'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'}).end(file);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EISDIR') console.error(error);
    response.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
