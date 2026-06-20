// ── Interactive Menu for RedoSan Authenticity CLI ──
// For users who prefer menus over command-line flags

const path = require("node:path");
const fs = require("node:fs");
const readline = require("node:readline");

const CLI = path.join(__dirname, "index.js");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const COLORS = {
  reset: "\u001B[0m",
  bright: "\u001B[1m",
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  blue: "\u001B[34m",
};

/**
 *
 * @param name
 * @param text
 */
function c(name, text) {
  return COLORS[name] + text + COLORS.reset;
}

/**
 *
 * @param question
 */
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 *
 * @param raw
 */
function cleanPath(raw) {
  return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 *
 * @param raw
 * @param defaultName
 */
function resolvePath(raw, defaultName) {
  const cleaned = cleanPath(raw || "");
  if (!cleaned) return defaultName ? path.resolve(defaultName) : "";
  // Convert MSYS2 paths on Windows (/f/... → F:\...)
  const converted =
    process.platform === "win32" && /^\/[a-zA-Z]\//.test(cleaned)
      ? cleaned[1].toUpperCase() + ":\\" + cleaned.slice(3)
      : cleaned;
  const resolved = path.resolve(converted);
  // If it's an existing directory, append default filename
  if (defaultName && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, defaultName);
  }
  return resolved;
}

/**
 *
 * @param args
 */
function run(args) {
  return new Promise((resolve, reject) => {
    const cp = require("node:child_process").spawn("node", [CLI, ...args], {
      stdio: "inherit",
      cwd: path.dirname(CLI),
    });
    cp.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))));
  });
}

/**
 *
 * @param prompt
 */
async function selectFile(prompt) {
  while (true) {
    const raw = await ask(c("cyan", prompt));
    const absPath = resolvePath(raw);
    if (absPath && fs.existsSync(absPath)) {
      if (fs.statSync(absPath).isDirectory()) {
        // Show directory contents, let user pick
        const items = fs
          .readdirSync(absPath)
          .filter((f) => {
            try {
              return fs.statSync(path.join(absPath, f)).isFile();
            } catch {
              return false;
            }
          })
          .sort();
        if (items.length === 0) {
          console.log(c("yellow", "(empty directory, no files found)"));
          continue;
        }
        console.log(c("dim", "Files in " + absPath + ":"));
        const maxShow = 40;
        const show = items.slice(0, maxShow);
        for (let i = 0; i < show.length; i++) {
          console.log(`  ${c("green", String(i + 1).padStart(2, " "))}  ${show[i]}`);
        }
        if (items.length > maxShow) {
          console.log(c("dim", `  ... and ${items.length - maxShow} more`));
        }
        const pick = await ask(c("yellow", "Pick a file (0 to cancel): "));
        const idx = parseInt(pick.trim(), 10);
        if (idx === 0) continue;
        if (idx >= 1 && idx <= show.length) {
          return path.join(absPath, show[idx - 1]);
        }
        console.log(c("red", "Invalid choice."));
        continue;
      }
      return absPath;
    }
    console.log(c("red", "✗ File not found. Try again."));
  }
}

/**
 *
 */
