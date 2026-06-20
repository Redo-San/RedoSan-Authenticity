(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
// ── File validation constants and helpers ──

var BLOCKED_EXTS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".ps1",
  ".psm1",
  ".psd1",
  ".py",
  ".pyc",
  ".rb",
  ".pl",
  ".sh",
  ".bash",
  ".dll",
  ".sys",
  ".ocx",
  ".app",
  ".jar",
  ".msu",
  ".msp",
  ".reg",
  ".inf",
  ".gadget",
  ".cpl",
  ".mst",
  ".hta",
  ".ws",
  ".vb",
  ".vba",
  ".swf",
  ".action",
  ".epub",
  ".xps",
  ".oxps",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  ".lnk",
  ".svg",
  ".svgz",
];

/**
 *
 * @param file
 */
function isDangerousFile(file) {
  var name = file.name.toLowerCase();
  for (const BLOCKED_EXT of BLOCKED_EXTS) {
    if (name.endsWith(BLOCKED_EXT)) return true;
  }
  return false;
}

var MAGIC_BYTES = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  ],
  "image/webp": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x57 ||
      buf[9] !== 0x45 ||
      buf[10] !== 0x42 ||
      buf[11] !== 0x50
    )
      return false;
    return true;
  },
  "image/bmp": [[0x42, 0x4d]],
  "image/tiff": [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
  "image/svg+xml": function (buf) {
    var s = String.fromCharCode.apply(null, buf.slice(0, 50)).toLowerCase();
    return s.includes("<svg") || s.includes("<?xml");
  },
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "audio/mpeg": [
    [0x49, 0x44, 0x33],
    [0xff, 0xfb],
    [0xff, 0xf3],
    [0xff, 0xf2],
  ],
  "audio/wav": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x57 ||
      buf[9] !== 0x41 ||
      buf[10] !== 0x56 ||
      buf[11] !== 0x45
    )
      return false;
    return true;
  },
  "audio/flac": [[0x66, 0x4c, 0x61, 0x43]],
  "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]],
  "video/mp4": function (buf) {
    if (
      buf[4] !== 0x66 ||
      buf[5] !== 0x74 ||
      buf[6] !== 0x79 ||
      buf[7] !== 0x70
    )
      return false;
    return true;
  },
  "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]],
  "video/avi": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x41 ||
      buf[9] !== 0x56 ||
      buf[10] !== 0x49 ||
      buf[11] !== 0x20
    )
      return false;
    return true;
  },
};

/**
 *
 * @param file
 */
