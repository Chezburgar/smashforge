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
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.resolve(path.join(root, p));
  if (file.toLowerCase().indexOf(root.toLowerCase()) !== 0) {
    res.writeHead(403); return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404 ' + p); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(port, () => console.log('SMASHFORGE serving ' + root + ' on http://localhost:' + port));
