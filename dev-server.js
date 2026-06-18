var http = require('http'), fs = require('fs'), path = require('path');
var ROOT = __dirname;
var MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.mp4':'video/mp4','.wav':'audio/wav','.ogg':'audio/ogg'};
var PAGE_NAMES = ['about','audio-watermark','c2pa','certificate','contact','converter','did','document-watermark','fingerprint','forensic','home','id_forge','metadata','pixel-injection','privacy','removal-tools','search','social','timestamp','watermark'];

http.createServer(function(req,res){
  var pathname = '/' + req.url.split('?')[0].replace(/^\/+|\/+$/g,'');
  if (pathname === '') pathname = '/index.html';
  var filePath = path.join(ROOT, pathname.replace(/\//g, path.sep));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }

  // Try direct path first; if 404, try rewrites
  if (!tryServe(filePath, req, res)) {
    // Rewrite short page URLs → Style/pages/{name}/index.html
    var m = pathname.match(/^\/([^\/]+)\/index\.html$/);
    if (m && PAGE_NAMES.indexOf(m[1]) !== -1) {
      var rewritten = path.join(ROOT, 'Style', 'pages', m[1], 'index.html');
      if (tryServe(rewritten, req, res)) return;
    }
    // Rewrite Style/ assets for standalone pages (css, js, etc.)
    var stylePath = path.join(ROOT, 'Style', pathname.replace(/^\//, ''));
    if (tryServe(stylePath, req, res)) return;
    res.writeHead(404, {'Content-Type':'text/html'});
    res.end('Not Found: ' + pathname);
  }
}).listen(8080, '0.0.0.0');
console.log('Server running on http://127.0.0.1:8080 with Range support');

function tryServe(filePath, req, res) {
  try {
    var stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    stat = fs.statSync(filePath);
    var ext = path.extname(filePath);
    var headers = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    };
    var range = req.headers.range;
    if (range) {
      var parts = range.replace(/bytes=/, '').split('-');
      var start = parseInt(parts[0], 10);
      var end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (start >= stat.size) { res.writeHead(416); res.end(); return true; }
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
    } else {
      headers['Content-Length'] = stat.size;
      headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
    return true;
  } catch(e) {
    return false;
  }
}
