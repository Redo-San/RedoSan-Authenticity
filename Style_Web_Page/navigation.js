// ── Page navigation ──
document.querySelectorAll('nav a[data-page], .footer-links a[data-page]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});
document.querySelectorAll('.card[data-page]').forEach(c => {
  c.addEventListener('click', e => { e.preventDefault(); showPage(c.dataset.page); });
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a[data-page]').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const nav = document.querySelector('nav a[data-page="' + name + '"]');
  if (nav) nav.classList.add('active');
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
