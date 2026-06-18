(function () {
  if (
    typeof window != "undefined" &&
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
// ── Simplified mode: step-by-step wizard ──

var simpleFile = null;
var simpleBuf = null;
var simpleType = null;
var simpleIsAI = false;
// Secure key store — private keys are NOT exposed on window
let _didKp = null;
let _didSig = null;

var simpleStep = 0;
var simpleSteps = [];
var simpleResults = {};
var simpleStepDone = false;
var simpleUserInfo = {
  name: "",
  email: "",
  phone: "",
  phoneCode: "",
  website: "",
  social: { tiktok: "", facebook: "", instagram: "", youtube: "" },
  isArtist: false,
  music: {
    spotify: "",
    appleMusic: "",
    youtubeMusic: "",
    soundcloud: "",
    bandcamp: "",
  },
};

function setBodyOverflow(disable) {
  if (disable) document.body.classList.add("no-scroll");
  else document.body.classList.remove("no-scroll");
}

function initMode() {
  // Don't lock body scroll here — the mode overlay CSS has overflow-y: auto
  // and setting overflow:hidden on <html> can prevent fixed children from scrolling on mobile.
}

function setMode(mode) {
  document.getElementById("modeSelect").style.display = "none";
  setBodyOverflow(false);
  try {
    history.pushState(
      { modeSet: mode },
      "",
      window.location.pathname.replace(/\/+$/, "") + "/",
    );
  } catch (e) {}
  if (mode === "simplified") {
    document.getElementById("mainNav").style.display = "none";
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("sidebarOverlay").style.display = "none";
    document.getElementById("app").style.display = "none";
    document.getElementById("mainFooter").style.display = "none";
    document.getElementById("simplifiedMode").style.display = "";
    initSimplified();
  } else {
    document.getElementById("simplifiedMode").style.display = "none";
    document.getElementById("mainNav").style.display = "";
    document.getElementById("sidebar").style.display = "";
    document.getElementById("app").style.display = "";
    document.getElementById("mainFooter").style.display = "";
    // Hybrid: use mpa-router to load home page content from standalone page
    if (typeof window.__mpaGoHome === "function" && !document.getElementById("page-home")) {
      window.__mpaGoHome();
    } else {
      document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
      document
        .querySelectorAll(".sidebar a[data-page]")
        .forEach((a) => a.classList.remove("active"));
      var home = document.getElementById("page-home");
      if (home) home.classList.add("active");
    }
  }
}

function resetProfessionalForms() {
  // Clear all file inputs in professional mode
  document.querySelectorAll('#app input[type="file"]').forEach(function (el) {
    var dt = new DataTransfer();
    el.files = dt.files;
  });
  // Clear all text/password inputs and textareas
  document
    .querySelectorAll(
      '#app input[type="text"], #app input[type="password"], #app input[type="search"], #app textarea',
    )
    .forEach(function (el) {
      el.value = "";
    });
  // Hide all result/output sections
  [
    "wm-result",
    "pi-result",
    "fp-result",
    "md-result",
    "ts-result",
    "c2pa-read-result",
    "c2pa-write-result",
    "c2pa-verify-result",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function switchMode() {
  showModeSelect();
}

function showModeSelect() {
  resetProfessionalForms();
  // Show mode overlay without page reload (keeps music playing)
  document.getElementById("modeSelect").style.display = "";
  document.documentElement.style.overflow = "hidden";
  document.getElementById("simplifiedMode").style.display = "none";
  document.getElementById("mainNav").style.display = "none";
  document.getElementById("sidebar").style.display = "none";
  document.getElementById("sidebarOverlay").style.display = "none";
  document.getElementById("app").style.display = "none";
  document.getElementById("mainFooter").style.display = "none";
}

// ── File type detection ──

function detectFileType(file) {
  var name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|avif|tiff?)$/.test(name))
    return "image";
  if (/\.(mp3|wav|ogg|flac|aac|wma|m4a|opus)$/.test(name)) return "audio";
  if (/\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp)$/.test(name)) return "video";
  if (
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|html?|xml|json|md|epub)$/.test(
      name,
    )
  )
    return "document";
  return "other";
}

function buildSteps(type, isAI) {
  var s = [{ id: "upload", label: __("simple.step_upload", "Upload") }];
  if (type === "image") {
    s.push({ id: "ai-question", label: __("simple.step_type", "Type") });
    s.push({
      id: "fingerprint",
      label: __("simple.step_fingerprint", "Fingerprint"),
    });
    s.push({ id: "did-sign", label: __("simple.step_did", "DID Sign") });
    s.push({
      id: "watermark",
      label: __("simple.step_watermark", "Watermark"),
    });
    s.push({
      id: "pixel-injection",
      label: __("simple.step_inject", "Inject"),
    });
    if (isAI) s.push({ id: "c2pa", label: __("simple.step_c2pa", "C2PA") });
    s.push({
      id: "timestamp",
      label: __("simple.step_timestamp", "Timestamp"),
    });
  } else if (type === "audio") {
    s.push({
      id: "fingerprint",
      label: __("simple.step_fingerprint", "Fingerprint"),
    });
    s.push({ id: "did-sign", label: __("simple.step_did", "DID Sign") });
    s.push({ id: "audio-watermark", label: "Audio Watermark" });
    s.push({
      id: "timestamp",
      label: __("simple.step_timestamp", "Timestamp"),
    });
  } else {
    s.push({
      id: "fingerprint",
      label: __("simple.step_fingerprint", "Fingerprint"),
    });
    s.push({
      id: "timestamp",
      label: __("simple.step_timestamp", "Timestamp"),
    });
    s.push({ id: "did-sign", label: __("simple.step_did", "DID Sign") });
  }
  s.push({ id: "done", label: __("simple.step_done", "Done") });
  return s;
}

// ── Init & render ──

function initSimplified() {
  simpleFile = null;
  simpleBuf = null;
  simpleType = null;
  simpleIsAI = false;
  simpleStep = 0;
  simpleSteps = [];
  simpleResults = {};
  simpleUserInfo = {
    name: "",
    email: "",
    phone: "",
    phoneCode: "",
    website: "",
    social: { tiktok: "", facebook: "", instagram: "", youtube: "" },
    isArtist: false,
    music: {
      spotify: "",
      appleMusic: "",
      youtubeMusic: "",
      soundcloud: "",
      bandcamp: "",
    },
  };
  var steps = [{ id: "upload", label: __("simple.step_upload", "Upload") }];
  simpleSteps = steps;
  document.getElementById("simpleNav").style.display = "";
  renderStep();
}

function renderStep() {
  var step = simpleSteps[simpleStep];
  renderProgress();
  var body = document.getElementById("simpleBody");
  var nextBtn = document.getElementById("simpleNextBtn");
  var prevBtn = document.getElementById("simplePrevBtn");
  prevBtn.style.display = simpleStep === 0 ? "none" : "";
  var isLast = simpleStep === simpleSteps.length - 1;
  nextBtn.textContent = isLast
    ? __("simple.start_over")
    : __("simple.next_btn");
  // Manage Next button: hidden for action-required steps, disabled until done for others
  simpleStepDone = false;
  if (
    [
      "ai-question",
      "c2pa",
      "watermark",
      "pixel-injection",
      "audio-watermark",
    ].indexOf(step.id) >= 0
  ) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = "";
    nextBtn.disabled =
      step.id === "upload" ? !simpleFile : step.id === "done" ? false : true;
  }
  if (step.id === "upload") renderUpload(body);
  else if (step.id === "ai-question") renderAiQuestion(body);
  else if (step.id === "c2pa") renderC2paStep(body);
  else if (step.id === "watermark") renderWatermarkStep(body);
  else if (step.id === "pixel-injection") renderPixelInjectStep(body);
  else if (step.id === "timestamp") renderTimestampStep(body);
  else if (step.id === "audio-watermark") renderAudioWatermarkStep(body);
  else if (step.id === "fingerprint") renderFingerprintStep(body);
  else if (step.id === "did-sign") renderDIDStep(body);
  else if (step.id === "done") renderDone(body);
  document.getElementById("simpleStepCounter").textContent = __(
    "simple.step_of",
    "Step {current} of {total}",
  )
    .replace("{current}", simpleStep + 1)
    .replace("{total}", simpleSteps.length);
}

