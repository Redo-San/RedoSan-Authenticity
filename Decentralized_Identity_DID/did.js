(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── DID: Decentralized Identity ──
// DID:key generation, signing, and verification using Web Crypto API
// Supports Ed25519, ECDSA P-256, RSA-2048, RSA-4096

var DID_STORAGE_KEY = 'redoSan_did_keys';
 
// ── Base58btc ──
var BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buf) {
  var bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length === 0) return '';
  // Count leading zeros
  var zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Encode
  var b58 = '';
  var num = [];
  for (var i = zeros; i < bytes.length; i++) num.push(bytes[i]);
  while (num.length > 0) {
    var remainder = 0;
    var newNum = [];
    for (var j = 0; j < num.length; j++) {
      remainder = remainder * 256 + num[j];
      var digit = Math.floor(remainder / 58);
      remainder = remainder % 58;
      if (newNum.length > 0 || digit > 0) newNum.push(digit);
    }
    b58 = BASE58_ALPHABET[remainder] + b58;
    num = newNum;
  }
  // Add leading '1's for each leading zero byte
  for (var k = 0; k < zeros; k++) b58 = '1' + b58;
  return b58;
}

function base58Decode(str) {
  if (typeof str !== 'string' || str.length === 0) return new Uint8Array(0);
  // Count leading '1's
  var zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  // Decode
  var num = [0];
  for (var i = zeros; i < str.length; i++) {
    var idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx === -1) throw new Error('Invalid base58 character: ' + str[i]);
    var carry = idx;
    for (var j = 0; j < num.length; j++) {
      carry += num[j] * 58;
      num[j] = carry & 0xFF;
      carry = carry >> 8;
    }
    while (carry > 0) {
      num.push(carry & 0xFF);
      carry = carry >> 8;
    }
  }
  // Reverse and add leading zeros
  var result = new Uint8Array(zeros + num.length);
  for (var k = 0; k < num.length; k++) result[zeros + k] = num[num.length - 1 - k];
  return result;
}

// ── Unsigned Varint ──
function varintEncode(value) {
  var bytes = [];
  while (value >= 0x80) {
    bytes.push((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7F);
  return new Uint8Array(bytes);
}

function varintDecode(bytes, offset) {
  offset = offset || 0;
  var value = 0;
  var shift = 0;
  var i = offset;
  while (true) {
    if (i >= bytes.length) throw new Error('Incomplete varint');
    var b = bytes[i];
    value |= (b & 0x7F) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
    i++;
  }
  return { value: value, length: i - offset + 1 };
}

// ── P-256 Key Compression ──
var P256_P = BigInt('115792089210356248762697446949407573530086143415290314195533631308867097853951');
var P256_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');

function compressP256Key(rawBytes) {
  if (rawBytes.length === 33) return rawBytes;
  if (rawBytes.length !== 65 || rawBytes[0] !== 0x04) throw new Error('Invalid P-256 raw public key');
  var x = rawBytes.slice(1, 33);
  var yLast = rawBytes[64];
  var compressed = new Uint8Array(33);
  compressed[0] = yLast % 2 === 0 ? 0x02 : 0x03;
  compressed.set(x, 1);
  return compressed;
}

function decompressP256Key(compressed) {
  if (compressed.length === 65 && compressed[0] === 0x04) return compressed;
  if (compressed.length !== 33) throw new Error('Invalid P-256 compressed key length: ' + compressed.length);
  var yParity = compressed[0] === 0x02 ? 0n : 1n;
  var x = new Uint8Array(compressed.slice(1, 33));
  // Compute y² = x³ - 3x + b (mod p) for secp256r1
  var xBn = bytesToBigInt(x);
  var ySq = (xBn * xBn * xBn - 3n * xBn + P256_B) % P256_P;
  var yBn = modSqrt(ySq, P256_P);
  if (yBn % 2n !== yParity) yBn = P256_P - yBn;
  var raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(bigIntToBytes(yBn, 32), 33);
  return raw;
}

function bytesToBigInt(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
  return BigInt('0x' + hex);
}

function bigIntToBytes(bn, len) {
  var hex = bn.toString(16);
  while (hex.length < len * 2) hex = '0' + hex;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function modSqrt(a, p) {
  // Tonelli-Shanks for p ≡ 3 (mod 4): a^((p+1)/4) mod p
  if (p % 4n === 3n) return powMod(a, (p + 1n) / 4n, p);
  // General Tonelli-Shanks
  var q = p - 1n;
  var s = 0n;
  while (q % 2n === 0n) { q /= 2n; s++; }
  if (s === 1n) return powMod(a, (p + 1n) / 4n, p);
  var z = 2n;
  while (powMod(z, (p - 1n) / 2n, p) !== p - 1n) z++;
  var c = powMod(z, q, p);
  var r = powMod(a, (q + 1n) / 2n, p);
  var t = powMod(a, q, p);
  var m = s;
  while (t !== 1n) {
    var i = 1n;
    var t2 = (t * t) % p;
    while (t2 !== 1n && i < m) { t2 = (t2 * t2) % p; i++; }
    var b = powMod(c, 1n << (m - i - 1n), p);
    r = (r * b) % p;
    c = (b * b) % p;
    t = (t * c) % p;
    m = i;
  }
  return r;
}

function powMod(a, e, m) {
  if (m === 1n) return 0n;
  var r = 1n;
  a = a % m;
  while (e > 0n) {
    if (e & 1n) r = (r * a) % m;
    e >>= 1n;
    a = (a * a) % m;
  }
  return r;
}

// ── Multicodec Prefixes ──
var MULTICODEC_MAP = {
  'ed25519': { code: 0xed, keyLength: 32 },
  'p256':    { code: 0x1200, keyLength: 33 },
  'rsa':     { code: 0x81, keyLength: null }
};
var MULTICODEC_REVERSE = {};
for (var _algo in MULTICODEC_MAP) {
  var _code = MULTICODEC_MAP[_algo].code;
  MULTICODEC_REVERSE[_code] = _algo;
}

function didGetAlgorithmList() {
  var algos = ['Ed25519', 'P-256'];
  if (crypto.subtle && crypto.subtle.generateKey) {
    algos.push('RSA-2048');
    algos.push('RSA-4096');
  }
  return algos;
}

async function didIsAlgoSupported(algo) {
  try {
    if (algo === 'Ed25519') {
      var k = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
      return !!k;
    } else if (algo === 'P-256') {
      var k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      return !!k;
    } else if (algo === 'RSA-2048') {
      var k = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, false, ['sign', 'verify']);
      return !!k;
    } else if (algo === 'RSA-4096') {
      var k = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]) }, false, ['sign', 'verify']);
      return !!k;
    }
  } catch (e) { return false; }
  return false;
}

