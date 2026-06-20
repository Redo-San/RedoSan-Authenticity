// Web Worker for background hash computation

self.importScripts('hashing.js');

self.onmessage = async function(e) {
  var msg = e.data;
  if (msg.type !== 'compute-remaining') return;

  var data = new Uint8Array(msg.buf);
  var hashes = {};

  try { hashes['SHA-3_224'] = await sha3_224(data); } catch{}
  self.postMessage({ type: 'progress', key: 'SHA-3_224' });
  try { hashes['SHA-3_256'] = await sha3_256(data); } catch{}
  self.postMessage({ type: 'progress', key: 'SHA-3_256' });
  try { hashes['SHA-3_384'] = await sha3_384(data); } catch{}
  self.postMessage({ type: 'progress', key: 'SHA-3_384' });
  try { hashes['SHA-3_512'] = await sha3_512(data); } catch{}
  self.postMessage({ type: 'progress', key: 'SHA-3_512' });

  try { hashes['BLAKE2b'] = await blake2b(data); } catch{}
  self.postMessage({ type: 'progress', key: 'BLAKE2b' });
  try { hashes['BLAKE2s'] = await blake2s(data); } catch{}
  self.postMessage({ type: 'progress', key: 'BLAKE2s' });

  try { hashes['SHA-224'] = await sha224(data); } catch{}
  self.postMessage({ type: 'progress', key: 'SHA-224' });
  try { hashes['MD5'] = await md5(data); } catch{}
  self.postMessage({ type: 'progress', key: 'MD5' });
  try { hashes['RIPEMD-160'] = await ripemd160(data); } catch{}
  self.postMessage({ type: 'progress', key: 'RIPEMD-160' });
  try { hashes['Whirlpool'] = await whirlpool(data); } catch{}
  self.postMessage({ type: 'progress', key: 'Whirlpool' });

  self.postMessage({ type: 'done', hashes: hashes });
};