function renderProgress() {
  var el = document.getElementById("simpleProgress");
  el.innerHTML = simpleSteps
    .map(function (s, i) {
      var cls =
        i === simpleStep ? "sp-active" : i < simpleStep ? "sp-done" : "";
      return (
        '<div class="sp-step ' +
        cls +
        '"><div class="sp-dot"></div><span class="sp-step-text">' +
        s.label +
        "</span></div>"
      );
    })
    .join('<div class="sp-line"></div>');
}

// ── Navigation ──

function simpleNext() {
  var step = simpleSteps[simpleStep];
  if (step.id === "upload" && !simpleFile) return;
  if (step.id === "upload") {
    saveSimpleUserInfo();
    if (
      !simpleUserInfo.name ||
      !simpleUserInfo.email ||
      !simpleUserInfo.phone ||
      !simpleUserInfo.website
    ) {
      var infoSection = document.querySelector(".simple-info-section");
      if (infoSection) {
        var existingErr = infoSection.querySelector(".simple-info-error");
        if (existingErr) existingErr.remove();
        var err = document.createElement("p");
        err.className = "simple-info-error";
        err.style.cssText =
          "font-size:0.8rem;color:var(--danger);margin:8px 0 0;text-align:left";
        err.textContent = __(
          "simple.info_required",
          "Please fill in all required fields: Name, Email, Phone, Website.",
        );
        infoSection.appendChild(err);
      }
      return;
    }
    // Deeper field validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(simpleUserInfo.email)) {
      var warn = document.getElementById("sinfo-email-warn");
      if (warn) warn.style.display = "block";
      return;
    }
    if (
      simpleUserInfo.website === "https://" ||
      !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(simpleUserInfo.website)
    ) {
      var warn = document.getElementById("sinfo-website-warn");
      if (warn) warn.style.display = "block";
      return;
    }
    // Validate social/music URLs at submission time
    var socialFields = [
      "sinfo-tiktok",
      "sinfo-facebook",
      "sinfo-instagram",
      "sinfo-youtube",
      "sinfo-spotify",
      "sinfo-applemusic",
      "sinfo-ytmusic",
      "sinfo-soundcloud",
      "sinfo-bandcamp",
    ];
    for (var si = 0; si < socialFields.length; si++) {
      var fld = document.getElementById(socialFields[si]);
      if (
        fld &&
        fld.value &&
        !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(fld.value)
      ) {
        var w = document.getElementById(socialFields[si] + "-warn");
        if (w) w.style.display = "block";
        return;
      }
    }
  }
  // Auto-run steps must complete before advancing
  if (
    (step.id === "timestamp" ||
      step.id === "fingerprint" ||
      step.id === "watermark" ||
      step.id === "pixel-injection" ||
      step.id === "c2pa" ||
      step.id === "did-sign") &&
    !simpleStepDone
  )
    return;
  if (step.id === "done") {
    restartSimple();
    return;
  }
  simpleStep++;
  if (simpleStep >= simpleSteps.length) simpleStep = simpleSteps.length - 1;
  renderStep();
}

