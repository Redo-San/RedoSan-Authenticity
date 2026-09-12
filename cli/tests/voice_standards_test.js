const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_standards.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_standards.js",
  hostname: "localhost",
  origin: "null",
};

const modSrc = fs.readFileSync(
  path.join(__dirname, "../../Voice_Biometric/voice_standards.js"),
  "utf8",
);
vm.runInThisContext(modSrc, {
  filename: path.resolve(__dirname, "../../Voice_Biometric/voice_standards.js"),
});

const VS = globalThis.VoiceStandards;
if (!VS) throw new Error("VoiceStandards failed to attach to window");

// ── CBEFF constants (verified: IBIA registry + Part 13 Table 1) ──
describe("VoiceStandards CBEFF constants", () => {
  it("FORMAT_OWNER is 0x0101 (257, ISO/IEC JTC 1/SC 37)", () => {
    assert.equal(VS.CBEFF.FORMAT_OWNER, 0x0101);
    assert.equal(VS.CBEFF.FORMAT_OWNER, 257);
  });

  it("FORMAT_TYPE is 0x001F (31, voice-data)", () => {
    assert.equal(VS.CBEFF.FORMAT_TYPE, 0x001f);
    assert.equal(VS.CBEFF.FORMAT_TYPE, 31);
  });

  it("ASN.1 OID resolves owner 257 / type 31", () => {
    assert.equal(VS.CBEFF.OID, "1.1.19785.0.257.0.31");
  });

  it("BIOMETRIC_TYPE_VOICE is 0x04 (NISTIR 6529-A)", () => {
    assert.equal(VS.CBEFF.BIOMETRIC_TYPE_VOICE, 0x04);
  });

  it("BIR_HEADER_TYPE_BDB is 0x00", () => {
    assert.equal(VS.CBEFF.BIR_HEADER_TYPE_BDB, 0x00);
  });
});

// ── Version / namespace / root element ──
describe("VoiceStandards version + XML identity", () => {
  it("VERSION is 1.0", () => {
    assert.equal(VS.VERSION.major, 1);
    assert.equal(VS.VERSION.minor, 0);
  });

  it("NAMESPACE uses the RFC 5141 urn pattern (INFERRED vdi NSS)", () => {
    assert.equal(VS.NAMESPACE, "urn:iso:std:iso-iec:19794:-13:ed-1:tech:vdi");
  });

  it("ROOT_ELEMENT is VoiceRecord", () => {
    assert.equal(VS.ROOT_ELEMENT, "VoiceRecord");
  });
});

// ── Enum maps (exact strings from Tables 3-4) ──
function enumWords(enumMap) {
  return Object.keys(enumMap)
    .filter((k) => k !== "DEFAULT")
    .map((k) => enumMap[k]);
}

describe("VoiceStandards enum maps", () => {
  it("CHANNEL_TYPE has the 6 exact words + default Unknown", () => {
    assert.deepEqual(
      enumWords(VS.CHANNEL_TYPE).sort(),
      [
        "Analog",
        "Digital",
        "DigitalVoIP",
        "Mixed",
        "NonVoIP",
        "Unknown",
      ].sort(),
    );
    assert.equal(VS.CHANNEL_TYPE.DEFAULT, "Unknown");
  });

  it("TRANSDUCER_TECHNOLOGY has 7 exact words + default Telephone", () => {
    assert.deepEqual(
      enumWords(VS.TRANSDUCER_TECHNOLOGY).sort(),
      [
        "Handheld",
        "Microphone",
        "Mobile phone",
        "Other",
        "Stethoscope",
        "Telephone",
        "Unknown",
      ].sort(),
    );
    assert.equal(VS.TRANSDUCER_TECHNOLOGY.DEFAULT, "Telephone");
  });

  it("MICROPHONE_TYPE has the 4 exact words", () => {
    assert.deepEqual(
      enumWords(VS.MICROPHONE_TYPE).sort(),
      ["Carbon", "Electret", "Other", "Unknown"].sort(),
    );
  });
});

// ── Range constants (Table 5 + 7.3.4.3) ──
describe("VoiceStandards range constants", () => {
  it("CHANNEL_COUNT 1-15 default 1", () => {
    assert.equal(VS.CHANNEL_COUNT.MIN, 1);
    assert.equal(VS.CHANNEL_COUNT.MAX, 15);
    assert.equal(VS.CHANNEL_COUNT.DEFAULT, 1);
  });

  it("SAMPLE_RATE 0-128000", () => {
    assert.equal(VS.SAMPLE_RATE.MAX, 128000);
    assert.equal(VS.SAMPLE_RATE.MIN, 0);
  });

  it("BITS_PER_SAMPLE 0-255 (0 = variable)", () => {
    assert.equal(VS.BITS_PER_SAMPLE.MAX, 255);
    assert.equal(VS.BITS_PER_SAMPLE.MIN, 0);
  });

  it("CUTOFF_FREQUENCY 0-65535", () => {
    assert.equal(VS.CUTOFF_FREQUENCY.MAX, 65535);
    assert.equal(VS.CUTOFF_FREQUENCY.MIN, 0);
  });

  it("COUNTRY_CODE_LENGTH = 3", () => {
    assert.equal(VS.COUNTRY_CODE_LENGTH, 3);
  });
});

// ── captureDeviceInfo / validateDeviceInfo ──
describe("VoiceStandards capture device", () => {
  it("captureDeviceInfo returns device info", () => {
    const info = VS.captureDeviceInfo();
    assert.ok(info);
    assert.equal(typeof info.userAgent, "string");
  });

  it("validateDeviceInfo returns a valid flag", () => {
    const r = VS.validateDeviceInfo({ userAgent: "test", deviceType: 3 });
    assert.equal(typeof r.valid, "boolean");

    const bad = VS.validateDeviceInfo(null);
    assert.equal(bad.valid, false);
    assert.ok(bad.warnings.length > 0);
  });
});