async function didGenerateKeypair(algo) {
  algo = algo || 'Ed25519';
  if (algo === 'Ed25519') return didGenerateEd25519Keypair();
  if (algo === 'P-256') return didGenerateP256Keypair();
  if (algo === 'RSA-2048' || algo === 'RSA-4096') return didGenerateRSAKeypair(algo === 'RSA-4096' ? 4096 : 2048);
  // Fallback
  return didGenerateEd25519Keypair();
}

async function didGenerateEd25519Keypair() {
  try {
    var keypair = await crypto.subtle.generateKey(
      { name: 'Ed25519' }, true, ['sign', 'verify']
    );
    var pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keypair.publicKey));
    var did = didKeyEncode(pubRaw, 'ed25519');
    var privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    return { did: did, publicKey: keypair.publicKey, privateKey: keypair.privateKey, privJwk: privJwk, pubRaw: pubRaw, algorithm: 'Ed25519' };
  } catch (e) {
    return didGenerateP256Keypair();
  }
}

async function didGenerateP256Keypair() {
  var keypair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  var pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keypair.publicKey));
  var pubCompressed = compressP256Key(pubRaw);
  var did = didKeyEncode(pubCompressed, 'p256');
  var privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
  return { did: did, publicKey: keypair.publicKey, privateKey: keypair.privateKey, privJwk: privJwk, pubRaw: pubRaw, algorithm: 'P-256' };
}

async function didGenerateRSAKeypair(bits) {
  bits = bits || 2048;
  var keypair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  );
  var spki = new Uint8Array(await crypto.subtle.exportKey('spki', keypair.publicKey));
  var algoName = bits === 4096 ? 'RSA-4096' : 'RSA-2048';
  var did = didKeyEncode(spki, 'rsa');
  var privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
  return { did: did, publicKey: keypair.publicKey, privateKey: keypair.privateKey, privJwk: privJwk, pubRaw: spki, algorithm: algoName };
}

function didKeyEncode(pubKeyBytes, algoType) {
  var info = MULTICODEC_MAP[algoType];
  if (!info) throw new Error('Unknown algorithm type: ' + algoType);
  var prefixBytes = varintEncode(info.code);
  var combined = new Uint8Array(prefixBytes.length + pubKeyBytes.length);
  combined.set(prefixBytes);
  combined.set(pubKeyBytes, prefixBytes.length);
  var b58 = base58Encode(combined);
  return 'did:key:z' + b58;
}

