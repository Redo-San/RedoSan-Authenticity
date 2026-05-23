var _ff = null;
var _ffLoaded = false;

function _tryLoadFfmpeg() {
  var urls = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      importScripts(urls[i]);
      if (typeof FFmpeg !== 'undefined') return true;
    } catch(e) {}
  }
  return false;
}

if (!_tryLoadFfmpeg()) {
  throw new Error('Failed to load FFmpeg library');
}

self.onmessage = async function(e) {
  var msg = e.data;
  try {
    if (msg.type === 'load') {
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
      _ffLoaded = true;
      self.postMessage({ id: msg.id, type: 'loaded' });
    } else if (msg.type === 'exec') {
      _ff.FS('writeFile', msg.inName, new Uint8Array(msg.fileData));
      var args = ['-nostdin', '-y', '-i', msg.inName].concat(msg.fmtArgs).concat([msg.outName]);
      try {
        _ff.run.apply(_ff, args);
      } catch(e) {}
      var data = _ff.FS('readFile', msg.outName);
      _ff.FS('unlink', msg.inName);
      _ff.FS('unlink', msg.outName);
      self.postMessage({ id: msg.id, type: 'result', data: data.buffer }, [data.buffer]);
    }
  } catch(e) {
    self.postMessage({ id: msg.id, type: 'error', message: e.message });
  }
};
