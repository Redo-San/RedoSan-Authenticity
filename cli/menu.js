// ── Interactive Menu for RedoSan Authenticity CLI ──
// For users who prefer menus over command-line flags

'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');

const CLI = path.join(__dirname, 'index.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function c(name, text) {
  return COLORS[name] + text + COLORS.reset;
}

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    const cp = require('child_process').spawn('node', [CLI, ...cmd.split(' ')], {
      stdio: 'inherit',
      cwd: path.dirname(CLI),
    });
    cp.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
  });
}

async function selectFile(prompt) {
  while (true) {
    const file = await ask(c('cyan', prompt));
    const absPath = path.resolve(file.trim());
    if (fs.existsSync(absPath)) return absPath;
    console.log(c('red', '✗ File not found. Try again.'));
  }
}

async function mainMenu() {
  while (true) {
    console.clear();
    console.log(c('bright', '╔══════════════════════════════════════╗'));
    console.log(c('bright', '║     RedoSan Authenticity CLI         ║'));
    console.log(c('bright', '╚══════════════════════════════════════╝'));
    console.log();
    console.log(c('yellow', 'Choose an option:'));
    console.log();
    console.log('  ' + c('green', '1') + '  Fingerprint file (hash a file)');
    console.log('  ' + c('green', '2') + '  Embed watermark');
    console.log('  ' + c('green', '3') + '  Extract watermark');
    console.log('  ' + c('green', '4') + '  View metadata (EXIF / dimensions)');
    console.log('  ' + c('green', '5') + '  Timestamp (create .ots proof)');
    console.log('  ' + c('green', '6') + '  Timestamp (verify .ots proof)');
    console.log('  ' + c('green', '7') + '  C2PA Sign (provenance)');
    console.log('  ' + c('green', '8') + '  C2PA Read');
    console.log('  ' + c('green', '9') + '  Pixel Injection (embed)');
    console.log('  ' + c('green', '10') + ' Pixel Injection (extract)');
    console.log('  ' + c('green', '0') + '  Exit');
    console.log();

    const choice = await ask(c('yellow', '> '));

    try {
      switch (choice.trim()) {
        case '1': await menuFingerprint(); break;
        case '2': await menuWmEmbed(); break;
        case '3': await menuWmExtract(); break;
        case '4': await menuMetadata(); break;
        case '5': await menuTsCreate(); break;
        case '6': await menuTsVerify(); break;
        case '7': await menuC2paSign(); break;
        case '8': await menuC2paRead(); break;
        case '9': await menuPiEmbed(); break;
        case '10': await menuPiExtract(); break;
        case '0': console.log(c('green', 'Goodbye!')); rl.close(); return;
        default: console.log(c('red', 'Invalid choice')); await ask('Press Enter...');
      }
    } catch (e) {
      console.log(c('red', `\nError: ${e.message}`));
      await ask('Press Enter...');
    }
  }
}

async function menuFingerprint() {
  console.clear();
  console.log(c('bright', '── Fingerprint ──'));
  const file = await selectFile('Enter file path > ');
  console.log(c('dim', 'Choose algorithm (Enter = all):'));
  console.log('  sha256, sha512, blake3, md5, sha1, all');
  const algo = await ask(c('cyan', '> '));
  await run(`fingerprint "${file}"${algo.trim() && algo !== 'all' ? ` --algo ${algo.trim()}` : ''}`);
  await ask('Press Enter...');
}

async function menuWmEmbed() {
  console.clear();
  console.log(c('bright', '── Watermark Embed ──'));
  const image = await selectFile('Cover image path > ');
  const secret = await ask(c('cyan', 'Secret file path (Enter = none): '));
  const output = await ask(c('cyan', 'Output image path > '));
  console.log(c('dim', 'Algorithm (Enter = lsb):'));
  console.log('  lsb, dct, random_lsb, neural_lsb, zero_bit, multi_bit, forensic, fragile, imatag');
  const algo = await ask(c('cyan', '> '));
  const pass = await ask(c('yellow', 'Password > '));
  let cmd = `watermark embed -i "${image}" -o "${output.trim()}" -a ${(algo.trim() || 'lsb')}`;
  if (secret.trim()) cmd += ` -s "${secret.trim()}"`;
  if (pass.trim()) cmd += ` -p "${pass.trim()}"`;
  await run(cmd);
  await ask('Press Enter...');
}

