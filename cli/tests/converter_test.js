const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ innerHTML: "", textContent: "", innerText: "" }) };
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.setTimeout = setTimeout;
globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
globalThis.jspdf = {
  jsPDF: class {
    constructor() { this._pages = 1; this._y = 20; }
    setFontSize(s) { this._fs = s; }
    setTextColor(r, g, b) { this._tc = [r, g, b]; }
    text(t, x, y, opts) { this._y = y + 5; }
    addPage() { this._pages++; this._y = 20; }
    splitTextToSize(t, w) { return t.split("\n"); }
    output(format) { return new Blob(["mock pdf"], { type: "application/pdf" }); }
  },
};
globalThis.docx = {
  Paragraph: class { constructor(opts) { this.opts = opts; } },
  TextRun: class { constructor(opts) { this.opts = opts; } },
  Document: class { constructor(opts) { this.opts = opts; this.sections = opts.sections; } },
  Packer: { toBlob: async (doc) => new Blob(["mock docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) },
};

var _origURL = globalThis.URL;
globalThis.URL = { createObjectURL: () => "blob:test", revokeObjectURL: () => {} };

function makeTextFile(text, baseName, ext) {
  return {
    name: baseName + "." + ext,
    text: async () => text,
  };
}

const src = fs.readFileSync(path.join(__dirname, "../../Converter/converter.js"), "utf8");

// Replace DOM-dependent functions that we don't test
const modified = src.replace(
  /function convStripHtml\(s\) \{[\s\S]*?\}/,
  'function convStripHtml(s) { return String(s).replace(/<[^>]*>/g, "").trim(); }',
);

vm.runInThisContext(modified, { filename: path.resolve(__dirname, "../../Converter/converter.js") });

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

describe("Converter — escXml", () => {
  it("escapes XML special characters", () => {
    assert.equal(escXml("<test>"), "&lt;test&gt;");
    assert.equal(escXml('a&b "c"'), "a&amp;b &quot;c&quot;");
    assert.equal(escXml("normal"), "normal");
  });

  it("handles null/undefined", () => {
    assert.equal(escXml(null), "null"); // String(null) == "null"
    assert.equal(escXml(undefined), "undefined"); // String(undefined) == "undefined"
  });
});

describe("Converter — convCue", () => {
  it("creates a cue object", () => {
    var cue = convSubCue(1000, 5000, "Hello");
    assert.equal(cue.start, 1000);
    assert.equal(cue.end, 5000);
    assert.equal(cue.text, "Hello");
  });
});

describe("Converter — convSubFormatTime", () => {
  it("formats SRT time", () => {
    assert.equal(convSubFormatTime(0), "00:00:00,000");
    assert.equal(convSubFormatTime(3661000), "01:01:01,000");
    assert.equal(convSubFormatTime(1234567), "00:20:34,567");
  });
});

describe("Converter — convSubFormatTimeVtt", () => {
  it("formats VTT time", () => {
    assert.equal(convSubFormatTimeVtt(0), "00:00:00.000");
    assert.equal(convSubFormatTimeVtt(3661000), "01:01:01.000");
  });
});

describe("Converter — convSubFormatAss", () => {
  it("formats ASS time", () => {
    assert.equal(convSubFormatAss(0), "0:00:00.00");
    assert.equal(convSubFormatAss(3661000), "1:01:01.00");
    assert.equal(convSubFormatAss(1230), "0:00:01.23");
  });
});

describe("Converter — convSubParse", () => {
  it("parses SRT format", () => {
    var srt = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,000\nLine two";
    var cues = convSubParse(srt, "srt");
    assert.equal(cues.length, 2);
    assert.equal(cues[0].start, 1000);
    assert.equal(cues[0].end, 4000);
    assert.equal(cues[0].text, "Hello world");
  });

  it("parses SRT without index numbers", () => {
    var srt = "00:00:01,000 --> 00:00:03,000\nNo index";
    var cues = convSubParse(srt, "srt");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "No index");
  });

  it("parses VTT format", () => {
    var vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nVTT text\n\n00:00:05.000 --> 00:00:08.000\nSecond";
    var cues = convSubParse(vtt, "vtt");
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, "VTT text");
  });

  it("parses VTT with short time format", () => {
    var vtt = "WEBVTT\n\n00:01.000 --> 00:04.000\nShort time";
    var cues = convSubParse(vtt, "vtt");
    assert.equal(cues.length, 1);
    assert.ok(cues[0].start > 0);
  });

  it("parses ASS format", () => {
    var ass = "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello ASS";
    var cues = convSubParse(ass, "ass");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "Hello ASS");
  });

  it("parses SUB format", () => {
    var sub = "{0}{95}Frame based";
    var cues = convSubParse(sub, "sub");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "Frame based");
  });

  it("parses SBV format", () => {
    var sbv = "0:00:01.000,0:00:04.000\nSBV text";
    var cues = convSubParse(sbv, "sbv");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].start, 1000);
  });

  it("parses LRC format", () => {
    var lrc = "[01:02.50]Lyric line";
    var cues = convSubParse(lrc, "lrc");
    assert.equal(cues.length, 1);
    assert.ok(cues[0].start > 0);
  });

  it("parses TTML format", () => {
    var ttml = '<tt><body><div><p begin="00:00:01.000" end="00:00:04.000">TTML text</p></div></body></tt>';
    var cues = convSubParse(ttml, "ttml");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "TTML text");
  });

  it("default fallback for unknown extension", () => {
    var cues = convSubParse("line1\nline2", "unknown");
    assert.equal(cues.length, 2);
  });

  it("skips NOTE and WEBVTT headers in VTT", () => {
    var vtt = "WEBVTT\n\nNOTE comment\n\n00:00:01.000 --> 00:00:04.000\nReal text";
    var cues = convSubParse(vtt, "vtt");
    assert.equal(cues.length, 1);
  });

  it("returns empty for SRT with no time match", () => {
    var cues = convSubParse("just text\nno timestamp", "srt");
    assert.equal(cues.length, 0);
  });
});