function simplePrev() {
  if (simpleStep <= 0) return;
  simpleStep--;
  simpleStepDone = false;
  renderStep();
}

function restartSimple() {
  initSimplified();
}

async function runC2paStep() {
  showProgress();
  var btn = document.getElementById("sc2pa-btn");
  var statusEl = document.getElementById("sc2pa-result");
  if (!window.handleC2paWrite) {
    if (statusEl) {
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px;margin-top:12px">' +
        __(
          "simple.c2pa_no_module",
          "C2PA module not loaded. Check internet connection and refresh.",
        ) +
        "</div>";
    }
    return;
  }
  // Validate C2PA social/music links before signing
  var c2paLinks = document.querySelectorAll(".sc2pa-link");
  var urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  for (var ci = 0; ci < c2paLinks.length; ci++) {
    if (c2paLinks[ci].value && !urlRegex.test(c2paLinks[ci].value)) {
      var warnId = c2paLinks[ci].id + "-warn";
      var warn = document.getElementById(warnId);
      if (warn) warn.style.display = "block";
      hideProgress();
      return;
    }
  }
  // 1. Sync content type checkboxes
  var typeCards = document.querySelectorAll(
    "#sc2pa-write-types .c2pa-type-card[data-form-type]",
  );
  typeCards.forEach(function (card) {
    var ft = card.dataset.formType;
    var simpleCb = card.querySelector('input[type="checkbox"]');
    var profCb = document.getElementById("c2pa-write-" + ft);
    if (profCb && simpleCb) profCb.checked = simpleCb.checked;
  });
  // DNT checkbox (no data-form-type)
  var simpleDnt = document.getElementById("sc2pa-dnt");
  var profDnt = document.getElementById("c2pa-write-dnt");
  if (profDnt && simpleDnt) profDnt.checked = simpleDnt.checked;
  // 2. Sync content type fields (title/author)
  var simpleFields = document.querySelectorAll(".sc2pa-field");
  simpleFields.forEach(function (f) {
    var type = f.dataset.type;
    var fname = f.dataset.field;
    var profF = document.getElementById("c2pa-field-" + type + "-" + fname);
    if (profF) profF.value = f.value;
  });
  // 3. Sync social & music links
  var simpleLinks = document.querySelectorAll(".sc2pa-link");
  simpleLinks.forEach(function (link) {
    var platform = link.dataset.platform;
    var profLink = document.getElementById("c2pa-link-" + platform);
    if (profLink) profLink.value = link.value;
  });
  // 4. Use the PI output as the image to sign (or watermark if PI not done)
  if (simpleResults.piFinalUrl && !simpleResults.piFinalBlob) {
    if (simpleResults.piFinalUrl.indexOf("blob:") === 0) {
      try {
        var resp = await fetch(simpleResults.piFinalUrl);
        simpleResults.piFinalBlob = await resp.blob();
      } catch (e) {}
    } else {
      simpleResults.piFinalBlob = dataUrlToBlob(simpleResults.piFinalUrl);
    }
  }
  var srcBlob = simpleResults.piFinalBlob || simpleResults.watermarkBlob;
  var fname = simpleFile ? simpleFile.name : "image.png";
  var srcFile = srcBlob
    ? new File([srcBlob], fname, { type: "image/png" })
    : simpleFile;
  var fileInput = document.getElementById("c2pa-write-file");
  if (fileInput && srcFile) {
    var dt = new DataTransfer();
    dt.items.add(srcFile);
    fileInput.files = dt.files;
  }
  var btn = document.getElementById("sc2pa-btn");
  btn.disabled = true;
  btn.textContent = __("simple.signing");
  var statusEl = document.getElementById("sc2pa-result");
  handleC2paWrite().then(function (result) {
    if (result && result.ok) {
      btn.textContent = __("simple.signed");
      simpleResults.c2pa = true;
      simpleResults.c2paUrl = window._c2paSignedUrl || "";
      simpleStepDone = true;
      var nextBtn = document.getElementById("simpleNextBtn");
      nextBtn.disabled = false;
      nextBtn.style.display = "";
      if (statusEl) statusEl.innerHTML = "";
    } else {
      var errMsg =
        (result && result.error) ||
        __("simple.c2pa_failed", "C2PA signing failed");
      btn.textContent = __("simple.failed_retry");
      btn.disabled = false;
      if (statusEl) {
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px;margin-top:12px">' +
          escapeHtml(errMsg) +
          "</div>";
      }
    }
  });
}


