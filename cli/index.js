#!/usr/bin/env node
// ── RedoSan Authenticity CLI ──
// Command-line interface for digital authenticity tools

"use strict";

const { Command } = require("commander");
const path = require("path");
const fs = require("fs");

const program = new Command();

program
  .name("redosan")
  .description(
    "Digital authenticity tools — fingerprint, watermark, audio-watermark, metadata, timestamp, did, certificate, converter, document-watermark",
  )
  .version("1.0.0")
  .option(
    "--allow-dangerous",
    "Skip file validation (allow blocked extensions, bypass magic bytes check)",
  )
  .addHelpText(
    "after",
    `
Quick start (no commands): double-click start.bat (Windows) or start.sh (Linux/macOS)
  
Examples:
  $ redosan fingerprint image.png
  $ redosan fingerprint image.png --algo sha256 --json
  $ redosan watermark embed -i image.png -s secret.png -a lsb -p mypassword -o output.png
  $ redosan watermark extract -i watermarked.png -a lsb -p mypassword
  $ redosan audio-watermark embed audio.wav -s secret.txt -o output.wav
  $ redosan audio-watermark extract audio.wav -p mypassword
  $ redosan metadata image.jpg --json
  $ redosan timestamp create image.png -o proof.ots
  $ redosan timestamp verify image.png -o proof.ots
  $ redosan c2pa sign image.png --claim "Created by Me" -o manifest.json
  $ redosan c2pa read image.jpg
  $ redosan pixel-injection embed -i image.png -s secret.txt -o output.png -a enhanced_lsb
  $ redosan forensic image.png --json
  $ redosan did generate --algo Ed25519
  $ redosan did sign fingerprint.json
  $ redosan certificate fingerprint.json -o passport.pdf --format pdf
   $ redosan converter image.png -f webp
   $ redosan document-watermark embed -i document.txt -m "secret" -o output.txt
   $ redosan document-watermark extract -i watermarked.txt
   $ redosan upgrade proof.ots -o upgraded.ots

All processing is 100% local — nothing is uploaded to any server.
`,
  );

// ── Fingerprint command ──
program
  .command("fingerprint")
  .description("Generate cryptographic fingerprints (hashes) for a file")
  .argument("<file>", "Path to the file to fingerprint")
  .option(
    "-a, --algo <type>",
    "Specific algorithm: sha1, sha256, sha384, sha512, sha3, blake2b, blake3, md5, ripemd160, whirlpool, all (default)",
  )
  .option("-j, --json", "Output as JSON")
  .option("-o, --output <file>", "Save results to a file")
  .action(async (filePath, opts) => {
    const { runFingerprint } = require("./commands/fingerprint");
    await runFingerprint(filePath, opts);
  });

// ── Watermark command ──
program
  .command("watermark")
  .description("Embed or extract invisible watermarks in images")
  .addCommand(
    new Command("embed")
      .description("Embed a watermark into an image")
      .requiredOption("-i, --image <file>", "Cover image")
      .option("-s, --secret <file>", "Secret file to embed")
      .requiredOption("-o, --output <file>", "Output image path")
      .option("-p, --password <pass>", "Password")
      .option("-a, --algo <type>", "Algorithm (default: lsb)")
      .action(async (opts) => {
        const { runWatermark } = require("./commands/watermark");
        await runWatermark("embed", opts);
      }),
  )
  .addCommand(
    new Command("extract")
      .description("Extract a watermark from an image")
      .requiredOption("-i, --image <file>", "Watermarked image")
      .option("-o, --output <file>", "Extracted data output path")
      .option("-p, --password <pass>", "Password")
      .option("-a, --algo <type>", "Algorithm (default: lsb)")
      .action(async (opts) => {
        const { runWatermark } = require("./commands/watermark");
        await runWatermark("extract", opts);
      }),
  );

// ── Metadata command ──
program
  .command("metadata")
  .description("Read metadata (EXIF, dimensions, format) from an image")
  .argument("<file>", "Path to the image file")
  .option("-j, --json", "Output as JSON")
  .option("-o, --output <file>", "Save results to a file")
  .action(async (filePath, opts) => {
    const { runMetadata } = require("./commands/metadata");
    await runMetadata(filePath, opts);
  });

