var _ff = null;

self.onmessage = async function(e) {
  var msg = e.data;
  try {
    if (msg.type === 'load') {
      if (typeof FFmpeg === 'undefined') {
        var loaded = false;
        var urls = msg.libUrls || [
          'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
          'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
        ];
        for (var i = 0; i < urls.length; i++) {
          try {
            var resp = await fetch(urls[i]);
            if (!resp.ok) continue;
            var code = await resp.text();
            var blob = new Blob([code], { type: 'application/javascript' });
            var blobUrl = URL.createObjectURL(blob);
            try { importScripts(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
            if (typeof FFmpeg !== 'undefined') { loaded = true; break; }
          } catch(e) {}
        }
        if (!loaded) throw new Error('Failed to load FFmpeg library');
      }
      _ff = FFmpeg.createFFmpeg({
        corePath: msg.corePath,
        mainName: 'main',
        log: true
      });
      _ff.setLogger(function(m) {
        self.postMessage({ type: 'log', message: m });
      });
      _ff.setProgress(function(p) {
        self.postMessage({ type: 'progress', progress: p.ratio });
      });
      await _ff.load();
      self.postMessage({ id: msg.id, type: 'loaded' });
    } else if (msg.type === 'exec') {
      _ff.FS('writeFile', msg.inName, new Uint8Array(msg.fileData));
      var args = ['-nostdin', '-y', '-i', msg.inName].concat(msg.fmtArgs).concat([msg.outName]);
      try { _ff.run.apply(_ff, args); } catch(e) {}
      var data = _ff.FS('readFile', msg.outName);
      _ff.FS('unlink', msg.inName);
      _ff.FS('unlink', msg.outName);
      self.postMessage({ id: msg.id, type: 'result', data: data.buffer }, [data.buffer]);
    }
  } catch(e) {
    self.postMessage({ id: msg.id, type: 'error', message: e.message });
  }
};