// ── createRecord ──
describe("VoiceStandards.createRecord", () => {
  it("throws when audioMetaInfo is missing (Table 2 M)", () => {
    assert.throws(
      () => VS.createRecord({ audioContent: "ITU-T G.711 PCM" }),
      /audioMetaInfo is required/,
    );
  });

  it("throws when audioContent is missing (Table 6 M)", () => {
    assert.throws(
      () => VS.createRecord({ audioMetaInfo: { channelCount: 1 } }),
      /audioContent is required/,
    );
  });

  it("builds a record with defaults", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
    });
    assert.ok(rec);
    assert.equal(rec.recordVersion.major, 1);
    assert.equal(rec.recordVersion.minor, 0);
    // Channel default = Unknown
    assert.equal(rec.channel.type, "Unknown");
    assert.equal(rec.channel.cutoffUpperFrequency, 0);
    assert.equal(rec.channel.cutoffLowerFrequency, 0);
    // AudioMetaInformation default channel count = 1
    assert.equal(rec.audioMetaInfo.channelCount, 1);
    // ≥1 representation per §7.4.1
    assert.ok(rec.representations.length >= 1);
    assert.equal(rec.representations[0].audioContent, "pcm");
  });

  it("passes through capture device / transducer / sessionId", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 2, samplingRate: 16000 },
      audioContent: "pcm",
      sessionId: "sess-1",
      channel: {
        type: "Digital",
        cutoffUpperFrequency: 8000,
        cutoffLowerFrequency: 100,
      },
      transducer: {
        captureTechnologyID: "Microphone",
        microphoneType: "Electret",
      },
      captureDevice: { organization: "Vendor", id: "MicModel1" },
    });
    assert.equal(rec.sessionId, "sess-1");
    assert.equal(rec.channel.type, "Digital");
    assert.equal(rec.channel.cutoffUpperFrequency, 8000);
    assert.equal(rec.transducer.captureTechnologyID, "Microphone");
    assert.equal(rec.transducer.microphoneType, "Electret");
    assert.equal(rec.captureDevice.organization, "Vendor");
    assert.equal(rec.captureDevice.id, "MicModel1");
  });

  it("keeps explicit representations when provided", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "raw",
      representations: [{ audioContent: "enhanced" }, { audioContent: "raw" }],
    });
    assert.equal(rec.representations.length, 2);
    assert.equal(rec.representations[1].audioContent, "raw");
  });
});

// ── validateRecord ──
function mockRecord(overrides) {
  return Object.assign(
    {
      recordVersion: { major: 1, minor: 0 },
      sessionId: "s",
      channel: {
        type: "Digital",
        cutoffUpperFrequency: 8000,
        cutoffLowerFrequency: 100,
      },
      captureDevice: { organization: "V", id: "M1" },
      transducer: {
        captureTechnologyID: "Microphone",
        microphoneType: "Electret",
      },
      audioMetaInfo: {
        channelCount: 1,
        samplingRate: 16000,
        bitsPerSample: 16,
        audioDuration: 2000,
      },
      representations: [{ audioContent: "pcm" }],
    },
    overrides || {},
  );
}

describe("VoiceStandards.validateRecord", () => {
  it("valid record → valid", () => {
    const r = VS.validateRecord(mockRecord());
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  it("null record → invalid", () => {
    const r = VS.validateRecord(null);
    assert.equal(r.valid, false);
    assert.ok(r.errors.length > 0);
  });

  it("missing channel → error (Table 2 M)", () => {
    const rec = mockRecord();
    delete rec.channel;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("channel")));
  });

  it("invalid channel.type → error", () => {
    const r = VS.validateRecord(mockRecord({ channel: { type: "Radio" } }));
    assert.ok(r.errors.some((e) => e.includes("type")));
  });

  it("cutoff frequency above 65535 → error", () => {
    const rec = mockRecord();
    rec.channel.cutoffUpperFrequency = 100000;
    const r = VS.validateRecord(rec);
    assert.ok(
      r.errors.some((e) => e.includes("cutoff") || e.includes("65535")),
    );
  });

  it("country code wrong length → error", () => {
    const rec = mockRecord();
    rec.channel.countryOfOrigin = "USA1";
    const r = VS.validateRecord(rec);
    assert.ok(r.errors.some((e) => e.includes("country")));
  });

  it("missing audioMetaInfo → error (Table 2 M)", () => {
    const rec = mockRecord();
    delete rec.audioMetaInfo;
    const r = VS.validateRecord(rec);
    assert.ok(r.errors.some((e) => e.includes("audioMetaInfo")));
  });

  it("channelCount out of 1-15 → error", () => {
    const a = mockRecord();
    a.audioMetaInfo.channelCount = 0;
    assert.equal(VS.validateRecord(a).valid, false);
    const b = mockRecord();
    b.audioMetaInfo.channelCount = 16;
    assert.equal(VS.validateRecord(b).valid, false);
    const c = mockRecord();
    c.audioMetaInfo.channelCount = 15;
    assert.equal(VS.validateRecord(c).valid, true);
  });

  it("samplingRate outside 0-128000 → error", () => {
    const a = mockRecord();
    a.audioMetaInfo.samplingRate = -1;
    assert.equal(VS.validateRecord(a).valid, false);
    const b = mockRecord();
    b.audioMetaInfo.samplingRate = 128001;
    assert.equal(VS.validateRecord(b).valid, false);
  });

  it("bitsPerSample outside 0-255 → error", () => {
    const a = mockRecord();
    a.audioMetaInfo.bitsPerSample = 256;
    assert.equal(VS.validateRecord(a).valid, false);
    const b = mockRecord();
    b.audioMetaInfo.bitsPerSample = 0;
    assert.equal(VS.validateRecord(b).valid, true);
  });

  it("missing representations → error (§7.4.1 minimum one)", () => {
    const rec = mockRecord();
    delete rec.representations;
    const r = VS.validateRecord(rec);
    assert.ok(r.errors.some((e) => e.includes("representations")));
  });

  it("representation missing audioContent → error (Table 6 M)", () => {
    const rec = mockRecord();
    rec.representations = [{ quality: { score: 80 } }];
    const r = VS.validateRecord(rec);
    assert.ok(r.errors.some((e) => e.includes("audioContent")));
  });

  it("invalid transducer technology → error", () => {
    const rec = mockRecord();
    rec.transducer.captureTechnologyID = "WarpDrive";
    assert.equal(VS.validateRecord(rec).valid, false);
  });

  it("quality outside 0-100/255 → error", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 101 };
    assert.equal(VS.validateRecord(rec).valid, false);
    rec.representations[0].quality = { score: 255 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.includes("quality")));
  });

  it("extendedVendorData over 256 → error", () => {
    const rec = mockRecord();
    rec.extendedVendorData = "x".repeat(257);
    assert.equal(VS.validateRecord(rec).valid, false);
    const ok = mockRecord();
    ok.extendedVendorData = "x".repeat(256);
    assert.equal(VS.validateRecord(ok).valid, true);
  });
});

// ── serialize ──
describe("VoiceStandards.serialize", () => {
  it("returns an XML string with declaration and root", () => {
    const xml = VS.serialize(mockRecord());
    assert.equal(typeof xml, "string");
    assert.ok(xml.startsWith('<?xml version="1.0"'));
    assert.ok(xml.includes("<VoiceRecord"));
  });

  it("includes the urn namespace", () => {
    const xml = VS.serialize(mockRecord());
    assert.ok(xml.includes("urn:iso:std:iso-iec:19794:-13:ed-1:tech:vdi"));
  });

  it("includes version element", () => {
    const xml = VS.serialize(mockRecord());
    assert.ok(xml.includes("<Version>1.0</Version>"));
  });

  it("includes audioMetaInformation values", () => {
    const xml = VS.serialize(mockRecord());
    assert.ok(xml.includes("<ChannelCount>1</ChannelCount>"));
    assert.ok(xml.includes("<SamplingRate>16000</SamplingRate>"));
    assert.ok(xml.includes("<BitsPerSample>16</BitsPerSample>"));
    assert.ok(xml.includes("<AudioDuration>2000</AudioDuration>"));
  });

  it("escapes audioContent text", () => {
    const rec = mockRecord();
    rec.representations[0].audioContent = "a<b&c>\"d'e";
    const xml = VS.serialize(rec);
    assert.ok(xml.includes("a&lt;b&amp;c&gt;"));
  });

  it("throws on invalid record", () => {
    assert.throws(() => VS.serialize({}), /Invalid record/);
  });
});