async function mainMenu() {
  while (true) {
    console.clear();
    console.log(c("bright", "╔══════════════════════════════════════╗"));
    console.log(c("bright", "║     RedoSan Authenticity CLI         ║"));
    console.log(c("bright", "╚══════════════════════════════════════╝"));
    console.log();
    console.log(c("yellow", "Choose an option:"));
    console.log();
    console.log("  " + c("green", "1") + "  Fingerprint file");
    console.log("  " + c("green", "2") + "  Watermark (embed)");
    console.log("  " + c("green", "3") + "  Watermark (extract)");
    console.log("  " + c("green", "4") + "  Audio Watermark (embed)");
    console.log("  " + c("green", "5") + "  Audio Watermark (extract)  — save as TXT / JSON");
    console.log("  " + c("green", "6") + "  View metadata (EXIF / dimensions)");
    console.log("  " + c("green", "7") + "  Timestamp (create .ots proof)");
    console.log("  " + c("green", "8") + "  Timestamp (verify .ots proof)");
    console.log("  " + c("green", "9") + "  C2PA Sign (provenance)");
    console.log("  " + c("green", "10") + " C2PA Read");
    console.log("  " + c("green", "11") + " Pixel Injection (embed)");
    console.log("  " + c("green", "12") + " Pixel Injection (extract)");
    console.log("  " + c("green", "13") + " DID Identity");
    console.log("  " + c("green", "14") + " Digital Passport");
    console.log("  " + c("green", "15") + " File Converter");
    console.log("  " + c("green", "16") + " Document Watermark (embed)");
    console.log("  " + c("green", "17") + " Document Watermark (extract)");
    console.log("  " + c("green", "18") + " Check external tools");
    console.log("  " + c("green", "0") + "  Exit");
    console.log();

    const choice = await ask(c("yellow", "> "));

    try {
      switch (choice.trim()) {
        case "1": {
          await menuFingerprint();
          break;
        }
        case "2": {
          await menuWmEmbed();
          break;
        }
        case "3": {
          await menuWmExtract();
          break;
        }
        case "4": {
          await runAwmEmbed();
          break;
        }
        case "5": {
          await runAwmExtract();
          break;
        }
        case "6": {
          await menuMetadata();
          break;
        }
        case "7": {
          await menuTsCreate();
          break;
        }
        case "8": {
          await menuTsVerify();
          break;
        }
        case "9": {
          await menuC2paSign();
          break;
        }
        case "10": {
          await menuC2paRead();
          break;
        }
        case "11": {
          await menuPiEmbed();
          break;
        }
        case "12": {
          await menuPiExtract();
          break;
        }
        case "13": {
          await menuDid();
          break;
        }
        case "14": {
          await menuCertificate();
          break;
        }
        case "15": {
          await menuConverter();
          break;
        }
        case "16": {
          await menuDocwEmbed();
          break;
        }
        case "17": {
          await menuDocwExtract();
          break;
        }
        case "18": {
          {
            const tools = require("./tools");
            console.log(tools.printToolSummary());
          }
          await ask("Press Enter...");
          break;
        }
        case "0": {
          console.log(c("green", "Goodbye!"));
          rl.close();
          return;
        }
        default: {
          console.log(c("red", "Invalid choice"));
          await ask("Press Enter...");
        }
      }
    } catch (error) {
      console.log(c("red", `\nError: ${error.message}`));
      await ask("Press Enter...");
    }
  }
}

/**
 *
 */
async function menuFingerprint() {
  console.clear();
  console.log(c("bright", "── Fingerprint ──"));
  const file = await selectFile("Enter file path > ");
  const algo = await pickAlgorithm(
    "Algorithm (Enter = all):",
    [
      "sha256",
      "sha512",
      "blake3",
      "md5",
      "sha1",
      "sha224",
      "sha384",
      "sha3_224",
      "sha3_256",
      "sha3_384",
      "sha3_512",
      "blake2b",
      "blake2s",
      "md2",
      "md4",
      "ripemd160",
      "whirlpool",
    ],
    "all",
  );
  const args = ["fingerprint", file];
  if (algo.trim() && algo !== "all") args.push("--algo", algo.trim());
  await run(args);

  // Ask to save
  console.log();
  console.log(c("yellow", "Save result?"));
  console.log("  " + c("green", "1") + "  Save as JSON");
  console.log("  " + c("green", "2") + "  Save as TXT");
  console.log("  " + c("green", "0") + "  Skip");
  const fmt = await ask(c("cyan", "> "));
  if (fmt.trim() === "1" || fmt.trim() === "2") {
    const def = file + (fmt.trim() === "1" ? ".json" : ".fingerprint.txt");
    const out = await ask(c("cyan", `Output path (Enter = ${path.basename(def)}): `));
    let outPath = out.trim() || def;
    if (outPath && fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
      outPath = path.join(outPath, path.basename(def));
    }
    const saveArgs = ["fingerprint", file, "-o", outPath];
    if (algo.trim() && algo !== "all") saveArgs.push("--algo", algo.trim());
    if (fmt.trim() === "1") saveArgs.push("--json");
    try {
      await run(saveArgs);
      console.log(c("green", `✓ Saved to ${outPath}`));
    } catch (error) {
      console.log(c("red", `✗ Save failed: ${error.message}`));
    }
  }

  await ask("Press Enter...");
}

/**
 *
 */