// Build combined fingerprint + DID payload, trimmed to fit maxBytes

function runWatermarkStep() {
  showProgress();
  var algo = parseInt(document.getElementById("swm-type").value, 10);
  var pass = document.getElementById("swm-password").value || "";
  var statusEl = document.getElementById("swm-status");
  var btn = document.getElementById("swm-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = __("simple.embedding", "Embedding...");
  }

  // Embed fingerprint only
  var payloadStr = JSON.stringify(simpleResults.fpResult || {});
  var secretFile = new File([payloadStr], "fingerprint.txt", {
    type: "text/plain",
  });

  watermarkEmbed(algo, simpleFile, secretFile, pass).then(function (result) {
    if (result.ok) {
      var wmNames = {
        2: "Frequency DCT",
        4: "Latent DCT",
        7: "Forensic",
        9: "Imatag-style",
      };
      simpleResults.watermark = true;
      simpleResults.watermarkAlgo = algo;
      simpleResults.watermarkAlgoName = wmNames[algo] || "Type " + algo;
      simpleResults.watermarkBlob = result.data;
      simpleResults.watermarkUrl = URL.createObjectURL(result.data);
      simpleResults.watermarkResult = result.msg
        ? result.msg.replace(/^Type\s+\d+\s+\([^)]+\):\s*/, "")
        : "";
      simpleStepDone = true;
      var nextBtn = document.getElementById("simpleNextBtn");
      nextBtn.disabled = false;
      nextBtn.style.display = "";
      if (btn) {
        btn.textContent = "✅ " + __("simple.watermarked_short", "Watermarked");
      }
      if (statusEl) {
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--success);padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
          __(
            "simple.wm_done",
            "✅ Watermark embedded successfully using fingerprint hash.",
          ) +
          "</div>";
      }
      hideProgress();
    } else {
      hideProgress();
      if (btn) {
        btn.disabled = false;
        btn.textContent = __("simple.watermark_btn", "Embed Watermark");
      }
      if (statusEl) {
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px">' +
          escapeHtml(result.error || __("simple.embed_failed")) +
          "</div>";
      }
    }
  });
}