// ── Timestamp command ──
program
  .command("timestamp")
  .description("Create or verify OpenTimestamps (.ots) proofs")
  .argument("<action>", "Action: create or verify")
  .argument("<file>", "Path to the file")
  .option(
    "-o, --output <file>",
    "Output .ots file (create) or .ots proof file (verify)",
  )
  .option("-f, --file2 <file>", "Original file (verify mode)")
  .action(async (action, filePath, opts) => {
    const { runTimestamp } = require("./commands/timestamp");
    await runTimestamp(action, filePath, opts);
  });

// ── C2PA command ──
program
  .command("c2pa")
  .description("Sign, read, or verify C2PA provenance metadata")
  .argument("<action>", "Action: sign, read, verify")
  .argument("<file>", "Path to the file")
  .option("-o, --output <file>", "Output file path")
  .option("--claim <text>", 'Claim (e.g. "Created by XYZ")')
  .option("--title <text>", "Content title")
  .option("--author <text>", "Author name")
  .action(async (action, filePath, opts) => {
    const { runC2pa } = require("./commands/c2pa");
    await runC2pa(action, filePath, opts);
  });

// ── Pixel Injection command ──
program
  .command("pixel-injection")
  .description(
    "Advanced spatial/frequency/DL watermark algorithms (23 algorithms)",
  )
  .argument("<action>", "Action: embed, extract")
  .requiredOption("-i, --image <file>", "Input image")
  .option("-s, --secret <file>", "Secret file to embed")
  .option(
    "-o, --output <file>",
    "Output file path (omit to print to screen for extract)",
  )
  .option("-p, --password <pass>", "Password")
  .option(
    "-a, --algo <type>",
    "Algorithm: " +
      [
        "enhanced_lsb",
        "adaptive_lsb",
        "multi_channel_lsb",
        "random_lsb",
        "dct",
        "dwt",
        "dft",
        "hybrid_dct_dwt",
        "vine",
        "pixel_seal",
        "nullguard",
        "shallow_diffuse",
        "diffusion_based",
        "imagewmark",
        "meta_seal",
        "stardustmark",
        "invisimark",
        "elevenlikes",
      ].join(", "),
  )
  .action(async (action, opts) => {
    const { runPixelInjection } = require("./commands/pixel_injection");
    await runPixelInjection(action, opts);
  });

// ── Audio Watermark command ──
program
  .command("audio-watermark")
  .description("Embed or extract watermarks in WAV audio files")
  .argument("<action>", "Action: embed, extract")
  .argument("<file>", "Path to audio file (WAV)")
  .option("-s, --secret <file>", "Secret file to embed (embed only)")
  .option("-o, --output <file>", "Output file path")
  .option("-p, --password <pass>", "Password")
  .option(
    "-a, --algo <type>",
    "Algorithm: lsb, phase_coding, echo_hiding, dsss, qim, dwt, patchwork, dct (default: lsb)",
  )
  .option("-j, --json", "Output as JSON (extract only)")
  .action(async (action, filePath, opts) => {
    const { runAudioWatermark } = require("./commands/audio_watermark");
    await runAudioWatermark(action, filePath, opts);
  });

// ── Forensic Analyzer command ──
program
  .command("forensic")
  .description(
    "Analyze image tamper signals (ELA, noise inconsistency, JPEG structure, copy-move)",
  )
  .argument("<file>", "Image file to analyze")
  .option("-j, --json", "Output as JSON")
  .option("-o, --output <file>", "Save results to a file")
  .action(async (filePath, opts) => {
    const { runForensic } = require("./commands/forensic");
    await runForensic(filePath, opts);
  });

// ── DID Identity command ──
program
  .command("did")
  .description("Generate DID keypair or sign a file fingerprint")
  .argument("<action>", "Action: generate, sign")
  .argument("[file]", "File to sign (sign mode)")
  .option("--algo <type>", "Key algorithm: Ed25519, P-256 (generate mode)")
  .option("-o, --output <file>", "Output path")
  .action(async (action, file, opts) => {
    const { runDid } = require("./commands/did");
    await runDid(action, file, opts);
  });