async function menuWmEmbed() {
  console.clear();
  console.log(c("bright", "── Watermark Embed ──"));
  const image = await selectFile("Cover image path > ");
  const secret = await ask(c("cyan", "Secret file path (Enter = none): "));
  const secretPath = secret.trim() ? resolvePath(secret) : "";
  if (secret.trim() && !fs.existsSync(secretPath)) {
    console.log(c("red", "✗ Secret file not found."));
    await ask("Press Enter...");
    return;
  }
  const outputRaw = await ask(c("cyan", "Output image path (Enter = output.png): "));
  const out = resolvePath(outputRaw, "output.png");
  const algo = await pickAlgorithm(
    "Algorithm:",
    ["lsb", "dct", "random_lsb", "neural_lsb", "zero_bit", "multi_bit", "forensic", "fragile", "imatag"],
    "lsb",
  );
  const pass = await ask(c("yellow", "Password > "));
  const args = ["watermark", "embed", "-i", image, "-o", out, "-a", algo.trim() || "lsb"];
  if (secretPath) args.push("-s", secretPath);
  if (pass.trim()) args.push("-p", pass.trim());
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuWmExtract() {
  console.clear();
  console.log(c("bright", "── Watermark Extract ──"));
  const image = await selectFile("Watermarked image path > ");
  const algo = await pickAlgorithm(
    "Algorithm:",
    ["lsb", "dct", "random_lsb", "neural_lsb", "zero_bit", "multi_bit", "forensic", "fragile", "imatag"],
    "lsb",
  );
  const pass = await ask(c("yellow", "Password > "));
  const outputRaw = await ask(c("cyan", "Output file path (Enter = print to screen): "));
  const out = resolvePath(outputRaw);
  const args = ["watermark", "extract", "-i", image, "-a", algo.trim() || "lsb"];
  if (pass.trim()) args.push("-p", pass.trim());
  if (out) args.push("-o", out);
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuMetadata() {
  console.clear();
  console.log(c("bright", "── Metadata ──"));
  const file = await selectFile("File path > ");
  await run(["metadata", file, "--json"]);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuTsCreate() {
  console.clear();
  console.log(c("bright", "── Timestamp Create ──"));
  const file = await selectFile("File path > ");
  const outputRaw = await ask(c("cyan", "Output .ots path (Enter = file.ots): "));
  const out = resolvePath(outputRaw, path.basename(file) + ".ots");
  const args = ["timestamp", "create", file];
  if (out) args.push("-o", out);
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuTsVerify() {
  console.clear();
  console.log(c("bright", "── Timestamp Verify ──"));
  const file = await selectFile("Original file path > ");
  const proofRaw = await ask(c("cyan", ".ots proof file path (Enter = file.ots): "));
  const proof = resolvePath(proofRaw, path.basename(file) + ".ots");
  const args = ["timestamp", "verify", file];
  if (proof) args.push("-o", proof);
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuC2paSign() {
  console.clear();
  console.log(c("bright", "── C2PA Sign ──"));
  const file = await selectFile("File path > ");
  const claim = await ask(c("cyan", "Claim text (Enter = none): "));
  const author = await ask(c("cyan", "Author (Enter = none): "));
  const outputRaw = await ask(c("cyan", "Output image path (Enter = overwrite original): "));
  const out = resolvePath(outputRaw);
  const args = ["c2pa", "sign", file];
  if (claim.trim()) args.push("--claim", claim.trim());
  if (author.trim()) args.push("--author", author.trim());
  if (out) args.push("-o", out);
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuC2paRead() {
  console.clear();
  console.log(c("bright", "── C2PA Read ──"));
  const file = await selectFile("File path > ");
  await run(["c2pa", "read", file]);
  await ask("Press Enter...");
}

/**
 *
 * @param title
 * @param algos
 * @param defaultAlgo
 */
async function pickAlgorithm(title, algos, defaultAlgo) {
  console.log(c("dim", title));
  for (let i = 0; i < algos.length; i++) {
    console.log(`  ${c("green", String(i + 1).padStart(2, " "))}  ${algos[i]}`);
  }
  const raw = await ask(c("cyan", `Choice (1-${algos.length}, Enter = ${defaultAlgo}): `));
  const n = parseInt(raw.trim(), 10);
  if (n >= 1 && n <= algos.length) return algos[n - 1];
  return defaultAlgo;
}

/**
 *
 */
async function menuPiEmbed() {
  console.clear();
  console.log(c("bright", "── Pixel Injection Embed ──"));
  const image = await selectFile("Image path > ");
  const secret = await ask(c("cyan", "Message / secret file path > "));
  const secretPath = secret.trim() ? resolvePath(secret) : "";
  if (secret.trim() && !fs.existsSync(secretPath)) {
    console.log(c("red", "✗ Secret file not found."));
    await ask("Press Enter...");
    return;
  }
  const outputRaw = await ask(c("cyan", "Output image path (Enter = output.png): "));
  const out = resolvePath(outputRaw, "output.png");
  const algo = await pickAlgorithm(
    "Algorithm:",
    ["enhanced_lsb", "adaptive_lsb", "dct", "dwt", "dft", "hybrid_dct_dwt", "vine", "pixel_seal"],
    "enhanced_lsb",
  );
  const pass = await ask(c("yellow", "Password > "));
  const args = ["pixel-injection", "embed", "-i", image, "-o", out, "-a", algo];
  if (secretPath) args.push("-s", secretPath);
  if (pass.trim()) args.push("-p", pass.trim());
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuPiExtract() {
  console.clear();
  console.log(c("bright", "── Pixel Injection Extract ──"));
  const image = await selectFile("Image path > ");
  console.log(c("dim", "Algorithm (Enter = auto-detect all):"));
  console.log("  enhanced_lsb, adaptive_lsb, dct, dwt, dft, hybrid_dct_dwt, vine, pixel_seal");
  const algo = await ask(c("cyan", "> "));
  const pass = await ask(c("yellow", "Password > "));
  const outputRaw = await ask(c("cyan", "Output path (Enter = print to screen): "));
  const out = resolvePath(outputRaw);

  const algos = algo.trim()
    ? [algo.trim()]
    : ["enhanced_lsb", "adaptive_lsb", "dct", "dwt", "dft", "hybrid_dct_dwt", "vine", "pixel_seal"];
  let found = false;
  for (const a of algos) {
    const args = ["pixel-injection", "extract", "-i", image, "-a", a];
    if (pass.trim()) args.push("-p", pass.trim());
    if (out) args.push("-o", out);
    try {
      await run(args);
      found = true;
      if (!algo.trim()) console.log(c("green", `  ✓ Algorithm: ${a}`));
      break; // stop on first success
    } catch {
      if (!algo.trim()) continue; // try next algo in auto mode
    }
  }
  if (!found) console.log(c("red", "✗ No watermark found with any algorithm."));

  await ask("Press Enter...");
}

/**
 *
 */
async function runAwmEmbed() {
  console.clear();
  console.log(c("bright", "── Audio Watermark Embed ──"));
  const audio = await selectFile("Audio file path (WAV) > ");
  const secretFile = await selectFile("Secret file > ");
  const pass = await ask(c("yellow", "Password > "));
  const algo = await pickAlgorithm(
    "Algorithm:",
    ["lsb", "phase_coding", "echo_hiding", "dsss", "qim", "dwt", "patchwork", "dct"],
    "lsb",
  );
  const outputRaw = await ask(c("cyan", "Output path (Enter = output.wav): "));
  const out = resolvePath(outputRaw, "output.wav");
  const args = ["audio-watermark", "embed", audio, "-s", secretFile, "-o", out, "-a", algo];
  if (pass.trim()) args.push("-p", pass.trim());
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function runAwmExtract() {
  console.clear();
  console.log(c("bright", "── Audio Watermark Extract ──"));
  const audio = await selectFile("Watermarked audio path (WAV) > ");
  const pass = await ask(c("yellow", "Password > "));
  const algo = await pickAlgorithm(
    "Algorithm:",
    ["lsb", "phase_coding", "echo_hiding", "dsss", "qim", "dwt", "patchwork", "dct"],
    "lsb",
  );

  /**
   *
   * @param out
   */
  function buildArgs(out) {
    const a = ["audio-watermark", "extract", audio, "-a", algo];
    if (pass.trim()) a.push("-p", pass.trim());
    if (out) a.push("-o", out);
    return a;
  }

  // First run — print to screen
  try {
    await run(buildArgs(""));
  } catch {
    await ask("Press Enter...");
    return;
  }
  console.log();

  // Ask to save
  console.log(c("yellow", "Save result?"));
  console.log("  " + c("green", "1") + "  Save as TXT");
  console.log("  " + c("green", "2") + "  Save as JSON");
  console.log("  " + c("green", "0") + "  Skip");
  const fmt = await ask(c("cyan", "> "));
  if (fmt.trim() === "1" || fmt.trim() === "2") {
    const isJson = fmt.trim() === "2";
    const def = path.basename(audio) + (isJson ? ".json" : ".txt");
    const out = await ask(c("cyan", `Output path (Enter = ${def}): `));
    const outPath = out.trim() || path.join(".", def);
    try {
      const saveArgs = buildArgs(outPath);
      if (isJson) saveArgs.push("--json");
      await run(saveArgs);
      console.log(c("green", `✓ Saved to ${outPath}`));
    } catch (error) {
      console.log(c("red", `✗ Save failed: ${error.message}`));
    }
  }
  await ask("Press Enter...");
}

/**
 *
 */
async function menuDid() {
  console.clear();
  console.log(c("bright", "── DID Identity ──"));
  console.log(c("dim", "1) Generate new DID keypair"));
  console.log(c("dim", "2) Sign a file with existing DID"));
  const sub = await ask(c("cyan", "> "));
  if (sub.trim() === "1") {
    const algo = await pickAlgorithm("Algorithm:", ["Ed25519", "P-256", "RSA-2048", "RSA-4096"], "Ed25519");
    const args = ["did", "generate", "--algo", algo];
    await run(args);
    const signNow = await ask(c("yellow", "Sign a file now? (y/N): "));
    if (signNow.trim().toLowerCase() === "y") {
      const file = await selectFile("Fingerprint JSON or file to sign > ");
      const args2 = ["did", "sign", file];
      await run(args2);
    }
  } else if (sub.trim() === "2") {
    const file = await selectFile("Fingerprint JSON or file to sign > ");
    const args = ["did", "sign", file];
    await run(args);
  }
  await ask("Press Enter...");
}

/**
 *
 */
async function menuCertificate() {
  console.clear();
  console.log(c("bright", "── Digital Passport ──"));
  console.log(c("dim", "Professional Mode — All fields are optional except Image, Name, Email, Phone, Website\n"));

  // Required: Image file
  const imageFile = await selectFile("Image file to certify > ");
  const args = ["certificate", imageFile];

  // Required identity
  const name = await ask(c("cyan", "Your name (required) > "));
  if (name.trim()) args.push("--name", name.trim());

  const email = await ask(c("cyan", "Your email (required) > "));
  if (email.trim()) args.push("--email", email.trim());

  const phoneCode = await ask(c("cyan", "Country code (Enter = +1) > "));
  const pcode = phoneCode.trim() || "+1";
  args.push("--phone-code", pcode);

  const phone = await ask(c("cyan", "Phone number (required) > "));
  if (phone.trim()) args.push("--phone", phone.replace(/\D/g, "").slice(0, 15));

  const website = await ask(c("cyan", "Website URL (required, e.g. https://example.com) > "));
  if (website.trim()) args.push("--website", website.trim());

  // Social links (optional)
  console.log(c("dim", "\nSocial links (optional, press Enter to skip each):"));
  const tiktok = await ask(c("cyan", "  TikTok URL > "));
  if (tiktok.trim()) args.push("--social-tiktok", tiktok.trim());
  const facebook = await ask(c("cyan", "  Facebook URL > "));
  if (facebook.trim()) args.push("--social-facebook", facebook.trim());
  const instagram = await ask(c("cyan", "  Instagram URL > "));
  if (instagram.trim()) args.push("--social-instagram", instagram.trim());
  const youtube = await ask(c("cyan", "  YouTube URL > "));
  if (youtube.trim()) args.push("--social-youtube", youtube.trim());

  // Music links (optional)
  console.log(c("dim", "\nMusic platform links (optional, press Enter to skip each):"));
  const spotify = await ask(c("cyan", "  Spotify URL > "));
  if (spotify.trim()) args.push("--music-spotify", spotify.trim());
  const appleMusic = await ask(c("cyan", "  Apple Music URL > "));
  if (appleMusic.trim()) args.push("--music-applemusic", appleMusic.trim());
  const ytmusic = await ask(c("cyan", "  YouTube Music URL > "));
  if (ytmusic.trim()) args.push("--music-ytmusic", ytmusic.trim());
  const soundcloud = await ask(c("cyan", "  SoundCloud URL > "));
  if (soundcloud.trim()) args.push("--music-soundcloud", soundcloud.trim());

  // Tool result files (optional)
  console.log(c("dim", "\nTool results (optional, press Enter to skip each):"));

  /**
   *
   * @param prompt
   */
  async function askFile(prompt) {
    const raw = await ask(c("cyan", "  " + prompt));
    const cleaned = cleanPath(raw);
    if (!cleaned) return "";
    const resolved = path.resolve(cleaned);
    if (fs.existsSync(resolved)) return resolved;
    console.log(c("yellow", "  (file not found, skipping)"));
    return "";
  }

  const wmFile = await askFile("Watermark result file (json/txt/log) > ");
  if (wmFile) args.push("--watermark", wmFile);
  const piFile = await askFile("Pixel Injection result file (json/txt/log) > ");
  if (piFile) args.push("--pixel-injection", piFile);
  const fpFile = await askFile("Fingerprint JSON file > ");
  if (fpFile) args.push("--fingerprint", fpFile);
  const didFile = await askFile("DID Identity JSON file > ");
  if (didFile) args.push("--did", didFile);
  const tsFile = await askFile("Timestamp .ots file > ");
  if (tsFile) args.push("--timestamp", tsFile);

  // Format and output
  const format = await ask(c("cyan", "\nFormat (pdf/docx/epub, Enter = pdf): "));
  args.push("--format", format.trim() || "pdf");

  const defaultName = "passport." + (format.trim() || "pdf");
  const outputRaw = await ask(c("cyan", "Output path (Enter = " + defaultName + "): "));
  const out = resolvePath(outputRaw, defaultName);
  args.push("-o", out);

  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuDocwEmbed() {
  console.clear();
  console.log(c("bright", "── Document Watermark Embed ──"));
  const input = await selectFile("Cover text file > ");
  const useFile = await ask(c("cyan", "Use secret file? (y/N): "));
  var args = ["document-watermark", "embed", "-i", input, "-a", "1"];
  if (useFile.trim().toLowerCase() === "y") {
    const secret = await selectFile("Secret message file > ");
    args.push("-s", secret);
  } else {
    const msg = await ask(c("cyan", "Secret message > "));
    if (msg.trim()) args.push("-m", msg.trim());
  }
  const algo = await pickAlgorithm("Algorithm:", ["ZWC (Zero-Width)", "Homoglyph", "Whitespace"], "ZWC (Zero-Width)");
  var algoMap = { 1: "1", 2: "2", 3: "3" };
  args.push("-a", algoMap[algo] || "1");
  const pass = await ask(c("yellow", "Password (optional) > "));
  if (pass.trim()) args.push("-p", pass.trim());
  const outputRaw = await ask(c("cyan", "Output path (Enter = input.watermarked.txt): "));
  if (outputRaw.trim()) args.push("-o", outputRaw.trim());
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuDocwExtract() {
  console.clear();
  console.log(c("bright", "── Document Watermark Extract ──"));
  const input = await selectFile("Watermarked text file > ");
  var args = ["document-watermark", "extract", "-i", input, "-a", "0"];
  const useAlgo = await ask(c("cyan", "Specify algorithm? (1=ZWC, 2=Homoglyph, 3=Whitespace, Enter=Auto): "));
  if (useAlgo.trim()) args[args.length - 1] = useAlgo.trim();
  const pass = await ask(c("yellow", "Password (optional) > "));
  if (pass.trim()) args.push("-p", pass.trim());
  const outputRaw = await ask(c("cyan", "Output path (Enter = print to screen): "));
  if (outputRaw.trim()) args.push("-o", outputRaw.trim());
  await run(args);
  await ask("Press Enter...");
}

/**
 *
 */
async function menuConverter() {
  console.clear();
  console.log(c("bright", "── File Converter ──"));
  const input = await selectFile("Input file > ");
  const fmt = await ask(c("cyan", "Target format (e.g. png, jpg, webp, mp3): "));
  const outputRaw = await ask(c("cyan", "Output path (Enter = auto): "));
  const out = resolvePath(outputRaw);
  const args = ["converter", input, "-f", fmt];
  if (out) args.push("-o", out);
  await run(args);
  await ask("Press Enter...");
}

mainMenu();
