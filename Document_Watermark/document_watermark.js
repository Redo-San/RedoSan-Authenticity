(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var _docwSecretMessage = '';
var _docwCoverText = '';
var _docwCoverFileName = '';
var _docwCoverBytes = null;
var _docwExtractText = '';
var _docwExtractResult = null;

function switchDocwTab(mode) {
    document.querySelectorAll('.tab-btn[data-docw-tab]').forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('docw-embed').style.display = mode === 'embed' ? '' : 'none';
    document.getElementById('docw-extract').style.display = mode === 'extract' ? '' : 'none';
    document.getElementById('docw-embed-result').style.display = 'none';
    document.getElementById('docw-extract-result').style.display = 'none';
    document.getElementById('docw-embed-buttons').style.display = 'none';
    document.getElementById('docw-extract-buttons').style.display = 'none';
    document.getElementById('docw-embed-download').innerHTML = '';
    document.querySelector('.tab-btn[data-docw-tab="' + mode + '"]').classList.add('active');
}

function showDocwLoading(msg, pct) {
    var ov = document.getElementById('docw-loading-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    document.getElementById('docw-loading-text').textContent = msg || 'Processing...';
    var bw = document.getElementById('docw-loading-bar-wrap');
    var bp = document.getElementById('docw-loading-pct');
    if (pct != null && pct >= 0) {
        bw.style.display = '';
        document.getElementById('docw-loading-bar').style.width = pct + '%';
        bp.textContent = pct + '%';
    } else {
        bw.style.display = 'none';
        bp.textContent = '';
    }
}
function hideDocwLoading() {
    var ov = document.getElementById('docw-loading-overlay');
    if (ov) ov.style.display = 'none';
}

function _docwShowNoTextWarning(cap) {
    var w = document.getElementById('docw-cover-warning');
    if (_docwCoverText != null && _docwCoverText.length <= 100) {
        w.style.display = '';
        w.innerHTML = '<strong>⚠ Very little text detected</strong><br>This document has only <b>' + _docwCoverText.length + ' characters</b> (~' + cap + ' capacity) — likely a scanned/image-based document with only form labels.<br><br>Document Watermarking works by modifying visible text. For image-based documents, use one of these instead:<br>• <b>Pixel Injection</b> — embed data in image pixels<br>• <b>Watermark</b> — image watermarking algorithms<br>• <b>Forensic</b> — forensic analysis tools<br><br><span style="font-size:0.72rem;color:var(--text-muted)">If this is a text document, try uploading a .txt or .docx version instead.</span>';
    } else if (_docwCoverText != null && cap <= 100) {
        w.style.display = '';
        w.innerHTML = '<strong>⚠ Low capacity</strong><br>The extracted text (' + _docwCoverText.length + ' chars, ~' + cap + ' capacity) is too short for most messages. Consider using <b>Pixel Injection</b> or <b>Watermark</b> tools for image-based documents.';
    } else {
        w.style.display = 'none';
    }
}

function docwAlgoChanged() {
    if (_docwCoverText != null) {
        var cap = docwEstimateCapacity(_docwCoverText, parseInt(document.getElementById('docw-algo').value));
        var el = document.getElementById('docw-capacity');
        if (cap > 0) {
            el.textContent = __('docw.capacity_estimate', 'Estimated capacity: ~{bytes} bytes').replace('{bytes}', cap);
            el.style.color = 'var(--text-muted)';
        } else {
            el.textContent = __('docw.text_too_short', 'Text too short for this algorithm');
            el.style.color = '#e74c3c';
        }
        _docwShowNoTextWarning(cap);
    }
}

function docwExAlgoChanged() {
    if (_docwExtractText) {
        var cap = docwEstimateCapacity(_docwExtractText, parseInt(document.getElementById('docw-algo-ex').value));
        var el = document.getElementById('docw-ex-capacity');
        if (cap > 0) {
            el.textContent = __('docw.capacity_estimate', 'Estimated capacity: ~{bytes} bytes').replace('{bytes}', cap);
            el.style.color = 'var(--text-muted)';
        } else {
            el.textContent = '';
        }
    }
}

function loadDocwSecretFile(event) {
    var file = event.target.files[0];
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') {
        // Parse JSON and extract SHA-256 hash automatically for fingerprint files
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var parsed = JSON.parse(e.target.result);
                var msg = null;
                if (parsed.hashes && parsed.hashes['SHA-256']) {
                    msg = parsed.hashes['SHA-256'];
                } else if (parsed.sha256) {
                    msg = parsed.sha256;
                } else if (typeof parsed === 'string') {
                    msg = parsed;
                } else {
                    msg = JSON.stringify(parsed, null, 2);
                }
                _docwSecretMessage = msg;
                document.getElementById('docw-secret-name').textContent = __('docw.loaded_hash', 'Loaded: {name} (SHA-256 hash, {len} chars)').replace('{name}', file.name).replace('{len}', msg.length);
                document.getElementById('docw-secret-name').style.color = '#2ecc71';
            } catch (e) {
                alert('Invalid JSON file: ' + e.message);
            }
        };
        reader.readAsText(file);
    } else {
        docwExtractText(file, function(err, text) {
            if (err) { alert(err); return; }
            _docwSecretMessage = text;
            document.getElementById('docw-secret-name').textContent = __('docw.loaded', 'Loaded: {name} ({len} chars)').replace('{name}', file.name).replace('{len}', text.length);
            document.getElementById('docw-secret-name').style.color = '#2ecc71';
        });
    }
}

