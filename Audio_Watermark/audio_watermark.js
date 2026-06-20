(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var _awmSecretBytes = null;

// ── Tab switching ──
/**
 *
 * @param mode
 */
function switchAwmTab(mode) {
    document.querySelectorAll('.tab-btn[data-awm-tab]').forEach(b => b.classList.remove('active'));
    document.getElementById('awm-embed').style.display = mode === 'embed' ? '' : 'none';
    document.getElementById('awm-extract').style.display = mode === 'extract' ? '' : 'none';
    document.querySelector('.tab-btn[data-awm-tab="' + mode + '"]').classList.add('active');
}

// ── Password toggle ──
/**
 *
 */
function toggleAwmPassword() {
    var t = parseInt(document.getElementById('awm-type').value);
    document.getElementById('awm-password-group').style.display = '';
    document.getElementById('awm-strength-group').style.display = (t === 5 || t === 6 || t === 8) ? '' : 'none';
}
/**
 *
 */
function toggleAwmInput() {
    var t = parseInt(document.getElementById('awm-type').value);
    var fileGroup = document.getElementById('awm-file-group');
    var textGroup = document.getElementById('awm-text-group');
    var isLowCapacity = (t === 3 || t === 4 || t === 7);
    fileGroup.style.display = isLowCapacity ? 'none' : '';
    textGroup.style.display = isLowCapacity ? '' : 'none';
    if (isLowCapacity) {
        _awmSecretBytes = null;
        updateAwmCapacity();
    } else {
        var fi = document.getElementById('awm-file');
        if (fi.files && fi.files[0]) loadAwmFile({target:fi});
    }
}
/**
 *
 */
function toggleAwmPasswordEx() {
    var t = parseInt(document.getElementById('awm-type-ex').value);
    document.getElementById('awm-password-ex-group').style.display = '';
    document.getElementById('awm-strength-ex-group').style.display = (t === 0 || t === 5 || t === 6 || t === 8) ? '' : 'none';
}

// ── File upload for secret message ──
/**
 *
 * @param event
 */
function loadAwmFile(event) {
    var file = event.target.files[0];
    if (!file) { _awmSecretBytes = null; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        _awmSecretBytes = new TextEncoder().encode(e.target.result);
        document.getElementById('awm-file-name').textContent = file.name + ' (' + _awmSecretBytes.length + ' bytes)';
        updateAwmCapacity();
    };
    reader.readAsText(file);
}

// ── Capacity update ──
/**
 *
 */
function updateAwmCapacity() {
    var f = document.getElementById('awm-audio');
    var capEl = document.getElementById('awm-capacity');
    if (!f || !f.files || !f.files[0]) { capEl.textContent = ''; return; }
    var t = parseInt(document.getElementById('awm-type').value);
    var isLowCapacity = (t === 3 || t === 4 || t === 7);
    var msgBytes;
    if (isLowCapacity) {
        var txt = document.getElementById('awm-text').value;
        msgBytes = txt ? new TextEncoder().encode(txt.substring(0, 1000)) : new Uint8Array(0);
        _awmSecretBytes = msgBytes;
        document.getElementById('awm-text-info').textContent = msgBytes.length + ' bytes / ~' + (msgBytes.length*8) + ' bits';
    } else {
        msgBytes = _awmSecretBytes || new Uint8Array(0);
    }
    var byteLen = msgBytes.length;
    var descs = {1:'LSB: ~1 bit/sample',2:'Phase Coding: ~1 bit/sample',3:'Echo Hiding: ~1 bit/'+AWM3_FRAME+' samples x3 reps',4:'DSSS: ~1 bit/'+(AWM4_FRAME>>1)+' frames',5:'QIM: ~1 bit/sample',6:'DWT Haar: ~1 bit/1024 coefs',7:'Patchwork: ~1 bit/'+(AWM7_FRAME>>1)+' frames x5 reps',8:'DCT: ~1 bit/'+(AWM8_FRAME>>1)+' frames'};
    var mult = {1:1, 2:1, 3:AWM3_FRAME*3, 4:AWM4_FRAME>>1, 5:1, 6:1024, 7:AWM7_FRAME*5>>1, 8:AWM8_FRAME>>1};
    var m = mult[t] || 1;
    var estSeconds = Math.ceil(byteLen * 8 * m / 44_100);
    capEl.textContent = (descs[t]||'') + ' | Message: ' + (byteLen*8) + ' bits | Need ~' + estSeconds + 's audio at 44.1kHz';
}

// ── Embed ──
/**
 *
 */
async function handleAwmEmbed() {
    var type = parseInt(document.getElementById('awm-type').value);
    var input = document.getElementById('awm-audio');
    if (!input || !input.files || !input.files[0]) return alert('Please select an audio file');
    if (typeof validateFileInput === 'function' && !validateFileInput(input)) return;
    var audioFile = input.files[0];
    var password = document.getElementById('awm-password').value;
    var isLowCapacity = (type === 3 || type === 4 || type === 7);
    if (isLowCapacity) {
        var txtVal = document.getElementById('awm-text').value;
        if (!txtVal || !txtVal.trim()) return alert('Please enter a secret message');
        _awmSecretBytes = new TextEncoder().encode(txtVal.trim());
    } else {
        if (!_awmSecretBytes) return alert('Please upload a secret document');
    }
    if (!password || !password.trim()) return alert('Password is required');
    var secretBytes = _awmSecretBytes;
    var spinner = document.getElementById('awm-spinner');
    var prog = document.getElementById('awm-progress');
    var progFill = document.getElementById('awm-progress-fill');
    var progText = document.getElementById('awm-progress-text');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    prog.style.display = 'none';
    try {
        var info = await awLoadAudio(audioFile);
        var key = await pw_key(password);
        var payloadBits = awFormatPayload(secretBytes, key);
        var maxBits = 0;
        var names = {1:'LSB Audio',2:'FFT-QIM',3:'Echo Hiding',4:'Spread Spectrum (DSSS)',5:'QIM',6:'DWT (Haar Wavelet)',7:'Patchwork',8:'DCT-based'};
        var maxFns = {2:aw2_maxBits,3:aw3_maxBits,4:aw4_maxBits,6:aw6_maxBits,7:aw7_maxBits,8:aw8_maxBits};
        if (type === 1 || type === 5) maxBits = info.samples.length;
        else if (maxFns[type]) maxBits = maxFns[type](info.samples.length, info.sr);
        if (payloadBits.length > maxBits)
            throw new Error('Message too long. Need ' + payloadBits.length + ' bits, max ' + maxBits + ' for ' + (names[type]||'this algorithm'));
        var modified;
        var s16 = new Int16Array(info.samples);
        if (type === 8) {
            spinner.style.display = 'none';
            prog.style.display = 'flex';
            modified = await aw8_embed_async(s16, payloadBits, info.sr, function(pct) {
                progFill.style.width = (pct * 100) + '%';
                progText.textContent = Math.round(pct * 100) + '%';
            });
        } else {
            switch (type) {
            case 1: {
            modified = aw1_embed(s16, payloadBits);
            break;
            }
            case 2: {
            modified = aw2_embed(s16, payloadBits, info.sr);
            break;
            }
            case 3: {
            modified = aw3_embed(s16, payloadBits, info.sr);
            break;
            }
            case 4: {
            modified = aw4_embed(s16, payloadBits, info.sr);
            break;
            }
            case 5: {
            modified = aw5_embed(s16, payloadBits, info.sr);
            break;
            }
            case 6: {
            modified = aw6_embed(s16, payloadBits, info.sr);
            break;
            }
            case 7: { {
            modified = aw7_embed(s16, payloadBits, info.sr);
            // No default
            }
            break;
            }
            }
        }
        prog.style.display = 'none';
        spinner.style.display = 'none';
        var wavBuf = awWriteWav(modified, info.sr, info.ch, info.raw, info.bps);
        var blob = new Blob([wavBuf], { type: 'audio/wav' });
        output.innerHTML = '<div class="result-success"><span class="result-icon">✅</span><strong>Watermark embedded successfully!</strong><br>Algorithm: ' + names[type] + '<br>File: ' + escapeHtml(audioFile.name) + '<br>Sample Rate: ' + info.sr + ' Hz<br>Channels: ' + info.ch + '<br>Hidden: ' + secretBytes.length + ' bytes</div>';
        downloadDiv.innerHTML = '<a href="' + URL.createObjectURL(blob) + '" download="watermarked_' + escapeHtml(audioFile.name).replace(/\.[^.]+$/, '.wav') + '" class="btn">⬇ Download Watermarked WAV</a>';
        setResult('awmResult', { blob: blob, originalName: audioFile.name, type: type, algorithm: names[type] });
        resultDiv.style.display = '';
    } catch (error) {
        prog.style.display = 'none';
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>' + escapeHtml(error.message) + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
    spinner.style.display = 'none';
    prog.style.display = 'none';
}

// ── Extract ──
/**
 *
 */
async function handleAwmExtract() {
    var type = parseInt(document.getElementById('awm-type-ex').value);
    var input = document.getElementById('awm-audio-ex');
    if (!input || !input.files || !input.files[0]) return alert('Please select a watermarked audio file');
    if (typeof validateFileInput === 'function' && !validateFileInput(input)) return;
    var audioFile = input.files[0];
    var password = document.getElementById('awm-password-ex').value;
    if (!password || !password.trim()) return alert('Password is required');
    var spinner = document.getElementById('awm-spinner');
    var prog = document.getElementById('awm-progress');
    var progFill = document.getElementById('awm-progress-fill');
    var progText = document.getElementById('awm-progress-text');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    prog.style.display = 'none';
    try {
        var info = await awLoadAudio(audioFile);
        var key = await pw_key(password);
        var bitsStr = '';
        var detectedAlgo = '';
        if (type === 0) {
            var found = await awmMultiDetect(info, key, spinner, prog, progFill, progText);
            resultDiv.style.display = '';
            spinner.style.display = 'none';
            return;
        } else if (type === 8) {
            spinner.style.display = 'none';
            prog.style.display = 'flex';
            bitsStr = await aw8_extract_async(info.samples, info.sr, info.samples.length, function(pct) {
                progFill.style.width = (pct * 100) + '%';
                progText.textContent = Math.round(pct * 100) + '%';
            });
        } else {
            switch (type) {
            case 1: {
            bitsStr = aw1_extract(info.samples, info.samples.length);
            break;
            }
            case 2: {
            bitsStr = aw2_extract(info.samples, info.sr);
            break;
            }
            case 3: {
            bitsStr = await aw3_extract(info.samples, info.sr);
            break;
            }
            case 4: {
            bitsStr = aw4_extract(info.samples, info.sr);
            break;
            }
            case 5: {
                bitsStr = aw5_extract(info.samples, info.sr, info.samples.length);
            
            break;
            }
            case 6: {
                bitsStr = aw6_extract(info.samples, info.sr, info.samples.length);
            
            break;
            }
            case 7: {
                bitsStr = aw7_extract(info.samples, info.sr);
            
            break;
            }
            // No default
            }
        }
        prog.style.display = 'none';
        spinner.style.display = 'none';
        if (type !== 0) {
            var result = awExtractPayload(bitsStr, key);
            if (result === 'bad-password') {
                output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>Wrong password or no watermark found</div>';
            } else if (result) {
                var decoded = new TextDecoder().decode(result);
                var algoName = detectedAlgo || ({1:'LSB Audio',2:'FFT-QIM',3:'Echo Hiding',4:'Spread Spectrum (DSSS)',5:'QIM',6:'DWT (Haar Wavelet)',7:'Patchwork',8:'DCT-based'})[type] || 'Unknown';
                output.innerHTML = '<div class="result-success"><span class="result-icon">✅</span><strong>Watermark extracted!</strong><br>Algorithm: ' + algoName + '<br><br><strong>Hidden Message:</strong><br><pre class="awm-pre">' + escapeHtml(decoded) + '</pre></div>';
            } else {
                output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>No watermark data found. Try a different algorithm.</div>';
            }
        }
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    } catch (error) {
        prog.style.display = 'none';
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>' + escapeHtml(error.message) + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
    spinner.style.display = 'none';
    prog.style.display = 'none';
}

/**
 *
 * @param info
 * @param key
 * @param spinner
 * @param prog
 * @param progFill
 * @param progText
 */
async function awmMultiDetect(info, key, spinner, prog, progFill, progText) {
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    var resultDiv = document.getElementById('awm-result');
    spinner.style.display = 'none';
    prog.style.display = 'flex';

    // Build right-channel samples for stereo dual-watermark detection
    var rightSamples = null;
    if (info.ch >= 2 && info.raw && info.raw.length >= info.samples.length * 2) {
        rightSamples = new Int16Array(info.samples.length);
        for (var ri = 0; ri < info.samples.length; ri++) rightSamples[ri] = info.raw[ri * info.ch + 1];
    }

    /**
     *
     * @param src
     */
    function makeAlgos(src) { return [
        { id: 8, name: 'DCT-based', fn: function() {
            return aw8_extract_async(src, info.sr, src.length, function(pct) {
                progFill.style.width = (pct * 100) + '%';
                progText.textContent = '🔍 DCT-based (' + Math.round(pct * 100) + '%)';
            });
        }},
        { id: 2, name: 'FFT-QIM', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw2_extract(src, info.sr));
        }, 0); }); }},
        { id: 3, name: 'Echo Hiding', fn: function() { return aw3_extract(src, info.sr); }},
        { id: 4, name: 'DSSS', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw4_extract(src, info.sr));
        }, 0); }); }},
        { id: 6, name: 'DWT', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw6_extract(src, info.sr, src.length));
        }, 0); }); }},
        { id: 7, name: 'Patchwork', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw7_extract(src, info.sr));
        }, 0); }); }},
        { id: 1, name: 'LSB Audio', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw1_extract(src, src.length));
        }, 0); }); }},
        { id: 5, name: 'QIM', fn: function() { return new Promise(function(r) { setTimeout(function() {
            r(aw5_extract(src, info.sr, src.length));
        }, 0); }); }}
    ]; }

    var channels = [{ src: info.samples, label: 'Left Ch' }];
    if (rightSamples) channels.push({ src: rightSamples, label: 'Right Ch' });

    var found = [];
    var seen = {};
    for (var ci = 0; ci < channels.length; ci++) {
        var ch = channels[ci];
        var algos = makeAlgos(ch.src);
        for (var i = 0; i < algos.length; i++) {
            var a = algos[i];
            progFill.style.width = '0%';
            progFill.style.background = '';
            progText.textContent = '🔍 ' + a.name + ' (' + ch.label + ', scanning...)';
            await new Promise(function(r) { setTimeout(r, 16); });
            var bitsStr;
            try {
                bitsStr = await a.fn();
            } catch { continue; }
            await new Promise(function(r) { setTimeout(r, 0); });
            if (typeof bitsStr !== 'string' || bitsStr.length < 32) {
                continue;
            }
            var result = awExtractPayload(bitsStr, key);
            if (!result || result === 'bad-password') {
                continue;
            }
            var decoded = new TextDecoder().decode(result);
            var dedupKey = result.length + ':' + (decoded.substring(0, 100));
            if (!seen[dedupKey]) {
                seen[dedupKey] = true;
                found.push({ algo: a.id, name: a.name, decoded: decoded, channel: ch.label });
            }
            progFill.style.width = '100%';
            progFill.style.background = '#4caf50';
            progText.textContent = '✅ ' + a.name + ' (' + ch.label + '): watermark found!';
            await new Promise(function(r) { setTimeout(r, 200); });
        }
    }
    prog.style.display = 'none';
    if (found.length === 0) {
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>No watermark detected with any algorithm. Try a different password or file.</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
        return false;
    }
    var html = '';
    for (var j = 0; j < found.length; j++) {
        var f = found[j];
        var icon = j === 0 ? '✅' : '🔷';
        html += '<div class="result-success" style="margin-bottom:12px"><span class="result-icon">' + icon + '</span>' +
            '<strong>Watermark #' + (j + 1) + '</strong><br>Algorithm: ' + f.name + ' (auto-detected, ' + f.channel + ')<br><br>' +
            '<strong>Hidden Message:</strong><br><pre class="awm-pre">' + escapeHtml(f.decoded) + '</pre></div>';
    }
    output.innerHTML = html;
    downloadDiv.innerHTML = '';
    resultDiv.style.display = '';
    document.getElementById('awm-type-ex').value = found[0].algo;
    return true;
}