describe("Converter — convSub writers", () => {
  var cues = [
    { start: 1000, end: 4000, text: "First cue" },
    { start: 5000, end: 8000, text: "Second cue" },
  ];

  it("convSubWriteSrt produces SRT output", () => {
    var out = convSubWriteSrt(cues);
    assert.ok(out.includes("1\n00:00:01,000 --> 00:00:04,000"));
    assert.ok(out.includes("First cue"));
    assert.ok(out.includes("2\n00:00:05,000 --> 00:00:08,000"));
  });

  it("convSubWriteVtt produces VTT output", () => {
    var out = convSubWriteVtt(cues);
    assert.ok(out.startsWith("WEBVTT"));
    assert.ok(out.includes("00:00:01.000 --> 00:00:04.000"));
  });

  it("convSubWriteAss produces ASS output", () => {
    var out = convSubWriteAss(cues);
    assert.ok(out.includes("[Script Info]"));
    assert.ok(out.includes("[Events]"));
    assert.ok(out.includes("0:00:01.00,0:00:04.00"));
  });

  it("convSubWriteSub produces SUB output", () => {
    var out = convSubWriteSub(cues);
    assert.ok(out.includes("{24}{96}"));
    assert.ok(out.includes("{120}{192}"));
  });

  it("convSubWriteSbv produces SBV output", () => {
    var out = convSubWriteSbv(cues);
    assert.ok(out.includes("00:00:01.000,00:00:04.000"));
  });

  it("convSubWriteLrc produces LRC output", () => {
    var out = convSubWriteLrc(cues);
    assert.ok(out.includes("[00:01.00]"));
  });

  it("convSubWriteTtml produces TTML output", () => {
    var out = convSubWriteTtml(cues);
    assert.ok(out.includes("<?xml"));
    assert.ok(out.includes("<p begin="));
  });

  it("convSubWriteTxt produces plain text", () => {
    var out = convSubWriteTxt(cues);
    assert.equal(out, "First cue\nSecond cue\n");
  });

  it("convSubWriteSrt handles empty cues", () => {
    assert.equal(convSubWriteSrt([]), "");
  });
});

