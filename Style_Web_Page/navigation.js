// ── Sidebar toggle ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Page navigation ──
document.querySelectorAll('.nav-links a[data-page], .footer-links a[data-page], .sidebar a[data-page]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    showPage(a.dataset.page);
    if (a.closest('.sidebar')) closeSidebar();
  });
});
document.querySelectorAll('.card[data-page]').forEach(c => {
  c.addEventListener('click', e => { e.preventDefault(); showPage(c.dataset.page); });
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar a[data-page]').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const nav = document.querySelector('.sidebar a[data-page="' + name + '"]');
  if (nav) nav.classList.add('active');
  // Update URL hash for direct linking
  if (name && name !== 'home') {
    history.replaceState(null, '', '#/' + name);
  } else {
    history.replaceState(null, '', window.location.pathname.replace(/\/+$/, '') + '/');
  }
}

// Handle hash-based navigation on load
function handleHashNav() {
  var hash = window.location.hash;
  if (hash && hash.indexOf('#/') === 0) {
    var page = hash.replace('#/', '');
    if (page) showPage(page);
  }
  // Handle ?search= query param
  var params = new URLSearchParams(window.location.search);
  var sq = params.get('search');
  if (sq) {
    setTimeout(function() {
      var inp = document.getElementById('searchInput');
      if (inp) { inp.value = sq; siteSearch(); }
    }, 500);
  }
}
document.addEventListener('DOMContentLoaded', handleHashNav);
// Also run immediately if DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  handleHashNav();
}

// ── Tab switching ──
function switchWmTab(mode) {
  document.querySelectorAll('.tab-btn[data-wm-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('wm-embed').style.display = mode === 'embed' ? '' : 'none';
  document.getElementById('wm-extract').style.display = mode === 'extract' ? '' : 'none';
  document.querySelector('.tab-btn[data-wm-tab="' + mode + '"]').classList.add('active');
}

function switchTsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ts-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ts-hash').style.display = mode === 'hash' ? '' : 'none';
  document.getElementById('ts-ots').style.display = mode === 'ots' ? '' : 'none';
  document.querySelector('.tab-btn[data-ts-tab="' + mode + '"]').classList.add('active');
}

function switchOtsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ots-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ots-create').style.display = mode === 'create' ? '' : 'none';
  document.getElementById('ots-verify').style.display = mode === 'verify' ? '' : 'none';
  document.querySelector('.tab-btn[data-ots-tab="' + mode + '"]').classList.add('active');
}

function showDownloadModal() {
  document.getElementById('dl-modal').classList.add('open');
}

function closeDownloadModal() {
  document.getElementById('dl-modal').classList.remove('open');
}

function downloadResult(format) {
  var handler = window._currentDownloadHandler;
  if (handler) { handler(format); return; }
  if (typeof downloadFingerprint === 'function') { downloadFingerprint(format); }
}

function switchC2paTab(mode) {
  document.querySelectorAll('.tab-btn[data-c2pa-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('c2pa-read').style.display = mode === 'read' ? '' : 'none';
  document.getElementById('c2pa-write').style.display = mode === 'write' ? '' : 'none';
  document.getElementById('c2pa-verify').style.display = mode === 'verify' ? '' : 'none';
  document.querySelector('.tab-btn[data-c2pa-tab="' + mode + '"]').classList.add('active');
  // Hide all result sections when switching tabs
  ['c2pa-read-result', 'c2pa-write-result', 'c2pa-verify-result'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}