// ── Certificate command ──
program
  .command("certificate")
  .description(
    "Generate a Digital Passport certificate from an image and identity data",
  )
  .argument("<file>", "Image file to certify (or fingerprint JSON)")
  .option("-o, --output <file>", "Output file path")
  .option("--format <type>", "Output format: pdf, docx, epub (default: pdf)")
  .option("--name <text>", "Owner name")
  .option("--email <text>", "Owner email")
  .option("--phone-code <text>", "Country code (e.g., +1)")
  .option("--phone <text>", "Phone number")
  .option("--website <url>", "Website URL")
  .option("--social-tiktok <url>", "TikTok URL")
  .option("--social-facebook <url>", "Facebook URL")
  .option("--social-instagram <url>", "Instagram URL")
  .option("--social-youtube <url>", "YouTube URL")
  .option("--music-spotify <url>", "Spotify URL")
  .option("--music-applemusic <url>", "Apple Music URL")
  .option("--music-ytmusic <url>", "YouTube Music URL")
  .option("--music-soundcloud <url>", "SoundCloud URL")
  .option("--watermark <file>", "Watermark result file")
  .option("--pixel-injection <file>", "Pixel injection result file")
  .option("--fingerprint <file>", "Fingerprint JSON file")
  .option("--did <file>", "DID identity JSON file")
  .option("--timestamp <file>", "Timestamp .ots file")
  .action(async (filePath, opts) => {
    const { runCertificate } = require("./commands/certificate");
    await runCertificate(filePath, opts);
  });

// ── Document Watermark command ──
program
  .command("document-watermark")
  .description("Embed or extract invisible watermarks in text documents")
  .argument("<action>", "Action: embed, extract")
  .requiredOption("-i, --input <file>", "Input text file")
  .option("-s, --secret <file>", "Secret message file (embed mode)")
  .option("-m, --message <text>", "Secret message text (embed mode)")
  .option("-o, --output <file>", "Output file path")
  .option("-p, --password <pass>", "Password")
  .option("-a, --algo <type>", "Algorithm: 1=ZWC, 2=Homoglyph, 3=Whitespace, 0=Auto (default: 1)")
  .action(async (action, opts) => {
    const { runDocumentWatermark } = require("./commands/document_watermark");
    await runDocumentWatermark(action, opts);
  });

// ── Converter command ──
program
  .command("converter")
  .description("Convert image/audio files between formats")
  .argument("<file>", "Input file path")
  .option("-f, --format <type>", "Target format (png, jpg, webp, mp3, etc.)")
  .option("-o, --output <file>", "Output file path")
  .action(async (filePath, opts) => {
    const { runConverter } = require("./commands/converter");
    await runConverter(filePath, opts);
  });

// ── Upgrade command (standalone) ──
program
  .command("upgrade")
  .description(
    "Upgrade an incomplete .ots timestamp proof via calendar aggregator",
  )
  .argument("<file>", "Path to .ots proof file")
  .option("-o, --output <file>", "Output file path")
  .action(async (filePath, opts) => {
    const { upgradeOts, otsParse } = require("./commands/timestamp");
    const { readFileBytes } = require("./utils");
    try {
      const data = readFileBytes(filePath);
      // Extract the 32-byte SHA-256 hash from the .ots, send only that
      const parsed = otsParse(data);
      const hashBytes = new Uint8Array(parsed.hash);
      const resp = await upgradeOts(hashBytes);
      // Build complete .ots: header + version + tag + hash + aggregator response
      const OTS_HEADER = [
        0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
        0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
        0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
      ];
      const full = new Uint8Array(OTS_HEADER.length + 1 + 1 + 32 + resp.length);
      full.set(new Uint8Array(OTS_HEADER), 0);
      full[OTS_HEADER.length] = 1;
      full[OTS_HEADER.length + 1] = 0x08;
      full.set(hashBytes, OTS_HEADER.length + 2);
      full.set(resp, OTS_HEADER.length + 2 + 32);
      const outPath = opts.output ? path.resolve(opts.output) : filePath;
      fs.writeFileSync(outPath, Buffer.from(full));
      console.log(
        `Upgraded .ots proof saved to: ${outPath} (${full.length} bytes)`,
      );
    } catch (err) {
      console.error(`Upgrade failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