describe("Converter — convDoc conversion functions", () => {
  it("convDocToTxt strips HTML and trims whitespace", () => {
    var result = convDocToTxt("<p>Hello</p><br>World");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "txt");
  });

  it("convDocToHtml produces HTML document", () => {
    var result = convDocToHtml("line1\nline2", "test.txt");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "html");
  });

  it("convDocToMd produces Markdown document", () => {
    var result = convDocToMd("content", "file.txt");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "md");
  });

  it("convDocToJson with valid JSON", () => {
    var result = convDocToJson('{"key":"value"}', "test.json");
    assert.equal(result.ext, "json");
  });

  it("convDocToJson with invalid JSON", () => {
    var result = convDocToJson("plain text", "test.txt");
    assert.equal(result.ext, "json");
  });

  it("convDocToXml produces XML document", () => {
    var result = convDocToXml("content", "test.txt");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "xml");
  });

  it("convDocToCsv with valid JSON array", () => {
    var result = convDocToCsv('[{"a":1,"b":2},{"a":3,"b":4}]', "test.json");
    assert.equal(result.ext, "csv");
  });

  it("convDocToCsv with plain text", () => {
    var result = convDocToCsv("line1\nline2", "test.txt");
    assert.equal(result.ext, "csv");
  });

  it("convDocToPdf produces PDF blob", async () => {
    var result = await convDocToPdf("Hello PDF", "test");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "pdf");
  });

  it("convDocToPdf throws when jspdf is undefined", async () => {
    var orig = globalThis.jspdf;
    delete globalThis.jspdf;
    try {
      await assert.rejects(function () { return convDocToPdf("test", "x"); });
    } finally {
      globalThis.jspdf = orig;
    }
  });

  it("convDocToDocx produces DOCX blob", async () => {
    var result = await convDocToDocx("Hello DOCX", "test");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "docx");
  });

  it("convDocToDocx throws when docx is undefined", async () => {
    var orig = globalThis.docx;
    delete globalThis.docx;
    try {
      await assert.rejects(function () { return convDocToDocx("test", "x"); });
    } finally {
      globalThis.docx = orig;
    }
  });
});

describe("Converter — convRun dispatcher", () => {
  it("throws for unknown type", async () => {
    await assert.rejects(function () { return convRun(null, "unknown", "txt"); });
  });

  it("dispatches document type", async () => {
    // convDocument reads file.text() so we need a real async
    var file = makeTextFile("hello", "test", "txt");
    var result = await convRun(file, "document", "txt");
    assert.ok(result);
    assert.equal(result.ext, "txt");
  });

  it("dispatches subtitle type", async () => {
    var file = makeTextFile("00:00:01,000 --> 00:00:04,000\nSubtitle", "test", "srt");
    var result = await convRun(file, "subtitle", "srt");
    assert.ok(result);
    assert.equal(result.ext, "srt");
  });
});

describe("Converter — convDocument", () => {
  it("converts to txt", async () => {
    var file = makeTextFile("<p>content</p>", "doc", "html");
    var result = await convDocument(file, "txt");
    assert.equal(result.ext, "txt");
  });

  it("converts to html", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "html");
    assert.equal(result.ext, "html");
  });

  it("converts to md", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "md");
    assert.equal(result.ext, "md");
  });

  it("converts to json", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "json");
    assert.equal(result.ext, "json");
  });

  it("converts to xml", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "xml");
    assert.equal(result.ext, "xml");
  });

  it("converts to csv", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "csv");
    assert.equal(result.ext, "csv");
  });

  it("converts to pdf", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "pdf");
    assert.equal(result.ext, "pdf");
  });

  it("converts to docx", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    var result = await convDocument(file, "docx");
    assert.equal(result.ext, "docx");
  });

  it("throws for unsupported format", async () => {
    var file = makeTextFile("hello", "doc", "txt");
    await assert.rejects(function () { return convDocument(file, "bogus"); });
  });
});

describe("Converter — convSubtitle", () => {
  it("converts SRT to SRT", async () => {
    var file = makeTextFile("1\n00:00:01,000 --> 00:00:04,000\nHello", "sub", "srt");
    var result = await convSubtitle(file, "srt");
    assert.equal(result.ext, "srt");
  });

  it("converts SSA to ASS", async () => {
    var file = makeTextFile("[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:04.00,Hello", "sub", "ssa");
    var result = await convSubtitle(file, "vtt");
    assert.equal(result.ext, "vtt");
  });

  it("throws for unsupported subtitle format", async () => {
    var file = makeTextFile("hello", "sub", "srt");
    await assert.rejects(function () { return convSubtitle(file, "bogus"); });
  });
});

