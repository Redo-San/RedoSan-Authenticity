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

function cleanPath(raw) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

function resolvePath(raw, defaultName) {
  const cleaned = cleanPath(raw || '');
  if (!cleaned) return defaultName ? path.resolve(defaultName) : '';
  // Convert MSYS2 paths on Windows (/f/... → F:\...)
  const converted = (process.platform === 'win32' && /^\/[a-zA-Z]\//.test(cleaned))
    ? cleaned[1].toUpperCase() + ':\\' + cleaned.slice(3)
    : cleaned;
  const resolved = path.resolve(converted);
  // If it's an existing directory, append default filename
  if (defaultName && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, defaultName);
  }
  return resolved;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const cp = require('child_process').spawn('node', [CLI, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(CLI),
    });
    cp.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
  });
}

async function selectFile(prompt) {
  while (true) {
    const raw = await ask(c('cyan', prompt));
    const absPath = resolvePath(raw);
    if (absPath && fs.existsSync(absPath)) {
      if (fs.statSync(absPath).isDirectory()) {
        // Show directory contents, let user pick
        const items = fs.readdirSync(absPath).filter(f => {
          try { return fs.statSync(path.join(absPath, f)).isFile(); } catch(e) { return false; }
        }).sort();
        if (items.length === 0) {
          console.log(c('yellow', '(empty directory, no files found)'));
          continue;
        }
        console.log(c('dim', 'Files in ' + absPath + ':'));
        const maxShow = 40;
        const show = items.slice(0, maxShow);
        for (let i = 0; i < show.length; i++) {
          console.log(`  ${c('green', String(i + 1).padStart(2, ' '))}  ${show[i]}`);
        }
        if (items.length > maxShow) {
          console.log(c('dim', `  ... and ${items.length - maxShow} more`));
        }
        const pick = await ask(c('yellow', 'Pick a file (0 to cancel): '));
        const idx = parseInt(pick.trim(), 10);
        if (idx === 0) continue;
        if (idx >= 1 && idx <= show.length) {
          return path.join(absPath, show[idx - 1]);
        }
        console.log(c('red', 'Invalid choice.'));
        continue;
      }
      return absPath;
    }
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
  const algo = await pickAlgorithm('Algorithm (Enter = all):', ['sha256', 'sha512', 'blake3', 'md5', 'sha1', 'sha224', 'sha384', 'sha3_224', 'sha3_256', 'sha3_384', 'sha3_512', 'blake2b', 'blake2s', 'md2', 'md4', 'ripemd160', 'whirlpool'], 'all');
  const args = ['fingerprint', file];
  if (algo.trim() && algo !== 'all') args.push('--algo', algo.trim());
  await run(args);

  // Ask to save
  console.log();
  console.log(c('yellow', 'Save result?'));
  console.log('  ' + c('green', '1') + '  Save as JSON');
  console.log('  ' + c('green', '2') + '  Save as TXT');
  console.log('  ' + c('green', '0') + '  Skip');
  const fmt = await ask(c('cyan', '> '));
  if (fmt.trim() === '1' || fmt.trim() === '2') {
    const def = file + (fmt.trim() === '1' ? '.json' : '.fingerprint.txt');
    const out = await ask(c('cyan', `Output path (Enter = ${path.basename(def)}): `));
    const outPath = out.trim() || def;
    const saveArgs = ['fingerprint', file, '-o', outPath];
    if (algo.trim() && algo !== 'all') saveArgs.push('--algo', algo.trim());
    if (fmt.trim() === '1') saveArgs.push('--json');
    try {
      await run(saveArgs);
      console.log(c('green', `✓ Saved to ${outPath}`));
    } catch (e) {
      console.log(c('red', `✗ Save failed: ${e.message}`));
    }
  }

  await ask('Press Enter...');
}

async function menuWmEmbed() {
  console.clear();
  console.log(c('bright', '── Watermark Embed ──'));
  const image = await selectFile('Cover image path > ');
  const secret = await ask(c('cyan', 'Secret file path (Enter = none): '));
  const secretPath = secret.trim() ? resolvePath(secret) : '';
  if (secret.trim() && !fs.existsSync(secretPath)) {
    console.log(c('red', '✗ Secret file not found.'));
    await ask('Press Enter...');
    return;
  }
  const outputRaw = await ask(c('cyan', 'Output image path (Enter = output.png): '));
  const out = resolvePath(outputRaw, 'output.png');
  const algo = await pickAlgorithm('Algorithm:', ['lsb', 'dct', 'random_lsb', 'neural_lsb', 'zero_bit', 'multi_bit', 'forensic', 'fragile', 'imatag'], 'lsb');
  const pass = await ask(c('yellow', 'Password > '));
  const args = ['watermark', 'embed', '-i', image, '-o', out, '-a', (algo.trim() || 'lsb')];
  if (secretPath) args.push('-s', secretPath);
  if (pass.trim()) args.push('-p', pass.trim());
  await run(args);
  await ask('Press Enter...');
}

async function menuWmExtract() {
  console.clear();
  console.log(c('bright', '── Watermark Extract ──'));
  const image = await selectFile('Watermarked image path > ');
  const algo = await pickAlgorithm('Algorithm:', ['lsb', 'dct', 'random_lsb', 'neural_lsb', 'zero_bit', 'multi_bit', 'forensic', 'fragile', 'imatag'], 'lsb');
  const pass = await ask(c('yellow', 'Password > '));
  const outputRaw = await ask(c('cyan', 'Output file path (Enter = print to screen): '));
  const out = resolvePath(outputRaw);
  const args = ['watermark', 'extract', '-i', image, '-a', (algo.trim() || 'lsb')];
  if (pass.trim()) args.push('-p', pass.trim());
  if (out) args.push('-o', out);
  await run(args);
  await ask('Press Enter...');
}

async function menuMetadata() {
  console.clear();
  console.log(c('bright', '── Metadata ──'));
  const file = await selectFile('File path > ');
  await run(['metadata', file, '--json']);
  await ask('Press Enter...');
}

async function menuTsCreate() {
  console.clear();
  console.log(c('bright', '── Timestamp Create ──'));
  const file = await selectFile('File path > ');
  const outputRaw = await ask(c('cyan', 'Output .ots path (Enter = file.ots): '));
  const out = resolvePath(outputRaw, path.basename(file) + '.ots');
  const args = ['timestamp', 'create', file];
  if (out) args.push('-o', out);
  await run(args);
  await ask('Press Enter...');
}

async function menuTsVerify() {
  console.clear();
  console.log(c('bright', '── Timestamp Verify ──'));
  const file = await selectFile('Original file path > ');
  const proofRaw = await ask(c('cyan', '.ots proof file path (Enter = file.ots): '));
  const proof = resolvePath(proofRaw, path.basename(file) + '.ots');
  const args = ['timestamp', 'verify', file];
  if (proof) args.push('-o', proof);
  await run(args);
  await ask('Press Enter...');
}

async function menuC2paSign() {
  console.clear();
  console.log(c('bright', '── C2PA Sign ──'));
  const file = await selectFile('File path > ');
  const claim = await ask(c('cyan', 'Claim text (Enter = none): '));
  const author = await ask(c('cyan', 'Author (Enter = none): '));
  const outputRaw = await ask(c('cyan', 'Output image path (Enter = overwrite original): '));
  const out = resolvePath(outputRaw);
  const args = ['c2pa', 'sign', file];
  if (claim.trim()) args.push('--claim', claim.trim());
  if (author.trim()) args.push('--author', author.trim());
  if (out) args.push('-o', out);
  await run(args);
  await ask('Press Enter...');
}

async function menuC2paRead() {
  console.clear();
  console.log(c('bright', '── C2PA Read ──'));
  const file = await selectFile('File path > ');
  await run(['c2pa', 'read', file]);
  await ask('Press Enter...');
}

async function pickAlgorithm(title, algos, defaultAlgo) {
  console.log(c('dim', title));
  for (let i = 0; i < algos.length; i++) {
    console.log(`  ${c('green', String(i + 1).padStart(2, ' '))}  ${algos[i]}`);
  }
  const raw = await ask(c('cyan', `Choice (1-${algos.length}, Enter = ${defaultAlgo}): `));
  const n = parseInt(raw.trim(), 10);
  if (n >= 1 && n <= algos.length) return algos[n - 1];
  return defaultAlgo;
}

async function menuPiEmbed() {
  console.clear();
  console.log(c('bright', '── Pixel Injection Embed ──'));
  const image = await selectFile('Image path > ');
  const secret = await ask(c('cyan', 'Message / secret file path > '));
  const secretPath = secret.trim() ? resolvePath(secret) : '';
  if (secret.trim() && !fs.existsSync(secretPath)) {
    console.log(c('red', '✗ Secret file not found.'));
    await ask('Press Enter...');
    return;
  }
  const outputRaw = await ask(c('cyan', 'Output image path (Enter = output.png): '));
  const out = resolvePath(outputRaw, 'output.png');
  const algo = await pickAlgorithm('Algorithm:', ['enhanced_lsb', 'adaptive_lsb', 'dct', 'dwt', 'dft', 'hybrid_dct_dwt', 'vine', 'pixel_seal'], 'enhanced_lsb');
  const pass = await ask(c('yellow', 'Password > '));
  const args = ['pixel-injection', 'embed', '-i', image, '-o', out, '-a', algo];
  if (secretPath) args.push('-s', secretPath);
  if (pass.trim()) args.push('-p', pass.trim());
  await run(args);
  await ask('Press Enter...');
}

async function menuPiExtract() {
  console.clear();
  console.log(c('bright', '── Pixel Injection Extract ──'));
  const image = await selectFile('Image path > ');
  console.log(c('dim', 'Algorithm (Enter = auto-detect all):'));
  console.log('  enhanced_lsb, adaptive_lsb, dct, dwt, dft, hybrid_dct_dwt, vine, pixel_seal');
  const algo = await ask(c('cyan', '> '));
  const pass = await ask(c('yellow', 'Password > '));
  const outputRaw = await ask(c('cyan', 'Output path (Enter = print to screen): '));
  const out = resolvePath(outputRaw);

  const algos = algo.trim() ? [algo.trim()] : ['enhanced_lsb', 'adaptive_lsb', 'dct', 'dwt', 'dft', 'hybrid_dct_dwt', 'vine', 'pixel_seal'];
  let found = false;
  for (const a of algos) {
    const args = ['pixel-injection', 'extract', '-i', image, '-a', a];
    if (pass.trim()) args.push('-p', pass.trim());
    if (out) args.push('-o', out);
    try {
      await run(args);
      found = true;
      if (!algo.trim()) console.log(c('green', `  ✓ Algorithm: ${a}`));
      break; // stop on first success
    } catch (e) {
      if (!algo.trim()) continue; // try next algo in auto mode
    }
  }
  if (!found) console.log(c('red', '✗ No watermark found with any algorithm.'));

  await ask('Press Enter...');
}

mainMenu();