function matchesMagicBytes(file) {
  return new Promise(function (resolve) {
    var mime = file.type.toLowerCase();
    var expected = MAGIC_BYTES[mime];
    if (!expected) {
      resolve(true);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      if (typeof expected === "function") {
        resolve(expected(arr));
        return;
      }
      for (var sig of expected) {
        var match = true;
        for (const [i, element] of sig.entries()) {
          if (arr[i] !== element) {
            match = false;
            break;
          }
        }
        if (match) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file.slice(0, 64));
  });
}

var DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /(?:^|\s)on\w+\s*=\s*["']/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<\s*foreignObject[\s>]/i,
  /<!ENTITY\s+/i,
  /<!DOCTYPE\s+\w+\s+SYSTEM/i,
  /<\s*xi:include[\s>]/i,
  /<\s*xi:fallback[\s>]/i,
];

var DOC_THREAT_PATTERNS = [
  { pattern: /\/JavaScript[\s<]/i, label: "embedded JavaScript" },
  { pattern: /\/JS\s+\d+\s+0\s+R/i, label: "embedded JavaScript" },
  { pattern: /\/OpenAction[\s<]/i, label: "auto-execute action" },
  { pattern: /\/Launch[\s<]/i, label: "launch external app" },
];

/**
 *
 * @param arr
 */
function hasDangerousContent(arr) {
  var dec = new TextDecoder("utf-8", { fatal: false });
  var s = dec.decode(arr.slice(0, 4096));
  for (const DANGEROUS_PATTERN of DANGEROUS_PATTERNS) {
    if (DANGEROUS_PATTERN.test(s)) return true;
  }
  return false;
}

/**
 *
 * @param file
 */
function checkDangerousContent(file) {
  return new Promise(function (resolve) {
    var reader = new FileReader();
    reader.onloadend = function () {
      resolve(hasDangerousContent(new Uint8Array(reader.result)));
    };
    reader.onerror = function () {
      resolve(false);
    };
    reader.readAsArrayBuffer(file.slice(0, 4096));
  });
}

/**
 *
 * @param file
 */
function checkDocumentThreats(file) {
  return new Promise(function (resolve) {
    if (file.type !== "application/pdf") {
      resolve(true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      resolve(true);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      var dec = new TextDecoder("utf-8", { fatal: false });
      var s = dec.decode(arr);
      for (const DOC_THREAT_PATTERN of DOC_THREAT_PATTERNS) {
        if (DOC_THREAT_PATTERN.pattern.test(s)) {
          resolve(false);
          return;
        }
      }
      resolve(true);
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 *
 * @param file
 */
function checkFileStructure(file) {
  return new Promise(function (resolve) {
    var mime = file.type.toLowerCase();
    var size = file.size;
    if (size < 20) {
      resolve(true);
      return;
    }
    var tailSize = Math.min(100, size);
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      var off = size - tailSize;
      switch (mime) {
        case "image/png": {
          // Last 12 bytes must be IEND chunk: 0-length, "IEND", CRC
          if (tailSize < 12) {
            resolve(false);
            return;
          }
          var i = arr.length - 12;
          if (
            arr[i] !== 0 ||
            arr[i + 1] !== 0 ||
            arr[i + 2] !== 0 ||
            arr[i + 3] !== 0
          ) {
            resolve(false);
            return;
          }
          if (
            arr[i + 4] !== 0x49 ||
            arr[i + 5] !== 0x45 ||
            arr[i + 6] !== 0x4e ||
            arr[i + 7] !== 0x44
          ) {
            resolve(false);
            return;
          }
          resolve(true);

          break;
        }
        case "image/jpeg": {
          // Last 2 bytes must be EOI marker FF D9
          if (tailSize < 2) {
            resolve(false);
            return;
          }
          if (arr.at(-2) !== 0xff || arr.at(-1) !== 0xd9) resolve(false);
          else resolve(true);

          break;
        }
        case "image/gif": {
          // Last byte must be GIF trailer 0x3B
          if (arr.at(-1) === 0x3b) {
            resolve(true);
          } else {
            resolve(false);
          }

          break;
        }
        case "image/webp": {
          resolve(true);

          break;
        }
        default: {
          resolve(true);
        }
      }
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file.slice(-tailSize));
  });
}

/**
 *
 * @param file
 * @param acceptAttr
 */
function matchesAccept(file, acceptAttr) {
  if (!acceptAttr) return true;
  var name = file.name.toLowerCase();
  var type = file.type.toLowerCase();
  var rules = acceptAttr.split(",");
  for (const rule of rules) {
    var r = rule.trim();
    if (r.endsWith("/*") && type.startsWith(r.split("/", 1)[0] + "/"))
      return true;
    else if (r.includes("/") && type === r) return true;
    else if (r.startsWith(".") && name.endsWith(r)) return true;
  }
  return false;
}

/**
 *
 * @param filename
 */
function isEnglishFilename(filename) {
  return /^[A-Za-z0-9 _.\-()\u00C0-\u00FF]+$/.test(filename);
}

/**
 *
 * @param input
 */
function clearInputFiles(input) {
  try {
    input.value = "";
  } catch {}
  if (input.files && input.files.length > 0) {
    var dt = new DataTransfer();
    input.files = dt.files;
  }
}

// Magic signatures of dangerous file types (for files without extension)
var DANGEROUS_MAGIC = [
  { sig: [0x4d, 0x5a], name: "PE executable (exe/dll/sys)" },
  { sig: [0x7f, 0x45, 0x4c, 0x46], name: "ELF executable" },
  { sig: [0xca, 0xfe, 0xba, 0xbe], name: "Mach-O executable" },
  { sig: [0xfe, 0xed, 0xfa, 0xce], name: "Mach-O executable" },
  { sig: [0xce, 0xfa, 0xed, 0xfe], name: "Mach-O executable" },
  { sig: [0xcf, 0xfa, 0xed, 0xfe], name: "Mach-O x86_64" },
  { sig: [0x4d, 0x53, 0x43, 0x46], name: "CAB archive" },
];

/**
 *
 * @param buf
 */
function hasDangerousMagic(buf) {
  for (const element of DANGEROUS_MAGIC) {
    var sig = element.sig;
    var match = true;
    for (const [j, element_] of sig.entries()) {
      if (buf[j] !== element_) {
        match = false;
        break;
      }
    }
    if (match) return element.name;
  }
  // Check for shebang (#!) indicating a script
  if (buf[0] === 0x23 && buf[1] === 0x21) return "script with shebang";
  return null;
}

/**
 *
 * @param file
 */
function fileHasExtension(file) {
  var name = file.name || "";
  var dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1;
}

/**
 *
 * @param input
 */
function detectDangerousMagic(input) {
  return new Promise(function (resolve) {
    if (!input || !input.files || input.files.length === 0) {
      resolve(false);
      return;
    }
    var file = input.files[0];
    if (!file) {
      resolve(false);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      resolve(hasDangerousMagic(new Uint8Array(reader.result)));
    };
    reader.onerror = function () {
      resolve(false);
    };
    reader.readAsArrayBuffer(file.slice(0, 64));
  });
}

/**
 *
 * @param input
 */
async function validateFileInput(input) {
  if (!input || !input.files || input.files.length === 0) return true;
  var file = input.files[0];
  if (!file) return true;
  if (isDangerousFile(file)) {
    alert(
      __(
        "shared.dangerous_file",
        "This file type is not allowed for security reasons.",
      ) || "This file type is not allowed for security reasons.",
    );
    clearInputFiles(input);
    return false;
  }
  if (file.size > 200 * 1024 * 1024) {
    alert(
      __(
        "shared.file_too_large",
        "File is too large. Maximum size is 200 MB.",
      ) || "File is too large. Maximum size is 200 MB.",
    );
    clearInputFiles(input);
    return false;
  }
  if (!isEnglishFilename(file.name)) {
    alert(
      __(
        "shared.english_filename",
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
      ) ||
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
    );
    clearInputFiles(input);
    return false;
  }
  // Detect dangerous file types by magic bytes when file has no extension
  if (!fileHasExtension(file)) {
    var dangerDetected = await detectDangerousMagic(input);
    if (dangerDetected) {
      alert(
        __(
          "shared.dangerous_file",
          "This file type is not allowed for security reasons.",
        ) || "This file type is not allowed for security reasons.",
      );
      clearInputFiles(input);
      return false;
    }
  }
  var accept = input.getAttribute("accept");
  if (accept && !matchesAccept(file, accept)) {
    alert(
      __(
        "shared.wrong_type",
        "Please select a valid file type for this tool.",
      ) || "Please select a valid file type for this tool.",
    );
    clearInputFiles(input);
    return false;
  }
  var magicOk = await matchesMagicBytes(file);
  if (!magicOk) {
    alert(
      __(
        "shared.corrupt_file",
        "This file appears to be corrupted or has an incorrect format.",
      ) || "This file appears to be corrupted or has an incorrect format.",
    );
    clearInputFiles(input);
    return false;
  }
  var dangerous = await checkDangerousContent(file);
  if (dangerous) {
    alert(
      __(
        "shared.dangerous_content",
        "This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.",
      ) ||
        "This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.",
    );
    clearInputFiles(input);
    return false;
  }
  var structOk = await checkFileStructure(file);
  if (!structOk) {
    alert(
      __(
        "shared.bad_structure",
        "This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.",
      ) ||
        "This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.",
    );
    clearInputFiles(input);
    return false;
  }
  return true;
}
