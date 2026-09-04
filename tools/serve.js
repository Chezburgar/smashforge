/* Tiny zero-dependency static server for local development.
   Usage:  node tools/serve.js [rootDir] [port]      (defaults: repo root, 8123) */
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const port = +(process.argv[3] || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.epk': 'application/octet-stream'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '' || p === '/') p = '/index.html';
  let file = path.resolve(path.join(root, p));
  if (file.toLowerCase().indexOf(root.toLowerCase()) !== 0) {
    res.writeHead(403); return res.end('forbidden');
  }
  /* Serve index.html for a directory, the way GitHub Pages does, so a
     subdirectory site like /orion/ resolves the same way locally. */
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  } catch (e) { /* fall through to the 404 below */ }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404 ' + p); }
    const head = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store'
    };
    if (req.method === 'HEAD') { res.writeHead(200, head); return res.end(); }
    res.writeHead(200, head);
    res.end(data);
  });
}).listen(port, () => console.log('SMASHFORGE serving ' + root + ' on http://localhost:' + port));