function loadDocwCoverFile(event) {
    var file = event.target.files[0];
    if (!file) return;
    _docwCoverFileName = file.name;
    var nameEl = document.getElementById('docw-cover-name');
    var capEl = document.getElementById('docw-capacity');
    document.getElementById('docw-cover-warning').style.display = 'none';
    nameEl.textContent = file.name + ' (' + __('docw.extracting', 'extracting text\u2026') + ')';
    nameEl.style.color = 'var(--text-muted)';
    capEl.textContent = '';
    showDocwLoading(__('docw.reading', 'Reading {name}...').replace('{name}', file.name), 0);
    var reader = new FileReader();
    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            showDocwLoading(__('docw.reading', 'Reading {name}...').replace('{name}', file.name), Math.round(e.loaded / e.total * 100));
        }
    };
    reader.onload = function(e) {
        var buf = e.target.result;
        _docwCoverBytes = new Uint8Array(buf);
        showDocwLoading(__('docw.extracting_from', 'Extracting text from {name}...').replace('{name}', file.name));
        setTimeout(function() {
            var ext = file.name.split('.').pop().toLowerCase();
            var textPromise;
            if (ext === 'docx') {
                textPromise = DOCX_EXTRACTOR.readDocx(buf);
            } else if (ext === 'pdf') {
                textPromise = DOCX_EXTRACTOR.readPdf(new Uint8Array(buf)).then(function(text) {
                    return text || '';
                });
            } else if (ext === 'doc') {
                var arr = new Uint8Array(buf);
                var result = '';
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i];
                    if ((c >= 0x20 && c <= 0x7E) || c === 0x0A || c === 0x0D) {
                        result += String.fromCharCode(c);
                    }
                }
                result = result.replace(/\s+/g, ' ').trim();
                textPromise = Promise.resolve(result || 'No readable text found in DOC file.');
            } else {
                textPromise = Promise.resolve(new TextDecoder('UTF-8').decode(new Uint8Array(buf)));
            }
            textPromise.then(function(text) {
                _docwCoverText = text;
                nameEl.textContent = file.name + ' (' + text.length + ' ' + __('docw.chars', 'chars') + ')';
                nameEl.style.color = '#2ecc71';
                var cap = docwEstimateCapacity(text, parseInt(document.getElementById('docw-algo').value));
                if (cap > 0) {
                    capEl.textContent = __('docw.capacity_estimate', 'Estimated capacity: ~{bytes} bytes').replace('{bytes}', cap);
                    capEl.style.color = 'var(--text-muted)';
                } else {
                    capEl.textContent = __('docw.text_too_short', 'Text too short for this algorithm');
                    capEl.style.color = '#e74c3c';
                }
                _docwShowNoTextWarning(cap);
                hideDocwLoading();
            }).catch(function(err) {
                hideDocwLoading();
                alert(err.message || err);
                nameEl.textContent = '';
                capEl.textContent = '';
            });
        }, 50);
    };
    reader.readAsArrayBuffer(file);
}

function loadDocwExtractFile(event) {
    var file = event.target.files[0];
    if (!file) return;
    var nameEl = document.getElementById('docw-extract-name');
    var capEl = document.getElementById('docw-ex-capacity');
    nameEl.textContent = file.name + ' (' + __('docw.extracting', 'extracting text\u2026') + ')';
    nameEl.style.color = 'var(--text-muted)';
    capEl.textContent = '';
    showDocwLoading(__('docw.reading', 'Reading {name}...').replace('{name}', file.name), 0);
    var reader = new FileReader();
    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            showDocwLoading(__('docw.reading', 'Reading {name}...').replace('{name}', file.name), Math.round(e.loaded / e.total * 100));
        }
    };
    reader.onload = function(e) {
        var buf = e.target.result;
        showDocwLoading(__('docw.extracting_from', 'Extracting text from {name}...').replace('{name}', file.name));
        setTimeout(function() {
            docwExtractTextFromBuf(file, buf, function(err, text) {
                hideDocwLoading();
                if (err) { alert(err); return; }
                _docwExtractText = text;
                nameEl.textContent = file.name + ' (' + text.length + ' ' + __('docw.chars', 'chars') + ')';
                nameEl.style.color = '#2ecc71';
                var cap = docwEstimateCapacity(text, parseInt(document.getElementById('docw-algo-ex').value));
                if (cap > 0) {
                    capEl.textContent = __('docw.capacity_estimate', 'Estimated capacity: ~{bytes} bytes').replace('{bytes}', cap);
                    capEl.style.color = 'var(--text-muted)';
                } else {
                    capEl.textContent = '';
                }
            });
        }, 50);
    };
    reader.readAsArrayBuffer(file);
}

