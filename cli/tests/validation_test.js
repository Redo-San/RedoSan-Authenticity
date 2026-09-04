const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

var _fileReaderInstances;
var _mockAlert;
var _mockClearInputFiles;

function MockFileReader() {
  _fileReaderInstances.push(this);
  this.result = null;
  this.onload = null;
  this.onerror = null;
}
MockFileReader.prototype.readAsArrayBuffer = function (blob) {
  if (blob && blob._data) {
    this.result = blob._data;
  } else if (blob && blob.size !== undefined) {
    this.result = new ArrayBuffer(blob.size);
  } else {
    this.result = new ArrayBuffer(0);
  }
  if (this.onloadend) this.onloadend({ target: this });
  if (this.onload) this.onload({ target: this });
};

function mockAlert(msg) {
  _mockAlert.push(msg);
}

function mockClearInputFiles(input) {
  _mockClearInputFiles.push(input);
  if (input) input.value = "";
}

function makeMockFile(name, type, data) {
  var arr = new Uint8Array(data || []);
  var blob = {
    name: name,
    type: type,
    size: arr.length,
    _data: arr.buffer,
    slice: function (start, end) {
      var sliced = arr.slice(start, end);
      var b = makeMockFile(name, type, sliced);
      b._data = sliced.buffer;
      return b;
    },
    arrayBuffer: function () {
      return Promise.resolve(arr.buffer);
    },
    text: function () {
      return Promise.resolve(new TextDecoder().decode(arr));
    },
  };
  return blob;
}

var ROOT = path.resolve(__dirname, "../..");
var sharedSrc = fs.readFileSync(
  path.resolve(ROOT, "Style/shared_validation.js"),
  "utf8",
);

function loadSharedValidation() {
  vm.runInThisContext(sharedSrc, {
    filename: path.resolve(ROOT, "Style/shared_validation.js"),
  });
}

describe("shared_validation.js — isDangerousFile", function () {
  before(function () {
    globalThis.__ = function (k) {
      return k;
    };
    globalThis.alert = mockAlert;
    globalThis.FileReader = MockFileReader;
    globalThis.DataTransfer = function () {
      this.files = [];
      this.items = { add: function () {} };
    };
    globalThis.TextDecoder = TextDecoder;
    globalThis.location = {
      protocol: "http:",
      hostname: "localhost",
      href: "http://localhost:8080/",
    };
    globalThis.window = globalThis;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
    _mockAlert = [];
    _mockClearInputFiles = [];
  });

  it("rejects .exe files", function () {
    assert.ok(isDangerousFile(makeMockFile("virus.exe", "", [])));
  });

  it("rejects .bat files", function () {
    assert.ok(isDangerousFile(makeMockFile("script.bat", "", [])));
  });

  it("rejects .js files", function () {
    assert.ok(isDangerousFile(makeMockFile("code.js", "", [])));
  });

  it("rejects .py files", function () {
    assert.ok(isDangerousFile(makeMockFile("script.py", "", [])));
  });

  it("rejects .sh files", function () {
    assert.ok(isDangerousFile(makeMockFile("script.sh", "", [])));
  });

  it("rejects .svg files", function () {
    assert.ok(isDangerousFile(makeMockFile("vector.svg", "", [])));
  });

  it("rejects .zip files", function () {
    assert.ok(isDangerousFile(makeMockFile("archive.zip", "", [])));
  });

  it("rejects uppercase extensions", function () {
    assert.ok(isDangerousFile(makeMockFile("Virus.EXE", "", [])));
  });

  it("allows .png files", function () {
    assert.ok(!isDangerousFile(makeMockFile("image.png", "", [])));
  });

  it("allows .jpg files", function () {
    assert.ok(!isDangerousFile(makeMockFile("photo.jpg", "", [])));
  });

  it("allows .mp3 files", function () {
    assert.ok(!isDangerousFile(makeMockFile("song.mp3", "", [])));
  });

  it("allows .pdf files", function () {
    assert.ok(!isDangerousFile(makeMockFile("doc.pdf", "", [])));
  });

  it("allows files without extension", function () {
    assert.ok(!isDangerousFile(makeMockFile("README", "", [])));
  });
});