async function runAudioWatermarkStep() {
  var fpAlgo = parseInt(document.getElementById("sawm-fp-type").value);
  var tsAlgo = parseInt(document.getElementById("sawm-ts-type").value);
  var pass = document.getElementById("sawm-password").value || "";
  var strength =
    parseInt(document.getElementById("sawm-strength").value) || 400;
  if (!pass) {
    alert("Password is required");
    return;
  }
  showProgress();
  var statusEl = document.getElementById("sawm-status");
  var btn = document.getElementById("sawm-btn");
  var progContainer = document.getElementById("sawm-progress");
  var progFill = document.getElementById("sawm-progress-fill");
  var progText = document.getElementById("sawm-progress-text");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Embedding...";
  }
  try {
    var info = await awLoadAudio(simpleFile);
    var key = await pw_key(pass);
    var fpMax = algoMaxBits(fpAlgo, info.samples.length, info.sr);
    var tsMax = algoMaxBits(tsAlgo, info.samples.length, info.sr);
    // Right channel: embed DID signature
    var didMsg = JSON.stringify(simpleResults.didSig || {});
    var tsBytes = new TextEncoder().encode(didMsg);
    var tsBits = awFormatPayload(tsBytes, key);
    if (tsBits.length > tsMax)
      throw new Error("DID message too long for algorithm " + tsAlgo);
    // Left channel: embed fingerprint only
    var fpPayload = JSON.stringify(simpleResults.fpResult || {});
    var fpBytes = new TextEncoder().encode(fpPayload);
    var fpBits = awFormatPayload(fpBytes, key);
    if (fpBits.length > fpMax)
      throw new Error(
        "Fingerprint message too long for algorithm " +
          fpAlgo +
          ". Need " +
          fpBits.length +
          " bits, max " +
          fpMax,
      );
    var algoNames = {
      1: "LSB Audio",
      2: "FFT-QIM",
      3: "Echo Hiding",
      4: "DSSS",
      5: "QIM",
      6: "DWT",
      7: "Patchwork",
      8: "DCT-based",
    };
    progContainer.style.display = "";
    progFill.style.width = "0%";

    // ── Zero-interference dual embed ──
    // Stereo: fingerprint in left channel, DID signature in right channel
    // Mono:   duplicate to both virtual channels → stereo
    var isStereo =
      info.ch >= 2 && info.raw && info.raw.length >= info.samples.length * 2;
    var leftSamples = new Int16Array(info.samples);
    var rightSamples;
    if (isStereo) {
      rightSamples = new Int16Array(info.samples.length);
      for (var ri = 0; ri < info.samples.length; ri++)
        rightSamples[ri] = info.raw[ri * info.ch + 1];
    } else {
      rightSamples = new Int16Array(info.samples);
    }

    progText.textContent =
      "Embedding fingerprint with " + algoNames[fpAlgo] + " (left channel, 0%)";
    var fpModified = await embedAlgo(
      fpAlgo,
      new Int16Array(leftSamples),
      fpBits,
      info.sr,
      strength,
      function (pct) {
        progFill.style.width = pct * 50 + "%";
        progText.textContent =
          "Embedding fingerprint with " +
          algoNames[fpAlgo] +
          " (" +
          Math.round(pct * 100) +
          "%)";
      },
    );
    progFill.style.width = "50%";
    await new Promise(function (r) {
      setTimeout(r, 50);
    });
    progText.textContent =
      "Embedding timestamp with " + algoNames[tsAlgo] + " (right channel, 0%)";
    var tsModified = await embedAlgo(
      tsAlgo,
      new Int16Array(rightSamples),
      tsBits,
      info.sr,
      strength,
      function (pct) {
        progFill.style.width = 50 + pct * 50 + "%";
        progText.textContent =
          "Embedding DID signature with " +
          algoNames[tsAlgo] +
          " (" +
          Math.round(pct * 100) +
          "%)";
      },
    );
    progFill.style.width = "100%";
    progText.textContent = "Finalizing...";

    var wavBuf = awWriteWav([fpModified, tsModified], info.sr, 2);
    var blob = new Blob([wavBuf], { type: "audio/wav" });
    simpleResults.audioWatermark = true;
    simpleResults.audioWatermarkBlob = blob;
    simpleResults.audioWatermarkUrl = URL.createObjectURL(blob);
    simpleResults.audioWatermarkFpAlgo = fpAlgo;
    simpleResults.audioWatermarkTsAlgo = tsAlgo;
    var origName = simpleFile.name.replace(/\.[^.]+$/, "");
    simpleResults.audioWatermarkFilename = origName + "_protected.wav";
    progContainer.style.display = "none";
    hideProgress();
    simpleStepDone = true;
    if (btn) {
      btn.textContent = "✅ Watermarked";
    }
    if (statusEl) {
      var chMode = isStereo ? "separate channels" : "split halves";
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--success);padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
        "✅ Audio watermarked with two non-interfering layers!<br>" +
        "Fingerprint: " +
        algoNames[fpAlgo] +
        " (" +
        (isStereo ? "left channel" : "first half") +
        ")<br>" +
        "DID Signature: " +
        algoNames[tsAlgo] +
        " (" +
        (isStereo ? "right channel" : "second half") +
        ")<br>" +
        "Mode: " +
        chMode +
        " — zero interference.</div>";
    }
    var nextBtn = document.getElementById("simpleNextBtn");
    nextBtn.disabled = false;
    nextBtn.style.display = "";
  } catch (e) {
    hideProgress();
    if (progContainer) progContainer.style.display = "none";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Embed Both Watermarks";
    }
    if (statusEl) {
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px">' +
        escapeHtml(e.message) +
        "</div>";
    }
  }
}

function algoMaxBits(algo, audioLen, sr) {
  if (algo === 1 || algo === 5) return audioLen;
  var fns = {
    2: aw2_maxBits,
    3: aw3_maxBits,
    4: aw4_maxBits,
    6: aw6_maxBits,
    7: aw7_maxBits,
    8: aw8_maxBits,
  };
  return fns[algo] ? fns[algo](audioLen, sr) : 0;
}

async function embedAlgo(algo, s16, bitsStr, sr, strength, onProgress) {
  if (algo === 1) return aw1_embed(s16, bitsStr);
  else if (algo === 2) return aw2_embed(s16, bitsStr, sr);
  else if (algo === 3) return aw3_embed(s16, bitsStr, sr);
  else if (algo === 4) return aw4_embed(s16, bitsStr, sr);
  else if (algo === 5) return aw5_embed(s16, bitsStr, sr);
  else if (algo === 6) return aw6_embed(s16, bitsStr, sr);
  else if (algo === 7) return aw7_embed(s16, bitsStr, sr);
  else if (algo === 8)
    return await aw8_embed_async(s16, bitsStr, sr, onProgress);
  throw new Error("Unknown algorithm: " + algo);
}