function docwExtractTextFromBuf(file, buf, callback) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'docx') {
        DOCX_EXTRACTOR.readDocx(buf).then(function(text) {
            callback(null, text, 'docx');
        }).catch(function(err) {
            callback(err.message);
        });
    } else if (ext === 'pdf') {
        DOCX_EXTRACTOR.readPdf(new Uint8Array(buf)).then(function(text) {
            callback(null, text || '', 'pdf');
        }).catch(function(err) {
            callback('PDF extraction failed: ' + err.message);
        });
    } else if (ext === 'doc') {
        var arr = new Uint8Array(buf);
        var result = '';
        for (var i = 0; i < arr.length; i++) {
            var c = arr[i];
            if ((c >= 0x20 && c <= 0x7E) || c === 0x0A || c === 0x0D) {
                result += String.fromCharCode(c);
            }
        }
        result = result.replace(/\s+/g, ' ').trim();
        callback(null, result || 'No readable text found in DOC file.', 'doc');
    } else {
        callback(null, new TextDecoder('UTF-8').decode(new Uint8Array(buf)), ext);
    }
}

async function handleDocwEmbed() {
    var algo = parseInt(document.getElementById('docw-algo').value);
    var password = document.getElementById('docw-password').value;

    if (!_docwSecretMessage) {
        alert('Please upload a secret message file.');
        return;
    }
    if (!_docwCoverText) {
        alert('Please upload a cover document.');
        return;
    }
    if (!password) {
        alert('Password is required for embedding.');
        return;
    }

    var cap = docwEstimateCapacity(_docwCoverText, algo);
    if (cap < _docwSecretMessage.length) {
        if (cap <= 100) {
            alert('This document has very little extractable text (' + _docwCoverText.length + ' chars, ~' + cap + ' capacity). It is likely a scanned/image-based document.\n\nDocument Watermarking requires visible text. Try these instead:\n• Pixel Injection — for images\n• Watermark — image watermarking\n• Forensic — forensic analysis');
        } else {
            alert('Message too long for this text. Max ~' + cap + ' characters.');
        }
        return;
    }

    var btn = document.getElementById('docw-embed-btn');
    btn.textContent = 'Processing...';
    btn.disabled = true;
    showDocwLoading('Embedding watermark\u2026');
    // Yield so the browser paints the overlay before heavy embedding starts
    await new Promise(function(r) { setTimeout(r, 0); });

    try {
        var result = await docwEmbed(_docwCoverText, _docwSecretMessage, algo, password);
        showDocwLoading('Building download\u2026');
        document.getElementById('docw-embed-output').value = result;
        document.getElementById('docw-embed-result').style.display = '';
        document.getElementById('docw-embed-buttons').style.display = '';
        document.getElementById('docw-embed-algo-name').textContent = DOCW_ALGOS[String(algo)].name;
        _docwResult = {
            algo: DOCW_ALGOS[String(algo)].name,
            algoId: algo,
            timestamp: new Date().toISOString(),
            textLength: _docwCoverText.length,
            resultLength: result.length,
            watermarkedText: result
        };
        window._currentDownloadHandler = downloadDocw;

        // Direct download: actual watermarked document (rebuilt in original format)
        var dlContainer = document.getElementById('docw-embed-download');
        var ext = _docwCoverFileName.split('.').pop().toLowerCase();
        if (ext === 'docx') {
            try {
                var rebuiltBlob = await buildWatermarkedDocx(_docwCoverBytes, result);
                var outUrl = URL.createObjectURL(rebuiltBlob);
                dlContainer.innerHTML = '<a href="' + outUrl + '" download="watermarked_' + _docwCoverFileName + '" class="btn">' + __('docw.direct_download', 'Download Watermarked Document') + ' (DOCX)</a>';
            } catch (e) {
                var txtBlob = new Blob([result], { type: 'text/plain;charset=utf-8' });
                var outUrl = URL.createObjectURL(txtBlob);
                dlContainer.innerHTML = '<a href="' + outUrl + '" download="watermarked_' + _docwCoverFileName.replace(/\.[^.]+$/, '.txt') + '" class="btn">' + __('docw.direct_download', 'Download Watermarked Document') + ' (TXT)</a>';
            }
        } else if (ext === 'pdf') {
            // Modify original PDF — replace extracted text with watermarked text
            try {
                var modifiedBytes = await buildWatermarkedPdfDoc(_docwCoverBytes, _docwCoverText, result);
                var pdfBlob = new Blob([modifiedBytes], { type: 'application/pdf' });
                var pdfUrl = URL.createObjectURL(pdfBlob);
                dlContainer.innerHTML = '<a href="' + pdfUrl + '" download="watermarked_' + _docwCoverFileName + '" class="btn">' + __('docw.direct_download', 'Download Watermarked Document') + ' (PDF)</a>';
            } catch (e) {
                var txtBlob = new Blob([result], { type: 'text/plain;charset=utf-8' });
                var outUrl = URL.createObjectURL(txtBlob);
                dlContainer.innerHTML = '<a href="' + outUrl + '" download="watermarked_' + _docwCoverFileName.replace(/\.[^.]+$/, '.txt') + '" class="btn">' + __('docw.direct_download', 'Download Watermarked Document') + ' (TXT — ' + __('docw.pdf_failed', 'PDF rebuild failed') + ')</a>';
            }
        } else {
            var txtBlob = new Blob([result], { type: 'text/plain;charset=utf-8' });
            var outUrl = URL.createObjectURL(txtBlob);
            dlContainer.innerHTML = '<a href="' + outUrl + '" download="watermarked_' + _docwCoverFileName.replace(/\.[^.]+$/, '.txt') + '" class="btn">' + __('docw.direct_download', 'Download Watermarked Document') + ' (TXT)</a>';
        }
    } catch (e) {
        hideDocwLoading();
        alert('Error: ' + e.message);
    }

    hideDocwLoading();
    btn.textContent = __('docw.embed_submit', 'Embed Watermark');
    btn.disabled = false;
}

