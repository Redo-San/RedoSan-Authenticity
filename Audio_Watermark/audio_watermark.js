(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var _awmSecretBytes = null;

// ── Tab switching ──
function switchAwmTab(mode) {
    document.querySelectorAll('.tab-btn[data-awm-tab]').forEach(b => b.classList.remove('active'));
    document.getElementById('awm-embed').style.display = mode === 'embed' ? '' : 'none';
    document.getElementById('awm-extract').style.display = mode === 'extract' ? '' : 'none';
    document.querySelector('.tab-btn[data-awm-tab="' + mode + '"]').classList.add('active');
}

// ── Password toggle ──
function toggleAwmPassword() {
    var t = parseInt(document.getElementById('awm-type').value);
    document.getElementById('awm-password-group').style.display = '';
    document.getElementById('awm-strength-group').style.display = (t === 5 || t === 6 || t === 8) ? '' : 'none';
}
function toggleAwmPasswordEx() {
    var t = parseInt(document.getElementById('awm-type-ex').value);
    document.getElementById('awm-password-ex-group').style.display = '';
    document.getElementById('awm-strength-ex-group').style.display = (t === 5 || t === 6 || t === 8) ? '' : 'none';
}

// ── File upload for secret message ──
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
function updateAwmCapacity() {
    var f = document.getElementById('awm-audio');
    var capEl = document.getElementById('awm-capacity');
    if (!f || !f.files || !f.files[0]) { capEl.textContent = ''; return; }
    var t = parseInt(document.getElementById('awm-type').value);
    var msgBytes = _awmSecretBytes || new Uint8Array(0);
    var byteLen = msgBytes.length;
    var descs = {1:'LSB: ~1 bit/sample',2:'Phase Coding: ~1 bit/sample',3:'Echo Hiding: ~1 bit/'+AWM3_FRAME+' samples x3 reps',4:'DSSS: ~1 bit/'+(AWM4_FRAME>>1)+' frames',5:'QIM: ~1 bit/sample',6:'DWT Haar: ~1 bit/1024 coefs',7:'Patchwork: ~1 bit/'+(AWM7_FRAME>>1)+' frames x5 reps',8:'DCT: ~1 bit/'+(AWM8_FRAME>>1)+' frames'};
    var mult = {1:1, 2:1, 3:AWM3_FRAME*3, 4:AWM4_FRAME>>1, 5:1, 6:1024, 7:AWM7_FRAME*5>>1, 8:AWM8_FRAME>>1};
    var m = mult[t] || 1;
    var estSeconds = Math.ceil(byteLen * 8 * m / 44100);
    capEl.textContent = (descs[t]||'') + ' | Message: ' + (byteLen*8) + ' bits | Need ~' + estSeconds + 's audio at 44.1kHz';
}

// ── Embed ──
async function handleAwmEmbed() {
    var type = parseInt(document.getElementById('awm-type').value);
    var audioFile = document.getElementById('awm-audio').files[0];
    var password = document.getElementById('awm-password').value;
    if (!audioFile) return alert('Please select an audio file');
    if (!_awmSecretBytes) return alert('Please upload a secret document');
    if (!password || !password.trim()) return alert('Password is required');
    var secretBytes = _awmSecretBytes;
    var spinner = document.getElementById('awm-spinner');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    try {
        var info = await awLoadAudio(audioFile);
        var key = await pw_key(password);
        var payloadBits = awFormatPayload(secretBytes, key);
        var maxBits = 0;
        var names = {1:'LSB Audio',2:'Phase Coding',3:'Echo Hiding',4:'Spread Spectrum (DSSS)',5:'QIM',6:'DWT (Haar Wavelet)',7:'Patchwork',8:'DCT-based'};
        var maxFns = {2:aw2_maxBits,3:aw3_maxBits,4:aw4_maxBits,6:aw6_maxBits,7:aw7_maxBits,8:aw8_maxBits};
        if (type === 1 || type === 5) maxBits = info.samples.length;
        else if (maxFns[type]) maxBits = maxFns[type](info.samples.length, info.sr);
        if (payloadBits.length > maxBits)
            throw new Error('Message too long. Need ' + payloadBits.length + ' bits, max ' + maxBits + ' for ' + (names[type]||'this algorithm'));
        var modified;
        var s16 = new Int16Array(info.samples);
        if (type === 1) modified = aw1_embed(s16, payloadBits);
        else if (type === 2) modified = aw2_embed(s16, payloadBits, info.sr);
        else if (type === 3) modified = aw3_embed(s16, payloadBits, info.sr);
        else if (type === 4) modified = aw4_embed(s16, payloadBits, info.sr);
        else if (type === 5) {
            var strength = parseInt(document.getElementById('awm-strength').value) || 500;
            modified = aw5_embed(s16, payloadBits, strength);
        } else if (type === 6) {
            var strength = parseInt(document.getElementById('awm-strength').value) || 300;
            modified = aw6_embed(s16, payloadBits, strength);
        } else if (type === 7) {
            modified = aw7_embed(s16, payloadBits, info.sr);
        } else if (type === 8) {
            var strength = parseInt(document.getElementById('awm-strength').value) || 400;
            modified = aw8_embed(s16, payloadBits, strength);
        }
        var wavBuf = awWriteWav(modified, info.sr, info.ch, info.raw, info.bps);
        var blob = new Blob([wavBuf], { type: 'audio/wav' });
        output.innerHTML = '<div class="result-success"><span class="result-icon">✅</span><strong>Watermark embedded successfully!</strong><br>Algorithm: ' + names[type] + '<br>File: ' + audioFile.name + '<br>Sample Rate: ' + info.sr + ' Hz<br>Channels: ' + info.ch + '<br>Hidden: ' + secretBytes.length + ' bytes</div>';
        downloadDiv.innerHTML = '<a href="' + URL.createObjectURL(blob) + '" download="watermarked_' + audioFile.name.replace(/\.[^.]+$/, '.wav') + '" class="btn">⬇ Download Watermarked WAV</a>';
        window._awmResult = { blob: blob, originalName: audioFile.name, type: type, algorithm: names[type] };
        resultDiv.style.display = '';
    } catch (e) {
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>' + e.message + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
    spinner.style.display = 'none';
}

// ── Extract ──
async function handleAwmExtract() {
    var type = parseInt(document.getElementById('awm-type-ex').value);
    var audioFile = document.getElementById('awm-audio-ex').files[0];
    var password = document.getElementById('awm-password-ex').value;
    if (!audioFile) return alert('Please select a watermarked audio file');
    if (!password || !password.trim()) return alert('Password is required');
    var spinner = document.getElementById('awm-spinner');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    try {
        var info = await awLoadAudio(audioFile);
        var key = await pw_key(password);
        var bitsStr = '';
        if (type === 1) bitsStr = aw1_extract(info.samples, info.samples.length);
        else if (type === 2) bitsStr = aw2_extract(info.samples, info.sr);
        else if (type === 3) bitsStr = aw3_extract(info.samples, info.sr);
        else if (type === 4) bitsStr = aw4_extract(info.samples, info.sr);
        else if (type === 5) {
            var strength = parseInt(document.getElementById('awm-strength-ex').value) || 500;
            bitsStr = aw5_extract(info.samples, info.samples.length, strength);
        } else if (type === 6) {
            var strength = parseInt(document.getElementById('awm-strength-ex').value) || 300;
            bitsStr = aw6_extract(info.samples, info.samples.length, strength);
        } else if (type === 7) {
            bitsStr = aw7_extract(info.samples, info.sr);
        } else if (type === 8) {
            var strength = parseInt(document.getElementById('awm-strength-ex').value) || 400;
            bitsStr = aw8_extract(info.samples, info.samples.length, strength);
        }
        var result = awExtractPayload(bitsStr, key);
        if (result === 'bad-password') {
            output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>Wrong password or no watermark found</div>';
        } else if (!result) {
            output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>No watermark data found. Try a different algorithm.</div>';
        } else {
            var decoded = new TextDecoder().decode(result);
            output.innerHTML = '<div class="result-success"><span class="result-icon">✅</span><strong>Watermark extracted!</strong><br><br><strong>Hidden Message:</strong><br><pre class="awm-pre">' + escapeHtml(decoded) + '</pre></div>';
        }
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    } catch (e) {
        output.innerHTML = '<div class="result-error"><span class="result-icon">❌</span>' + e.message + '</div>';
        downloadDiv.innerHTML = '';
        resultDiv.style.display = '';
    }
    spinner.style.display = 'none';
}

function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
}