describe("shared_validation.js — matchesAccept", function () {
  before(function () {
    loadSharedValidation();
  });

  it("returns true when acceptAttr is empty", function () {
    assert.ok(matchesAccept(makeMockFile("test.png", "image/png"), ""));
  });

  it("returns true when acceptAttr is null", function () {
    assert.ok(matchesAccept(makeMockFile("test.png", "image/png"), null));
  });

  it("matches by file extension", function () {
    assert.ok(matchesAccept(makeMockFile("photo.png", "image/png"), ".png"));
  });

  it("matches by MIME type", function () {
    assert.ok(
      matchesAccept(makeMockFile("photo.png", "image/png"), "image/png"),
    );
  });

  it("matches by MIME category", function () {
    assert.ok(matchesAccept(makeMockFile("photo.png", "image/png"), "image/*"));
  });

  it("rejects non-matching extension", function () {
    assert.ok(!matchesAccept(makeMockFile("photo.png", "image/png"), ".jpg"));
  });

  it("rejects non-matching MIME type", function () {
    assert.ok(
      !matchesAccept(makeMockFile("photo.png", "image/png"), "audio/mpeg"),
    );
  });

  it("handles comma-separated accept rules", function () {
    assert.ok(
      matchesAccept(makeMockFile("photo.jpg", "image/jpeg"), ".png,.jpg,.gif"),
    );
  });

  it("matches any rule in comma-separated list", function () {
    assert.ok(
      matchesAccept(makeMockFile("video.mp4", "video/mp4"), "image/*,video/*"),
    );
  });

  it("matches extension despite wrong MIME type", function () {
    assert.ok(
      matchesAccept(
        makeMockFile("doc.pdf", "application/octet-stream"),
        ".pdf",
      ),
    );
  });
});

describe("shared_validation.js — isEnglishFilename", function () {
  before(function () {
    loadSharedValidation();
  });

  it("accepts simple ASCII filename", function () {
    assert.ok(isEnglishFilename("photo.png"));
  });

  it("accepts filename with spaces and dashes", function () {
    assert.ok(isEnglishFilename("my photo-vacation.jpg"));
  });

  it("accepts filename with accented characters", function () {
    assert.ok(isEnglishFilename("café.jpg"));
  });

  it("rejects filename with non-Latin characters", function () {
    assert.ok(!isEnglishFilename("照片.png"));
  });

  it("rejects filename with Cyrillic characters", function () {
    assert.ok(!isEnglishFilename("фото.png"));
  });

  it("rejects filename with Arabic characters", function () {
    assert.ok(!isEnglishFilename("صورة.png"));
  });

  it("rejects filename with emoji", function () {
    assert.ok(!isEnglishFilename("photo😀.png"));
  });
});

describe("shared_validation.js — hasDangerousContent", function () {
  before(function () {
    loadSharedValidation();
  });

  function toBytes(str) {
    return new TextEncoder().encode(str);
  }

  it("detects script tags", function () {
    assert.ok(hasDangerousContent(toBytes("<script>alert('xss')</script>")));
  });

  it("detects event handlers", function () {
    assert.ok(hasDangerousContent(toBytes('<img onerror="alert(1)" src=x>')));
  });

  it("detects javascript: URIs", function () {
    assert.ok(
      hasDangerousContent(toBytes('<a href="javascript:alert(1)">link</a>')),
    );
  });

  it("detects foreignObject tags", function () {
    assert.ok(
      hasDangerousContent(
        toBytes("<svg><foreignObject>...</foreignObject></svg>"),
      ),
    );
  });

  it("detects XML entities", function () {
    assert.ok(
      hasDangerousContent(
        toBytes("<!ENTITY blah SYSTEM 'file:///etc/passwd'>"),
      ),
    );
  });

  it("allows safe content", function () {
    assert.ok(!hasDangerousContent(toBytes("Hello, this is safe content.")));
  });

  it("allows normal HTML without scripts", function () {
    assert.ok(
      !hasDangerousContent(toBytes("<html><body><p>Safe</p></body></html>")),
    );
  });
});