async function handleDocwExtract() {
    var algo = parseInt(document.getElementById('docw-algo-ex').value);
    var password = document.getElementById('docw-password-ex').value;

    if (!_docwExtractText) {
        alert('Please upload a watermarked document.');
        return;
    }
    if (!password) {
        alert('Password is required for extraction.');
        return;
    }

    var btn = document.getElementById('docw-extract-btn');
    btn.textContent = 'Extracting...';
    btn.disabled = true;

    try {
        var result;
        var algoName;
        if (algo === 0) {
            var detected = await docwAutoDetect(_docwExtractText, password);
            if (detected) {
                result = detected.message;
                algoName = detected.name + ' (auto-detected)';
            } else {
                document.getElementById('docw-extract-result').style.display = '';
                document.getElementById('docw-extract-buttons').style.display = 'none';
                document.getElementById('docw-extracted-msg').value = '';
                document.getElementById('docw-extract-algo-name').textContent = 'No watermark found';
                btn.textContent = 'Extract Watermark';
                btn.disabled = false;
                return;
            }
        } else {
            result = await docwExtract(_docwExtractText, algo, password);
            algoName = DOCW_ALGOS[String(algo)].name;
        }

        document.getElementById('docw-extract-result').style.display = '';
        document.getElementById('docw-extract-buttons').style.display = '';
        document.getElementById('docw-extracted-msg').value = result || __('docw.no_watermark', 'No watermark found');
        document.getElementById('docw-extract-algo-name').textContent = algoName;
        _docwExtractResult = {
            message: result,
            algo: algoName,
            algoId: algo,
            timestamp: new Date().toISOString()
        };
        window._currentDownloadHandler = downloadDocwExtract;
    } catch (e) {
        if (e.message === 'WRONG_PASSWORD') {
            document.getElementById('docw-extract-result').style.display = '';
            document.getElementById('docw-extract-buttons').style.display = 'none';
            document.getElementById('docw-extracted-msg').value = '';
            document.getElementById('docw-extract-algo-name').textContent = __('docw.wrong_password', 'Password may be incorrect');
        } else {
            alert('Error: ' + e.message);
        }
    }

    btn.textContent = __('docw.extract_submit', 'Extract Watermark');
    btn.disabled = false;
}

function docwCopyResult(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.select();
    document.execCommand('copy');
}