function runPixelInjectStep() {
  showProgress();
  var cat = document.getElementById("spi-category").value;
  var pass = document.getElementById("spi-password").value;
  var statusEl = document.getElementById("spi-status");
  var btn = document.getElementById("spi-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = __("simple.injecting", "Injecting...");
  }

  // Use DID signature as the message
  var didMessage = simpleResults.didSig
    ? "DID Signature:\n" + JSON.stringify(simpleResults.didSig, null, 2)
    : "";

  if (window.switchPiTab) window.switchPiTab("embed");

  setTimeout(function () {
    // Populate hidden professional form fields
    var fileInput = document.getElementById("pi-image");
    if (fileInput) {
      var srcFile = simpleResults.watermarkBlob
        ? new File([simpleResults.watermarkBlob], simpleFile.name, {
            type: simpleResults.watermarkBlob.type || simpleFile.type,
          })
        : simpleFile;
      if (srcFile) {
        var dt = new DataTransfer();
        dt.items.add(srcFile);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    }
    var catSelect = document.getElementById("pi-category");
    if (catSelect) {
      catSelect.value = cat;
      catSelect.dispatchEvent(new Event("change"));
    }
    var algoSelect = document.getElementById("pi-algorithm");
    var srcAlgo = document.getElementById("spi-algorithm");
    if (algoSelect && srcAlgo) algoSelect.value = srcAlgo.value;
    var msgInput = document.getElementById("pi-message");
    if (msgInput) msgInput.value = didMessage;
    var passInput = document.getElementById("pi-password");
    if (passInput) passInput.value = pass;

    function cleanupPiFields() {
      if (msgInput) msgInput.value = "";
      if (passInput) passInput.value = "";
      if (fileInput) {
        var dt2 = new DataTransfer();
        fileInput.files = dt2.files;
      }
    }

    var promise = window.handlePixelInjection();
    if (promise && promise.then) {
      promise
        .then(function () {
          simpleResults["pixel-injection"] = true;
          var piOutput = document.getElementById("pi-output");
          var piDownload = document.getElementById("pi-download");
          if (piOutput) simpleResults.piResultHtml = piOutput.innerHTML;
          if (piDownload) simpleResults.piHtml = piDownload.innerHTML;
          if (piDownload) {
            var piLink = piDownload.querySelector("a");
            if (piLink) simpleResults.piFinalUrl = piLink.href;
          }
          simpleStepDone = true;
          var nextBtn = document.getElementById("simpleNextBtn");
          nextBtn.disabled = false;
          nextBtn.style.display = "";

          if (btn) {
            btn.textContent = "✅ " + __("simple.injected", "Injected");
          }
          if (statusEl) {
            statusEl.innerHTML =
              '<div style="font-size:0.85rem;color:var(--success);padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
              __(
                "simple.pi_done_did",
                "✅ DID signature injected successfully as secret message.",
              ) +
              "</div>";
          }
          hideProgress();
        })
        .catch(function (e) {
          hideProgress();
          if (btn) {
            btn.disabled = false;
            btn.textContent = __("simple.pi_btn", "Inject Message");
          }
          if (statusEl) {
            statusEl.innerHTML =
              '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px">' +
              escapeHtml(
                e && e.message
                  ? e.message
                  : __("simple.pi_failed", "Injection failed"),
              ) +
              "</div>";
          }
        })
        .then(function () {
          cleanupPiFields();
        });
    }
  }, 50);
}



async function runTimestampStep() {
  if (!window.handleOtsCreate) return;
  var fileInput = document.getElementById("ts-create-file");
  if (fileInput) {
    // Use final output (C2PA/audio > injected > original) depending on available steps
    try {
      var srcUrl = null;
      if (simpleType === "image")
        srcUrl = simpleResults.c2paUrl || simpleResults.piFinalUrl;
      else if (simpleType === "audio") srcUrl = simpleResults.audioWatermarkUrl;
      if (srcUrl) {
        var blob;
        if (srcUrl.indexOf("blob:") === 0) {
          var resp = await fetch(srcUrl);
          blob = await resp.blob();
        } else {
          blob = dataUrlToBlob(srcUrl);
        }
        if (blob) {
          var finalFile = new File([blob], simpleFile.name, {
            type: simpleFile.type,
          });
          var dt = new DataTransfer();
          dt.items.add(finalFile);
          fileInput.files = dt.files;
        }
      } else if (simpleFile) {
        var dt = new DataTransfer();
        dt.items.add(simpleFile);
        fileInput.files = dt.files;
      }
      var evt = new Event("change");
      fileInput.dispatchEvent(evt);
    } catch (e) {
      if (simpleFile) {
        var dt = new DataTransfer();
        dt.items.add(simpleFile);
        fileInput.files = dt.files;
        var evt = new Event("change");
        fileInput.dispatchEvent(evt);
      }
    }
  }
  var promise = window.handleOtsCreate();
  if (promise && promise.then) {
    promise
      .then(function () {
        var resultDiv = document.getElementById("sts-result");
        if (resultDiv) {
          var text = escapeHtml(
            (document.getElementById("ts-output") || {}).textContent || "",
          );
          resultDiv.innerHTML =
            '<div class="simple-success">' +
            text.replace(/\n/g, "<br>") +
            "</div>";
        }
        simpleResults.timestamp = true;
        var tsOut = document.getElementById("ts-output");
        if (tsOut) {
          var rawText = tsOut.textContent || "";
          var hashMatch = rawText.match(/[a-f0-9]{64}/i);
          var hash = hashMatch ? hashMatch[0] : "";
          var hasAttestation =
            rawText.indexOf("blockchain") >= 0 ||
            rawText.indexOf("attestation") >= 0;
          var dateStr = new Date()
            .toISOString()
            .replace("T", " ")
            .substring(0, 19);
          if (hash) {
            simpleResults.tsResult =
              "Certificate Transparency\n" +
              "SHA-256: " +
              hash +
              "\n" +
              (hasAttestation
                ? "Logged: " +
                  dateStr +
                  "\nTransparency log: a.pool.opentimestamps.org\n"
                : "Created: " +
                  dateStr +
                  "\nStatus: Pending — awaiting blockchain attestation\n") +
              "Verifiable at: https://opentimestamps.org";
          } else {
            simpleResults.tsResult = rawText;
          }
        }
        var tsDl = document.getElementById("ts-download");
        if (tsDl) simpleResults.tsHtml = tsDl.innerHTML;
        simpleStepDone = true;
        document.getElementById("simpleNextBtn").disabled = false;
      })
      .catch(function (e) {
        var resultDiv = document.getElementById("sts-result");
        if (resultDiv)
          resultDiv.innerHTML =
            '<div class="simple-error">' +
            __("simple.ts_failed").replace("{msg}", escapeHtml(e.message)) +
            "</div>";
      });
  }
}


function runFingerprintStep() {
  if (!window.handleFingerprint) return;
  var fileInput = document.getElementById("fp-file");
  if (fileInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    fileInput.files = dt.files;
    var evt = new Event("change");
    fileInput.dispatchEvent(evt);
  }
  // Defer to next tick so the browser renders the spinner first
  setTimeout(function () {
    if (window.fastFingerprint) {
      var statusEl = document.getElementById("sfp-status");
      var _fpResultRef = null;
      var _fpPendingHashes = {};
      window
        .fastFingerprint(
          simpleFile,
          function (msg) {
            if (statusEl) statusEl.textContent = msg || "";
          },
          function (extraHashes) {
            if (_fpResultRef) {
              Object.assign(_fpResultRef.hashes, extraHashes);
            }
            Object.assign(_fpPendingHashes, extraHashes);
          },
        )
        .then(function (result) {
          _fpResultRef = result;
          Object.assign(result.hashes, _fpPendingHashes);
          var resultDiv = document.getElementById("sfp-result");
          if (resultDiv) {
            resultDiv.innerHTML =
              '<div class="simple-fp-result" style="font-size:0.85rem;color:var(--success);margin-top:12px;padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
              __(
                "simple.fp_done",
                "Digital fingerprint generated successfully. All hash algorithms and perceptual hashes are complete.",
              ) +
              "</div>";
          }
          simpleResults.fingerprint = true;
          simpleResults.fpResult = result;
          setResult('fpResult', result);
          simpleStepDone = true;
          document.getElementById("simpleNextBtn").disabled = false;
        })
        .catch(function (e) {
          var resultDiv = document.getElementById("sfp-result");
          if (resultDiv)
            resultDiv.innerHTML =
              '<div class="simple-error">' +
              __("simple.fp_failed").replace("{msg}", escapeHtml(e.message)) +
              "</div>";
        });
    } else {
      var promise = window.handleFingerprint();
      if (promise && promise.then) {
        promise
          .then(function () {
            var resultDiv = document.getElementById("sfp-result");
            var fpOutput = document.getElementById("fp-output");
            if (resultDiv) {
              resultDiv.innerHTML =
                '<div class="simple-fp-result" style="font-size:0.85rem;color:var(--success);margin-top:12px;padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
                __(
                  "simple.fp_done",
                  "Digital fingerprint generated successfully. All hash algorithms and perceptual hashes are complete.",
                ) +
                "</div>";
            }
            simpleResults.fingerprint = true;
            if (fpOutput) {
              simpleResults.fpHtml = fpOutput.innerHTML;
              simpleResults.fpResult = getResult('fpResult') || null;
            }
            simpleStepDone = true;
            document.getElementById("simpleNextBtn").disabled = false;
          })
          .catch(function (e) {
            var resultDiv = document.getElementById("sfp-result");
            if (resultDiv)
              resultDiv.innerHTML =
                '<div class="simple-error">' +
                __("simple.fp_failed").replace("{msg}", escapeHtml(e.message)) +
                "</div>";
          });
      }
    }
  }, 50);
}


async function runDIDStepGenerate() {
  var statusEl = document.getElementById("sdid-result");
  var genBtn = document.getElementById("sdid-gen-btn");
  var signBtn = document.getElementById("sdid-sign-btn");
  var algoSelect = document.getElementById("sdid-algo-select");
  var algo = algoSelect ? algoSelect.value : "Ed25519";
  if (statusEl)
    statusEl.innerHTML =
      '<div class="spinner" style="display:inline-block;margin:8px auto"></div><p style="font-size:0.82rem;color:var(--text-muted)">' +
      __("simple.did_generating", "Generating DID keypair...") +
      "</p>";
  try {
    var kp = await didGenerateKeypair(algo);
    didStoreKeys(kp.did, kp.privJwk, kp.algorithm);
    _didKp = kp;
    if (statusEl) {
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--success);padding:10px;background:rgba(40,167,69,.1);border-radius:8px">' +
        __("simple.did_generated", "✅ DID identity generated successfully!") +
        '<br><span style="font-size:0.75rem;word-break:break-all">' +
        kp.did +
        "</span></div>";
    }
    if (signBtn) signBtn.disabled = false;
    simpleResults.didIdentity = kp.did;
  } catch (e) {
    if (statusEl)
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
        __("simple.did_failed", "❌ DID generation failed: {msg}").replace(
          "{msg}",
          escapeHtml(e.message),
        ) +
        "</div>";
  }
}

