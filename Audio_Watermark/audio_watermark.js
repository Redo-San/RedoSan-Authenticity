(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

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
    document.getElementById('awm-password-group').style.display = (t === 4) ? 'none' : '';
    document.getElementById('awm-strength-group').style.display = (t === 3) ? '' : 'none';
}
function toggleAwmPasswordEx() {
    var t = parseInt(document.getElementById('awm-type-ex').value);
    document.getElementById('awm-password-ex-group').style.display = (t === 4) ? 'none' : '';
    document.getElementById('awm-strength-ex-group').style.display = (t === 3) ? '' : 'none';
}

// ── Capacity update ──
function updateAwmCapacity() {
    var f = document.getElementById('awm-audio');
    var capEl = document.getElementById('awm-capacity');
    if (!f || !f.files || !f.files[0]) { capEl.textContent = ''; return; }
    var t = parseInt(document.getElementById('awm-type').value);
    var msg = document.getElementById('awm-secret').value;
    var msgBytes = new TextEncoder().encode(msg).length;
    var estSeconds = 0;
    if (t === 1) { // LSB - 1 bit per sample
        estSeconds = Math.ceil(msgBytes * 8 / 44100);
        capEl.textContent = 'LSB: ~1 bit/sample | Message: ' + msgBytes + ' bytes = ' + (msgBytes*8) + ' bits | Need ~' + estSeconds + 's audio at 44.1kHz';
    } else if (t === 2) { // Echo Hiding - 1 bit per 4096 samples
        estSeconds = Math.ceil(msgBytes * 8 * 4096 / 44100);
        capEl.textContent = 'Echo Hiding: ~1 bit/4096 samples | Message: ' + (msgBytes*8) + ' bits | Need ~' + estSeconds + 's audio at 44.1kHz';
    } else if (t === 3) { // QIM - 1 bit per sample
        estSeconds = Math.ceil(msgBytes * 8 / 44100);
        capEl.textContent = 'QIM: ~1 bit/sample | Message: ' + (msgBytes*8) + ' bits | Need ~' + estSeconds + 's audio at 44.1kHz';
    }
}

// ── Embed ──
async function handleAwmEmbed() {
    var type = parseInt(document.getElementById('awm-type').value);
    var audioFile = document.getElementById('awm-audio').files[0];
    var secret = document.getElementById('awm-secret').value;
    var password = document.getElementById('awm-password').value;
    if (!audioFile) return alert('Please select an audio file');
    if (!secret || !secret.trim()) return alert('Please enter a secret message');
    if (type !== 4 && (!password || !password.trim())) return alert('Password is required');
    var spinner = document.getElementById('awm-spinner');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    try {
        var info = await awLoadAudio(audioFile);
        var key = type !== 4 ? await pw_key(password) : new Uint8Array(0);
        var secretBytes = new TextEncoder().encode(secret.trim());
        var payloadBits = awFormatPayload(secretBytes, key);
        var maxBits = 0;
        if (type === 1) maxBits = info.samples.length;
        else if (type === 2) maxBits = aw2_maxBits(info.samples.length, info.sr);
        else if (type === 3) maxBits = info.samples.length;
        if (payloadBits.length > maxBits)
            throw new Error('Message too long for this audio file. Need ' + payloadBits.length + ' bits, have ' + maxBits + ' (' + (type===2?'echo hiding':'') + ')');
        var modified;
        if (type === 1) {
            modified = aw1_embed(new Int16Array(info.samples), payloadBits);
        } else if (type === 2) {
            modified = aw2_embed(new Int16Array(info.samples), payloadBits, info.sr);
        } else if (type === 3) {
            var strength = parseInt(document.getElementById('awm-strength').value) || 500;
            modified = aw3_embed(new Int16Array(info.samples), payloadBits, strength);
        } else {
            throw new Error('Invalid algorithm type');
        }
        var wavBuf = awWriteWav(modified, info.sr, info.ch, info.raw, info.bps);
        var blob = new Blob([wavBuf], { type: 'audio/wav' });
        var names = {1:'LSB Audio',2:'Echo Hiding',3:'QIM'};
        output.innerHTML = '<div class="result-success"><span class="result-icon">✅</span><strong>Watermark embedded successfully!</strong><br>Algorithm: ' + names[type] + '<br>File: ' + audioFile.name + '<br>Sample Rate: ' + info.sr + ' Hz<br>Channels: ' + info.ch + '<br>Hidden: ' + secretBytes.length + ' bytes (' + secret.trim().length + ' chars)</div>';
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
    if (type !== 4 && (!password || !password.trim())) return alert('Password is required');
    var spinner = document.getElementById('awm-spinner');
    var resultDiv = document.getElementById('awm-result');
    var output = document.getElementById('awm-output');
    var downloadDiv = document.getElementById('awm-download');
    resultDiv.style.display = 'none';
    spinner.style.display = 'block';
    try {
        var info = await awLoadAudio(audioFile);
        var key = type !== 4 ? await pw_key(password) : new Uint8Array(0);
        var bitsStr = '';
        if (type === 1) {
            bitsStr = aw1_extract(info.samples, info.samples.length);
        } else if (type === 2) {
            bitsStr = aw2_extract(info.samples, info.sr, 1000);
        } else if (type === 3) {
            var strength = parseInt(document.getElementById('awm-strength-ex').value) || 500;
            bitsStr = aw3_extract(info.samples, info.samples.length, strength);
        } else {
            throw new Error('Invalid algorithm type');
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