// ── deserialize ──
describe("VoiceStandards.deserialize", () => {
  it("round-trips a full record", () => {
    const rec = mockRecord();
    rec.channel = {
      type: "DigitalVoIP",
      cutoffUpperFrequency: 4000,
      cutoffLowerFrequency: 300,
    };
    rec.transducer = {
      captureTechnologyID: "Mobile phone",
      microphoneType: "Carbon",
      manufacturer: "Acme",
    };
    rec.audioMetaInfo = {
      channelCount: 2,
      samplingRate: 48000,
      bitsPerSample: 24,
      audioDuration: 1500,
    };
    const xml = VS.serialize(rec);
    const out = VS.deserialize(xml);
    assert.equal(out.recordVersion.major, 1);
    assert.equal(out.channel.type, "DigitalVoIP");
    assert.equal(out.channel.cutoffUpperFrequency, 4000);
    assert.equal(out.transducer.captureTechnologyID, "Mobile phone");
    assert.equal(out.transducer.microphoneType, "Carbon");
    assert.equal(out.audioMetaInfo.channelCount, 2);
    assert.equal(out.audioMetaInfo.samplingRate, 48000);
    assert.equal(out.audioMetaInfo.bitsPerSample, 24);
    assert.equal(out.audioMetaInfo.audioDuration, 1500);
    assert.equal(out.representations.length, 1);
  });

  it("round-trips multiple representations (raw + enhanced)", () => {
    const rec = mockRecord();
    rec.representations = [
      { audioContent: "raw" },
      { audioContent: "enhanced" },
    ];
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.representations.length, 2);
    assert.equal(out.representations[0].audioContent, "raw");
    assert.equal(out.representations[1].audioContent, "enhanced");
  });

  it("round-trips escaped content and quality score", () => {
    const rec = mockRecord();
    rec.representations[0].audioContent = "a<b&c";
    rec.representations[0].quality = { score: 88 };
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.representations[0].audioContent, "a<b&c");
    assert.equal(out.representations[0].quality.score, 88);
  });

  it("round-trips optional extendedVendorData and captureProcessProtocol", () => {
    const rec = mockRecord();
    rec.captureProcessProtocol = "pipeline-v1";
    rec.extendedVendorData = "vendor.xyz";
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.captureProcessProtocol, "pipeline-v1");
    assert.equal(out.extendedVendorData, "vendor.xyz");
  });

  it("throws on empty / non-XML input", () => {
    assert.throws(() => VS.deserialize(""), /xml|XML|parse/i);
    assert.throws(() => VS.deserialize("hello"), /parse/i);
  });

  it("throws on unknown root element", () => {
    assert.throws(
      () => VS.deserialize('<?xml version="1.0"?><FingerImage/>'),
      /VoiceRecord/,
    );
  });

  it("throws on unclosed tag", () => {
    const xml = VS.serialize(mockRecord()).replace("</VoiceRecord>", "");
    assert.throws(() => VS.deserialize(xml), /parse|unclosed|expected/i);
  });

  it("throws on mismatched close tag", () => {
    const xml = VS.serialize(mockRecord()).replace(
      "</Channel>",
      "</Transducer>",
    );
    assert.throws(() => VS.deserialize(xml), /mismatch|unexpected/i);
  });
});