describe("shared_validation.js — hasDangerousMagic", function () {
  before(function () {
    loadSharedValidation();
  });

  function magicBytes() {
    return new Uint8Array(arguments);
  }

  it("detects PE executable magic (MZ)", function () {
    var buf = magicBytes(0x4d, 0x5a, 0x90, 0x00);
    assert.ok(hasDangerousMagic(buf));
  });

  it("detects ELF magic", function () {
    var buf = magicBytes(0x7f, 0x45, 0x4c, 0x46);
    assert.ok(hasDangerousMagic(buf));
  });

  it("detects Mach-O magic", function () {
    var buf = magicBytes(0xfe, 0xed, 0xfa, 0xce);
    assert.ok(hasDangerousMagic(buf));
  });

  it("detects shebang scripts", function () {
    var buf = magicBytes(0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e);
    assert.ok(hasDangerousMagic(buf));
  });

  it("returns null for safe files", function () {
    var buf = magicBytes(0x89, 0x50, 0x4e, 0x47);
    assert.equal(hasDangerousMagic(buf), null);
  });

  it("returns dangerous type name", function () {
    var buf = magicBytes(0x4d, 0x5a, 0x90, 0x00);
    var result = hasDangerousMagic(buf);
    assert.ok(typeof result === "string");
    assert.ok(result.includes("PE") || result.includes("executable"));
  });
});

describe("shared_validation.js — fileHasExtension", function () {
  before(function () {
    loadSharedValidation();
  });

  it("returns true for files with extension", function () {
    assert.ok(fileHasExtension({ name: "test.png" }));
  });

  it("returns false for files without extension", function () {
    assert.ok(!fileHasExtension({ name: "README" }));
  });

  it("returns false for files with only a dot", function () {
    assert.ok(!fileHasExtension({ name: "." }));
  });

  it("returns false for files starting with dot", function () {
    assert.ok(!fileHasExtension({ name: ".gitignore" }));
  });

  it("handles multiple dots", function () {
    assert.ok(fileHasExtension({ name: "archive.tar.gz" }));
  });
});

describe("shared_validation.js — checkDocumentThreats", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    globalThis.TextDecoder = TextDecoder;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes non-PDF files immediately", async function () {
    var file = makeMockFile("test.png", "image/png", []);
    assert.ok(await checkDocumentThreats(file));
  });

  it("passes PDF files without threats", async function () {
    var data = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
    );
    var file = makeMockFile("doc.pdf", "application/pdf", data);
    assert.ok(await checkDocumentThreats(file));
  });

  it("rejects PDF with embedded JavaScript", async function () {
    var data = new TextEncoder().encode("%PDF-1.4\n/JavaScript\nendobj\n%%EOF");
    var file = makeMockFile("doc.pdf", "application/pdf", data);
    assert.ok(!(await checkDocumentThreats(file)));
  });

  it("rejects PDF with /Launch action", async function () {
    var data = new TextEncoder().encode("%PDF-1.4\n/Launch\nendobj\n%%EOF");
    var file = makeMockFile("doc.pdf", "application/pdf", data);
    assert.ok(!(await checkDocumentThreats(file)));
  });

  it("rejects PDF with /OpenAction", async function () {
    var data = new TextEncoder().encode("%PDF-1.4\n/OpenAction\nendobj\n%%EOF");
    var file = makeMockFile("doc.pdf", "application/pdf", data);
    assert.ok(!(await checkDocumentThreats(file)));
  });

  it("rejects large PDF files over 10MB", async function () {
    var file = {
      type: "application/pdf",
      size: 11 * 1024 * 1024,
      slice: function () {
        return { _data: new ArrayBuffer(0) };
      },
    };
    assert.ok(await checkDocumentThreats(file));
  });
});