function docwDownloadResult(id, filename) {
    var el = document.getElementById(id);
    if (!el) return;
    var blob = new Blob([el.value], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document_watermarked.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Professional Report Generator ──

var _docwEscXml = (function() {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return function(s) { return String(s).replace(/[&<>"]/g, function(m) { return map[m]; }); };
})();

async function _docwHash(text) {
    var enc = new TextEncoder().encode(text);
    var hashBuf = await crypto.subtle.digest('SHA-256', enc);
    var hashArr = new Uint8Array(hashBuf);
    var hex = '';
    for (var i = 0; i < hashArr.length; i++) {
        hex += ('0' + hashArr[i].toString(16)).slice(-2);
    }
    return hex;
}

function _docwQrDataURL(text) {
    if (typeof QRious === 'undefined') return null;
    var canvas = document.createElement('canvas');
    new QRious({ element: canvas, value: text, size: 200, level: 'H', padding: 4 });
    return canvas.toDataURL('image/png');
}

async function _docwBuildReportPdf(r, mode) {
    var isExtract = mode === 'extract';
    var title = isExtract ? 'Extracted Watermark — Authenticity Report' : 'Document Watermark — Authenticity Report';
    var content = isExtract ? (r.message || '') : (r.watermarkedText || '');
    var algo = isExtract ? (r.algo || '') : (r.algo || '');
    var ts = isExtract ? (r.timestamp || new Date().toISOString()) : (r.timestamp || new Date().toISOString());
    var hash = await _docwHash(content);
    var qrContent = JSON.stringify({ hash: hash, algo: algo, timestamp: ts, type: isExtract ? 'extract' : 'embed' });
    var qrData = _docwQrDataURL(qrContent);

    var doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pw = doc.internal.pageSize.getWidth();
    var ph = doc.internal.pageSize.getHeight();
    var lm = 20, rm = 20, y = 20;

    // ── Header bar ──
    doc.setFillColor(108, 92, 231);
    doc.rect(0, 0, pw, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('RedoSan Authenticity — Digital Document Provenance', pw / 2, 8, { align: 'center' });

    // ── Title ──
    y = 24;
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(18);
    doc.text(title, pw / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 140);
    doc.text('Certificate of Document Authenticity — 100% Client-Side Generated', pw / 2, y, { align: 'center' });
    y += 12;

    // ── Metadata table ──
    var meta = [
        ['Algorithm', algo],
        ['Timestamp', new Date(ts).toLocaleString()],
        ['Content Length', content.length + ' characters'],
        ['SHA-256 Fingerprint', hash]
    ];
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 80);
    doc.setFillColor(245, 245, 250);
    for (var mi = 0; mi < meta.length; mi++) {
        if (mi % 2 === 0) doc.rect(lm, y - 3, pw - lm - rm, 7, 'F');
        doc.text(meta[mi][0], lm + 3, y);
        doc.text(meta[mi][1], lm + 55, y);
        y += 7;
    }
    y += 6;

    // ── Content section ──
    doc.setFillColor(108, 92, 231);
    doc.rect(lm, y, pw - lm - rm, 0.5, 'F');
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 50);
    doc.text(isExtract ? 'Extracted Message' : 'Watermarked Content', lm, y);
    y += 6;
    doc.setFontSize(7);
    var boxX = lm, boxW = pw - lm - rm;
    doc.setDrawColor(200, 200, 215);
    doc.setFillColor(250, 250, 252);
    var contentLines = doc.splitTextToSize(content, boxW - 8);
    var maxLines = Math.min(contentLines.length, 80);
    var lineH = 3.5;
    var boxH = Math.max(20, Math.min(maxLines * lineH + 6, 280));
    doc.roundedRect(boxX, y - 3, boxW, boxH, 2, 2, 'FD');
    doc.setTextColor(60, 60, 80);
    for (var cli = 0; cli < maxLines; cli++) {
        var line = contentLines[cli];
        if (doc.getStringUnitWidth(line) * doc.internal.getFontSize() / doc.internal.scaleFactor > boxW - 8) {
            line = line.substring(0, Math.floor((boxW - 8) * 0.7)) + '…';
        }
        doc.text(line, boxX + 4, y + 2);
        y += lineH;
    }
    if (contentLines.length > maxLines) {
        doc.text('... (' + (contentLines.length - maxLines) + ' ' + __('docw.more_lines', 'more lines') + ')', boxX + 4, y + 2);
        y += lineH + 2;
    } else {
        y += 14;
    }

    // ── QR Code ──
    if (qrData) {
        if (y + 65 > ph - 15) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 50);
        doc.text('Verification QR Code', pw / 2, y, { align: 'center' });
        y += 4;
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 140);
        doc.text('Scan to verify document integrity — QR encodes hash, algorithm, and timestamp', pw / 2, y, { align: 'center' });
        y += 3;
        try {
            doc.addImage(qrData, 'PNG', pw / 2 - 30, y, 60, 60);
        } catch (e) {}
        y += 64;
    }

    // ── Footer ──
    doc.setFontSize(6);
    doc.setTextColor(160, 160, 175);
    doc.text('Generated by RedoSan Authenticity (redo-san.github.io) — ' + new Date().toISOString().split('T')[0], pw / 2, ph - 8, { align: 'center' });
    doc.text('SHA-256: ' + hash, pw / 2, ph - 4, { align: 'center' });

    return doc.output('blob');
}

async function _docwBuildReportDocx(r, mode) {
    var isExtract = mode === 'extract';
    var content = isExtract ? (r.message || '') : (r.watermarkedText || '');
    var algo = isExtract ? (r.algo || '') : (r.algo || '');
    var ts = isExtract ? (r.timestamp || '') : (r.timestamp || '');
    var hash = await _docwHash(content);
    var dateStr = ts ? new Date(ts).toLocaleString() : new Date().toLocaleString();

    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    xml += '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">';
    xml += '<w:body>';

    // Title
    xml += '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2D2D3A"/></w:rPr><w:t>' + _docwEscXml(isExtract ? 'EXTRACTED WATERMARK REPORT' : 'DOCUMENT WATERMARK REPORT') + '</w:t></w:r></w:p>';

    // Subtitle
    xml += '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="400"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="6C5CE7"/></w:rPr><w:t>Digital Authenticity Certificate — RedoSan Authenticity</w:t></w:r></w:p>';

    // Metadata table
    xml += '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D0E0"/><w:bottom w:val="single" w:sz="4" w:color="D0D0E0"/><w:insideH w:val="single" w:sz="4" w:color="D0D0E0"/></w:tblBorders></w:tblPr>';
    var metaRows = [
        ['Algorithm', algo],
        ['Date/Time', dateStr],
        ['Content Length', content.length + ' characters'],
        ['SHA-256', hash]
    ];
    for (var mri = 0; mri < metaRows.length; mri++) {
        xml += '<w:tr><w:tc><w:tcW w:w="2000" w:type="dxa"/><w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>' + _docwEscXml(metaRows[mri][0]) + '</w:t></w:r></w:p></w:tc>';
        xml += '<w:tc><w:tcW w:w="5000" w:type="dxa"/><w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>' + _docwEscXml(metaRows[mri][1]) + '</w:t></w:r></w:p></w:tc></w:tr>';
    }
    xml += '</w:tbl><w:p><w:r><w:br/></w:r></w:p>';

    // Content section
    xml += '<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>' + _docwEscXml(isExtract ? 'Extracted Message' : 'Watermarked Content') + '</w:t></w:r></w:p>';
    xml += '<w:p><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="404050"/></w:rPr><w:t>' + _docwEscXml(content) + '</w:t></w:r></w:p>';

    xml += '</w:body></w:document>';

    var zip = new JSZip();
    zip.file('word/document.xml', xml);
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    return await zip.generateAsync({ type: 'blob' });
}

function _docwBuildReportHtml(r, mode) {
    var isExtract = mode === 'extract';
    var content = isExtract ? (r.message || '') : (r.watermarkedText || '');
    var algo = isExtract ? (r.algo || '') : (r.algo || '');
    var ts = isExtract ? (r.timestamp || '') : (r.timestamp || '');
    var dateStr = ts ? new Date(ts).toLocaleString() : new Date().toLocaleString();

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + (isExtract ? 'Extracted Watermark Report' : 'Document Watermark Report') + '</title>' +
        '<style>' +
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:800px;margin:30px auto;padding:0 24px;color:#2D2D3A;background:#F8F8FC}' +
        '.header{background:#6C5CE7;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;margin:-30px -24px 0;text-align:center}' +
        '.header h1{font-size:20px;margin:0}' +
        '.header p{font-size:12px;margin:4px 0 0;opacity:0.85}' +
        '.section{margin:24px 0}' +
        '.section h2{font-size:15px;border-bottom:2px solid #6C5CE7;padding-bottom:6px;margin:0 0 12px}' +
        'table{width:100%;border-collapse:collapse;font-size:13px}' +
        'td{padding:7px 10px;border:1px solid #E0E0EE}' +
        'td:first-child{font-weight:600;width:160px;background:#F0F0F8}' +
        '.content-box{background:#FAFAFC;border:1px solid #D0D0E0;border-radius:8px;padding:14px;font-family:"Courier New",monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.6;max-height:400px;overflow:auto}' +
        '.qr-section{text-align:center;margin:24px 0}' +
        '.qr-section img{width:140px;height:140px}' +
        '.footer{margin-top:30px;padding-top:12px;border-top:1px solid #E0E0EE;font-size:11px;color:#888;text-align:center}' +
        '.fingerprint{font-family:"Courier New",monospace;font-size:11px;background:#F0F0F8;padding:6px 10px;border-radius:4px;word-break:break-all}' +
        '</style></head><body>' +
        '<div class="header"><h1>' + (isExtract ? 'Extracted Watermark Report' : 'Document Watermark Report') + '</h1><p>Digital Authenticity Certificate — Generated by RedoSan Authenticity</p></div>' +
        '<div class="section"><h2>Metadata</h2><table>' +
        '<tr><td>Algorithm</td><td>' + _docwEscXml(algo) + '</td></tr>' +
        '<tr><td>Date/Time</td><td>' + _docwEscXml(dateStr) + '</td></tr>' +
        '<tr><td>Content Length</td><td>' + content.length + ' characters</td></tr>' +
        '<tr><td>SHA-256</td><td class="fingerprint" id="docw-hash"></td></tr>' +
        '</table></div>' +
        '<div class="section"><h2>' + (isExtract ? 'Extracted Message' : 'Watermarked Content') + '</h2>' +
        '<div class="content-box">' + _docwEscXml(content) + '</div></div>' +
        '<div class="qr-section" id="docw-qr-section"></div>' +
        '<div class="footer">Generated by <a href="https://redo-san.github.io/RedoSan-Authenticity/">RedoSan Authenticity</a> — 100% Client-Side &bull; ' + new Date().toISOString().split('T')[0] + '</div>' +
        '<script>' +
        'crypto.subtle.digest("SHA-256",new TextEncoder().encode(' + JSON.stringify(content) + ')).then(function(b){' +
        'var h="";new Uint8Array(b).forEach(function(v){h+=("0"+v.toString(16)).slice(-2)});' +
        'document.getElementById("docw-hash").textContent=h;' +
        'var qr=document.createElement("canvas");' +
        'new QRious({element:qr,value:JSON.stringify({hash:h,algo:' + JSON.stringify(algo) + ',timestamp:' + JSON.stringify(ts) + '}),size:140,level:"H",padding:4});' +
        'var img=document.createElement("img");img.src=qr.toDataURL();img.alt="Verification QR Code";' +
        'document.getElementById("docw-qr-section").appendChild(img)' +
        '})<\/script>' +
        '</body></html>';
}

// ── PDF rebuild — modifies original PDF, replacing text with watermarked version ──

function _getWmAtPos(origFull, wmFull, segText, startPos) {
    // Verify segText is at startPos in origFull
    if (origFull.length - startPos < segText.length) return null;
    for (var i = 0; i < segText.length; i++) {
        if (origFull[startPos + i] !== segText[i]) return null;
    }
    // Walk wmFull matching original chars until we reach startPos
    var wmIdx = 0, origIdx = 0;
    while (origIdx < startPos && wmIdx < wmFull.length) {
        if (wmFull[wmIdx] === origFull[origIdx]) origIdx++;
        wmIdx++;
    }
    // Advance to first char of segText (skip any ZWC between prev char and this one)
    var wmStart = wmIdx;
    while (wmStart < wmFull.length && wmFull[wmStart] !== segText[0]) wmStart++;
    // Collect watermarked version of segText chars
    wmIdx = wmStart;
    var si = 0;
    while (si < segText.length && wmIdx < wmFull.length) {
        if (wmFull[wmIdx] === segText[si]) si++;
        wmIdx++;
    }
    if (si < segText.length) return null;
    return wmFull.substring(wmStart, wmIdx);
}

function _pdfReplaceInStream(content, origFull, wmFull) {
    // ── 1. Locate all text segments (TJ arrays + Tj operators) ──
    var segs = [];
    var reTJ = /\[([\s\S]*?)\]\s*TJ/g;
    var m;
    while ((m = reTJ.exec(content)) !== null) {
        var combined = '';
        var ci = 0, arr = m[1];
        while (ci < arr.length) {
            if (arr[ci] === '(') {
                var depth = 1; ci++;
                var cStart = ci;
                while (ci < arr.length && depth > 0) {
                    if (arr[ci] === '\\') { ci += 2; continue; }
                    if (arr[ci] === '(') depth++;
                    if (arr[ci] === ')') depth--;
                    ci++;
                }
                combined += arr.substring(cStart, ci - 1).replace(/\\(.)/g, '$1');
            } else { ci++; }
        }
        segs.push({ start: m.index, end: m.index + m[0].length, text: combined, isTJ: true });
    }
    var reTj = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    while ((m = reTj.exec(content)) !== null) {
        segs.push({ start: m.index, end: m.index + m[0].length, text: m[1].replace(/\\(.)/g, '$1'), isTJ: false });
    }
    if (segs.length === 0) {
        var origHex = '', replHex = '';
        for (var j = 0; j < origFull.length; j++) origHex += origFull.charCodeAt(j).toString(16).toUpperCase();
        for (var k = 0; k < wmFull.length; k++) replHex += wmFull.charCodeAt(k).toString(16).toUpperCase();
        if (origHex) return content.split(origHex).join(replHex);
        return content;
    }

    // ── 2. Build full stream text and find it in origFull ──
    segs.sort(function(a, b) { return a.start - b.start; });
    var streamText = '';
    for (var si = 0; si < segs.length; si++) streamText += segs[si].text;
    if (!streamText) return content;
    var streamPos = origFull.indexOf(streamText);
    if (streamPos < 0) return content;

    // ── 3. Walk segments backward, replace each with per-position watermarked text ──
    var remainingText = streamText.length;
    for (var si2 = segs.length - 1; si2 >= 0; si2--) {
        var segEndInStream = remainingText;
        var segStartInStream = segEndInStream - segs[si2].text.length;
        remainingText = segStartInStream;
        var wmSeg = _getWmAtPos(origFull, wmFull, segs[si2].text, streamPos + segStartInStream);
        var chunk = wmSeg !== null ? wmSeg : segs[si2].text;
        var esc = chunk.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        content = content.substring(0, segs[si2].start) + '(' + esc + ') Tj' + content.substring(segs[si2].end);
    }

    return content;
}

async function buildWatermarkedPdfDoc(originalBytes, originalText, watermarkedText) {
    var src = '';
    for (var i = 0; i < originalBytes.length; i++) src += String.fromCharCode(originalBytes[i]);
    var result = '', lastIdx = 0;

    // Encode watermarked text as UTF-16 BE for PDF parenthesized string
    var wmUtf16Be = '';
    for (var ci = 0; ci < watermarkedText.length; ci++) {
        var code = watermarkedText.charCodeAt(ci);
        wmUtf16Be += String.fromCharCode((code >> 8) & 0xFF);
        wmUtf16Be += String.fromCharCode(code & 0xFF);
    }
    function escPdfStr(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
    var wmStreamSnippet = '\nBT\n/F0 12 Tf\n0 0 Td\n(' + escPdfStr(wmUtf16Be) + ') Tj\nET\n';

    // Process each stream
    var re = /stream([\r\n]+)([\s\S]*?)endstream/g;
    var m;
    while ((m = re.exec(src)) !== null) {
        result += src.substring(lastIdx, m.index);
        result += 'stream' + m[1];
        var rawData = m[2];
        var cleanData = rawData.replace(/[\r\n]+$/, '');
        var rawBytes = new Uint8Array(cleanData.length);
        for (var di = 0; di < cleanData.length; di++) rawBytes[di] = cleanData.charCodeAt(di) & 0xFF;
        var modified = cleanData;

        // Try to decompress (zlib first, then raw deflate)
        var dec = null;
        for (var fmtIdx = 0; fmtIdx < 2 && dec === null; fmtIdx++) {
            var fmt = fmtIdx === 0 ? 'deflate' : 'deflate-raw';
            try {
                var st = new DecompressionStream(fmt);
                var sw = st.writable.getWriter();
                var sr = st.readable.getReader();
                var sch = [];
                var srp = (async function() {
                    try { while (true) { var v = await sr.read(); if (v.done) break; sch.push(v.value); } }
                    catch (e) { /* reader error — suppress */ }
                })();
                await sw.write(rawBytes); await sw.close(); await srp;
                var sttl = 0; for (var si = 0; si < sch.length; si++) sttl += sch[si].length;
                dec = new Uint8Array(sttl); var soff = 0;
                for (var sj = 0; sj < sch.length; sj++) { dec.set(sch[sj], soff); soff += sch[sj].length; }
            } catch (e) { dec = null; }
        }

        if (dec) {
            var decStr = '';
            for (var d2 = 0; d2 < dec.length; d2++) decStr += String.fromCharCode(dec[d2]);
            // Append watermarked text to the first page content stream (has BT/ET)
            var pageStream = wmUtf16Be && decStr.indexOf('BT') >= 0 && decStr.indexOf('ET') >= 0;
            if (pageStream) {
                var lastEt = decStr.lastIndexOf('ET');
                decStr = decStr.substring(0, lastEt + 2) + wmStreamSnippet + decStr.substring(lastEt + 2);
                wmUtf16Be = ''; // only append once
            }
            // Try text replacement (best-effort, likely won't match CMap-encoded text)
            var newStr = _pdfReplaceInStream(decStr, originalText, watermarkedText);
            if (newStr !== decStr || pageStream) {
                var nBytes = new Uint8Array(newStr.length);
                for (var nb = 0; nb < newStr.length; nb++) nBytes[nb] = newStr.charCodeAt(nb) & 0xFF;
                var comp = await _deflate(nBytes);
                modified = '';
                for (var ciX = 0; ciX < comp.length; ciX++) modified += String.fromCharCode(comp[ciX]);
            }
        }

        var trail = rawData.substring(cleanData.length);
        result += modified + trail + 'endstream';
        lastIdx = m.index + m[0].length;
    }
    result += src.substring(lastIdx);

    var out = new Uint8Array(result.length);
    for (var i2 = 0; i2 < result.length; i2++) out[i2] = result.charCodeAt(i2) & 0xFF;
    return out;
}

function docwToTXT(r) {
    return r.watermarkedText || '';
}

function docwToCSV(r) {
    var rows = [['Key', 'Value']];
    for (var k in r) {
        if (k === 'watermarkedText') continue;
        rows.push([k, String(r[k])]);
    }
    return rows.map(function(row) { return row.map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }).join(','); }).join('\n') + '\n';
}

function docwToXML(r) {
    var xml = '<?xml version="1.0"?>\n<document_watermark>\n';
    for (var k in r) {
        if (k === 'watermarkedText') continue;
        xml += '  <' + k + '>' + _docwEscXml(String(r[k])) + '</' + k + '>\n';
    }
    xml += '</document_watermark>';
    return xml;
}

function docwToHTML(r) {
    return _docwBuildReportHtml(r, 'embed');
}

async function downloadDocw(format) {
    closeDownloadModal();
    var r = _docwResult;
    if (!r) return;

    if (format === 'pdf') {
        var blob = await _docwBuildReportPdf(r, 'embed');
        downloadBlobSimple(blob, 'document_watermark_report.pdf');
        return;
    }

    if (format === 'doc') {
        var blob = await _docwBuildReportDocx(r, 'embed');
        downloadBlobSimple(blob, 'document_watermark_report.docx');
        return;
    }

    var content, ext, mime;
    switch (format) {
        case 'json':
            content = JSON.stringify({ watermarkedText: r.watermarkedText, algo: r.algo, timestamp: r.timestamp, textLength: r.textLength }, null, 2);
            ext = 'json'; mime = 'application/json'; break;
        case 'csv':  content = docwToCSV(r);  ext = 'csv';  mime = 'text/csv'; break;
        case 'txt':  content = docwToTXT(r);  ext = 'txt';  mime = 'text/plain'; break;
        case 'xml':  content = docwToXML(r);  ext = 'xml';  mime = 'application/xml'; break;
        case 'html': content = docwToHTML(r); ext = 'html'; mime = 'text/html'; break;
    }
    if (content == null) return;
    var blob = new Blob([content], { type: mime });
    downloadBlobSimple(blob, 'document_watermark.' + ext);
}

// ── Rebuild original document with watermarked text (preserves ZWC) ──

async function buildWatermarkedDocx(originalBytes, watermarkedText) {
    var zip = await JSZip.loadAsync(originalBytes);
    var xml = await zip.file('word/document.xml').async('string');
    var runCount = 0;
    xml = xml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function(match, content) {
        runCount++;
        if (runCount === 1) {
            return match.replace(content, _docwEscXml(watermarkedText));
        }
        return match.replace(content, '');
    });
    zip.file('word/document.xml', xml);
    return await zip.generateAsync({ type: 'blob' });
}

