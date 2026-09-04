importScripts("ffmpeg.min.js");

var _ff = null;

self.onmessage = async function (e) {
  var msg = e.data;
  try {
    if (msg.type === "load") {
      _ff = FFmpeg.createFFmpeg({
        corePath: msg.corePath,
        mainName: "main",
        log: true,
      });
      _ff.setLogger(function (m) {
        self.postMessage({ type: "log", message: m });
      });
      _ff.setProgress(function (p) {
        self.postMessage({ type: "progress", progress: p.ratio });
      });
      await _ff.load();
      self.postMessage({ id: msg.id, type: "loaded" });
    } else if (msg.type === "exec") {
      _ff.FS("writeFile", msg.inName, new Uint8Array(msg.fileData));
      var args = ["-nostdin", "-y", "-i", msg.inName]
        .concat(msg.fmtArgs)
        .concat([msg.outName]);
      try {
        _ff.run.apply(_ff, args);
      } catch {}
      var data = _ff.FS("readFile", msg.outName);
      _ff.FS("unlink", msg.inName);
      _ff.FS("unlink", msg.outName);
      self.postMessage({ id: msg.id, type: "result", data: data.buffer }, [
        data.buffer,
      ]);
    }
  } catch (error) {
    self.postMessage({ id: msg.id, type: "error", message: error.message });
  }
};