async function menuWmExtract() {
  console.clear();
  console.log(c('bright', '── Watermark Extract ──'));
  const image = await selectFile('Watermarked image path > ');
  console.log(c('dim', 'Algorithm (Enter = lsb):'));
  const algo = await ask(c('cyan', '> '));
  const pass = await ask(c('yellow', 'Password > '));
  const output = await ask(c('cyan', 'Output file path (Enter = print to screen): '));
  let cmd = `watermark extract -i "${image}" -a ${(algo.trim() || 'lsb')}`;
  if (pass.trim()) cmd += ` -p "${pass.trim()}"`;
  if (output.trim()) cmd += ` -o "${output.trim()}"`;
  await run(cmd);
  await ask('Press Enter...');
}

async function menuMetadata() {
  console.clear();
  console.log(c('bright', '── Metadata ──'));
  const file = await selectFile('File path > ');
  await run(`metadata "${file}" --json`);
  await ask('Press Enter...');
}

async function menuTsCreate() {
  console.clear();
  console.log(c('bright', '── Timestamp Create ──'));
  const file = await selectFile('File path > ');
  const output = await ask(c('cyan', 'Output .ots path (Enter = file.ots): '));
  await run(`timestamp create "${file}"${output.trim() ? ` -o "${output.trim()}"` : ''}`);
  await ask('Press Enter...');
}

async function menuTsVerify() {
  console.clear();
  console.log(c('bright', '── Timestamp Verify ──'));
  const file = await selectFile('Original file path > ');
  const proof = await ask(c('cyan', '.ots proof file path (Enter = file.ots): '));
  await run(`timestamp verify "${file}"${proof.trim() ? ` -o "${proof.trim()}"` : ''}`);
  await ask('Press Enter...');
}

async function menuC2paSign() {
  console.clear();
  console.log(c('bright', '── C2PA Sign ──'));
  const file = await selectFile('File path > ');
  const claim = await ask(c('cyan', 'Claim text (Enter = none): '));
  const author = await ask(c('cyan', 'Author (Enter = none): '));
  const output = await ask(c('cyan', 'Output JSON path (Enter = file.c2pa.json): '));
  let cmd = `c2pa sign "${file}"`;
  if (claim.trim()) cmd += ` --claim "${claim.trim()}"`;
  if (author.trim()) cmd += ` --author "${author.trim()}"`;
  if (output.trim()) cmd += ` -o "${output.trim()}"`;
  await run(cmd);
  await ask('Press Enter...');
}

async function menuC2paRead() {
  console.clear();
  console.log(c('bright', '── C2PA Read ──'));
  const file = await selectFile('File path > ');
  await run(`c2pa read "${file}"`);
  await ask('Press Enter...');
}

async function menuPiEmbed() {
  console.clear();
  console.log(c('bright', '── Pixel Injection Embed ──'));
  const image = await selectFile('Image path > ');
  const secret = await ask(c('cyan', 'Message / secret file path > '));
  const output = await ask(c('cyan', 'Output image path > '));
  console.log(c('dim', 'Algorithm (Enter = enhanced_lsb):'));
  console.log('  enhanced_lsb, adaptive_lsb, dct, dwt, dft, hybrid_dct_dwt, vine, pixel_seal');
  const algo = await ask(c('cyan', '> '));
  const pass = await ask(c('yellow', 'Password > '));
  let cmd = `pixel-injection embed -i "${image}" -o "${output.trim()}" -a ${(algo.trim() || 'enhanced_lsb')}`;
  if (secret.trim()) cmd += ` -s "${secret.trim()}"`;
  if (pass.trim()) cmd += ` -p "${pass.trim()}"`;
  await run(cmd);
  await ask('Press Enter...');
}

async function menuPiExtract() {
  console.clear();
  console.log(c('bright', '── Pixel Injection Extract ──'));
  const image = await selectFile('Image path > ');
  console.log(c('dim', 'Algorithm (Enter = enhanced_lsb):'));
  const algo = await ask(c('cyan', '> '));
  const pass = await ask(c('yellow', 'Password > '));
  const output = await ask(c('cyan', 'Output path (Enter = print to screen): '));
  let cmd = `pixel-injection extract -i "${image}" -a ${(algo.trim() || 'enhanced_lsb')}`;
  if (pass.trim()) cmd += ` -p "${pass.trim()}"`;
  if (output.trim()) cmd += ` -o "${output.trim()}"`;
  await run(cmd);
  await ask('Press Enter...');
}

mainMenu();