function didKeyDecode(did) {
  if (!did || typeof did !== 'string') throw new Error('Invalid DID');
  // Backward compat: old format did:key:u... (base64url)
  if (did.indexOf('did:key:u') === 0) {
    var b64 = did.slice(9);
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bytes = new Uint8Array(atob(b64).split('').map(function(c) { return c.charCodeAt(0); }));
    var prefix = bytes[0];
    var pubKeyBytes = bytes.slice(1);
    var algo;
    if (prefix === 0xed) algo = 'ed25519';
    else if (prefix === 0x80) algo = 'p256';
    else if (prefix === 0x81) algo = 'rsa';
    else throw new Error('Unknown old-format multicodec prefix: 0x' + prefix.toString(16));
    return { pubKeyBytes: pubKeyBytes, algorithm: algo, legacy: true };
  }
  // New format: did:key:z... (base58btc)
  if (did.indexOf('did:key:z') !== 0) throw new Error('Unsupported DID format (expected did:key:z... or did:key:u...)');
  var b58 = did.slice(9);
  var decoded = base58Decode(b58);
  var vi = varintDecode(decoded, 0);
  var code = vi.value;
  var pubKeyBytes = decoded.slice(vi.length);
  var algoName = MULTICODEC_REVERSE[code];
  if (!algoName) throw new Error('Unknown multicodec code: 0x' + code.toString(16));
  return { pubKeyBytes: pubKeyBytes, algorithm: algoName };
}