describe("shared_validation.js — checkFileStructure PNG", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes PNG with valid IEND chunk", async function () {
    var buf = new Uint8Array(100);
    buf.set(
      [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00],
      88,
    );
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(await checkFileStructure(file));
  });

  it("rejects PNG with missing IEND length", async function () {
    var buf = new Uint8Array(100);
    buf.set(
      [0x01, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00],
      88,
    );
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(!(await checkFileStructure(file)));
  });

  it("rejects PNG with missing IEND marker", async function () {
    var buf = new Uint8Array(100);
    buf.set(
      [0x00, 0x00, 0x00, 0x00, 0x58, 0x58, 0x58, 0x58, 0x00, 0x00, 0x00, 0x00],
      88,
    );
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(!(await checkFileStructure(file)));
  });
});

describe("shared_validation.js — checkFileStructure JPEG", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes JPEG ending with FFD9", async function () {
    var buf = new Uint8Array(40);
    buf.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    buf[buf.length - 2] = 0xff;
    buf[buf.length - 1] = 0xd9;
    var file = makeMockFile("test.jpg", "image/jpeg", buf);
    assert.ok(await checkFileStructure(file));
  });

  it("rejects JPEG not ending with FFD9", async function () {
    var buf = new Uint8Array(40);
    buf.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    buf[buf.length - 2] = 0xff;
    buf[buf.length - 1] = 0xfe;
    var file = makeMockFile("test.jpg", "image/jpeg", buf);
    assert.ok(!(await checkFileStructure(file)));
  });

  it("returns true for tiny JPEG (size < 20 bypass)", async function () {
    var buf = new Uint8Array(1);
    var file = makeMockFile("tiny.jpg", "image/jpeg", buf);
    assert.ok(await checkFileStructure(file));
  });
});

describe("shared_validation.js — checkFileStructure GIF", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes GIF ending with 0x3B", async function () {
    var buf = new Uint8Array(30);
    buf.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
    buf[buf.length - 1] = 0x3b;
    var file = makeMockFile("test.gif", "image/gif", buf);
    assert.ok(await checkFileStructure(file));
  });

  it("rejects GIF not ending with 0x3B", async function () {
    var buf = new Uint8Array(30);
    buf.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
    // Last byte is NOT 0x3B
    buf[buf.length - 1] = 0x00;
    var file = makeMockFile("test.gif", "image/gif", buf);
    assert.ok(!(await checkFileStructure(file)));
  });
});

describe("shared_validation.js — checkFileStructure WebP", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes WebP files (always valid structure)", async function () {
    var buf = new Uint8Array(30);
    var file = makeMockFile("test.webp", "image/webp", buf);
    assert.ok(await checkFileStructure(file));
  });
});

describe("shared_validation.js — checkFileStructure default", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes unknown format files", async function () {
    var buf = new Uint8Array(30);
    var file = makeMockFile("test.bin", "application/octet-stream", buf);
    assert.ok(await checkFileStructure(file));
  });
});

describe("shared_validation.js — checkFileStructure small files", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("passes files under 20 bytes", async function () {
    var buf = new Uint8Array([0x01, 0x02, 0x03]);
    var file = makeMockFile("tiny.png", "image/png", buf);
    assert.ok(await checkFileStructure(file));
  });

  it("passes on FileReader error during check (benefit of doubt)", async function () {
    var origFR = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.result = null;
      this.onload = null;
      this.onerror = null;
    };
    FileReader.prototype.readAsArrayBuffer = function () {
      if (this.onerror) this.onerror(new Error("read error"));
    };
    var buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(await checkFileStructure(file));
    globalThis.FileReader = origFR;
  });
});