// ── Multi-format download for extraction result ──

async function downloadDocwExtract(format) {
    closeDownloadModal();
    var r = _docwExtractResult;
    if (!r) return;

    if (format === 'pdf') {
        var blob = await _docwBuildReportPdf(r, 'extract');
        downloadBlobSimple(blob, 'extracted_message_report.pdf');
        return;
    }

    if (format === 'doc') {
        var blob = await _docwBuildReportDocx(r, 'extract');
        downloadBlobSimple(blob, 'extracted_message_report.docx');
        return;
    }

    var content, ext, mime;
    switch (format) {
        case 'json': content = JSON.stringify(r, null, 2); ext = 'json'; mime = 'application/json'; break;
        case 'csv':
            content = '"Key","Value"\n' + '"message","' + (r.message || '').replace(/"/g,'""') + '"\n"algo","' + (r.algo || '').replace(/"/g,'""') + '"\n"timestamp","' + (r.timestamp || '').replace(/"/g,'""') + '"';
            ext = 'csv'; mime = 'text/csv'; break;
        case 'txt':  content = r.message || ''; ext = 'txt'; mime = 'text/plain'; break;
        case 'xml':
            content = '<?xml version="1.0"?>\n<extracted>\n  <message>' + _docwEscXml(r.message || '') + '</message>\n  <algo>' + _docwEscXml(r.algo || '') + '</algo>\n  <timestamp>' + _docwEscXml(r.timestamp || '') + '</timestamp>\n</extracted>';
            ext = 'xml'; mime = 'application/xml'; break;
        case 'html':
            content = _docwBuildReportHtml(r, 'extract');
            ext = 'html'; mime = 'text/html'; break;
    }
    if (content == null) return;
    var blob = new Blob([content], { type: mime });
    downloadBlobSimple(blob, 'extracted_message.' + ext);
}