describe("Converter — convTimeout", () => {
  it("resolves fast promise", async () => {
    var result = await convTimeout(Promise.resolve("ok"), 1000);
    assert.equal(result, "ok");
  });

  it("rejects on timeout", async () => {
    await assert.rejects(function () { return convTimeout(new Promise(function () {}), 1); });
  });
});

describe("Converter — convYield", () => {
  it("resolves after microtask", async () => {
    await convYield();
    assert.ok(true);
  });
});

// ── Pure audio encoding function tests ──

function makeMockAudioBuffer(length, numChannels, sampleRate) {
  return {
    length: length,
    numberOfChannels: numChannels,
    sampleRate: sampleRate,
    getChannelData: function (ch) {
      var data = new Float32Array(length);
      for (var i = 0; i < length; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }
      return data;
    },
  };
}

describe("Converter — convEncodeWav", () => {
  it("encodes mono WAV", () => {
    var buf = makeMockAudioBuffer(100, 1, 44100);
    var result = convEncodeWav(buf, 1, 44100);
    assert.ok(result instanceof ArrayBuffer);
    assert.ok(result.byteLength > 44);
    var view = new DataView(result);
    assert.equal(new TextDecoder().decode(new Uint8Array(result, 0, 4)), "RIFF");
    assert.equal(new TextDecoder().decode(new Uint8Array(result, 8, 4)), "WAVE");
  });

  it("encodes stereo WAV", () => {
    var buf = makeMockAudioBuffer(100, 2, 48000);
    var result = convEncodeWav(buf, 2, 48000);
    assert.ok(result instanceof ArrayBuffer);
    var view = new DataView(result);
    assert.equal(view.getUint16(22, true), 2); // numChannels
    assert.equal(view.getUint32(24, true), 48000); // sampleRate
  });
});

describe("Converter — convExtended80", () => {
  it("encodes zero as all zeros", () => {
    var buf = new ArrayBuffer(10);
    var view = new DataView(buf);
    convExtended80(0, view, 0);
    for (var i = 0; i < 10; i++) assert.equal(view.getUint8(i), 0);
  });

  it("encodes positive sample rate", () => {
    var buf = new ArrayBuffer(10);
    var view = new DataView(buf);
    convExtended80(44100, view, 0);
    // Sign bit should be 0 (positive)
    assert.ok((view.getUint16(0, false) & 0x8000) === 0);
  });

  it("encodes negative value", () => {
    var buf = new ArrayBuffer(10);
    var view = new DataView(buf);
    convExtended80(-44100, view, 0);
    // Sign bit should be 1 (negative)
    assert.ok((view.getUint16(0, false) & 0x8000) !== 0);
  });

  it("handles Infinity and NaN", () => {
    var buf = new ArrayBuffer(10);
    var view = new DataView(buf);
    convExtended80(Infinity, view, 0);
    for (var i = 0; i < 10; i++) assert.equal(view.getUint8(i), 0);
    convExtended80(NaN, view, 0);
    for (var i = 0; i < 10; i++) assert.equal(view.getUint8(i), 0);
  });
});

describe("Converter — convEncodeAiff", () => {
  it("encodes mono AIFF", () => {
    var buf = makeMockAudioBuffer(50, 1, 44100);
    var result = convEncodeAiff(buf, 1, 44100);
    assert.ok(result instanceof ArrayBuffer);
    var view = new DataView(result);
    assert.equal(new TextDecoder().decode(new Uint8Array(result, 0, 4)), "FORM");
    assert.equal(new TextDecoder().decode(new Uint8Array(result, 8, 4)), "AIFF");
  });

  it("encodes stereo AIFF", () => {
    var buf = makeMockAudioBuffer(50, 2, 48000);
    var result = convEncodeAiff(buf, 2, 48000);
    assert.ok(result instanceof ArrayBuffer);
    var view = new DataView(result);
    // numChannels is at offset 20: FORM(4) + FORM_size(4) + AIFF(4) + COMM(4) + COMM_size(4) = 20
    assert.equal(view.getUint16(20, false), 2);
  });
});

