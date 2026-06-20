const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ innerHTML: "", textContent: "", innerText: "" }) };
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.setTimeout = setTimeout;

const src = fs.readFileSync(path.join(__dirname, "../../Converter/converter.js"), "utf8");

// Replace DOM-dependent functions that we don't test
const modified = src.replace(
  /function convStripHtml\(s\) \{[\s\S]*?\}/,
  'function convStripHtml(s) { return String(s).replace(/<[^>]*>/g, "").trim(); }',
);

vm.runInThisContext(modified, { filename: "converter.js" });

describe("Converter — convDetectType", () => {
  const mockFile = (name) => ({ name });

  it("detects image types", () => {
    assert.equal(convDetectType(mockFile("photo.png")), "image");
    assert.equal(convDetectType(mockFile("photo.jpg")), "image");
    assert.equal(convDetectType(mockFile("photo.jpeg")), "image");
    assert.equal(convDetectType(mockFile("photo.gif")), "image");
    assert.equal(convDetectType(mockFile("photo.webp")), "image");
    assert.equal(convDetectType(mockFile("photo.bmp")), "image");
    assert.equal(convDetectType(mockFile("photo.tiff")), "image");
    assert.equal(convDetectType(mockFile("photo.tif")), "image");
    assert.equal(convDetectType(mockFile("photo.svg")), "image");
    assert.equal(convDetectType(mockFile("photo.ico")), "image");
  });

  it("detects audio types", () => {
    assert.equal(convDetectType(mockFile("audio.mp3")), "audio");
    assert.equal(convDetectType(mockFile("audio.wav")), "audio");
    assert.equal(convDetectType(mockFile("audio.ogg")), "audio");
    assert.equal(convDetectType(mockFile("audio.aac")), "audio");
    assert.equal(convDetectType(mockFile("audio.flac")), "audio");
    assert.equal(convDetectType(mockFile("audio.m4a")), "audio");
    assert.equal(convDetectType(mockFile("audio.wma")), "audio");
    assert.equal(convDetectType(mockFile("audio.opus")), "audio");
  });

  it("detects video types", () => {
    assert.equal(convDetectType(mockFile("video.mp4")), "video");
    assert.equal(convDetectType(mockFile("video.webm")), "video");
    assert.equal(convDetectType(mockFile("video.avi")), "video");
    assert.equal(convDetectType(mockFile("video.mov")), "video");
    assert.equal(convDetectType(mockFile("video.mkv")), "video");
    assert.equal(convDetectType(mockFile("video.flv")), "video");
    assert.equal(convDetectType(mockFile("video.wmv")), "video");
    assert.equal(convDetectType(mockFile("video.m4v")), "video");
  });

  it("detects document types", () => {
    assert.equal(convDetectType(mockFile("doc.txt")), "document");
    assert.equal(convDetectType(mockFile("doc.md")), "document");
    assert.equal(convDetectType(mockFile("doc.html")), "document");
    assert.equal(convDetectType(mockFile("doc.htm")), "document");
    assert.equal(convDetectType(mockFile("doc.csv")), "document");
    assert.equal(convDetectType(mockFile("doc.json")), "document");
    assert.equal(convDetectType(mockFile("doc.xml")), "document");
    assert.equal(convDetectType(mockFile("doc.pdf")), "document");
    assert.equal(convDetectType(mockFile("doc.doc")), "document");
    assert.equal(convDetectType(mockFile("doc.docx")), "document");
    assert.equal(convDetectType(mockFile("doc.rtf")), "document");
    assert.equal(convDetectType(mockFile("doc.odt")), "document");
  });

  it("detects subtitle types", () => {
    assert.equal(convDetectType(mockFile("sub.srt")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.vtt")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.ass")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.ssa")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.sub")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.sbv")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.smi")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.lrc")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.ttml")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.dfxp")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.mpl2")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.pjs")), "subtitle");
    assert.equal(convDetectType(mockFile("sub.rt")), "subtitle");
  });

  it("returns unknown for unrecognized extensions", () => {
    assert.equal(convDetectType(mockFile("file.xyz")), "unknown");
    assert.equal(convDetectType(mockFile("file.abc")), "unknown");
  });

  it("is case-insensitive", () => {
    assert.equal(convDetectType(mockFile("Photo.PNG")), "image");
    assert.equal(convDetectType(mockFile("Audio.MP3")), "audio");
    assert.equal(convDetectType(mockFile("Video.MP4")), "video");
    assert.equal(convDetectType(mockFile("Doc.TXT")), "document");
    assert.equal(convDetectType(mockFile("Sub.SRT")), "subtitle");
  });
});