async function didImportVerifyKey(did) {
  var decoded = didKeyDecode(did);
  if (decoded.algorithm === 'ed25519') {
    return await crypto.subtle.importKey(
      'raw', decoded.pubKeyBytes,
      { name: 'Ed25519' }, true, ['verify']
    );
  } else if (decoded.algorithm === 'p256') {
    var uncompressed = decompressP256Key(decoded.pubKeyBytes);
    return await crypto.subtle.importKey(
      'raw', uncompressed,
      { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
    );
  } else {
    return await crypto.subtle.importKey(
      'spki', decoded.pubKeyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']
    );
  }
}

async function didSign(keypair, data) {
  var enc = typeof data === 'string' ? new TextEncoder().encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
  var algo;
  if (keypair.algorithm === 'Ed25519') algo = { name: 'Ed25519' };
  else if (keypair.algorithm === 'P-256') algo = { name: 'ECDSA', hash: 'SHA-256' };
  else algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  var sig = await crypto.subtle.sign(algo, keypair.privateKey, enc);
  return new Uint8Array(sig);
}

async function didVerify(publicKey, signature, data, algorithm) {
  var enc = typeof data === 'string' ? new TextEncoder().encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
  var sig = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
  var algo;
  if (algorithm === 'Ed25519') algo = { name: 'Ed25519' };
  else if (algorithm === 'P-256') algo = { name: 'ECDSA', hash: 'SHA-256' };
  else algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  return await crypto.subtle.verify(algo, publicKey, sig, enc);
}

function didStoreKeys(did, privJwk, algorithm) {
  try {
    var data = JSON.stringify({ did: did, privJwk: privJwk, algorithm: algorithm, createdAt: Date.now() });
    localStorage.setItem(DID_STORAGE_KEY, data);
    return true;
  } catch (e) {
    return false;
  }
}

function didLoadKeys() {
  try {
    var raw = localStorage.getItem(DID_STORAGE_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data.did || !data.privJwk || !data.algorithm) return null;
    return { did: data.did, privJwk: data.privJwk, algorithm: data.algorithm, createdAt: data.createdAt || 0 };
  } catch (e) {
    return null;
  }
}

function didClearKeys() {
  try {
    localStorage.removeItem(DID_STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

async function didImportSignKey(stored) {
  if (stored.algorithm === 'Ed25519') {
    var privateKey = await crypto.subtle.importKey(
      'jwk', stored.privJwk,
      { name: 'Ed25519' }, true, ['sign']
    );
    var pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', privateKey));
    var publicKey = await crypto.subtle.importKey(
      'raw', pubRaw,
      { name: 'Ed25519' }, true, ['verify']
    );
    return { did: stored.did, publicKey: publicKey, privateKey: privateKey, pubRaw: pubRaw, algorithm: 'Ed25519' };
  } else if (stored.algorithm === 'P-256') {
    var privateKey = await crypto.subtle.importKey(
      'jwk', stored.privJwk,
      { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']
    );
    var pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', privateKey));
    var publicKey = await crypto.subtle.importKey(
      'raw', pubRaw,
      { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
    );
    return { did: stored.did, publicKey: publicKey, privateKey: privateKey, pubRaw: pubRaw, algorithm: 'P-256' };
  } else {
    // RSA-2048 or RSA-4096
    var algoName = stored.algorithm === 'RSA-4096' ? 'RSA-4096' : 'RSA-2048';
    var privateKey = await crypto.subtle.importKey(
      'jwk', stored.privJwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign']
    );
    var pubRaw = new Uint8Array(await crypto.subtle.exportKey('spki', privateKey));
    var publicKey = await crypto.subtle.importKey(
      'spki', pubRaw,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']
    );
    return { did: stored.did, publicKey: publicKey, privateKey: privateKey, pubRaw: pubRaw, algorithm: algoName };
  }
}

function didSigToBase64(sigBytes) {
  return btoa(String.fromCharCode.apply(null, sigBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function didBase64ToBytes(b64) {
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return new Uint8Array(atob(b64).split('').map(function(c) { return c.charCodeAt(0); }));
}

// ── W3C DID Document ──

function didGenerateDocument(kp) {
  var did = kp.did;
  var vmId = did + '#' + did.slice(8); // fragment = multibase value
  var doc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: did,
    verificationMethod: [
      {
        id: vmId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: did.slice(8)
      }
    ],
    authentication: [vmId],
    assertionMethod: [vmId],
    capabilityDelegation: [vmId],
    capabilityInvocation: [vmId]
  };
  if (kp.algorithm === 'P-256') {
    doc['@context'] = [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/secp256r1-2020/v1'
    ];
    doc.verificationMethod[0].type = 'EcdsaSecp256r1VerificationKey2020';
  }
  if (kp.algorithm.indexOf('RSA') === 0) {
    doc['@context'] = ['https://www.w3.org/ns/did/v1'];
    doc.verificationMethod[0].type = 'RsaVerificationKey2018';
  }
  return doc;
}

// ── Verifiable Credential ──

function getCryptosuite(algorithm) {
  if (algorithm === 'Ed25519') return 'eddsa-rdfc-2022';
  if (algorithm === 'P-256') return 'ecdsa-rdfc-2019';
  return 'rsa-signature-2022';
}

function getSuiteContext(algorithm) {
  if (algorithm === 'Ed25519') return 'https://w3id.org/security/suites/ed25519-2020/v1';
  if (algorithm === 'P-256') return 'https://w3id.org/security/suites/secp256r1-2020/v1';
  return 'https://w3id.org/security/suites/rsa-2020/v1';
}

function didCreateVerifiableCredential(kp, subjectData, signatureB64, nonce) {
  var did = kp.did;
  var vmId = did + '#' + did.slice(8);
  var vc = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      getSuiteContext(kp.algorithm),
      'https://w3id.org/security/data-integrity/v2'
    ],
    type: ['VerifiableCredential', 'RedoSanIdentityCredential'],
    issuer: did,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: did,
      fingerprintHash: subjectData
    },
    proof: {
      type: 'DataIntegrityProof',
      created: new Date().toISOString(),
      verificationMethod: vmId,
      cryptosuite: getCryptosuite(kp.algorithm),
      proofPurpose: 'assertionMethod',
      proofValue: signatureB64
    }
  };
  if (nonce) vc.proof.nonce = nonce;
  return vc;
}

// ── Professional Mode Handlers ──

function didUpdateButtons() {
  var genBtn = document.getElementById('did-gen-btn');
  var signBtn = document.getElementById('did-sign-btn');
  var clearBtn = document.getElementById('did-clear-btn');
  var fpInput = document.getElementById('did-fp-file');
  var hasDid = !!window._didKeypair;
  var hasFp = !!(fpInput && fpInput.files && fpInput.files[0]);
  if (genBtn) {
    genBtn.disabled = !hasFp;
  }
  if (signBtn) {
    signBtn.style.display = (hasDid && hasFp) ? '' : 'none';
  }
  if (clearBtn) {
    clearBtn.style.display = hasDid ? '' : 'none';
  }
}

function didUpdateProfessionalUI(kp) {
  var didVal = document.getElementById('did-did-value');
  var algoVal = document.getElementById('did-algo-value');
  var keyDisplay = document.getElementById('did-key-display');
  var statusText = document.getElementById('did-status-text');
  if (didVal) didVal.textContent = kp.did;
  if (algoVal) algoVal.textContent = kp.algorithm;
  if (keyDisplay) keyDisplay.style.display = 'block';
  if (statusText) statusText.textContent = __('did.keys_found', '🔑 Existing DID identity found');
  didUpdateButtons();
}

async function handleDidGenerate() {
  var btn = document.getElementById('did-gen-btn');
  var signBtn = document.getElementById('did-sign-btn');
  var spinner = document.getElementById('did-spinner');
  var result = document.getElementById('did-result');
  var statusText = document.getElementById('did-status-text');
  var algoSelect = document.getElementById('did-algo-select');
  var algo = algoSelect ? algoSelect.value : 'Ed25519';
  if (spinner) spinner.style.display = 'block';
  if (btn) btn.disabled = true;
  if (statusText) statusText.textContent = __('did.status_generating', 'Generating DID keypair...');
  try {
    var kp = await didGenerateKeypair(algo);
    didStoreKeys(kp.did, kp.privJwk, kp.algorithm);
    window._didKeypair = kp;
    window._didStored = didLoadKeys();
    didUpdateProfessionalUI(kp);
    if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--success);padding:10px;background:rgba(40,167,69,.1);border-radius:8px">' +
      __('did.generated', '✅ DID identity generated successfully!') + '<br><span style="font-size:0.8rem;margin-top:6px;display:block">' + __('did.prompt_sign', '👉 Now click ✍️ Sign Fingerprint to sign your file.') + '</span></div>';
  } catch (e) {
    if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
      __('did.failed', 'Error: {msg}').replace('{msg}', escapeHtml(e.message)) + '</div>';
    if (btn) btn.disabled = false;
  }
  if (spinner) spinner.style.display = 'none';
  if (btn) btn.disabled = false;
}

async function handleDidSign() {
  var signBtn = document.getElementById('did-sign-btn');
  var spinner = document.getElementById('did-spinner');
  var result = document.getElementById('did-result');
  var sigDisplay = document.getElementById('did-sig-display');
  var sigValue = document.getElementById('did-sig-value');
  var sigDid = document.getElementById('did-sig-did');
  var statusText = document.getElementById('did-status-text');
  if (spinner) spinner.style.display = 'block';
  if (signBtn) signBtn.disabled = true;
  if (statusText) statusText.textContent = __('did.status_signing', 'Signing fingerprint...');

  // Load keypair if not in memory
  if (!window._didKeypair) {
    var stored = didLoadKeys();
    if (stored) {
      try {
        window._didKeypair = await didImportSignKey(stored);
      } catch (e) {
        if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
          __('did.failed', 'Error: {msg}').replace('{msg}', escapeHtml('Failed to load keys: ' + e.message)) + '</div>';
        if (signBtn) signBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        return;
      }
    } else {
      if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
        __('did.no_keys', 'No DID identity found. Generate one above.') + '</div>';
      if (signBtn) signBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      return;
    }
  }

  // Get fingerprint data
  var fpResult = window._fpResult || null;
  if (!fpResult) {
    // Try loading from professional mode file uploads
    var fpFileInput = document.getElementById('did-fp-file') || document.getElementById('cert-result-fp');
    var fpText = '';
    if (fpFileInput && fpFileInput.files && fpFileInput.files[0]) {
      fpText = await new Promise(function(resolve) {
        var r = new FileReader();
        r.onload = function(e) { resolve(e.target.result); };
        r.onerror = function() { resolve(''); };
        r.readAsText(fpFileInput.files[0]);
      });
    }
    if (fpText) {
      try { fpResult = JSON.parse(fpText); } catch(e) { fpResult = null; }
    }
  }

  if (!fpResult) {
    if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
      __('did.no_fp', 'No fingerprint data found. Run Fingerprint tool first.') + '</div>';
    if (signBtn) signBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    return;
  }

  try {
    var fpJson = JSON.stringify(fpResult.hashes || {});
    var sigBytes = await didSign(window._didKeypair, fpJson);
    var sigBase64 = didSigToBase64(sigBytes);
    window._didSig = {
      did: window._didKeypair.did,
      algorithm: window._didKeypair.algorithm,
      signature: sigBase64,
      signedData: fpJson,
      timestamp: new Date().toISOString()
    };

    // Verify
    var verifyOk = await didVerify(window._didKeypair.publicKey, sigBytes, fpJson, window._didKeypair.algorithm);

    if (sigValue) sigValue.textContent = sigBase64.substring(0, 64) + '...';
    if (sigDid) sigDid.textContent = window._didKeypair.did;
    if (sigDisplay) sigDisplay.style.display = 'block';

    var dlContainer = document.getElementById('did-dl-container');
    if (verifyOk) {
      if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--success);padding:10px;background:rgba(40,167,69,.1);border-radius:8px">' +
        __('did.signed', '✅ Fingerprint signed successfully! Signature verified.') + '</div>';
      if (dlContainer) dlContainer.style.display = '';
    } else {
      if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
        __('did.verify_failed', '✗ Signature verification FAILED.') + '</div>';
      if (dlContainer) dlContainer.style.display = 'none';
    }
  } catch (e) {
    if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
      __('did.failed', 'Error: {msg}').replace('{msg}', escapeHtml(e.message)) + '</div>';
    var dlContainer = document.getElementById('did-dl-container');
    if (dlContainer) dlContainer.style.display = 'none';
  }
  if (spinner) spinner.style.display = 'none';
  if (signBtn) signBtn.disabled = false;
}

// ── DID Download ──

function showDidDownloadModal() {
  var stored = didLoadKeys();
  if (!stored) return;
  window._currentDownloadHandler = downloadDID;
  document.getElementById('dl-modal-title').textContent = __('dl.title', 'Download') + ' — DID';
  showDownloadModal();
}

async function downloadDID(format) {
  closeDownloadModal();
  var stored = didLoadKeys();
  if (!stored) return;
  // Reconstruct keypair
  var kp;
  if (window._didKeypair && window._didKeypair.did === stored.did) {
    kp = window._didKeypair;
  } else {
    try { kp = await didImportSignKey(stored); }
    catch(e) { return; }
  }
  var didSig = window._didSig || null;
  var createdAt = stored.createdAt ? new Date(stored.createdAt).toISOString() : '';

  var name = 'did_identity';

  if (format === 'pdf') {
    var blob = await didToPDF(kp, didSig, createdAt);
    downloadBlobSimple(blob, name + '.did.pdf');
    return;
  }
  if (format === 'doc') {
    var blob = await didToDOCX(kp, didSig, createdAt);
    downloadBlobSimple(blob, name + '.did.docx');
    return;
  }

  var content, ext, mime;
  switch (format) {
    case 'json': content = didToJSON(kp, didSig, createdAt); ext = 'json'; mime = 'application/json'; break;
    case 'csv':  content = didToCSV(kp, didSig, createdAt);  ext = 'csv';  mime = 'text/csv'; break;
    case 'txt':  content = didToTXT(kp, didSig, createdAt);  ext = 'txt';  mime = 'text/plain'; break;
    case 'xml':  content = didToXML(kp, didSig, createdAt);  ext = 'xml';  mime = 'application/xml'; break;
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, name + '.did.' + ext);
}

// ── DID format converters ──

function didToJSON(kp, didSig, createdAt) {
  var doc = didGenerateDocument(kp);
  var data = {
    did: kp.did,
    algorithm: kp.algorithm,
    created_at: createdAt,
    public_key_base64: kp.pubRaw ? btoa(String.fromCharCode.apply(null, kp.pubRaw)) : '',
    didDocument: doc
  };
  if (didSig) {
    data.signature = {
      did: didSig.did,
      algorithm: didSig.algorithm,
      value: didSig.signature,
      signed_data: didSig.signedData,
      timestamp: didSig.timestamp
    };
    data.verifiableCredential = didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature);
  }
  return JSON.stringify(data, null, 2);
}

function didToCSV(kp, didSig, createdAt) {
  var lines = [];
  lines.push('did,algorithm,created_at,public_key');
  lines.push('"' + kp.did + '","' + kp.algorithm + '","' + createdAt + '","' + (kp.pubRaw ? btoa(String.fromCharCode.apply(null, kp.pubRaw)) : '') + '"');
  lines.push('');
  var docStr = JSON.stringify(didGenerateDocument(kp));
  lines.push('did_document');
  lines.push('"' + docStr.replace(/"/g, '""') + '"');
  if (didSig) {
    lines.push('');
    lines.push('signature_did,signature_algorithm,signature_value,signed_data,timestamp');
    lines.push('"' + didSig.did + '","' + didSig.algorithm + '","' + didSig.signature + '","' + didSig.signedData + '","' + didSig.timestamp + '"');
    var vcStr = JSON.stringify(didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature));
    lines.push('');
    lines.push('verifiable_credential');
    lines.push('"' + vcStr.replace(/"/g, '""') + '"');
  }
  return lines.join('\n');
}

function didToTXT(kp, didSig, createdAt) {
  var lines = [];
  lines.push('RedoSan Authenticity — Decentralized Identity (DID)');
  lines.push('===================================================');
  lines.push('');
  lines.push('DID:            ' + kp.did);
  lines.push('Algorithm:      ' + kp.algorithm);
  if (createdAt) lines.push('Created:        ' + createdAt);
  if (kp.pubRaw) lines.push('Public Key:     ' + btoa(String.fromCharCode.apply(null, kp.pubRaw)));
  lines.push('');
  lines.push('--- W3C DID Document ---');
  lines.push(JSON.stringify(didGenerateDocument(kp), null, 2));
  if (didSig) {
    lines.push('');
    lines.push('--- Signature ---');
    lines.push('Signed By:      ' + didSig.did);
    lines.push('Algorithm:      ' + didSig.algorithm);
    lines.push('Timestamp:      ' + didSig.timestamp);
    lines.push('Signed Data:    ' + didSig.signedData);
    lines.push('Signature:      ' + didSig.signature);
    lines.push('');
    lines.push('--- Verifiable Credential ---');
    lines.push(JSON.stringify(didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature), null, 2));
  }
  lines.push('');
  lines.push('Generated by RedoSan Authenticity');
  return lines.join('\n');
}

function didToXML(kp, didSig, createdAt) {
  var x = '<?xml version="1.0" encoding="UTF-8"?>\n<did>\n';
  x += '  <did_value>' + escXml(kp.did) + '</did_value>\n';
  x += '  <algorithm>' + escXml(kp.algorithm) + '</algorithm>\n';
  x += '  <created_at>' + escXml(createdAt) + '</created_at>\n';
  x += '  <public_key>' + escXml(kp.pubRaw ? btoa(String.fromCharCode.apply(null, kp.pubRaw)) : '') + '</public_key>\n';
  var doc = didGenerateDocument(kp);
  x += '  <did_document>' + escXml(JSON.stringify(doc, null, 2)) + '</did_document>\n';
  if (didSig) {
    x += '  <signature>\n';
    x += '    <signed_by>' + escXml(didSig.did) + '</signed_by>\n';
    x += '    <algorithm>' + escXml(didSig.algorithm) + '</algorithm>\n';
    x += '    <value>' + escXml(didSig.signature) + '</value>\n';
    x += '    <signed_data>' + escXml(didSig.signedData) + '</signed_data>\n';
    x += '    <timestamp>' + escXml(didSig.timestamp) + '</timestamp>\n';
    x += '  </signature>\n';
    var vc = didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature);
    x += '  <verifiable_credential>' + escXml(JSON.stringify(vc, null, 2)) + '</verifiable_credential>\n';
  }
  x += '</did>';
  return x;
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function didToPDF(kp, didSig, createdAt) {
  if (typeof jspdf === 'undefined') await ensureLib('jspdf');
  var doc = new jspdf.jsPDF();
  var y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text('RedoSan Authenticity — DID Identity', 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('DID: ' + kp.did, 14, y); y += 6;
  doc.text('Algorithm: ' + kp.algorithm, 14, y); y += 6;
  if (createdAt) { doc.text('Created: ' + createdAt, 14, y); y += 6; }
  if (kp.pubRaw) {
    var b64 = btoa(String.fromCharCode.apply(null, kp.pubRaw));
    doc.text('Public Key (base64):', 14, y); y += 5;
    doc.setFontSize(7);
    doc.text(b64, 14, y); y += 8;
  }
  y += 4;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text('W3C DID Document', 14, y); y += 7;
  doc.setFontSize(6);
  doc.setTextColor(50, 50, 50);
  var docStr = JSON.stringify(didGenerateDocument(kp), null, 2);
  var docLines = doc.splitTextToSize(docStr, 180);
  for (var di = 0; di < docLines.length; di++) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(docLines[di], 14, y); y += 3.5;
  }
  if (didSig) {
    y += 4;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(40, 167, 69);
    doc.text('Signature', 14, y); y += 8;
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('Signed By: ' + didSig.did, 14, y); y += 5;
    doc.text('Algorithm: ' + didSig.algorithm, 14, y); y += 5;
    doc.text('Timestamp: ' + didSig.timestamp, 14, y); y += 5;
    doc.setFontSize(7);
    doc.text('Signature: ' + didSig.signature, 14, y); y += 8;
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(40, 167, 69);
    doc.text('Verifiable Credential', 14, y); y += 7;
    doc.setFontSize(6);
    doc.setTextColor(50, 50, 50);
    var vcStr = JSON.stringify(didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature), null, 2);
    var vcLines = doc.splitTextToSize(vcStr, 180);
    for (var vi = 0; vi < vcLines.length; vi++) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(vcLines[vi], 14, y); y += 3.5;
    }
  }
  return doc.output('blob');
}

async function didToDOCX(kp, didSig, createdAt) {
  if (typeof docx === 'undefined') await ensureLib('docx');
  var children = [];
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'RedoSan Authenticity — DID Identity', bold: true, size: 28, color: '6C5CE7' })], spacing: { after: 200 } }));
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'DID: ', bold: true, size: 20 }), new docx.TextRun({ text: kp.did, size: 20 })], spacing: { after: 100 } }));
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Algorithm: ', bold: true, size: 20 }), new docx.TextRun({ text: kp.algorithm, size: 20 })], spacing: { after: 100 } }));
  if (createdAt) children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Created: ', bold: true, size: 20 }), new docx.TextRun({ text: createdAt, size: 20 })], spacing: { after: 100 } }));
  if (kp.pubRaw) {
    var b64 = btoa(String.fromCharCode.apply(null, kp.pubRaw));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Public Key (base64): ', bold: true, size: 20 })], spacing: { after: 60 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: b64, size: 16, font: 'Courier New' })], spacing: { after: 100 } }));
  }
  // DID Document
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'W3C DID Document', bold: true, size: 22, color: '6C5CE7' })], spacing: { after: 200 } }));
  var docStr = JSON.stringify(didGenerateDocument(kp), null, 2);
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: docStr, size: 16, font: 'Courier New' })], spacing: { after: 200 } }));
  if (didSig) {
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Signature', bold: true, size: 24, color: '28A745' })], spacing: { after: 200 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Signed By: ', bold: true, size: 20 }), new docx.TextRun({ text: didSig.did, size: 20 })], spacing: { after: 100 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Algorithm: ', bold: true, size: 20 }), new docx.TextRun({ text: didSig.algorithm, size: 20 })], spacing: { after: 100 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Timestamp: ', bold: true, size: 20 }), new docx.TextRun({ text: didSig.timestamp, size: 20 })], spacing: { after: 100 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Signature: ', bold: true, size: 16 }), new docx.TextRun({ text: didSig.signature, size: 16, font: 'Courier New' })], spacing: { after: 100 } }));
    // Verifiable Credential
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Verifiable Credential', bold: true, size: 22, color: '28A745' })], spacing: { after: 200 } }));
    var vcStr = JSON.stringify(didCreateVerifiableCredential(kp, didSig.signedData, didSig.signature), null, 2);
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: vcStr, size: 16, font: 'Courier New' })], spacing: { after: 200 } }));
  }
  children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Generated by RedoSan Authenticity', size: 16, color: '999999' })], spacing: { before: 400 } }));
  var doc2 = new docx.Document({ sections: [{ children: children }] });
  return docx.Packer.toBlob(doc2);
}