// ── createBIR ──
describe("VoiceStandards.createBIR", () => {
  it("builds sbh with verified constants", () => {
    const bir = VS.createBIR(mockRecord());
    assert.ok(bir);
    assert.equal(bir.sbh.bdbFormatOwner, 0x0101);
    assert.equal(bir.sbh.bdbFormatType, 0x001f);
    assert.equal(bir.sbh.biometricType, 0x04);
    assert.equal(bir.sbh.oid, "1.1.19785.0.257.0.31");
  });

  it("bdb is the XML VoiceRecord payload", () => {
    const bir = VS.createBIR(mockRecord());
    assert.ok(bir.bdb instanceof Uint8Array);
    const text = Buffer.from(bir.bdb).toString("utf8");
    assert.ok(text.includes("<VoiceRecord"));
    assert.ok(text.includes("urn:iso:std:iso-iec:19794:-13:ed-1:tech:vdi"));
  });

  it("totalSize is a positive number", () => {
    const bir = VS.createBIR(mockRecord());
    assert.equal(typeof bir.totalSize, "number");
    assert.ok(bir.totalSize > 0);
  });

  it("throws for null record", () => {
    assert.throws(() => VS.createBIR(null), /required/);
  });

  it("populates qualityBlocks when representation has quality score", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 85 };
    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.qualityBlocks.length, 1);
    assert.equal(bir.sbh.qualityBlocks[0].qualityScore, 85);
    assert.equal(bir.sbh.qualityBlocks[0].qualityAlgorithmVendor, 0x0101);
    assert.equal(bir.sbh.qualityBlocks[0].qualityAlgorithmId, 0);
  });

  it("qualityBlocks is empty when no quality score", () => {
    const rec = mockRecord();
    delete rec.representations[0].quality;
    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.qualityBlocks.length, 0);
  });

  it("uses VERSION from record.recordVersion when present", () => {
    const rec = mockRecord();
    rec.recordVersion = { major: 1, minor: 0 };
    const bir = VS.createBIR(rec);
    assert.deepEqual(bir.sbh.version, rec.recordVersion);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _classifyDeviceType (lines 210-214)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._classifyDeviceType (branch coverage)", () => {
  it("returns 0 for empty/undefined UA (line 210)", () => {
    assert.equal(VS._classifyDeviceType(""), 0);
    assert.equal(VS._classifyDeviceType(undefined), 0);
    assert.equal(VS._classifyDeviceType(null), 0);
  });

  it("returns 1 for mobile/Android UA (line 212)", () => {
    assert.equal(VS._classifyDeviceType("Mozilla/5.0 (Linux; Android 10)"), 1);
    assert.equal(VS._classifyDeviceType("Some Mobile Browser"), 1);
  });

  it("returns 2 for tablet/iPad UA (line 213)", () => {
    assert.equal(VS._classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 15)"), 2);
    assert.equal(VS._classifyDeviceType("Samsung Tablet Browser"), 2);
  });

  it("returns 3 for desktop UA (line 214)", () => {
    assert.equal(
      VS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
      3,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: validateDeviceInfo warning branches (lines 229-238)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.validateDeviceInfo (branch coverage)", () => {
  it("warns when vendor is 'unknown' (line 229)", () => {
    const r = VS.validateDeviceInfo({
      vendor: "unknown",
      deviceType: 3,
      userAgent: "test",
    });
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.includes("vendor")));
  });

  it("warns when vendor is empty string (line 229)", () => {
    const r = VS.validateDeviceInfo({
      vendor: "",
      deviceType: 3,
      userAgent: "test",
    });
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.includes("vendor")));
  });

  it("warns when deviceType is 0 (line 232)", () => {
    const r = VS.validateDeviceInfo({
      vendor: "Intel",
      deviceType: 0,
      userAgent: "test",
    });
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.includes("Device type")));
  });

  it("warns when userAgent is 'unknown' (line 235)", () => {
    const r = VS.validateDeviceInfo({
      vendor: "Intel",
      deviceType: 3,
      userAgent: "unknown",
    });
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.includes("User agent")));
  });

  it("warns when userAgent is empty (line 235)", () => {
    const r = VS.validateDeviceInfo({
      vendor: "Intel",
      deviceType: 3,
      userAgent: "",
    });
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.includes("User agent")));
  });

  it("valid when all fields present and known", () => {
    const r = VS.validateDeviceInfo({
      vendor: "Intel",
      deviceType: 3,
      userAgent: "Mozilla/5.0",
    });
    assert.equal(r.valid, true);
    assert.equal(r.warnings.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: createRecord defaulting branches (lines 283-305)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.createRecord (defaulting branch coverage)", () => {
  it("defaults channel.type when channel provided without type (line 283)", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      channel: { cutoffUpperFrequency: 4000, cutoffLowerFrequency: 100 },
    });
    assert.equal(rec.channel.type, "Unknown");
    assert.equal(rec.channel.cutoffUpperFrequency, 4000);
    assert.equal(rec.channel.cutoffLowerFrequency, 100);
  });

  it("defaults channel.cutoffUpperFrequency when undefined (lines 284-285)", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      channel: { type: "Digital" },
    });
    assert.equal(rec.channel.cutoffUpperFrequency, 0);
  });

  it("defaults channel.cutoffLowerFrequency when undefined (lines 287-288)", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      channel: { type: "Digital" },
    });
    assert.equal(rec.channel.cutoffLowerFrequency, 0);
  });

  it("defaults channelCount when audioMetaInfo has no channelCount (line 305)", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { samplingRate: 16000 },
      audioContent: "pcm",
    });
    assert.equal(rec.audioMetaInfo.channelCount, 1);
  });

  it("preserves explicit channelCount when provided", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 5 },
      audioContent: "pcm",
    });
    assert.equal(rec.audioMetaInfo.channelCount, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: validateRecord branches (lines 450, 483-488, 507)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.validateRecord (additional branch coverage)", () => {
  it("errors on negative audioDuration (line 450)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.audioDuration = -1;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("audioDuration")));
  });

  it("errors on non-number audioDuration (line 448)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.audioDuration = "long";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("audioDuration")));
  });

  it("errors on invalid microphoneType (lines 483-488)", () => {
    const rec = mockRecord();
    rec.transducer.microphoneType = "WarpDrive";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("microphoneType")));
  });

  it("errors when quality.score is not a number (line 507)", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: "bad" };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("quality.score")));
  });

  it("warns on quality score 255 (failed) (line 509)", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 255 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.includes("quality calculation failed")));
  });

  it("valid record with channelCount exactly 1 (boundary)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.channelCount = 1;
    assert.equal(VS.validateRecord(rec).valid, true);
  });

  it("valid record with channelCount exactly 15 (boundary)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.channelCount = 15;
    assert.equal(VS.validateRecord(rec).valid, true);
  });

  it("errors on samplingRate of wrong type (string)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.samplingRate = "fast";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("samplingRate")));
  });

  it("errors on bitsPerSample of wrong type (string)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.bitsPerSample = "high";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("bitsPerSample")));
  });

  it("errors on negative bitsPerSample", () => {
    const rec = mockRecord();
    rec.audioMetaInfo.bitsPerSample = -1;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
  });

  it("errors on cutoffLowerFrequency below range", () => {
    const rec = mockRecord();
    rec.channel.cutoffLowerFrequency = -1;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("cutoffLowerFrequency")));
  });

  it("errors on cutoffLowerFrequency above range", () => {
    const rec = mockRecord();
    rec.channel.cutoffLowerFrequency = 99999;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("cutoffLowerFrequency")));
  });

  it("errors when transducer present without captureTechnologyID (valid path)", () => {
    const rec = mockRecord();
    rec.transducer = { microphoneType: "Electret" };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("errors on empty representations array (line 495)", () => {
    const rec = mockRecord();
    rec.representations = [];
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("representations")));
  });

  it("errors on representations that is not an array (line 494)", () => {
    const rec = mockRecord();
    rec.representations = "not-an-array";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("representations")));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _unescapeXml (line 730)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._unescapeXml (branch coverage)", () => {
  it("returns falsy values as-is (line 730)", () => {
    assert.equal(VS._unescapeXml(null), null);
    assert.equal(VS._unescapeXml(undefined), undefined);
    assert.equal(VS._unescapeXml(""), "");
  });

  it("unescapes all five XML entities", () => {
    const input = "&lt; &gt; &amp; &quot; &apos;";
    const result = VS._unescapeXml(input);
    assert.equal(result, "< > & \" '");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _escapeXml (line 550-557)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._escapeXml (additional coverage)", () => {
  it("escapes all five special characters", () => {
    const result = VS._escapeXml("<tag>\"'&</tag>");
    assert.equal(result, "&lt;tag&gt;&quot;&apos;&amp;&lt;/tag&gt;");
  });

  it("handles non-string input by coercing to string", () => {
    assert.equal(VS._escapeXml(123), "123");
    assert.equal(VS._escapeXml(true), "true");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _optEl (line 583-586)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._optEl (branch coverage)", () => {
  it("returns empty for undefined", () => {
    assert.equal(VS._optEl("Foo", undefined), "");
  });

  it("returns empty for null", () => {
    assert.equal(VS._optEl("Foo", null), "");
  });

  it("returns empty for empty string", () => {
    assert.equal(VS._optEl("Foo", ""), "");
  });

  it("returns element for non-empty value", () => {
    assert.equal(VS._optEl("Foo", "bar"), "<Foo>bar</Foo>");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _parseXml error branches (lines 752-918)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._parseXml (error branch coverage)", () => {
  it("throws on empty string (line 756)", () => {
    assert.throws(() => VS._parseXml(""), /no XML input/);
  });

  it("throws on null input (line 756)", () => {
    assert.throws(() => VS._parseXml(null), /no XML input/);
  });

  it("throws on whitespace-only input (line 911)", () => {
    assert.throws(() => VS._parseXml("   "), /no XML input/);
  });

  it("strips BOM and parses (line 764)", () => {
    const xmlWithBOM = "\ufeff" + VS.serialize(mockRecord());
    const root = VS._parseXml(xmlWithBOM);
    assert.equal(root.name, "VoiceRecord");
  });

  it("throws on unterminated XML declaration (line 769)", () => {
    assert.throws(
      () => VS._parseXml('<?xml version="1.0"?>'),
      /unterminated|no XML input/,
    );
  });

  it("throws on comment in XML (line 797 via 801)", () => {
    assert.throws(
      () => VS._parseXml('<?xml version="1.0"?><!-- comment --><VoiceRecord/>'),
      /doctype|processing instruction/,
    );
  });

  it("throws on CDATA in XML (line 799)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><![CDATA[data]]></VoiceRecord>',
        ),
      /CDATA/,
    );
  });

  it("throws on doctype in XML (line 801-802)", () => {
    assert.throws(
      () => VS._parseXml('<?xml version="1.0"?><!DOCTYPE foo><VoiceRecord/>'),
      /doctype|processing instruction/,
    );
  });

  it("throws on processing instruction (line 801-802)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><?mso-application progid="Word.Document"?><VoiceRecord/>',
        ),
      /processing instruction|doctype/,
    );
  });

  it("throws on empty element name (line 810)", () => {
    assert.throws(() => VS._parseXml("<>"), /empty element name/);
  });

  it("throws on unterminated open tag (line 815/875)", () => {
    assert.throws(
      () => VS._parseXml("<VoiceRecord"),
      /unclosed element|parse error/,
    );
  });

  it("throws on invalid self-closing tag (lines 821-822)", () => {
    assert.throws(
      () => VS._parseXml("<VoiceRecord/x>"),
      /invalid self-closing tag/,
    );
  });

  it("throws on invalid attribute (line 838)", () => {
    assert.throws(
      () => VS._parseXml('<VoiceRecord = "bad"/>'),
      /invalid attribute|expected/,
    );
  });

  it("throws on missing = in attribute (line 840)", () => {
    assert.throws(
      () => VS._parseXml('<VoiceRecord xmlns "urn:x"/>'),
      /expected.*=|invalid/,
    );
  });

  it("throws on unquoted attribute value (line 844)", () => {
    assert.throws(
      () => VS._parseXml("<VoiceRecord xmlns=urn:x/>"),
      /expected quoted attribute value/,
    );
  });

  it("throws on unterminated attribute value (line 850)", () => {
    assert.throws(
      () => VS._parseXml('<VoiceRecord xmlns="urn:x>'),
      /unterminated attribute value/,
    );
  });

  it("throws on trailing content after root (lines 917-918)", () => {
    const xml = VS.serialize(mockRecord()) + "<Extra/>";
    assert.throws(() => VS._parseXml(xml), /unexpected content/);
  });

  it("throws on comment inside element children (line 895-896)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><!-- comment --></VoiceRecord>',
        ),
      /comment/,
    );
  });

  it("throws on CDATA inside element children (line 897-898)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><![CDATA[data]]></VoiceRecord>',
        ),
      /CDATA/,
    );
  });

  it("throws on doctype inside element children (line 899)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><!DOCTYPE foo></VoiceRecord>',
        ),
      /doctype/,
    );
  });

  it("throws on processing instruction inside children (line 900-901)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><?mso-application progid="Word"?></VoiceRecord>',
        ),
      /processing instruction/,
    );
  });

  it("throws on text content after child elements (line 870)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><Child/>text</VoiceRecord>',
        ),
      /unexpected text/,
    );
  });

  it("throws on self-closing tag inside content with trailing text (line 870)", () => {
    assert.throws(
      () =>
        VS._parseXml(
          '<?xml version="1.0"?><VoiceRecord><Child/>text</VoiceRecord>',
        ),
      /unexpected text|parse error/,
    );
  });

  it("throws on malformed close tag without > (line 885)", () => {
    assert.throws(
      () => VS._parseXml('<?xml version="1.0"?><VoiceRecord</VoiceRecord>'),
      /parse error|unclosed|malformed/,
    );
  });

  it("non-XML text that starts with <", () => {
    assert.throws(() => VS._parseXml("<not xml at all"), /parse error/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _xmlToRecord branches (lines 975-1070)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._xmlToRecord (branch coverage)", () => {
  it("round-trips Version with major.minor parts (lines 996-999)", () => {
    const rec = mockRecord();
    rec.recordVersion = { major: 1, minor: 0 };
    const xml = VS.serialize(rec);
    const out = VS.deserialize(xml);
    assert.equal(out.recordVersion.major, 1);
    assert.equal(out.recordVersion.minor, 0);
  });

  it("skips non-Representation children in RepresentationList (line 1055)", () => {
    const rec = mockRecord();
    rec.representations = [{ audioContent: "raw" }];
    const xml = VS.serialize(rec);
    // Insert a non-Representation element inside RepresentationList
    const modified = xml.replace(
      "</RepresentationList>",
      "<UnknownChild>data</UnknownChild></RepresentationList>",
    );
    // This should either throw or skip the unknown child
    try {
      const out = VS.deserialize(modified);
      // If it doesn't throw, representations should still have 1 entry
      assert.equal(out.representations.length, 1);
    } catch (e) {
      // It may throw on unknown element in default case - that's expected
      assert.ok(e.message.includes("unexpected element"));
    }
  });

  it("throws on unexpected root element (line 957)", () => {
    const xml = '<?xml version="1.0"?><UnknownRoot/>';
    assert.throws(() => VS.deserialize(xml), /unknown root element/);
  });

  it("throws on unexpected element at top level (line 1069-1070)", () => {
    const rec = mockRecord();
    const xml = VS.serialize(rec);
    // Insert unexpected element at root level after VoiceRecord starts
    const modified = xml.replace(
      "</VoiceRecord>",
      "<UnexpectedElement/>  </VoiceRecord>",
    );
    assert.throws(
      () => VS.deserialize(modified),
      /unexpected element|unexpected content/,
    );
  });

  it("deserializes record with session and captureDevice (lines 1003-1019)", () => {
    const rec = mockRecord();
    rec.sessionId = "sess-99";
    rec.captureDevice = { organization: "Acme", id: "MDL-1" };
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.sessionId, "sess-99");
    assert.equal(out.captureDevice.organization, "Acme");
    assert.equal(out.captureDevice.id, "MDL-1");
  });

  it("deserializes record with full transducer fields (lines 1023-1033)", () => {
    const rec = mockRecord();
    rec.transducer = {
      captureTechnologyID: "Microphone",
      microphoneType: "Electret",
      manufacturer: "Acme",
      model: "V200",
      micCutoffUpper: 8000,
      micCutoffLower: 100,
      deviceInfo: "custom-info",
    };
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.transducer.manufacturer, "Acme");
    assert.equal(out.transducer.model, "V200");
    assert.equal(out.transducer.micCutoffUpper, 8000);
    assert.equal(out.transducer.micCutoffLower, 100);
    assert.equal(out.transducer.deviceInfo, "custom-info");
  });

  it("deserializes record with all audioMetaInfo fields (lines 1035-1042)", () => {
    const rec = mockRecord();
    rec.audioMetaInfo = {
      channelCount: 2,
      samplingRate: 44100,
      bitsPerSample: 16,
      audioDuration: 5000,
    };
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.audioMetaInfo.channelCount, 2);
    assert.equal(out.audioMetaInfo.samplingRate, 44100);
    assert.equal(out.audioMetaInfo.bitsPerSample, 16);
    assert.equal(out.audioMetaInfo.audioDuration, 5000);
  });

  it("deserializes record with captureProcessProtocol and extendedVendorData (lines 1044-1051)", () => {
    const rec = mockRecord();
    rec.captureProcessProtocol = "proto-v2";
    rec.extendedVendorData = "vendor-data-123";
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.captureProcessProtocol, "proto-v2");
    assert.equal(out.extendedVendorData, "vendor-data-123");
  });

  it("deserializes representations with quality and all sub-fields (lines 1052-1067)", () => {
    const rec = mockRecord();
    rec.representations = [
      {
        dateAndTime: "2024-01-01T00:00:00Z",
        audioContent: "raw",
        quality: { score: 90 },
        signalEnhancement: "denoise-v1",
        extendedVendorData: "rep-vendor",
      },
    ];
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.representations[0].dateAndTime, "2024-01-01T00:00:00Z");
    assert.equal(out.representations[0].quality.score, 90);
    assert.equal(out.representations[0].signalEnhancement, "denoise-v1");
    assert.equal(out.representations[0].extendedVendorData, "rep-vendor");
  });

  it("deserializes representations without quality", () => {
    const rec = mockRecord();
    rec.representations = [{ audioContent: "raw" }];
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.representations[0].quality, undefined);
  });

  it("countryOfOrigin round-trips correctly", () => {
    const rec = mockRecord();
    rec.channel.countryOfOrigin = "JPN";
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.channel.countryOfOrigin, "JPN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _isNumericElement (line 931-943)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._isNumericElement (coverage)", () => {
  it("returns true for numeric element names", () => {
    assert.equal(VS._isNumericElement("CutoffUpperFrequency"), true);
    assert.equal(VS._isNumericElement("CutoffLowerFrequency"), true);
    assert.equal(VS._isNumericElement("MicCutoffUpper"), true);
    assert.equal(VS._isNumericElement("MicCutoffLower"), true);
    assert.equal(VS._isNumericElement("ChannelCount"), true);
    assert.equal(VS._isNumericElement("SamplingRate"), true);
    assert.equal(VS._isNumericElement("BitsPerSample"), true);
    assert.equal(VS._isNumericElement("AudioDuration"), true);
    assert.equal(VS._isNumericElement("Score"), true);
  });

  it("returns false for non-numeric element names", () => {
    assert.equal(VS._isNumericElement("Type"), false);
    assert.equal(VS._isNumericElement("AudioContent"), false);
    assert.equal(VS._isNumericElement("Version"), false);
    assert.equal(VS._isNumericElement(""), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: serialize optional element branches (lines 692-714)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.serialize (additional branches)", () => {
  it("omits SessionId when not set", () => {
    const rec = mockRecord();
    delete rec.sessionId;
    const xml = VS.serialize(rec);
    assert.ok(!xml.includes("<SessionId>"));
  });

  it("includes captureDevice block", () => {
    const rec = mockRecord();
    rec.captureDevice = { organization: "Org", id: "ID1" };
    const xml = VS.serialize(rec);
    assert.ok(xml.includes("<CaptureDevice>"));
    assert.ok(xml.includes("<Organization>Org</Organization>"));
    assert.ok(xml.includes("<Id>ID1</Id>"));
  });

  it("omits captureDevice when not set", () => {
    const rec = mockRecord();
    delete rec.captureDevice;
    const xml = VS.serialize(rec);
    assert.ok(!xml.includes("<CaptureDevice>"));
  });

  it("includes transducer block with all sub-elements", () => {
    const rec = mockRecord();
    rec.transducer = {
      captureTechnologyID: "Telephone",
      microphoneType: "Carbon",
      manufacturer: "Acme",
      model: "T100",
      micCutoffUpper: 4000,
      micCutoffLower: 300,
      deviceInfo: "info",
    };
    const xml = VS.serialize(rec);
    assert.ok(
      xml.includes("<CaptureTechnologyID>Telephone</CaptureTechnologyID>"),
    );
    assert.ok(xml.includes("<MicrophoneType>Carbon</MicrophoneType>"));
    assert.ok(xml.includes("<Manufacturer>Acme</Manufacturer>"));
    assert.ok(xml.includes("<Model>T100</Model>"));
    assert.ok(xml.includes("<MicCutoffUpper>4000</MicCutoffUpper>"));
    assert.ok(xml.includes("<MicCutoffLower>300</MicCutoffLower>"));
    assert.ok(xml.includes("<DeviceInfo>info</DeviceInfo>"));
  });

  it("omits transducer when not set", () => {
    const rec = mockRecord();
    delete rec.transducer;
    const xml = VS.serialize(rec);
    assert.ok(!xml.includes("<Transducer>"));
  });

  it("includes CaptureProcessProtocol and ExtendedVendorData", () => {
    const rec = mockRecord();
    rec.captureProcessProtocol = "cp-v1";
    rec.extendedVendorData = "vd-123";
    const xml = VS.serialize(rec);
    assert.ok(
      xml.includes("<CaptureProcessProtocol>cp-v1</CaptureProcessProtocol>"),
    );
    assert.ok(xml.includes("<ExtendedVendorData>vd-123</ExtendedVendorData>"));
  });

  it("includes representation sub-elements: dateAndTime, signalEnhancement, extendedVendorData", () => {
    const rec = mockRecord();
    rec.representations = [
      {
        audioContent: "raw",
        dateAndTime: "2024-01-01T00:00:00Z",
        quality: { score: 75 },
        signalEnhancement: "nr-v2",
        extendedVendorData: "rvd",
      },
    ];
    const xml = VS.serialize(rec);
    assert.ok(xml.includes("<DateAndTime>2024-01-01T00:00:00Z</DateAndTime>"));
    assert.ok(xml.includes("<Score>75</Score>"));
    assert.ok(xml.includes("<SignalEnhancement>nr-v2</SignalEnhancement>"));
    assert.ok(xml.includes("<ExtendedVendorData>rvd</ExtendedVendorData>"));
  });

  it("omits Quality block when quality is not set", () => {
    const rec = mockRecord();
    delete rec.representations[0].quality;
    const xml = VS.serialize(rec);
    assert.ok(!xml.includes("<Quality>"));
  });

  it("includes countryOfOrigin in channel when set", () => {
    const rec = mockRecord();
    rec.channel.countryOfOrigin = "USA";
    const xml = VS.serialize(rec);
    assert.ok(xml.includes("<CountryOfOrigin>USA</CountryOfOrigin>"));
  });

  it("omits CountryOfOrigin when not set", () => {
    const rec = mockRecord();
    const xml = VS.serialize(rec);
    assert.ok(!xml.includes("<CountryOfOrigin>"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: captureDeviceInfo (lines 180-182)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.captureDeviceInfo (branch coverage)", () => {
  it("returns device info with expected shape", () => {
    const info = VS.captureDeviceInfo();
    assert.equal(typeof info.vendor, "string");
    assert.equal(typeof info.userAgent, "string");
    assert.equal(typeof info.language, "string");
    assert.equal(typeof info.screenWidth, "number");
    assert.equal(typeof info.screenHeight, "number");
    assert.equal(typeof info.devicePixelRatio, "number");
    assert.equal(typeof info.hardwareConcurrency, "number");
    assert.equal(typeof info.capturedAt, "number");
    assert.equal(typeof info.deviceType, "number");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: deserialize edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.deserialize (additional edge cases)", () => {
  it("handles record with all channel fields populated", () => {
    const rec = mockRecord();
    rec.channel = {
      type: "Analog",
      cutoffUpperFrequency: 3400,
      cutoffLowerFrequency: 300,
      countryOfOrigin: "DEU",
    };
    const out = VS.deserialize(VS.serialize(rec));
    assert.equal(out.channel.type, "Analog");
    assert.equal(out.channel.cutoffUpperFrequency, 3400);
    assert.equal(out.channel.cutoffLowerFrequency, 300);
    assert.equal(out.channel.countryOfOrigin, "DEU");
  });

  it("handles all channel types", () => {
    const types = [
      "Unknown",
      "Analog",
      "Digital",
      "NonVoIP",
      "DigitalVoIP",
      "Mixed",
    ];
    for (const t of types) {
      const rec = mockRecord();
      rec.channel.type = t;
      const out = VS.deserialize(VS.serialize(rec));
      assert.equal(out.channel.type, t);
    }
  });

  it("handles all transducer technologies", () => {
    const techs = [
      "Telephone",
      "Microphone",
      "Handheld",
      "Mobile phone",
      "Stethoscope",
      "Other",
      "Unknown",
    ];
    for (const tech of techs) {
      const rec = mockRecord();
      rec.transducer = { captureTechnologyID: tech };
      const out = VS.deserialize(VS.serialize(rec));
      assert.equal(out.transducer.captureTechnologyID, tech);
    }
  });

  it("handles all microphone types", () => {
    const types = ["Carbon", "Electret", "Other", "Unknown"];
    for (const t of types) {
      const rec = mockRecord();
      rec.transducer = { microphoneType: t };
      const out = VS.deserialize(VS.serialize(rec));
      assert.equal(out.transducer.microphoneType, t);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: serialize with multiple representations (lines 700-713)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.serialize (representation list)", () => {
  it("serializes multiple representations with mixed quality", () => {
    const rec = mockRecord();
    rec.representations = [
      { audioContent: "raw", quality: { score: 60 } },
      { audioContent: "enhanced" },
      {
        audioContent: "processed",
        quality: { score: 255 },
        dateAndTime: "2024-06-01T12:00:00Z",
      },
    ];
    const xml = VS.serialize(rec);
    assert.ok(xml.includes("<RepresentationList>"));
    const repCount = (xml.match(/<Representation>/g) || []).length;
    assert.equal(repCount, 3);
    assert.ok(xml.includes("<AudioContent>raw</AudioContent>"));
    assert.ok(xml.includes("<AudioContent>enhanced</AudioContent>"));
    assert.ok(xml.includes("<AudioContent>processed</AudioContent>"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: validateRecord - complete field validation (lines 350-530)
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.validateRecord (comprehensive)", () => {
  it("errors when recordVersion is missing", () => {
    const rec = mockRecord();
    delete rec.recordVersion;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("recordVersion")));
  });

  it("errors when recordVersion major is wrong", () => {
    const rec = mockRecord();
    rec.recordVersion = { major: 2, minor: 0 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("recordVersion")));
  });

  it("errors when recordVersion minor is wrong", () => {
    const rec = mockRecord();
    rec.recordVersion = { major: 1, minor: 1 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("recordVersion")));
  });

  it("errors when audioMetaInfo is a non-object type", () => {
    const rec = mockRecord();
    rec.audioMetaInfo = "invalid";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("audioMetaInfo")));
  });

  it("errors when channel is a non-object type", () => {
    const rec = mockRecord();
    rec.channel = "invalid";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("channel")));
  });

  it("allows record without captureDevice", () => {
    const rec = mockRecord();
    delete rec.captureDevice;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("allows record without transducer", () => {
    const rec = mockRecord();
    delete rec.transducer;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("allows record without extendedVendorData", () => {
    const rec = mockRecord();
    delete rec.extendedVendorData;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("allows record without samplingRate", () => {
    const rec = mockRecord();
    delete rec.audioMetaInfo.samplingRate;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("allows record without bitsPerSample", () => {
    const rec = mockRecord();
    delete rec.audioMetaInfo.bitsPerSample;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("allows record without audioDuration", () => {
    const rec = mockRecord();
    delete rec.audioMetaInfo.audioDuration;
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("quality score at exact min (0) is valid", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 0 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("quality score at exact max (100) is valid", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 100 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, true);
  });

  it("quality score above max (101) is invalid", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 101 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("quality.score")));
  });

  it("quality score of 254 is invalid (not 255 special)", () => {
    const rec = mockRecord();
    rec.representations[0].quality = { score: 254 };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
  });

  it("representation with null entry is error", () => {
    const rec = mockRecord();
    rec.representations = [null];
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("audioContent")));
  });

  it("representation with empty object is error", () => {
    const rec = mockRecord();
    rec.representations = [{}];
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("audioContent")));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: createRecord - various param combinations
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.createRecord (param combinations)", () => {
  it("creates record with only representations (no audioContent)", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      representations: [{ audioContent: "raw" }],
    });
    assert.equal(rec.representations.length, 1);
    assert.equal(rec.representations[0].audioContent, "raw");
  });

  it("includes captureProcessProtocol when provided", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      captureProcessProtocol: "proto-1",
    });
    assert.equal(rec.captureProcessProtocol, "proto-1");
  });

  it("includes extendedVendorData when provided", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      extendedVendorData: "vendor-x",
    });
    assert.equal(rec.extendedVendorData, "vendor-x");
  });

  it("throws when params is null", () => {
    assert.throws(() => VS.createRecord(null), /audioMetaInfo is required/);
  });

  it("throws when params is undefined", () => {
    assert.throws(
      () => VS.createRecord(undefined),
      /audioMetaInfo is required/,
    );
  });

  it("creates record with quality score in representation", () => {
    const rec = VS.createRecord({
      audioMetaInfo: { channelCount: 1 },
      audioContent: "pcm",
      quality: { score: 80 },
    });
    assert.equal(rec.representations[0].quality.score, 80);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: createBIR additional paths
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.createBIR (additional coverage)", () => {
  it("qualityBlocks empty when representations[0] has no quality property", () => {
    const rec = mockRecord();
    rec.representations = [{ audioContent: "raw" }];
    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.qualityBlocks.length, 0);
  });

  it("qualityBlocks empty when quality.score is undefined (null quality)", () => {
    const rec = mockRecord();
    rec.representations = [{ audioContent: "raw", quality: null }];
    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.qualityBlocks.length, 0);
  });

  it("qualityBlocks empty when representations is empty", () => {
    const rec = mockRecord();
    rec.representations = [];
    // This will throw because validateRecord fails with 0 representations
    assert.throws(() => VS.createBIR(rec), /Invalid record/);
  });

  it("uses deviceInfo from record when present", () => {
    const rec = mockRecord();
    rec.deviceInfo = { vendor: "test", deviceType: 3 };
    const bir = VS.createBIR(rec);
    assert.deepEqual(bir.sbh.deviceInfo, { vendor: "test", deviceType: 3 });
  });

  it("uses creationDate and timestamp from record when present", () => {
    const rec = mockRecord();
    rec.creationDate = "2024-01-01T00:00:00Z";
    rec.timestamp = "2024-01-02T00:00:00Z";
    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.creationDate, "2024-01-01T00:00:00Z");
    assert.equal(bir.sbh.timestamp, "2024-01-02T00:00:00Z");
  });

  it("totalSize includes sbh JSON length plus bdb length", () => {
    const rec = mockRecord();
    const bir = VS.createBIR(rec);
    const expectedSize = JSON.stringify(bir.sbh).length + bir.bdb.length;
    assert.equal(bir.totalSize, expectedSize);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: Validation with all enum values
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards.validateRecord (enum validation)", () => {
  it("accepts all valid channel types", () => {
    const types = [
      "Unknown",
      "Analog",
      "Digital",
      "NonVoIP",
      "DigitalVoIP",
      "Mixed",
    ];
    for (const t of types) {
      const rec = mockRecord();
      rec.channel.type = t;
      const r = VS.validateRecord(rec);
      assert.equal(r.valid, true, `Channel type ${t} should be valid`);
    }
  });

  it("accepts all valid transducer technologies", () => {
    const techs = [
      "Telephone",
      "Microphone",
      "Handheld",
      "Mobile phone",
      "Stethoscope",
      "Other",
      "Unknown",
    ];
    for (const tech of techs) {
      const rec = mockRecord();
      rec.transducer = { captureTechnologyID: tech };
      const r = VS.validateRecord(rec);
      assert.equal(r.valid, true, `Transducer tech ${tech} should be valid`);
    }
  });

  it("accepts all valid microphone types", () => {
    const types = ["Carbon", "Electret", "Other", "Unknown"];
    for (const t of types) {
      const rec = mockRecord();
      rec.transducer = { microphoneType: t };
      const r = VS.validateRecord(rec);
      assert.equal(r.valid, true, `Mic type ${t} should be valid`);
    }
  });

  it("rejects invalid channel type", () => {
    const rec = mockRecord();
    rec.channel.type = "Radio";
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
  });

  it("rejects invalid transducer technology", () => {
    const rec = mockRecord();
    rec.transducer = { captureTechnologyID: "WarpDrive" };
    const r = VS.validateRecord(rec);
    assert.equal(r.valid, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: _parseXml - well-formed XML with various structures
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards._parseXml (well-formed structures)", () => {
  it("parses simple self-closing root", () => {
    const root = VS._parseXml('<?xml version="1.0"?><Root/>');
    assert.equal(root.name, "Root");
    assert.equal(root.children.length, 0);
  });

  it("parses element with text content", () => {
    const root = VS._parseXml('<?xml version="1.0"?><Root>hello</Root>');
    assert.equal(root.text, "hello");
  });

  it("parses element with children", () => {
    const root = VS._parseXml(
      '<?xml version="1.0"?><Root><A>1</A><B>2</B></Root>',
    );
    assert.equal(root.children.length, 2);
    assert.equal(root.children[0].name, "A");
    assert.equal(root.children[1].name, "B");
  });

  it("parses element with attributes", () => {
    const root = VS._parseXml(
      '<?xml version="1.0"?><Root xmlns="test" id="42"/>',
    );
    assert.equal(root.attrs.xmlns, "test");
    assert.equal(root.attrs.id, "42");
  });

  it("parses element with single-quoted attributes", () => {
    const root = VS._parseXml("<?xml version=\"1.0\"?><Root xmlns='test'/>");
    assert.equal(root.attrs.xmlns, "test");
  });

  it("handles nested elements", () => {
    const root = VS._parseXml(
      '<?xml version="1.0"?><Root><A><B>deep</B></A></Root>',
    );
    assert.equal(root.children[0].children[0].text, "deep");
  });

  it("handles escaped text content", () => {
    const root = VS._parseXml('<?xml version="1.0"?><Root>&lt;tag&gt;</Root>');
    assert.equal(root.text, "<tag>");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE: Full integration round-trips
// ═══════════════════════════════════════════════════════════════════════════
describe("VoiceStandards (full integration)", () => {
  it("createRecord → validateRecord → serialize → deserialize full round-trip", () => {
    const rec = VS.createRecord({
      audioMetaInfo: {
        channelCount: 2,
        samplingRate: 44100,
        bitsPerSample: 16,
        audioDuration: 3000,
      },
      audioContent: "pcm-data",
      sessionId: "s-42",
      channel: {
        type: "DigitalVoIP",
        cutoffUpperFrequency: 4000,
        cutoffLowerFrequency: 300,
        countryOfOrigin: "USA",
      },
      captureDevice: { organization: "Acme", id: "Mic-1" },
      transducer: {
        captureTechnologyID: "Mobile phone",
        microphoneType: "Electret",
        manufacturer: "Acme",
        model: "M200",
        micCutoffUpper: 8000,
        micCutoffLower: 100,
        deviceInfo: "dev-info",
      },
      quality: { score: 92 },
      captureProcessProtocol: "cp-v3",
      extendedVendorData: "vendor-ext",
    });

    const vr = VS.validateRecord(rec);
    assert.equal(
      vr.valid,
      true,
      "Validation should pass: " + vr.errors.join(", "),
    );

    const xml = VS.serialize(rec);
    assert.ok(xml.includes('<?xml version="1.0"'));
    assert.ok(xml.includes("VoiceRecord"));

    const out = VS.deserialize(xml);
    assert.equal(out.sessionId, "s-42");
    assert.equal(out.channel.type, "DigitalVoIP");
    assert.equal(out.channel.countryOfOrigin, "USA");
    assert.equal(out.captureDevice.organization, "Acme");
    assert.equal(out.transducer.captureTechnologyID, "Mobile phone");
    assert.equal(out.audioMetaInfo.channelCount, 2);
    assert.equal(out.audioMetaInfo.samplingRate, 44100);
    assert.equal(out.representations[0].quality.score, 92);

    const bir = VS.createBIR(rec);
    assert.equal(bir.sbh.qualityBlocks.length, 1);
    assert.equal(bir.sbh.qualityBlocks[0].qualityScore, 92);
    assert.ok(bir.bdb instanceof Uint8Array);
    assert.ok(bir.totalSize > 0);
  });
});