/**
 *
 * @param s
 */
function escapeHtml(s) {
    var d = document.createElement('div');
    d.append(document.createTextNode(s));
    return d.innerHTML;
}

// ── Dual extract (for simplified-mode protected audio) ──
/**
 *
 */
async function awmDualExtract() {
    var audioFile = document.getElementById('awm-audio-ex').files[0];
    var password = document.getElementById('awm-password-ex').value;
    var fpAlgo = parseInt(document.getElementById('awm-dual-fp-algo').value);
    var didAlgo = parseInt(document.getElementById('awm-dual-did-algo').value);
    if (!audioFile) return alert('Please select a watermarked audio file');
    if (!password || !password.trim()) return alert('Password is required');
    var spinner = document.getElementById('awm-spinner');
    var prog = document.getElementById('awm-progress');
    var progFill = document.getElementById('awm-progress-fill');
    var progText = document.getElementById('awm-progress-text');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    prog.style.display = 'none';
    try {
        var info = await awLoadAudio(audioFile);
        var key = await pw_key(password);
        var algoNames = {1:'LSB Audio',2:'FFT-QIM',3:'Echo Hiding',4:'DSSS',5:'QIM',6:'DWT',7:'Patchwork',8:'DCT-based'};
        var leftSrc = info.samples;
        var rightSrc = null;

        if (info.ch >= 2 && info.raw && info.raw.length >= info.samples.length * 2) {
            rightSrc = new Int16Array(info.samples.length);
            for (var ri = 0; ri < info.samples.length; ri++) rightSrc[ri] = info.raw[ri * info.ch + 1];
        } else {
            var frameSize = fpAlgo && fpAlgo > 0 ? (fpAlgo === 1 || fpAlgo === 5 ? 1 : fpAlgo === 6 ? 1024 : 2048) : 1024;
            var splitPoint = Math.floor(info.samples.length / (frameSize * 2)) * frameSize;
            if (splitPoint < frameSize) splitPoint = Math.floor(info.samples.length / 2);
            rightSrc = info.samples.slice(splitPoint);
            leftSrc = info.samples.slice(0, splitPoint);
        }

        spinner.style.display = 'none';
        prog.style.display = 'flex';

        /**
         *
         * @param src
         * @param algo
         * @param label
         */
        function tryExtract(src, algo, label) {
            if (algo === 0) {
                // Auto detect: try all algorithms that are valid for this channel
                var candidates = label === 'DID Identity' ? [2, 6, 8] : [1, 2, 3, 5, 6, 7, 8];
                return tryExtractAuto(src, key, info.sr, candidates);
            }
            return tryExtractSingle(src, algo, key, info.sr, algoNames[algo] || ('Algo ' + algo));
        }

        var results = [];

        progText.textContent = '🔍 Scanning left channel (fingerprint)...';
        await new Promise(function(r) { setTimeout(r, 16); });
        var fpResult = await tryExtract(leftSrc, fpAlgo, 'Fingerprint');
        results.push({ label: 'Fingerprint (left)', result: fpResult });

        if (rightSrc) {
            progText.textContent = '🔍 Scanning right channel (DID identity)...';
            await new Promise(function(r) { setTimeout(r, 16); });
            var didResult = await tryExtract(rightSrc, didAlgo, 'DID Identity');
            results.push({ label: 'DID Identity (right)', result: didResult });
        }

        prog.style.display = 'none';
        var html = '';
        for (var rj = 0; rj < results.length; rj++) {
            var res2 = results[rj].result;
            html += res2 && res2.decoded ? '<div class="result-success" style="margin-bottom:12px"><span class="result-icon">✅</span>' +
                    '<strong>' + results[rj].label + '</strong><br>Algorithm: ' + res2.algorithm + '<br>' +
                    '<strong>Hidden Message:</strong><br><pre class="awm-pre">' + escapeHtml(res2.decoded) + '</pre></div>' : '<div class="result-error" style="margin-bottom:12px"><span class="result-icon">❌</span>' +
                    '<strong>' + results[rj].label + '</strong><br>' +
                    (res2 ? res2.error : 'not found') + '</div>';
        }
        output.innerHTML = html || '<div class="result-error">❌ No watermarks found.</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    } catch (error) {
        prog.style.display = 'none';
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>' + escapeHtml(error.message) + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
    spinner.style.display = 'none';
    prog.style.display = 'none';
}

/**
 *
 * @param src
 * @param algo
 * @param key
 * @param sr
 * @param algoName
 */
async function tryExtractSingle(src, algo, key, sr, algoName) {
    var bitsStr;
    switch (algo) {
    case 1: {
    bitsStr = await aw1_extract(src, src.length);
    break;
    }
    case 2: {
    bitsStr = await aw2_extract(src, sr);
    break;
    }
    case 3: {
    bitsStr = await aw3_extract(src, sr);
    break;
    }
    case 4: {
    bitsStr = await aw4_extract(src, sr);
    break;
    }
    case 5: {
    bitsStr = await aw5_extract(src, sr, src.length);
    break;
    }
    case 6: {
    bitsStr = await aw6_extract(src, sr, src.length);
    break;
    }
    case 7: {
    bitsStr = await aw7_extract(src, sr);
    break;
    }
    case 8: { {
    bitsStr = await aw8_extract_async(src, sr, src.length);
    // No default
    }
    break;
    }
    }
    if (typeof bitsStr !== 'string' || bitsStr.length < 32) return null;
    var r = awExtractPayload(bitsStr, key);
    if (!r || r === 'bad-password') return null;
    return { decoded: new TextDecoder().decode(r), algorithm: algoName };
}

/**
 *
 * @param src
 * @param key
 * @param sr
 * @param candidates
 */
async function tryExtractAuto(src, key, sr, candidates) {
    for (var ci = 0; ci < candidates.length; ci++) {
        var a = candidates[ci];
        var names = {1:'LSB Audio',2:'FFT-QIM',3:'Echo Hiding',5:'QIM',6:'DWT',7:'Patchwork',8:'DCT-based'};
        var r = await tryExtractSingle(src, a, key, sr, names[a] || ('Algo ' + a));
        if (r && r.decoded) return r;
    }
    return null;
}

// ── Self-test diagnostic ──
/**
 *
 */
async function awmSelfTest() {
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    var resultDiv = document.getElementById('awm-result');
    var spinner = document.getElementById('awm-spinner');
    var prog = document.getElementById('awm-progress');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    prog.style.display = 'none';
    await new Promise(function(r) { setTimeout(r, 16); });

    try {
        // Create synthetic 5-second audio
        var sr = 44_100;
        var len = sr * 5;
        var buf = new ArrayBuffer(44 + len * 2);
        var v = new DataView(buf);
        v.setUint8(0, 0x52); v.setUint8(1, 0x49); v.setUint8(2, 0x46); v.setUint8(3, 0x46);
        v.setUint32(4, 36 + len * 2, true);
        v.setUint8(8, 0x57); v.setUint8(9, 0x41); v.setUint8(10, 0x56); v.setUint8(11, 0x45);
        v.setUint8(12, 0x66); v.setUint8(13, 0x6D); v.setUint8(14, 0x74); v.setUint8(15, 0x20);
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        v.setUint8(36, 0x64); v.setUint8(37, 0x61); v.setUint8(38, 0x74); v.setUint8(39, 0x61);
        v.setUint32(40, len * 2, true);
        for (var i = 0; i < len; i++) {
            v.setInt16(44 + i * 2, Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / sr)), true);
        }

        var info = awReadWavRaw(buf);
        var PASS = 'diagnostic';
        var MSG = 'SELF_TEST_OK';
        var key = await pw_key(PASS);
        var payload = awFormatPayload(new TextEncoder().encode(MSG), key);
        var s16 = new Int16Array(info.samples);

        var results = [];
        var algos = [
            { id: 1, name: 'LSB', embed: function() { return aw1_embed(new Int16Array(s16), payload); },
              extract: function(m) { return aw1_extract(m, m.length); } },
            { id: 2, name: 'FFT-QIM', embed: function() { return aw2_embed(new Int16Array(s16), payload, sr); },
              extract: function(m) { return aw2_extract(m, sr, m.length); } },
            { id: 5, name: 'QIM', embed: function() { return aw5_embed(new Int16Array(s16), payload, sr); },
              extract: function(m) { return aw5_extract(m, sr, m.length); } },
            { id: 6, name: 'DWT', embed: function() { return aw6_embed(new Int16Array(s16), payload, sr); },
              extract: function(m) { return aw6_extract(m, sr, m.length); } },
            { id: 8, name: 'DCT', embed: async function() { return await aw8_embed_async(new Int16Array(s16), payload, sr); },
              extract: async function(m) { return await aw8_extract_async(m, sr, m.length); } }
        ];
        for (var a = 0; a < algos.length; a++) {
            var algo = algos[a];
            try {
                var maxB = algo.id === 1 || algo.id === 5 ? s16.length : Math.floor(s16.length / (algo.id === 8 ? 1024 : algo.id === 6 ? 1024 : 2048));
                if (payload.length > maxB) { results.push(algo.name + ': SKIP'); continue; }
                var modified = await algo.embed();
                var bits = await algo.extract(modified);
                var r = (bits && bits.length >= 32) ? awExtractPayload(bits, key) : null;
                if (r && r !== 'bad-password') {
                    results.push(algo.name + ': ✅');
                } else {
                    var d = bits ? parseInt(bits.substring(0, 32), 2) : -1;
                    results.push(algo.name + ': ❌ (dlen=' + d + ')');
                }
            } catch (error) {
                results.push(algo.name + ': 💥 ' + error.message.substring(0, 30));
            }
        }

        // ── Dual-watermark self-test (stereo channel separation) ──
        results.push('<br><strong>Dual-watermark test:</strong>');
        var fpAlgo = 8, tsAlgo = 6;
        var fpMaxB = Math.floor(s16.length / 1024);
        var tsMaxB = Math.floor(s16.length / 1024);
        var fpBits2 = awFormatPayload(new TextEncoder().encode('DUAL_FP_TEST'), key);
        var tsBits2 = awFormatPayload(new TextEncoder().encode('DUAL_TS_TEST'), key);
        if (fpBits2.length <= fpMaxB && tsBits2.length <= tsMaxB) {
            try {
                // Create stereo test: left = DCT, right = DWT
                var stereoLen = s16.length;
                var leftDual = await aw8_embed_async(new Int16Array(s16), fpBits2, sr);
                var rightDual = await aw6_embed(new Int16Array(s16), tsBits2, sr);
                var stereoBuf = awWriteWav([leftDual, rightDual], sr, 2);

                // Read back
                var stereoInfo = awReadWavRaw(stereoBuf);
                var rightCh = new Int16Array(stereoLen);
                for (var si = 0; si < stereoLen; si++) rightCh[si] = stereoInfo.raw[si * 2 + 1];

                var fpBitsOut = await aw8_extract_async(stereoInfo.samples, sr, stereoLen);
                var fpR = (fpBitsOut && fpBitsOut.length >= 32) ? awExtractPayload(fpBitsOut, key) : null;
                var fpOk = fpR && fpR !== 'bad-password' && new TextDecoder().decode(fpR) === 'DUAL_FP_TEST';

                var tsBitsOut = await aw6_extract(rightCh, sr, stereoLen);
                var tsR = (tsBitsOut && tsBitsOut.length >= 32) ? awExtractPayload(tsBitsOut, key) : null;
                var tsOk = tsR && tsR !== 'bad-password' && new TextDecoder().decode(tsR) === 'DUAL_TS_TEST';

                results.push('Dual (DCT left + DWT right): ' + (fpOk && tsOk ? '✅' : '❌'));
                if (!fpOk) results.push('  FP: ' + (fpR ? new TextDecoder().decode(fpR).substring(0, 20) : 'null'));
                if (!tsOk) results.push('  TS: ' + (tsR ? new TextDecoder().decode(tsR).substring(0, 20) : 'null'));
            } catch (error) {
                results.push('Dual: 💥 ' + error.message.substring(0, 40));
            }
        } else {
            results.push('Dual: SKIP (payload too large for 5s)');
        }

        spinner.style.display = 'none';
        var html = '<div class="result-success"><span class="result-icon">🔬</span><strong>Self-Test Results</strong><br><br>' +
            results.join('<br>') + '<br><br><em>All ✅ means the watermark code works in this browser.</em></div>';
        output.innerHTML = html;
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    } catch (error) {
        spinner.style.display = 'none';
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>Self-test error: ' + escapeHtml(error.message) + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
}