async function runDIDStepSign() {
  var statusEl = document.getElementById("sdid-result");
  var signBtn = document.getElementById("sdid-sign-btn");
  var genBtn = document.getElementById("sdid-gen-btn");
  if (!_didKp) {
    var stored = didLoadKeys();
    if (stored) {
      try {
        _didKp = await didImportSignKey(stored);
      } catch (e) {
        didClearKeys();
        if (statusEl)
          statusEl.innerHTML =
            '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
            __(
              "simple.did_stored_keys_invalid",
              "Stored DID keys are invalid. Please generate a new identity.",
            ) +
            "</div>";
        var signBtn = document.getElementById("sdid-sign-btn");
        if (signBtn) signBtn.disabled = true;
        return;
      }
    } else {
      if (statusEl)
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
          __(
            "simple.did_no_keys_err",
            "Please generate a DID identity first.",
          ) +
          "</div>";
      return;
    }
  }
  if (!simpleResults.fpResult) {
    if (statusEl)
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
        __(
          "simple.did_no_fp",
          "No fingerprint found. Please complete the Fingerprint step first.",
        ) +
        "</div>";
    return;
  }
  if (statusEl)
    statusEl.innerHTML =
      '<div class="spinner" style="display:inline-block;margin:8px auto"></div><p style="font-size:0.82rem;color:var(--text-muted)">' +
      __("simple.did_signing", "Signing fingerprint...") +
      "</p>";
  try {
    var fpJson = JSON.stringify(simpleResults.fpResult.hashes || {});
    var sigBytes = await didSign(_didKp, fpJson);
    var sigBase64 = didSigToBase64(sigBytes);
    simpleResults.didSig = {
      did: _didKp.did,
      algorithm: _didKp.algorithm,
      signature: sigBase64,
      signedData: "fingerprint_hashes",
      timestamp: new Date().toISOString(),
    };
    var verifyOk = await didVerify(
      _didKp.publicKey,
      sigBytes,
      fpJson,
      _didKp.algorithm,
    );
    if (statusEl) {
      if (verifyOk) {
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--success);padding:10px;background:rgba(40,167,69,.1);border-radius:8px">' +
          __(
            "simple.did_signed_success",
            "✅ Fingerprint signed and verified successfully!",
          ) +
          "<br>" +
          '<span style="font-size:0.75rem;word-break:break-all">DID: ' +
          _didKp.did +
          "</span><br>" +
          '<span style="font-size:0.72rem;color:var(--text-muted)">' +
          __("simple.did_sig_algorithm", "Algorithm: {algo}").replace(
            "{algo}",
            _didKp.algorithm,
          ) +
          "</span></div>";
      } else {
        statusEl.innerHTML =
          '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
          __(
            "simple.did_verify_failed",
            "❌ Signature verification failed. Please regenerate your identity.",
          ) +
          "</div>";
      }
    }
    simpleStepDone = true;
    var nextBtn = document.getElementById("simpleNextBtn");
    if (nextBtn) nextBtn.disabled = false;
  } catch (e) {
    if (statusEl)
      statusEl.innerHTML =
        '<div style="font-size:0.85rem;color:var(--danger);padding:10px;background:rgba(220,53,69,.1);border-radius:8px">' +
        __("simple.did_failed", "❌ DID signing failed: {msg}").replace(
          "{msg}",
          escapeHtml(e.message),
        ) +
        "</div>";
  }
  // Clear sensitive key material from memory
  _didKp = null;
  _didSig = null;
}






// ── Helpers ──



// Init on DOM ready
document.addEventListener("DOMContentLoaded", initMode);
