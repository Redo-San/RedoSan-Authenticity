(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();

// ── Perceptual hashing (pure JS using Canvas) ──

function ahash(imgData) {
  var data = imgData.data,
    w = imgData.w,
    h = imgData.h;
  var size = 8;
  var gray = new Float64Array(size * size);
  for (var y = 0; y < size; y++)
    for (var x = 0; x < size; x++) {
      var i = (y * w + x) * 4;
      gray[y * size + x] =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  var avg = 0;
  for (var i = 0; i < gray.length; i++) avg += gray[i];
  avg /= gray.length;
  var hash = 0n;
  for (var i = 0; i < gray.length; i++)
    if (gray[i] > avg) hash |= 1n << BigInt(i);
  return hash.toString(16).padStart(16, "0");
}

function dhash(imgData) {
  var data = imgData.data,
    w = imgData.w,
    h = imgData.h;
  var size = 9;
  var gray = new Float64Array(size * size);
  for (var y = 0; y < size; y++)
    for (var x = 0; x < size; x++) {
      var i = (y * w + x) * 4;
      gray[y * size + x] =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  var hash = 0n,
    idx = 0;
  for (var y = 0; y < size; y++)
    for (var x = 0; x < size - 1; x++) {
      if (gray[y * size + x] > gray[y * size + x + 1])
        hash |= 1n << BigInt(idx);
      idx++;
    }
  return hash.toString(16).padStart(16, "0");
}

function phash(imgData) {
  var data = imgData.data,
    w = imgData.w,
    h = imgData.h;
  var size = 32;
  var gray = new Float64Array(size * size);
  for (var y = 0; y < size; y++)
    for (var x = 0; x < size; x++) {
      var i = (y * w + x) * 4;
      gray[y * size + x] =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  var dct = new Float64Array(8 * 8);
  for (var u = 0; u < 8; u++)
    for (var v = 0; v < 8; v++) {
      var s = 0;
      for (var x = 0; x < size; x++)
        for (var y = 0; y < size; y++)
          s +=
            gray[x * size + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
      var cu = u === 0 ? 1 / Math.SQRT2 : 1,
        cv = v === 0 ? 1 / Math.SQRT2 : 1;
      dct[u * 8 + v] = (s * cu * cv * 2) / size;
    }
  var avg = 0;
  for (var i = 0; i < dct.length; i++) avg += dct[i];
  avg /= dct.length;
  var hash = 0n;
  for (var i = 0; i < dct.length; i++)
    if (dct[i] > avg) hash |= 1n << BigInt(i);
  return hash.toString(16).padStart(16, "0");
}

function whash(imgData) {
  var data = imgData.data,
    w = imgData.w,
    h = imgData.h;
  var size = 32;
  var gray = new Float64Array(size * size);
  for (var y = 0; y < size; y++)
    for (var x = 0; x < size; x++) {
      var i = (y * w + x) * 4;
      gray[y * size + x] =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  var half = size / 2;
  var out = new Float64Array(size * size);
  for (var y = 0; y < size; y++)
    for (var x = 0; x < half; x++) {
      var a = gray[y * size + x * 2],
        b = gray[y * size + x * 2 + 1];
      out[y * size + x] = (a + b) / Math.SQRT2;
      out[y * size + half + x] = (a - b) / Math.SQRT2;
    }
  var out2 = new Float64Array(size * size);
  for (var y = 0; y < half; y++)
    for (var x = 0; x < size; x++) {
      var a = out[y * size + x],
        b = out[(y + half) * size + x];
      out2[y * size + x] = (a + b) / Math.SQRT2;
      out2[(y + half) * size + x] = (a - b) / Math.SQRT2;
    }
  var vals = [];
  for (var y = 0; y < 8; y++)
    for (var x = 0; x < 8; x++) vals.push(out2[y * size + x]);
  var sorted = vals.slice().sort(function (a, b) {
    return a - b;
  });
  var median = sorted[32];
  var hash = 0n,
    idx = 0;
  for (var y = 0; y < 8; y++)
    for (var x = 0; x < 8; x++) {
      if (out2[y * size + x] > median) hash |= 1n << BigInt(idx);
      idx++;
    }
  return hash.toString(16).padStart(16, "0");
}

function resizeImageData(imgData, targetSize) {
  var c = document.createElement("canvas");
  c.width = imgData.w;
  c.height = imgData.h;
  var ctx = c.getContext("2d");
  var tmp = ctx.createImageData(imgData.w, imgData.h);
  tmp.data.set(imgData.data);
  ctx.putImageData(tmp, 0, 0);
  var c2 = document.createElement("canvas");
  c2.width = targetSize;
  c2.height = targetSize;
  var ctx2 = c2.getContext("2d");
  ctx2.drawImage(c, 0, 0, targetSize, targetSize);
  var r = ctx2.getImageData(0, 0, targetSize, targetSize);
  r.w = targetSize;
  r.h = targetSize;
  return r;
}