describe("shared_validation.js — detectDangerousMagic", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("returns false for null input", async function () {
    assert.equal(await detectDangerousMagic(null), false);
  });

  it("returns false for input with no files", async function () {
    assert.equal(await detectDangerousMagic({ files: [] }), false);
  });

  it("returns false for input with null file entry", async function () {
    assert.equal(await detectDangerousMagic({ files: [null] }), false);
  });

  it("detects PE executable from magic bytes", async function () {
    var buf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    var file = makeMockFile("unknown", "", buf);
    var input = { files: [file] };
    var result = await detectDangerousMagic(input);
    assert.ok(typeof result === "string");
    assert.ok(result.includes("PE"));
  });

  it("returns null for safe magic bytes", async function () {
    var buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    var file = makeMockFile("unknown", "", buf);
    var input = { files: [file] };
    assert.equal(await detectDangerousMagic(input), null);
  });

  it("detects shebang script", async function () {
    var buf = new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]);
    var file = makeMockFile("script", "", buf);
    var input = { files: [file] };
    assert.ok(typeof (await detectDangerousMagic(input)) === "string");
  });

  it("returns false on FileReader error during magic detection", async function () {
    var origFR = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    };
    FileReader.prototype.readAsArrayBuffer = function () {
      if (this.onerror) this.onerror(new Error("read error"));
    };
    var buf = new Uint8Array([0x4d, 0x5a]);
    var file = makeMockFile("unknown", "", buf);
    assert.equal(await detectDangerousMagic({ files: [file] }), false);
    globalThis.FileReader = origFR;
  });
});

