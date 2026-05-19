#!/usr/bin/env node
// ── RedoSan Authenticity CLI ──
// Command-line interface for digital authenticity tools

'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

const program = new Command();

program
  .name('redosan')
  .description('Digital authenticity tools — fingerprint, watermark, metadata, timestamp')
  .version('1.0.0')
  .option('--allow-dangerous', 'Skip file validation (allow blocked extensions, bypass magic bytes check)')
  .addHelpText('after', `
Quick start (no commands): double-click start.bat (Windows) or start.sh (Linux/macOS)
  
Examples:
  $ redosan fingerprint image.png
  $ redosan fingerprint image.png --algo sha256 --json
  $ redosan watermark embed -i image.png -s secret.png -a lsb -p mypassword -o output.png
  $ redosan watermark extract -i watermarked.png -a lsb -p mypassword
  $ redosan metadata image.jpg --json
  $ redosan timestamp create image.png -o proof.ots
  $ redosan timestamp verify image.png -o proof.ots
  $ redosan c2pa sign image.png --claim "Created by Me" -o manifest.json
  $ redosan c2pa read image.jpg
  $ redosan pixel-injection embed -i image.png -s secret.txt -o output.png -a enhanced_lsb
  $ redosan upgrade proof.ots -o upgraded.ots

All processing is 100% local — nothing is uploaded to any server.
`);

// ── Fingerprint command ──
program
  .command('fingerprint')
  .description('Generate cryptographic fingerprints (hashes) for a file')
  .argument('<file>', 'Path to the file to fingerprint')
  .option('-a, --algo <type>', 'Specific algorithm: sha1, sha256, sha384, sha512, sha3, blake2b, blake3, md5, ripemd160, whirlpool, all (default)')
  .option('-j, --json', 'Output as JSON')
  .option('-o, --output <file>', 'Save results to a file')
  .action(async (filePath, opts) => {
    const { runFingerprint } = require('./commands/fingerprint');
    await runFingerprint(filePath, opts);
  });

// ── Watermark command ──
program
  .command('watermark')
  .description('Embed or extract invisible watermarks in images')
  .addCommand(
    new Command('embed')
      .description('Embed a watermark into an image')
      .requiredOption('-i, --image <file>', 'Cover image')
      .option('-s, --secret <file>', 'Secret file to embed')
      .requiredOption('-o, --output <file>', 'Output image path')
      .option('-p, --password <pass>', 'Password')
      .option('-a, --algo <type>', 'Algorithm (default: lsb)')
      .action(async (opts) => {
        const { runWatermark } = require('./commands/watermark');
        await runWatermark('embed', opts);
      })
  )
  .addCommand(
    new Command('extract')
      .description('Extract a watermark from an image')
      .requiredOption('-i, --image <file>', 'Watermarked image')
      .option('-o, --output <file>', 'Extracted data output path')
      .option('-p, --password <pass>', 'Password')
      .option('-a, --algo <type>', 'Algorithm (default: lsb)')
      .action(async (opts) => {
        const { runWatermark } = require('./commands/watermark');
        await runWatermark('extract', opts);
      })
  );

// ── Metadata command ──
program
  .command('metadata')
  .description('Read metadata (EXIF, dimensions, format) from an image')
  .argument('<file>', 'Path to the image file')
  .option('-j, --json', 'Output as JSON')
  .option('-o, --output <file>', 'Save results to a file')
  .action(async (filePath, opts) => {
    const { runMetadata } = require('./commands/metadata');
    await runMetadata(filePath, opts);
  });

// ── Timestamp command ──
program
  .command('timestamp')
  .description('Create or verify OpenTimestamps (.ots) proofs')
  .argument('<action>', 'Action: create or verify')
  .argument('<file>', 'Path to the file')
  .option('-o, --output <file>', 'Output .ots file (create) or .ots proof file (verify)')
  .option('-f, --file2 <file>', 'Original file (verify mode)')
  .action(async (action, filePath, opts) => {
    const { runTimestamp } = require('./commands/timestamp');
    await runTimestamp(action, filePath, opts);
  });

// ── C2PA command ──
program
  .command('c2pa')
  .description('Sign, read, or verify C2PA provenance metadata')
  .argument('<action>', 'Action: sign, read, verify')
  .argument('<file>', 'Path to the file')
  .option('-o, --output <file>', 'Output file path')
  .option('--claim <text>', 'Claim (e.g. "Created by XYZ")')
  .option('--title <text>', 'Content title')
  .option('--author <text>', 'Author name')
  .action(async (action, filePath, opts) => {
    const { runC2pa } = require('./commands/c2pa');
    await runC2pa(action, filePath, opts);
  });

// ── Pixel Injection command ──
program
  .command('pixel-injection')
  .description('Advanced spatial/frequency/DL watermark algorithms (23 algorithms)')
  .argument('<action>', 'Action: embed, extract')
  .requiredOption('-i, --image <file>', 'Input image')
  .option('-s, --secret <file>', 'Secret file to embed')
  .option('-o, --output <file>', 'Output file path (omit to print to screen for extract)')
  .option('-p, --password <pass>', 'Password')
  .option('-a, --algo <type>', 'Algorithm: ' + [
    'enhanced_lsb','adaptive_lsb','multi_channel_lsb','random_lsb',
    'dct','dwt','dft','hybrid_dct_dwt',
    'vine','pixel_seal','nullguard','shallow_diffuse','diffusion_based',
    'imagewmark','meta_seal','stardustmark','invisimark','elevenlikes',
  ].join(', '))
  .action(async (action, opts) => {
    const { runPixelInjection } = require('./commands/pixel_injection');
    await runPixelInjection(action, opts);
  });

// ── Upgrade command (standalone) ──
program
  .command('upgrade')
  .description('Upgrade an incomplete .ots timestamp proof via calendar aggregator')
  .argument('<file>', 'Path to .ots proof file')
  .option('-o, --output <file>', 'Output file path')
  .action(async (filePath, opts) => {
    const { upgradeOts } = require('./commands/timestamp');
    const { readFileBytes } = require('./utils');
    try {
      const data = readFileBytes(filePath);
      const upgraded = await upgradeOts(data);
      const outPath = opts.output ? path.resolve(opts.output) : filePath;
      fs.writeFileSync(outPath, Buffer.from(upgraded));
      console.log(`Upgraded .ots proof saved to: ${outPath} (${upgraded.length} bytes)`);
    } catch (err) {
      console.error(`Upgrade failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