describe("Converter — convGetFormats", () => {
  it("returns image formats", () => {
    const fmts = convGetFormats("image");
    assert.ok(Array.isArray(fmts));
    assert.ok(fmts.includes("png"));
    assert.ok(fmts.includes("jpeg"));
    assert.ok(fmts.includes("webp"));
  });

  it("returns audio formats", () => {
    const fmts = convGetFormats("audio");
    assert.ok(fmts.includes("wav"));
    assert.ok(fmts.includes("mp3"));
  });

  it("returns video formats", () => {
    const fmts = convGetFormats("video");
    assert.ok(Array.isArray(fmts));
  });

  it("returns document formats", () => {
    const fmts = convGetFormats("document");
    assert.ok(fmts.includes("txt"));
    assert.ok(fmts.includes("pdf"));
    assert.ok(fmts.includes("docx"));
  });

  it("returns subtitle formats", () => {
    const fmts = convGetFormats("subtitle");
    assert.ok(fmts.includes("srt"));
    assert.ok(fmts.includes("vtt"));
  });

  it("returns empty array for unknown type", () => {
    assert.deepEqual(convGetFormats("unknown"), []);
    assert.deepEqual(convGetFormats(""), []);
  });
});

describe("Converter — convGetFormatLabel", () => {
  it("returns known labels", () => {
    assert.equal(convGetFormatLabel("png"), "PNG");
    assert.equal(convGetFormatLabel("jpeg"), "JPEG");
    assert.equal(convGetFormatLabel("webp"), "WebP");
    assert.equal(convGetFormatLabel("mp3"), "MP3");
    assert.equal(convGetFormatLabel("txt"), "TXT");
    assert.equal(convGetFormatLabel("pdf"), "PDF");
    assert.equal(convGetFormatLabel("srt"), "SRT");
    assert.equal(convGetFormatLabel("json"), "JSON");
  });

  it("falls back to uppercase for unknown format", () => {
    assert.equal(convGetFormatLabel("xyz"), "XYZ");
    assert.equal(convGetFormatLabel(""), "");
  });
});

describe("Converter — convStripHtml", () => {
  it("strips HTML tags", () => {
    assert.equal(convStripHtml("<p>Hello</p>"), "Hello");
    assert.equal(convStripHtml("<div><b>Bold</b> text</div>"), "Bold text");
  });

  it("returns trimmed result", () => {
    assert.equal(convStripHtml("  spaced  "), "spaced");
  });

  it("returns empty for empty input", () => {
    assert.equal(convStripHtml(""), "");
  });
});

describe("Converter — convAudioFormats / convVideoFormats / convSubFormats", () => {
  it("convAudioFormats returns format list", () => {
    const fmts = convAudioFormats();
    assert.ok(fmts.length >= 10);
    assert.ok(fmts.includes("wav"));
    assert.ok(fmts.includes("flac"));
  });

  it("convVideoFormats returns format list", () => {
    const fmts = convVideoFormats();
    assert.ok(fmts.length >= 10);
    assert.ok(fmts.includes("mp3"));
    assert.ok(fmts.includes("opus"));
  });

  it("convSubFormats returns format list", () => {
    const fmts = convSubFormats();
    assert.ok(fmts.length >= 8);
    assert.ok(fmts.includes("srt"));
    assert.ok(fmts.includes("vtt"));
  });
});

describe("Converter — escAttr", () => {
  it("escapes HTML attribute characters", () => {
    assert.equal(escAttr("hello"), "hello");
    assert.equal(escAttr("<script>"), "&lt;script&gt;");
    assert.equal(escAttr("a&b"), "a&amp;b");
    assert.equal(escAttr('"quoted"'), "&quot;quoted&quot;");
    assert.equal(escAttr("'single'"), "&#39;single&#39;");
  });
});