function handleDidClear() {
  didClearKeys();
  window._didKeypair = null;
  window._didSig = null;
  var keyDisplay = document.getElementById('did-key-display');
  var sigDisplay = document.getElementById('did-sig-display');
  var signBtn = document.getElementById('did-sign-btn');
  var result = document.getElementById('did-result');
  var statusText = document.getElementById('did-status-text');
  if (keyDisplay) keyDisplay.style.display = 'none';
  if (sigDisplay) sigDisplay.style.display = 'none';
  if (signBtn) signBtn.style.display = 'none';
  var dlContainer = document.getElementById('did-dl-container');
  if (dlContainer) dlContainer.style.display = 'none';
  if (statusText) statusText.textContent = __('did.no_keys', 'No DID identity found. Generate one above.');
  if (result) result.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);padding:10px;background:rgba(108,92,231,.08);border-radius:8px">' +
    __('did.cleared', 'DID identity cleared.') + '</div>';
}

// ── Auto-restore DID identity + populate algorithm selector on page load ──
document.addEventListener('DOMContentLoaded', function() {
  // Populate algorithm selector (preserve static HTML option labels)
  var algoSelect = document.getElementById('did-algo-select');
  if (algoSelect) {
    var algos = didGetAlgorithmList();
    var hasOptions = algoSelect.options.length > 0;
    if (!hasOptions) {
      algoSelect.innerHTML = '';
      for (var ai = 0; ai < algos.length; ai++) {
        var opt = document.createElement('option');
        opt.value = algos[ai];
        opt.textContent = algos[ai];
        algoSelect.appendChild(opt);
      }
    }
  }
  didUpdateButtons();
});
