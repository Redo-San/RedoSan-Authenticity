// ── RedoSan Authenticity — Security Threat Blocker ──
// Intercepts requests to dangerous file types and returns a warning page.

var DANGEROUS_EXTS = [
  '.exe','.msi','.bat','.cmd','.com','.scr','.pif',
  '.ps1','.psm1','.psd1','.vbs','.vbe','.jse','.wsf','.wsh',
  '.dll','.ocx','.sys','.drv',
  '.jar','.sh','.pl','.py','.rb','.bash','.app',
  '.msu','.msp','.reg','.inf','.gadget','.cpl','.mst',
  '.hta','.ws','.vb','.vba','.swf','.action'
];

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  var path = url.pathname.toLowerCase();

  var isDangerous = DANGEROUS_EXTS.some(function(ext) {
    return path.endsWith(ext);
  });

  if (isDangerous) {
    event.respondWith(
      new Response(threatPage(url.pathname), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 403
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

function threatPage(filePath) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>⚠️ Threat Blocked — RedoSan Authenticity</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:600px;padding:40px 20px;text-align:center}.icon{font-size:72px;margin-bottom:20px}h1{color:#ff4757;font-size:28px;margin-bottom:16px}.file-path{background:#1a1a2e;padding:12px 16px;border-radius:8px;word-break:break-all;font-family:monospace;margin:20px 0;border:1px solid #ff475740;color:#ff6b81}p{color:#a0a0b0;line-height:1.6;margin-bottom:12px}.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#6C5CE7;color:#fff;text-decoration:none;border-radius:8px;font-size:16px}.btn:hover{background:#5f4dd1}.ext-list{margin-top:20px;font-size:13px;color:#606070}.note{font-size:13px;color:#505060;margin-top:24px;padding:12px;background:#12121a;border-radius:6px;border:1px solid #2a2a3a}</style></head><body><div class="container"><div class="icon">&#x26A0;&#xFE0F;</div><h1>Security Threat Blocked</h1><p>This URL appears to be a malicious file disguised as a legitimate resource.</p><div class="file-path">' + escapeHtml(filePath) + '</div><p>&#x1F512; RedoSan Authenticity is a client-side digital authenticity tool and does <strong>not</strong> serve executable files or scripts. If you received this link from someone, it is likely a scam or phishing attempt.</p><a href="/RedoSan-Authenticity/" class="btn">Return to Safety</a><div class="ext-list">Blocked: .exe .msi .bat .cmd .ps1 .vbs .dll .jar .sh .py and more</div><div class="note">If you believe this is a mistake, please report it on <a href="https://github.com/Redo-San/RedoSan-Authenticity/issues" style="color:#6C5CE7" target="_blank" rel="noopener">GitHub Issues</a>.</div></div></body></html>';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