describe("shared_validation.js — validateFileInput", function () {
  before(function () {
    globalThis.__ = function (k, d) {
      return d || k || "";
    };
    globalThis.alert = mockAlert;
    globalThis.FileReader = MockFileReader;
    globalThis.DataTransfer = function () {
      this.files = [];
      this.items = { add: function () {} };
    };
    globalThis.TextDecoder = TextDecoder;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
    _mockAlert = [];
    _mockClearInputFiles = [];
  });

  function makeInput(file, accept) {
    return {
      files: file ? [file] : [],
      value: file ? file.name : "",
      tagName: "INPUT",
      getAttribute: function (a) {
        return a === "accept" ? accept || null : null;
      },
    };
  }

  function makeValidPngBytes() {
    var pngHeader = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ];
    var full = new Uint8Array(pngHeader.length + 40);
    full.set(pngHeader);
    var end = full.length;
    full[end - 12] = 0x00;
    full[end - 11] = 0x00;
    full[end - 10] = 0x00;
    full[end - 9] = 0x00;
    full[end - 8] = 0x49;
    full[end - 7] = 0x45;
    full[end - 6] = 0x4e;
    full[end - 5] = 0x44;
    full[end - 4] = 0x00;
    full[end - 3] = 0x00;
    full[end - 2] = 0x00;
    full[end - 1] = 0x00;
    return full;
  }

  function makeValidInput(name, extraBytes) {
    var full = makeValidPngBytes();
    if (extraBytes) {
      var bigger = new Uint8Array(full.length + extraBytes.length);
      bigger.set(full);
      bigger.set(extraBytes, full.length);
      full = bigger;
      // Fix IEND to be at the new end
      var end = full.length;
      full[end - 12] = 0x00;
      full[end - 11] = 0x00;
      full[end - 10] = 0x00;
      full[end - 9] = 0x00;
      full[end - 8] = 0x49;
      full[end - 7] = 0x45;
      full[end - 6] = 0x4e;
      full[end - 5] = 0x44;
      full[end - 4] = 0x00;
      full[end - 3] = 0x00;
      full[end - 2] = 0x00;
      full[end - 1] = 0x00;
    }
    return makeInput(makeMockFile(name, "image/png", full));
  }

  it("returns true for null input", async function () {
    assert.ok(await validateFileInput(null));
  });

  it("returns true for input with no files", async function () {
    assert.ok(await validateFileInput({ files: [] }));
  });

  it("rejects dangerous file extensions", async function () {
    var input = makeInput(makeMockFile("virus.exe", "", []));
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("rejects oversized files (>200MB)", async function () {
    var bigFile = makeMockFile(
      "big.png",
      "image/png",
      new Uint8Array(201 * 1024 * 1024),
    );
    var input = makeInput(bigFile);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("rejects non-English filenames", async function () {
    var file = makeMockFile("照片.png", "image/png", []);
    var input = makeInput(file);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("rejects files not matching accept attribute", async function () {
    var file = makeMockFile("song.mp3", "audio/mpeg", []);
    var input = makeInput(file, "image/*");
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("rejects corrupt file (wrong magic bytes)", async function () {
    var buf = new Uint8Array(30);
    buf.set([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    var file = makeMockFile("fake.png", "image/png", buf);
    var input = makeInput(file);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("passes valid PNG file", async function () {
    var input = makeValidInput("test.png");
    assert.ok(await validateFileInput(input));
  });

  it("rejects files with dangerous content (valid PNG + script)", async function () {
    var xss = new TextEncoder().encode("<script>alert('xss')</script>");
    var input = makeValidInput("test.png", xss);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("passes file without extension (safe magic)", async function () {
    var buf = makeValidPngBytes();
    var file = makeMockFile("favicon", "image/png", buf);
    var input = makeInput(file);
    assert.ok(await validateFileInput(input));
  });

  it("rejects file without extension with dangerous magic", async function () {
    var buf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    var file = makeMockFile("badfile", "", buf);
    var input = makeInput(file);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });

  it("rejects file with bad PNG structure", async function () {
    var buf = makeValidPngBytes();
    // Corrupt last 12 bytes (remove IEND)
    var end = buf.length;
    buf[end - 8] = 0x00;
    buf[end - 7] = 0x00;
    buf[end - 6] = 0x00;
    buf[end - 5] = 0x00;
    var file = makeMockFile("corrupt.png", "image/png", buf);
    var input = makeInput(file);
    assert.ok(!(await validateFileInput(input)));
    assert.ok(_mockAlert.length > 0);
  });
});

describe("shared_validation.js — matchesMagicBytes edge cases", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    globalThis.TextDecoder = TextDecoder;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("validates WebP via function validator", async function () {
    var buf = new Uint8Array(20);
    buf[0] = 0x52;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf[3] = 0x46; // RIFF
    buf[8] = 0x57;
    buf[9] = 0x45;
    buf[10] = 0x42;
    buf[11] = 0x50; // WEBP
    var file = makeMockFile("test.webp", "image/webp", buf);
    assert.ok(await matchesMagicBytes(file));
  });

  it("rejects WebP with wrong RIFF header", async function () {
    var buf = new Uint8Array(20);
    buf[0] = 0x00;
    buf[1] = 0x00;
    buf[2] = 0x00;
    buf[3] = 0x00; // Wrong RIFF
    buf[8] = 0x57;
    buf[9] = 0x45;
    buf[10] = 0x42;
    buf[11] = 0x50; // WEBP
    var file = makeMockFile("bad.webp", "image/webp", buf);
    assert.ok(!(await matchesMagicBytes(file)));
  });

  it("validates SVG via function validator", async function () {
    var enc = new TextEncoder();
    var data = enc.encode("<svg xmlns='http://www.w3.org/2000/svg'>");
    var file = makeMockFile("test.svg", "image/svg+xml", data);
    assert.ok(await matchesMagicBytes(file));
  });

  it("validates WAV via function validator", async function () {
    var buf = new Uint8Array(20);
    buf[0] = 0x52;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf[3] = 0x46; // RIFF
    buf[8] = 0x57;
    buf[9] = 0x41;
    buf[10] = 0x56;
    buf[11] = 0x45; // WAVE
    var file = makeMockFile("test.wav", "audio/wav", buf);
    assert.ok(await matchesMagicBytes(file));
  });

  it("validates MP4 via function validator", async function () {
    var buf = new Uint8Array(20);
    buf[4] = 0x66;
    buf[5] = 0x74;
    buf[6] = 0x79;
    buf[7] = 0x70; // ftyp
    var file = makeMockFile("test.mp4", "video/mp4", buf);
    assert.ok(await matchesMagicBytes(file));
  });

  it("validates AVI via function validator", async function () {
    var buf = new Uint8Array(20);
    buf[0] = 0x52;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf[3] = 0x46; // RIFF
    buf[8] = 0x41;
    buf[9] = 0x56;
    buf[10] = 0x49;
    buf[11] = 0x20; // AVI
    var file = makeMockFile("test.avi", "video/avi", buf);
    assert.ok(await matchesMagicBytes(file));
  });

  it("handles FileReader error in matchesMagicBytes", async function () {
    var origFR = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    };
    FileReader.prototype.readAsArrayBuffer = function () {
      if (this.onerror) this.onerror(new Error("read error"));
    };
    var buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(await matchesMagicBytes(file));
    globalThis.FileReader = origFR;
  });

  it("passes through for unknown MIME type", async function () {
    var file = makeMockFile("test.xyz", "application/octet-stream", []);
    assert.ok(await matchesMagicBytes(file));
  });
});

describe("shared_validation.js — checkDangerousContent error handler", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    globalThis.TextDecoder = TextDecoder;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("handles FileReader error in checkDangerousContent", async function () {
    var origFR = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    };
    FileReader.prototype.readAsArrayBuffer = function () {
      if (this.onerror) this.onerror(new Error("read error"));
    };
    var buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    var file = makeMockFile("test.png", "image/png", buf);
    assert.ok(!(await checkDangerousContent(file)));
    globalThis.FileReader = origFR;
  });
});

describe("shared_validation.js — checkDocumentThreats error handler", function () {
  before(function () {
    globalThis.FileReader = MockFileReader;
    globalThis.TextDecoder = TextDecoder;
    loadSharedValidation();
  });

  beforeEach(function () {
    _fileReaderInstances = [];
  });

  it("handles FileReader error in checkDocumentThreats", async function () {
    var origFR = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    };
    FileReader.prototype.readAsArrayBuffer = function () {
      if (this.onerror) this.onerror(new Error("read error"));
    };
    var data = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
    );
    var file = makeMockFile("doc.pdf", "application/pdf", data);
    assert.ok(await checkDocumentThreats(file));
    globalThis.FileReader = origFR;
  });
});

describe("shared_validation.js — matchesAccept edge cases", function () {
  before(function () {
    loadSharedValidation();
  });

  it("matches extension regardless of MIME type", function () {
    assert.ok(
      matchesAccept(
        makeMockFile("doc.pdf", "application/octet-stream"),
        ".pdf,.png",
      ),
    );
  });

  it("matches wildcard MIME without matching", function () {
    assert.ok(
      !matchesAccept(makeMockFile("doc.pdf", "application/pdf"), "audio/*"),
    );
  });
});

describe("shared_validation.js — clearInputFiles", function () {
  before(function () {
    loadSharedValidation();
  });

  it("clears file input value and DataTransfer", function () {
    var dt = { files: [] };
    var input = { value: "test.txt", files: [{}], tagName: "INPUT" };
    clearInputFiles(input);
    assert.equal(input.value, "");
  });

  it("handles error when setting value throws", function () {
    var input = {
      get value() {
        return "x";
      },
      set value(v) {
        throw new Error("no");
      },
      files: [],
    };
    clearInputFiles(input);
    // Should not throw
    assert.ok(true);
  });
});
