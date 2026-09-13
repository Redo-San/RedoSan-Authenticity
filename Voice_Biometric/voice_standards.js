/* c8 ignore start */
(function () {
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */
// ── Voice Standards: ISO/IEC 19794-13:2018 voice data interchange format (XML) ──

/**
 * ISO/IEC 19794-13:2018 Voice Data Standard
 * Defines an XML-only voice data interchange format for speaker enrolment,
 * identification and verification. Single-speaker / single-session assumption.
 *
 * NOTE: element names and the part namespace below are INFERRED from the
 * ISO/IEC 19794-1:2011/Amd 2:2015 XML framework (clause 13) and the part
 * title; clauses 7.6 (schema) / 7.7 (example) are paywalled. Re-verify before
 * release against the purchased standard.
 * @class
 */
function VoiceStandards() {}

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/**
 * CBEFF BDB (Biometric Data Block) identifiers for Part 13.
 *
 * Verified against the IBIA CBEFF BDB format-identifiers registry and the
 * standard's own Table 1. Do NOT copy iris_standards.js SBH_OWNER 0x00 /
 * SBH_TYPE 0x09: those are a legacy CBEFF head packing, not the SC37
 * registry scheme. Clause 6.2 in the standard itself is defective ("format
 * owner identifier 31") — Table 1 and the OID both say owner 257 / type 31.
 */
VoiceStandards.CBEFF = {
  // Registered biometric organization id issued to ISO/IEC JTC 1/SC 37
  FORMAT_OWNER: 0x0101, // 257 dec
  // CBEFF_BDB format type for voice-data (scope ISO/IEC 19794-13)
  FORMAT_TYPE: 0x001f, // 31 dec
  // ASN.1 OID: {iso(1) ra(1) cbeff(19785) org(0) sc37(257) bdbs(0) voice-data(31)}
  OID: "1.1.19785.0.257.0.31",
  // Biometric type flag for voice (NISTIR 6529-A / CBEFF bitmap)
  BIOMETRIC_TYPE_VOICE: 0x04,
  // BIR Header Type values
  BIR_HEADER_TYPE_BDB: 0x00,
};

/**
 * Record version (Table 2: Version, M; 19794-1 VersionType).
 * First edition, 2018-03.
 */
VoiceStandards.VERSION = {
  major: 1,
  minor: 0,
};

/**
 * Expected Part 13 XML namespace (RFC 5141 URN pattern).
 * INFERRED from ISO/IEC 19794-1:2011/Amd 2:2015 clause 13 (`dna`, `frw`, `fmr`
 * confirmed; `vdi` = "voice data interchange" expected). UNVERIFIED against
 * Part 13 clause 7.6.
 */
VoiceStandards.NAMESPACE = "urn:iso:std:iso-iec:19794:-13:ed-1:tech:vdi";

/**
 * Root element name (INFERRED from the Amd 2 packaging prototype: the root is
 * named after the part title).
 */
VoiceStandards.ROOT_ELEMENT = "VoiceRecord";

/**
 * ChannelType (Table 3, 7.3.4.2, M). Exact wordlist incl. spacing.
 */
VoiceStandards.CHANNEL_TYPE = {
  UNKNOWN: "Unknown",
  ANALOG: "Analog",
  DIGITAL: "Digital",
  NON_VOIP: "NonVoIP",
  DIGITAL_VOIP: "DigitalVoIP",
  MIXED: "Mixed",
  DEFAULT: "Unknown",
};

/**
 * TransducerType (Table 4, 7.3.6.2, O). Exact wordlist.
 */
VoiceStandards.TRANSDUCER_TECHNOLOGY = {
  TELEPHONE: "Telephone",
  MICROPHONE: "Microphone",
  HANDHELD: "Handheld",
  MOBILE_PHONE: "Mobile phone",
  STETHOSCOPE: "Stethoscope",
  OTHER: "Other",
  UNKNOWN: "Unknown",
  DEFAULT: "Telephone",
};

/**
 * Microphone type (Table 4, 7.3.6.3).
 */
VoiceStandards.MICROPHONE_TYPE = {
  CARBON: "Carbon",
  ELECTRET: "Electret",
  OTHER: "Other",
  UNKNOWN: "Unknown",
};

/**
 * Range constants (Table 3/5 + clause 7.3.4.3).
 */
VoiceStandards.CHANNEL_COUNT = {
  MIN: 1,
  MAX: 15,
  DEFAULT: 1,
};

VoiceStandards.SAMPLE_RATE = {
  MIN: 0,
  MAX: 128000,
};

VoiceStandards.BITS_PER_SAMPLE = {
  MIN: 0,
  MAX: 255, // 0 = variable bit depth (e.g. Ogg Vorbis)
};

VoiceStandards.CUTOFF_FREQUENCY = {
  MIN: 0,
  MAX: 65535, // 0 = unknown
};

/**
 * Country of origin is a 3-character string per ISO 3166-1 (7.3.4.4).
 */
VoiceStandards.COUNTRY_CODE_LENGTH = 3;

/**
 * Extended vendor data is limited to 256 characters (Table 2, 7.3.9).
 */
VoiceStandards.VENDOR_DATA_MAX = 256;

/**
 * Quality score semantics per ISO/IEC 19794-1:2011/Amd 2:2015 clause 13:
 * 0-100 real scores; 255 = quality calculation failed (naming UNVERIFIED);
 * omit when no score was computed.
 */
VoiceStandards.QUALITY_SCORE = {
  MIN: 0,
  MAX: 100,
  FAILED: 255,
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// DEVICE FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Capture device metadata from browser environment (traceability, not part
 * of the XML record itself).
 * @returns {object} Device metadata
 */
/* c8 ignore stop */
VoiceStandards.captureDeviceInfo = function () {
  var nav, screen, info, ua;

  nav = typeof navigator === "undefined" ? {} : navigator;
  screen = typeof window !== "undefined" && window.screen ? window.screen : {};
  ua = nav.userAgent || "unknown";

  /* c8 ignore start -- browser-only device metadata */
  info = {
    vendor: nav.platform || "unknown",
    deviceType: VoiceStandards._classifyDeviceType(ua),
    userAgent: ua,
    language: nav.language || "en",
    screenWidth: screen.width || 0,
    screenHeight: screen.height || 0,
    devicePixelRatio:
      (typeof window !== "undefined" && window.devicePixelRatio) || 1,
    hardwareConcurrency: nav.hardwareConcurrency || 0,
    capturedAt: Date.now(),
  };
  /* c8 ignore stop */

  return info;
};

/* c8 ignore start */
/**
 * Classify device type from user agent.
 * @param ua
 * @private
 */
/* c8 ignore stop */
VoiceStandards._classifyDeviceType = function (ua) {
  if (!ua) return 0; // Unknown
  var lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android")) return 1; // Mobile
  if (lower.includes("tablet") || lower.includes("ipad")) return 2; // Tablet
  return 3; // Desktop/laptop
};

/* c8 ignore start */
/**
 * Validate device info has sufficient fields.
 * @param {object} deviceInfo
 * @returns {{ valid: boolean, warnings: string[] }}
 */
/* c8 ignore stop */
VoiceStandards.validateDeviceInfo = function (deviceInfo) {
  var warnings = [];
  if (!deviceInfo) {
    return { valid: false, warnings: ["No device info provided"] };
  }
  if (!deviceInfo.vendor || deviceInfo.vendor === "unknown") {
    warnings.push("Device vendor not available (browser privacy restriction)");
  }
  if (deviceInfo.deviceType === 0) {
    warnings.push("Device type unknown");
  }
  if (!deviceInfo.userAgent || deviceInfo.userAgent === "unknown") {
    warnings.push("User agent not available");
  }
  return { valid: warnings.length === 0, warnings: warnings };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// VOICE RECORD
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create an ISO/IEC 19794-13 compliant voice record.
 * @param {object} params
 * @param {object} params.audioMetaInfo - AudioMetaInformationType (Table 5, M): { channelCount?, samplingRate?, bitsPerSample?, audioDuration? }
 * @param {string} params.audioContent - Audio content for the representation (Table 6, M); the payload/gamma is kept opaque — the AudioContentType child layout is UNVERIFIED.
 * @param {string} [params.sessionId] - Session ID (Table 2, O)
 * @param {object} [params.channel] - ChannelType (Table 3, M; defaulted if absent): { type?, cutoffUpperFrequency?, cutoffLowerFrequency?, countryOfOrigin? }
 * @param {object} [params.captureDevice] - CaptureDeviceModelID (Table 2, O): { organization?, id? }
 * @param {object} [params.transducer] - TransducerType (Table 4, O): { captureTechnologyID?, microphoneType?, manufacturer?, model?, micCutoffUpper?, micCutoffLower?, deviceInfo? }
 * @param {string} [params.captureProcessProtocol] - CaptureProcessProtocolType (Table 2, O)
 * @param {string} [params.extendedVendorData] - VendorSpecificDataType (Table 2, O, max 256)
 * @param {Array<object>} [params.representations] - Explicit VR representations; defaults to one built from audioContent/quality
 * @param {object} [params.quality] - { score } 0-100, 255 = failed, omit if not computed (Amd 2)
 * @returns {object} ISO-compliant voice record
 */
/* c8 ignore stop */
VoiceStandards.createRecord = function (params) {
  var record, channel, audioMetaInfo;
  var now;

  if (!params || !params.audioMetaInfo) {
    throw new Error("VoiceStandards.createRecord: audioMetaInfo is required");
  }
  if (!params.audioContent && !params.representations) {
    throw new Error("VoiceStandards.createRecord: audioContent is required");
  }

  audioMetaInfo = params.audioMetaInfo;

  // ChannelType: Table 3, M — defaulted (type Unknown, cutoffs 0 = unknown)
  channel = params.channel || {
    type: VoiceStandards.CHANNEL_TYPE.DEFAULT,
    cutoffUpperFrequency: 0,
    cutoffLowerFrequency: 0,
  };
  if (!channel.type) channel.type = VoiceStandards.CHANNEL_TYPE.DEFAULT;
  if (channel.cutoffUpperFrequency === undefined) {
    channel.cutoffUpperFrequency = 0;
  }
  if (channel.cutoffLowerFrequency === undefined) {
    channel.cutoffLowerFrequency = 0;
  }

  now = new Date();

  record = {
    recordVersion: {
      major: VoiceStandards.VERSION.major,
      minor: VoiceStandards.VERSION.minor,
    },
    sessionId: params.sessionId,
    channel: channel,
    captureDevice: params.captureDevice,
    transducer: params.transducer,
    audioMetaInfo: {
      channelCount:
        audioMetaInfo.channelCount === undefined
          ? VoiceStandards.CHANNEL_COUNT.DEFAULT
          : audioMetaInfo.channelCount,
      samplingRate: audioMetaInfo.samplingRate,
      bitsPerSample: audioMetaInfo.bitsPerSample,
      audioDuration: audioMetaInfo.audioDuration,
    },
    captureProcessProtocol: params.captureProcessProtocol,
    extendedVendorData: params.extendedVendorData,
    // §7.4.1: minimum one representation per capture process
    representations: params.representations || [
      {
        audioContent: params.audioContent,
        quality: params.quality,
      },
    ],
    deviceInfo: VoiceStandards.captureDeviceInfo(),
    creationDate: now.toISOString(),
    timestamp: now.toISOString(),
  };

  return record;
};

/* c8 ignore start */
/**
 * Validate a voice record against ISO/IEC 19794-13 Table 2 M/O requirements
 * and the Table 3/5 range constraints.
 * @param {object} record - Voice record
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
/* c8 ignore stop */
VoiceStandards.validateRecord = function (record) {
  var errors = [],
    warnings = [];
  var i, rep, score;

  if (!record) {
    return {
      valid: false,
      errors: ["Record is null or undefined"],
      warnings: [],
    };
  }

  // Version (Table 2: M)
  if (
    !record.recordVersion ||
    record.recordVersion.major !== VoiceStandards.VERSION.major ||
    record.recordVersion.minor !== VoiceStandards.VERSION.minor
  ) {
    errors.push("Invalid recordVersion: must be 1.0 (ISO/IEC 19794-13:2018)");
  }

  // Channel (Table 2: M; Table 3)
  if (!record.channel || typeof record.channel !== "object") {
    errors.push("Missing channel (Table 2: M)");
  } else {
    if (
      !record.channel.type ||
      Object.keys(VoiceStandards.CHANNEL_TYPE)
        .filter(function (k) {
          return k !== "DEFAULT";
        })
        .map(function (k) {
          return VoiceStandards.CHANNEL_TYPE[k];
        })
        .indexOf(record.channel.type) === -1
    ) {
      errors.push("Invalid channel.type: " + record.channel.type);
    }
    if (
      typeof record.channel.cutoffUpperFrequency !== "number" ||
      record.channel.cutoffUpperFrequency <
        VoiceStandards.CUTOFF_FREQUENCY.MIN ||
      record.channel.cutoffUpperFrequency > VoiceStandards.CUTOFF_FREQUENCY.MAX
    ) {
      errors.push(
        "channel.cutoffUpperFrequency out of range 0-65535: " +
          record.channel.cutoffUpperFrequency,
      );
    }
    if (
      typeof record.channel.cutoffLowerFrequency !== "number" ||
      record.channel.cutoffLowerFrequency <
        VoiceStandards.CUTOFF_FREQUENCY.MIN ||
      record.channel.cutoffLowerFrequency > VoiceStandards.CUTOFF_FREQUENCY.MAX
    ) {
      errors.push(
        "channel.cutoffLowerFrequency out of range 0-65535: " +
          record.channel.cutoffLowerFrequency,
      );
    }
    if (
      record.channel.countryOfOrigin &&
      typeof record.channel.countryOfOrigin === "string" &&
      record.channel.countryOfOrigin.length !==
        VoiceStandards.COUNTRY_CODE_LENGTH
    ) {
      errors.push(
        "channel.countryOfOrigin must be a 3-character ISO 3166 code",
      );
    }
  }

  // Audio meta information (Table 2: M; Table 5)
  if (!record.audioMetaInfo || typeof record.audioMetaInfo !== "object") {
    errors.push("Missing audioMetaInfo (Table 2: M)");
  } else {
    if (
      typeof record.audioMetaInfo.channelCount !== "number" ||
      record.audioMetaInfo.channelCount < VoiceStandards.CHANNEL_COUNT.MIN ||
      record.audioMetaInfo.channelCount > VoiceStandards.CHANNEL_COUNT.MAX
    ) {
      errors.push(
        "Invalid audioMetaInfo.channelCount (1-15): " +
          record.audioMetaInfo.channelCount,
      );
    }
    if (
      record.audioMetaInfo.samplingRate !== undefined &&
      (typeof record.audioMetaInfo.samplingRate !== "number" ||
        record.audioMetaInfo.samplingRate < VoiceStandards.SAMPLE_RATE.MIN ||
        record.audioMetaInfo.samplingRate > VoiceStandards.SAMPLE_RATE.MAX)
    ) {
      errors.push(
        "Invalid audioMetaInfo.samplingRate (0-128000): " +
          record.audioMetaInfo.samplingRate,
      );
    }
    if (
      record.audioMetaInfo.bitsPerSample !== undefined &&
      (typeof record.audioMetaInfo.bitsPerSample !== "number" ||
        record.audioMetaInfo.bitsPerSample <
          VoiceStandards.BITS_PER_SAMPLE.MIN ||
        record.audioMetaInfo.bitsPerSample > VoiceStandards.BITS_PER_SAMPLE.MAX)
    ) {
      errors.push(
        "Invalid audioMetaInfo.bitsPerSample (0-255): " +
          record.audioMetaInfo.bitsPerSample,
      );
    }
    if (
      record.audioMetaInfo.audioDuration !== undefined &&
      (typeof record.audioMetaInfo.audioDuration !== "number" ||
        record.audioMetaInfo.audioDuration < 0)
    ) {
      errors.push(
        "Invalid audioMetaInfo.audioDuration: " +
          record.audioMetaInfo.audioDuration,
      );
    }
  }

  // Transducer (Table 2: O; Table 4) — validated when present
  if (record.transducer && typeof record.transducer === "object") {
    if (
      record.transducer.captureTechnologyID &&
      Object.keys(VoiceStandards.TRANSDUCER_TECHNOLOGY)
        .filter(function (k) {
          return k !== "DEFAULT";
        })
        .map(function (k) {
          return VoiceStandards.TRANSDUCER_TECHNOLOGY[k];
        })
        .indexOf(record.transducer.captureTechnologyID) === -1
    ) {
      errors.push(
        "Invalid transducer.captureTechnologyID: " +
          record.transducer.captureTechnologyID,
      );
    }
    if (
      record.transducer.microphoneType &&
      Object.keys(VoiceStandards.MICROPHONE_TYPE)
        .map(function (k) {
          return VoiceStandards.MICROPHONE_TYPE[k];
        })
        .indexOf(record.transducer.microphoneType) === -1
    ) {
      errors.push(
        "Invalid transducer.microphoneType: " +
          record.transducer.microphoneType,
      );
    }
  }

  // Representations (§7.4.1: minimum one per capture process; Table 6 fields)
  if (
    !record.representations ||
    !Array.isArray(record.representations) ||
    record.representations.length === 0
  ) {
    errors.push("Missing representations: at least one required (§7.4.1)");
  } else {
    for (i = 0; i < record.representations.length; i++) {
      rep = record.representations[i];
      if (!rep || !rep.audioContent) {
        errors.push("Missing audioContent (Table 6: M)");
        continue;
      }
      if (rep.quality) {
        score = rep.quality.score;
        if (typeof score !== "number") {
          errors.push("Invalid quality.score: " + score);
        } else if (score === VoiceStandards.QUALITY_SCORE.FAILED) {
          warnings.push("Quality score 255: quality calculation failed");
        } else if (
          score < VoiceStandards.QUALITY_SCORE.MIN ||
          score > VoiceStandards.QUALITY_SCORE.MAX
        ) {
          errors.push("Invalid quality.score (0-100, or 255 failed): " + score);
        }
      }
    }
  }

  // Extended vendor data (7.3.9: max 256)
  if (
    record.extendedVendorData &&
    record.extendedVendorData.length > VoiceStandards.VENDOR_DATA_MAX
  ) {
    errors.push("ExtendedVendorData exceeds 256 characters");
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// XML SERIALIZATION / DESERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Escape text for XML element content.
 * @param {*} value
 * @returns {string}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._escapeXml = function (value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/* c8 ignore start */
/**
 * Emit an element with escaped text content.
 * @param {string} name
 * @param {*} value
 * @returns {string}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._el = function (name, value) {
  return (
    "<" + name + ">" + VoiceStandards._escapeXml(value) + "</" + name + ">"
  );
};

/* c8 ignore start */
/**
 * Emit an optional element; empty/undefined values are omitted.
 * @param {string} name
 * @param {*} value
 * @returns {string}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._optEl = function (name, value) {
  if (value === undefined || value === null || value === "") return "";
  return VoiceStandards._el(name, value);
};

/* c8 ignore start */
/**
 * Serialize a voice record to an XML string.
 *
 * The grammar is the strict subset emitted by this module: XML declaration,
 * root element with a single xmlns attribute, nested elements, escaped text
 * content only (no mixed content, no CDATA, no comments).
 * @param {object} record - Voice record from createRecord()
 * @returns {string} XML document
 */
/* c8 ignore stop */
VoiceStandards.serialize = function (record) {
  var validation, xml, i, rep, versionString;

  validation = VoiceStandards.validateRecord(record);
  if (!validation.valid) {
    throw new Error("Invalid record: " + validation.errors.join(", "));
  }

  versionString = record.recordVersion.major + "." + record.recordVersion.minor;

  xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml +=
    "<" +
    VoiceStandards.ROOT_ELEMENT +
    ' xmlns="' +
    VoiceStandards.NAMESPACE +
    '">';
  xml += VoiceStandards._el("Version", versionString);
  xml += VoiceStandards._optEl("SessionId", record.sessionId);

  // Channel (M, Table 3)
  xml += "<Channel>";
  xml += VoiceStandards._el("Type", record.channel.type);
  xml += VoiceStandards._el(
    "CutoffUpperFrequency",
    record.channel.cutoffUpperFrequency,
  );
  xml += VoiceStandards._el(
    "CutoffLowerFrequency",
    record.channel.cutoffLowerFrequency,
  );
  xml += VoiceStandards._optEl(
    "CountryOfOrigin",
    record.channel.countryOfOrigin,
  );
  xml += "</Channel>";

  // Capture device (O, Table 2)
  if (record.captureDevice) {
    xml += "<CaptureDevice>";
    xml += VoiceStandards._optEl(
      "Organization",
      record.captureDevice.organization,
    );
    xml += VoiceStandards._optEl("Id", record.captureDevice.id);
    xml += "</CaptureDevice>";
  }

  // Transducer (O, Table 4)
  if (record.transducer) {
    xml += "<Transducer>";
    xml += VoiceStandards._optEl(
      "CaptureTechnologyID",
      record.transducer.captureTechnologyID,
    );
    xml += VoiceStandards._optEl(
      "MicrophoneType",
      record.transducer.microphoneType,
    );
    xml += VoiceStandards._optEl(
      "Manufacturer",
      record.transducer.manufacturer,
    );
    xml += VoiceStandards._optEl("Model", record.transducer.model);
    xml += VoiceStandards._optEl(
      "MicCutoffUpper",
      record.transducer.micCutoffUpper,
    );
    xml += VoiceStandards._optEl(
      "MicCutoffLower",
      record.transducer.micCutoffLower,
    );
    xml += VoiceStandards._optEl("DeviceInfo", record.transducer.deviceInfo);
    xml += "</Transducer>";
  }

  // Audio meta information (M, Table 5)
  xml += "<AudioMetaInformation>";
  xml += VoiceStandards._el("ChannelCount", record.audioMetaInfo.channelCount);
  xml += VoiceStandards._optEl(
    "SamplingRate",
    record.audioMetaInfo.samplingRate,
  );
  xml += VoiceStandards._optEl(
    "BitsPerSample",
    record.audioMetaInfo.bitsPerSample,
  );
  xml += VoiceStandards._optEl(
    "AudioDuration",
    record.audioMetaInfo.audioDuration,
  );
  xml += "</AudioMetaInformation>";

  xml += VoiceStandards._optEl(
    "CaptureProcessProtocol",
    record.captureProcessProtocol,
  );
  xml += VoiceStandards._optEl("ExtendedVendorData", record.extendedVendorData);

  // RepresentationList (Amd 2 packaging prototype; wrapper name INFERRED)
  xml += "<RepresentationList>";
  for (i = 0; i < record.representations.length; i++) {
    rep = record.representations[i];
    xml += "<Representation>";
    xml += VoiceStandards._optEl("DateAndTime", rep.dateAndTime);
    xml += VoiceStandards._el("AudioContent", rep.audioContent);
    if (rep.quality && rep.quality.score !== undefined) {
      xml += "<Quality>";
      xml += VoiceStandards._el("Score", rep.quality.score);
      xml += "</Quality>";
    }
    xml += VoiceStandards._optEl("SignalEnhancement", rep.signalEnhancement);
    xml += VoiceStandards._optEl("ExtendedVendorData", rep.extendedVendorData);
    xml += "</Representation>";
  }
  xml += "</RepresentationList>";

  xml += "</" + VoiceStandards.ROOT_ELEMENT + ">";

  return xml;
};

/* c8 ignore start */
/**
 * Unescape the five predefined XML entities.
 * @param {string} value
 * @returns {string}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._unescapeXml = function (value) {
  if (!value) return value;
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
};

/* c8 ignore start */
/**
 * Strict recursive-descent mini-parser for the exact subset of XML that
 * serialize() emits. Rejects doctype/CDATA/comments/processing instructions,
 * mixed content, malformed or unclosed tags, and unknown roots. No eval, no
 * external parser, no DOMParser dependency.
 * @param {string} xml
 * @returns {{ name: string, attrs: object, children: Array, text: (string|undefined) }}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._parseXml = function (xml) {
  var pos = 0;
  var len = typeof xml === "string" ? xml.length : 0;

  // input must be a non-empty string
  if (!xml || len === 0) {
    throw new Error("deserialize: no XML input");
  }

  function fail(message) {
    throw new Error("deserialize: " + message);
  }

  // strip BOM
  if (xml.charCodeAt(0) === 0xfeff) pos = 1;

  // optional XML declaration (only the declaration serializer emits)
  if (xml.startsWith("<?xml", pos)) {
    var declEnd = xml.indexOf("?>", pos);
    if (declEnd === -1) fail("parse error: unterminated XML declaration");
    pos = declEnd + 2;
  }

  function isWs(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
  }

  function isNameChar(ch) {
    if (ch === undefined) return false;
    return (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "-" ||
      ch === "_" ||
      ch === ":" ||
      ch === "."
    );
  }

  function parseElement() {
    var name, node, attrs, cname, text, child, quote;
    var attrName, valStart;

    if (xml[pos] !== "<") fail("parse error: expected '<' at " + pos);
    pos++;

    if (xml.startsWith("<!--", pos))
      fail("parse error: comments not supported");
    if (xml.startsWith("<![CDATA[", pos))
      fail("parse error: CDATA not supported");
    if (xml[pos] === "!" || xml[pos] === "?") {
      fail("parse error: doctype/processing instruction not allowed");
    }

    name = "";
    while (pos < len && isNameChar(xml[pos])) {
      name += xml[pos];
      pos++;
    }
    if (!name) fail("parse error: empty element name");

    attrs = {};
    while (pos < len) {
      while (pos < len && isWs(xml[pos])) pos++;
      if (pos >= len) fail("parse error: unterminated open tag <" + name + ">");
      if (xml[pos] === ">") {
        pos++;
        break;
      }
      if (xml[pos] === "/") {
        if (xml[pos + 1] !== ">") {
          fail("parse error: invalid self-closing tag <" + name + ">");
        }
        pos += 2;
        return {
          name: name,
          attrs: attrs,
          children: [],
          text: undefined,
        };
      }

      attrName = "";
      while (pos < len && xml[pos] !== "=" && !isWs(xml[pos])) {
        attrName += xml[pos];
        pos++;
      }
      if (!attrName) fail("parse error: invalid attribute");
      while (pos < len && isWs(xml[pos])) pos++;
      if (xml[pos] !== "=") fail("parse error: expected '=' after attribute");
      pos++;
      while (pos < len && isWs(xml[pos])) pos++;
      quote = xml[pos];
      if (quote !== '"' && quote !== "'") {
        fail("parse error: expected quoted attribute value");
      }
      pos++;
      valStart = pos;
      while (pos < len && xml[pos] !== quote) pos++;
      if (pos >= len) fail("parse error: unterminated attribute value");
      attrs[attrName] = VoiceStandards._unescapeXml(xml.slice(valStart, pos));
      pos++;
    }

    node = {
      name: name,
      attrs: attrs,
      children: [],
      text: undefined,
    };

    // children
    while (true) {
      text = "";
      while (pos < len && xml[pos] !== "<") {
        text += xml[pos];
        pos++;
      }
      if (text.trim().length > 0) {
        if (node.text !== undefined || node.children.length > 0) {
          fail("parse error: unexpected text in element <" + name + ">");
        }
        node.text = VoiceStandards._unescapeXml(text);
      }
      if (pos >= len) fail("unclosed element <" + name + ">");

      if (xml.startsWith("</", pos)) {
        pos += 2;
        cname = "";
        while (pos < len && isNameChar(xml[pos])) {
          cname += xml[pos];
          pos++;
        }
        while (pos < len && isWs(xml[pos])) pos++;
        if (xml[pos] !== ">") fail("parse error: malformed close tag");
        pos++;
        if (cname !== name) {
          fail(
            "mismatched close tag </" + cname + ">, expected </" + name + ">",
          );
        }
        return node;
      }

      if (xml.startsWith("<!--", pos))
        fail("parse error: comments not supported");
      if (xml.startsWith("<![CDATA[", pos))
        fail("parse error: CDATA not supported");
      if (xml.startsWith("<!", pos)) fail("parse error: doctype not supported");
      if (xml.startsWith("<?", pos)) {
        fail("parse error: processing instruction not allowed");
      }

      child = parseElement();
      node.children.push(child);
    }
  }

  // whitespace before root
  while (pos < len && isWs(xml[pos])) pos++;
  if (pos >= len) fail("no XML input");
  if (xml[pos] !== "<") fail("parse error: expected '<' at " + pos);

  var root = parseElement();

  // trailing content must be whitespace only
  while (pos < len && isWs(xml[pos])) pos++;
  if (pos < len) fail("parse error: unexpected content after root element");

  return root;
};

/* c8 ignore start */
/**
 * Element names whose text must be restored as numbers on deserialization.
 * @param {string} name
 * @returns {boolean}
 * @private
 */
/* c8 ignore stop */
VoiceStandards._isNumericElement = function (name) {
  return (
    name === "CutoffUpperFrequency" ||
    name === "CutoffLowerFrequency" ||
    name === "MicCutoffUpper" ||
    name === "MicCutoffLower" ||
    name === "ChannelCount" ||
    name === "SamplingRate" ||
    name === "BitsPerSample" ||
    name === "AudioDuration" ||
    name === "Score"
  );
};

/* c8 ignore start */
/**
 * Map a parsed XML node tree back to a voice record object.
 * @param {object} root - Root node from _parseXml()
 * @returns {object} Voice record
 * @private
 */
/* c8 ignore stop */
VoiceStandards._xmlToRecord = function (root) {
  var record, i, j, child, rep, qualityChild;
  var numeric = VoiceStandards._isNumericElement;

  if (root.name !== VoiceStandards.ROOT_ELEMENT) {
    throw new Error(
      "deserialize: unknown root element <" +
        root.name +
        ">, expected <" +
        VoiceStandards.ROOT_ELEMENT +
        ">",
    );
  }

  function childByName(node, name) {
    for (var k = 0; k < node.children.length; k++) {
      if (node.children[k].name === name) return node.children[k];
    }
    return null;
  }

  function childText(node, name) {
    if (!node || !node.children) return undefined;
    var child = childByName(node, name);
    if (!child) return undefined;
    if (numeric(name)) {
      return child.text === undefined ? undefined : Number(child.text);
    }
    return child.text;
  }

  record = {
    recordVersion: {
      major: VoiceStandards.VERSION.major,
      minor: VoiceStandards.VERSION.minor,
    },
    representations: [],
  };

  for (i = 0; i < root.children.length; i++) {
    child = root.children[i];
    switch (child.name) {
      case "Version": {
        var parts = (child.text || "1.0").split(".");
        record.recordVersion = {
          major: Number(parts[0]) || VoiceStandards.VERSION.major,
          minor: Number(parts[1]) || VoiceStandards.VERSION.minor,
        };
        break;
      }
      case "SessionId": {
        record.sessionId = child.text;
        break;
      }
      case "Channel": {
        record.channel = {
          type: childText(child, "Type"),
          cutoffUpperFrequency: childText(child, "CutoffUpperFrequency"),
          cutoffLowerFrequency: childText(child, "CutoffLowerFrequency"),
          countryOfOrigin: childText(child, "CountryOfOrigin"),
        };
        break;
      }
      case "CaptureDevice": {
        record.captureDevice = {
          organization: childText(child, "Organization"),
          id: childText(child, "Id"),
        };
        break;
      }
      case "Transducer": {
        record.transducer = {
          captureTechnologyID: childText(child, "CaptureTechnologyID"),
          microphoneType: childText(child, "MicrophoneType"),
          manufacturer: childText(child, "Manufacturer"),
          model: childText(child, "Model"),
          micCutoffUpper: childText(child, "MicCutoffUpper"),
          micCutoffLower: childText(child, "MicCutoffLower"),
          deviceInfo: childText(child, "DeviceInfo"),
        };
        break;
      }
      case "AudioMetaInformation": {
        record.audioMetaInfo = {
          channelCount: childText(child, "ChannelCount"),
          samplingRate: childText(child, "SamplingRate"),
          bitsPerSample: childText(child, "BitsPerSample"),
          audioDuration: childText(child, "AudioDuration"),
        };
        break;
      }
      case "CaptureProcessProtocol": {
        record.captureProcessProtocol = child.text;
        break;
      }
      case "ExtendedVendorData": {
        record.extendedVendorData = child.text;
        break;
      }
      case "RepresentationList": {
        for (j = 0; j < child.children.length; j++) {
          rep = child.children[j];
          if (rep.name !== "Representation") continue;
          qualityChild = childByName(rep, "Quality");
          record.representations.push({
            dateAndTime: childText(rep, "DateAndTime"),
            audioContent: childText(rep, "AudioContent"),
            quality: qualityChild
              ? { score: childText(qualityChild, "Score") }
              : undefined,
            signalEnhancement: childText(rep, "SignalEnhancement"),
            extendedVendorData: childText(rep, "ExtendedVendorData"),
          });
        }
        break;
      }
      default: {
        throw new Error("deserialize: unexpected element <" + child.name + ">");
      }
    }
  }

  return record;
};

/* c8 ignore start */
/**
 * Deserialize an XML voice record (strict mini-parser — only the grammar
 * serialized by serialize() is accepted).
 * @param {string} xml - Serialized voice record
 * @returns {object} Voice record
 */
/* c8 ignore stop */
VoiceStandards.deserialize = function (xml) {
  var root = VoiceStandards._parseXml(xml);
  return VoiceStandards._xmlToRecord(root);
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CBEFF BIR
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create a CBEFF-compliant BIR (Biometric Identification Record) wrapping the
 * XML voice record as the BDB payload.
 *
 * NOTE: the exact binary SBH framing for XML-payload BDBs under ISO 19785-1
 * was not re-verified from a primary source; the sbh object mirrors the BIR
 * header fields (owner/type via the IBIA registry, biometric type, OID).
 * @param {object} record - Voice record from createRecord()
 * @returns {{ sbh: object, bdb: Uint8Array, totalSize: number }}
 */
/* c8 ignore stop */
VoiceStandards.createBIR = function (record) {
  var sbh, bdb, xml, qualityBlocks;

  if (!record) {
    throw new Error("VoiceStandards.createBIR: record is required");
  }

  // BDB = the XML VoiceRecord document (Part 13 BDB is XML-only)
  xml = VoiceStandards.serialize(record);
  bdb = new TextEncoder().encode(xml);

  qualityBlocks = [];
  if (
    record.representations &&
    record.representations.length > 0 &&
    record.representations[0].quality &&
    record.representations[0].quality.score !== undefined
  ) {
    qualityBlocks.push({
      qualityAlgorithmVendor: VoiceStandards.CBEFF.FORMAT_OWNER,
      qualityAlgorithmId: 0,
      qualityScore: record.representations[0].quality.score,
    });
  }

  sbh = {
    // Biometric type (voice = 0x04)
    biometricType: VoiceStandards.CBEFF.BIOMETRIC_TYPE_VOICE,
    // Biometric data format owner (0x0101 = ISO/IEC JTC 1/SC 37)
    bdbFormatOwner: VoiceStandards.CBEFF.FORMAT_OWNER,
    // Biometric data format type (voice-data = 0x001F)
    bdbFormatType: VoiceStandards.CBEFF.FORMAT_TYPE,
    // ASN.1 object identifier for the voice-data BDB
    oid: VoiceStandards.CBEFF.OID,
    // Bir header type (BDB is the payload format)
    birType: VoiceStandards.CBEFF.BIR_HEADER_TYPE_BDB,
    version: record.recordVersion || VoiceStandards.VERSION,
    qualityBlocks: qualityBlocks,
    // Security options (0 = none; integrity is out of Part 13 scope)
    securityOptions: {
      integrity: false,
      confidentiality: false,
      irrevocable: false,
    },
    deviceInfo: record.deviceInfo || VoiceStandards.captureDeviceInfo(),
    creationDate: record.creationDate || new Date().toISOString(),
    timestamp: record.timestamp || new Date().toISOString(),
  };

  return {
    sbh: sbh,
    bdb: bdb,
    totalSize: JSON.stringify(sbh).length + bdb.length,
  };
};

// Export for window
if (typeof window !== "undefined") {
  window.VoiceStandards = VoiceStandards;
}