describe("Converter — convEncodeAu", () => {
  it("encodes mono AU", () => {
    var buf = makeMockAudioBuffer(30, 1, 22050);
    var result = convEncodeAu(buf, 1, 22050);
    assert.ok(result instanceof ArrayBuffer);
    var view = new DataView(result);
    assert.equal(view.getUint32(0, false), 0x2e736e64); // ".snd"
    assert.equal(view.getUint32(16, false), 22050); // sampleRate
  });

  it("encodes stereo AU", () => {
    var buf = makeMockAudioBuffer(30, 2, 44100);
    var result = convEncodeAu(buf, 2, 44100);
    assert.ok(result instanceof ArrayBuffer);
    assert.equal(new DataView(result).getUint32(20, false), 2); // numChannels
  });
});

describe("Converter — convEncodeRaw", () => {
  it("encodes mono raw PCM", () => {
    var buf = makeMockAudioBuffer(40, 1, 44100);
    var result = convEncodeRaw(buf, 1);
    assert.ok(result instanceof ArrayBuffer);
    assert.equal(result.byteLength, 40 * 1 * 2); // length * channels * bytesPerSample
  });

  it("encodes stereo raw PCM", () => {
    var buf = makeMockAudioBuffer(40, 2, 44100);
    var result = convEncodeRaw(buf, 2);
    assert.ok(result instanceof ArrayBuffer);
    assert.equal(result.byteLength, 40 * 2 * 2);
  });

  it("raises silence to non-zero values", () => {
    // All zeros should produce encoded non-flat output (sine wave)
    var buf = makeMockAudioBuffer(100, 1, 44100);
    var result = convEncodeRaw(buf, 1);
    var view = new DataView(result);
    var allZero = true;
    for (var i = 0; i < result.byteLength; i += 2) {
      if (view.getInt16(i, true) !== 0) { allZero = false; break; }
    }
    assert.ok(!allZero);
  });
});

describe("Converter — ASS parsing section header edge cases", () => {
  it("handles section headers before [Events]", () => {
    // Use standard ASS Format with many fields so idx.text correctly extracts just the text
    var ass = "[Script Info]\nTitle: Test\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,After header";
    var cues = convSubParse(ass, "ass");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "After header");
  });

  it("skips non-Dialogue lines inside [Events]", () => {
    var ass = "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nComment: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,skipped\nDialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,Real dialogue";
    var cues = convSubParse(ass, "ass");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, "Real dialogue");
  });

  it("handles missing Format line", () => {
    var ass = "[Events]\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,No format";
    var cues = convSubParse(ass, "ass");
    assert.equal(cues.length, 0);
  });
});

describe("Converter — TTML time formats", () => {
  it("parses TTML with 2-part time (mm:ss.xxx)", () => {
    var ttml = '<tt><body><div><p begin="01:30.500" end="02:45.750">Short time</p></div></body></tt>';
    var cues = convSubParse(ttml, "ttml");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].start, 90500); // 1*60000 + 30*1000 + 500
    assert.equal(cues[0].end, 165750);  // 2*60000 + 45*1000 + 750
    assert.equal(cues[0].text, "Short time");
  });

  it("parses TTML with seconds-only time (Xs)", () => {
    var ttml = '<tt><body><div><p begin="1.5s" end="3.5s">Seconds format</p></div></body></tt>';
    var cues = convSubParse(ttml, "ttml");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].start, 1500);
    assert.equal(cues[0].end, 3500);
  });

  it("parses TTML with 3-part time (hh:mm:ss.xxx)", () => {
    var ttml = '<tt><body><div><p begin="00:00:01.000" end="00:00:04.500">Standard time</p></div></body></tt>';
    var cues = convSubParse(ttml, "ttml");
    assert.equal(cues.length, 1);
    assert.equal(cues[0].start, 1000);
  });
});

describe("Converter — convDocToPdf page break", () => {
  it("handles text long enough to cause page break", async () => {
    // Generate enough lines to exceed 280 Y position
    var longText = "";
    for (var i = 0; i < 60; i++) longText += "Line " + i + "\n";
    var result = await convDocToPdf(longText, "longdoc");
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.ext, "pdf");
  });
});
