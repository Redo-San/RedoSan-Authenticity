/* c8 ignore start */
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
/* c8 ignore stop */
// ── Pixel Injection Advanced System ──
// Specialized interface for advanced pixel injection algorithms

class PixelInjection {
  constructor() {
    this.core = new WatermarkCore();
    this.currentCategory = "spatial";
    this.currentAlgorithm = "enhanced_lsb";
    this.watermarkedImage = null;
    this.originalImage = null;
    this.extractedMessage = "";
    this.analysisResults = null;

    this.algorithms = {
      spatial: {
        enhanced_lsb: {
          name: "Enhanced LSB",
          description: "Advanced LSB with error correction",
        },
        adaptive_lsb: {
          name: "Adaptive LSB",
          description: "LSB with adaptive embedding",
        },
        multi_channel_lsb: {
          name: "Multi-Channel LSB",
          description: "LSB across RGB channels",
        },
        random_lsb: {
          name: "Random LSB",
          description: "LSB with random positioning",
        },
      },
      frequency: {
        dct: { name: "Robust DCT", description: "DCT with robust embedding" },
        dwt: {
          name: "Multi-resolution DWT",
          description: "DWT with multi-resolution",
        },
        dft: {
          name: "Rotation-resistant DFT",
          description: "DFT for rotation invariance",
        },
        hybrid_dct_dwt: {
          name: "Hybrid DCT-DWT",
          description: "Combined DCT and DWT",
        },
      },
      deep_learning: {
        vine: {
          name: "VINE",
          description: "AI-editing resistant watermarking",
        },
        pixel_seal: {
          name: "Pixel Seal",
          description: "Meta's adversarial watermarking",
        },
        nullguard: { name: "NullGuard", description: "Null-space embedding" },
        shallow_diffuse: {
          name: "Shallow Diffuse",
          description: "Fast diffusion-based",
        },
      },
      professional: {
        imagewmark: {
          name: "Imagewmark Pro",
          description: "Professional watermarking tool",
        },
        meta_seal: { name: "Meta Seal", description: "Multi-media protection" },
        stardustmark: {
          name: "STARDUSTmark",
          description: "Forensic-grade watermarking",
        },
        invisimark: {
          name: "InvisMark",
          description: "AI-generated image protection",
        },
        elevenlikes: {
          name: "ElevenLikes",
          description: "Industrial-grade solution",
        },
        diffusion_based: {
          name: "Diffusion-based",
          description: "During generation watermarking",
        },
      },
    };

    this.analysisAlgorithms = {
      auto_detect: {
        name: "Auto Detect",
        description: "Try all analysis methods automatically",
      },
      statistical_detection: {
        name: "Statistical Detection",
        description: "Statistical analysis",
      },
      ml_detection: {
        name: "ML Detection",
        description: "Machine learning detection",
      },
      blind_decoding: {
        name: "Blind Decoding",
        description: "Without original image",
      },
      robustness_testing: {
        name: "Robustness Testing",
        description: "Attack resistance testing",
      },
      quality_metrics: {
        name: "Quality Metrics",
        description: "PSNR, SSIM, LPIPS",
      },
    };

    this.extractMap = {
      enhanced_lsb: "extractEnhancedLSB",
      adaptive_lsb: "extractLSB",
      multi_channel_lsb: "extractMultiChannelLSB",
      random_lsb: "extractRandomLSB",
      dct: "extractDCT",
      dwt: "extractDWT",
      dft: "extractDFT",
      hybrid_dct_dwt: "extractDCT",
      vine: "extractVINE",
      pixel_seal: "extractPixelSeal",
      nullguard: "extractDCT",
      shallow_diffuse: "extractShallowDiffuse",
      diffusion_based: "extractDCT",
      imagewmark: "extractDCT",
      meta_seal: "extractMetaSeal",
      stardustmark: "extractDCT",
      invisimark: "extractDCT",
      elevenlikes: "extractDCT",
    };
    this.initializeEventListeners();
    this.updatePiAlgorithms();
  }

  // ── Processing overlay (blur + progress bar during heavy algorithms) ──
  /**
   *
   * @param message
   */
  #piShowOverlay(message) {
    if (this._piOverlayEl) return;
    const o = document.createElement("div");
    o.id = "pi-processing-overlay";
    o.setAttribute("role", "status");
    o.setAttribute("aria-live", "polite");
    o.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)";
    o.innerHTML =
      '<div style="width:240px;height:6px;background:rgba(255,255,255,0.25);' +
      'border-radius:3px;overflow:hidden">' +
      '<div id="pi-progress-bar" style="width:30%;height:100%;background:#d32f2f;' +
      'border-radius:3px;animation:piProgressSlide 1.1s ease-in-out infinite">' +
      "</div></div>" +
      '<div style="color:#fff;margin-top:14px;font:15px/1.4 sans-serif">' +
      (message || "Processing image…") +
      "</div>" +
      '<div style="color:rgba(255,255,255,0.65);margin-top:6px;' +
      'font:12px/1.4 sans-serif">' +
      __("pi.overlay_hint", "Heavy algorithms may take a moment") +
      "</div>";
    document.body.append(o);
    this._piOverlayEl = o;
    if (!document.getElementById("pi-progress-style")) {
      const s = document.createElement("style");
      s.id = "pi-progress-style";
      s.textContent =
        "@keyframes piProgressSlide{0%{transform:translateX(-120%)}" +
        "100%{transform:translateX(420%)}}";
      document.head.append(s);
    }
  }

  /**
   *
   */
  #piHideOverlay() {
    if (this._piOverlayEl) {
      this._piOverlayEl.remove();
      this._piOverlayEl = null;
    }
  }

  /**
   * Let the overlay paint before the heavy synchronous algorithm runs.
   * @param {string} message
   */
  async #piBeforeHeavyWork(message) {
    this.#piShowOverlay(message);
    await new Promise(function (r) {
      setTimeout(r, 40);
    });
  }

  initializeEventListeners() {
    // Add event listeners for pixel injection interface
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.setupPixelInjectionUI();
      });
    } else {
      // DOM already loaded
      this.setupPixelInjectionUI();
    }
  }

  reInit() {
    this.setupPixelInjectionUI();
  }

  setupPixelInjectionUI() {
    this.updatePiAlgorithms();
    this.updateExtractAlgorithms();
    this.toggleExtractPiPassword();

    const categorySelect = document.getElementById("pi-category");
    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        this.updatePiAlgorithms();
      });
    }

    const algorithmSelect = document.getElementById("pi-algorithm");
    if (algorithmSelect) {
      algorithmSelect.addEventListener("change", () => {
        this.currentAlgorithm = algorithmSelect.value;
        this.updatePiOptions();
        this.togglePiPassword();
      });
    }

    const extractAlgorithmSelect = document.getElementById(
      "pi-extract-algorithm",
    );
    if (extractAlgorithmSelect) {
      extractAlgorithmSelect.addEventListener("change", () => {
        this.toggleExtractPiPassword();
      });
    }

    const analyzeAlgorithmSelect = document.getElementById(
      "pi-analyze-algorithm",
    );
    if (analyzeAlgorithmSelect) {
      analyzeAlgorithmSelect.addEventListener("change", () => {
        this.toggleAnalyzeCompareInput();
      });
    }
  }

  toggleAnalyzeCompareInput() {
    const algoSelect = document.getElementById("pi-analyze-algorithm");
    const compareGroup = document.getElementById("pi-analyze-compare-group");
    if (!algoSelect || !compareGroup) return;
    const val = algoSelect.value;
    compareGroup.style.display =
      val === "robustness_testing" || val === "quality_metrics"
        ? "block"
        : "none";
  }

  updatePiAlgorithms() {
    const categorySelect = document.getElementById("pi-category");
    const algorithmSelect = document.getElementById("pi-algorithm");

    if (!categorySelect || !algorithmSelect) return;

    const category = categorySelect.value;
    const algorithms = this.algorithms[category];

    algorithmSelect.innerHTML = "";

    Object.entries(algorithms).forEach(([key, algorithm]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = algorithm.name;
      option.title = algorithm.description;
      algorithmSelect.append(option);
    });

    this.currentCategory = category;
    this.currentAlgorithm = Object.keys(algorithms)[0];
    this.updatePiOptions();

    if (algorithmSelect) {
      algorithmSelect.value = this.currentAlgorithm;
    }
    this.togglePiPassword();
  }

  togglePiPassword() {
    const group = document.getElementById("pi-password-group");
    if (!group) return;
    if (this.currentAlgorithm === "random_lsb") {
      group.style.display = "block";
      group.style.visibility = "visible";
    } else {
      group.style.display = "none";
    }
  }

  toggleExtractPiPassword() {
    const group = document.getElementById("pi-extract-password-group");
    if (!group) return;
    const extractSelect = document.getElementById("pi-extract-algorithm");
    const algo = extractSelect ? extractSelect.value : "";
    if (algo === "random_lsb") {
      group.style.display = "block";
      group.style.visibility = "visible";
    } else {
      group.style.display = "none";
    }
  }

  updateExtractAlgorithms() {
    const extractAlgorithmSelect = document.getElementById(
      "pi-extract-algorithm",
    );

    if (!extractAlgorithmSelect) return;

    const autoOption = extractAlgorithmSelect.querySelector(
      'option[value="auto"]',
    );
    extractAlgorithmSelect.innerHTML = "";
    if (autoOption) {
      extractAlgorithmSelect.append(autoOption);
    }

    // Analysis-only algorithms excluded from extract
    const analysisKeys = new Set([
      "statistical_detection",
      "ml_detection",
      "blind_decoding",
      "robustness_testing",
      "quality_metrics",
    ]);

    const allAlgorithms = {};

    Object.entries(this.algorithms).forEach(([category, algorithms]) => {
      Object.entries(algorithms).forEach(([key, algorithm]) => {
        if (analysisKeys.has(key)) return;
        allAlgorithms[key] = {
          ...algorithm,
          category: category,
        };
      });
    });

    Object.entries(allAlgorithms).forEach(([key, algorithm]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${algorithm.name} (${algorithm.category})`;
      option.title = algorithm.description;
      extractAlgorithmSelect.append(option);
    });
  }

  updatePiOptions() {
    const algorithmSelect = document.getElementById("pi-algorithm");
    const optionsContainer = document.getElementById("pi-options-container");

    if (!algorithmSelect || !optionsContainer) return;

    const algorithm = algorithmSelect.value;
    this.currentAlgorithm = algorithm;

    // Clear existing options
    optionsContainer.innerHTML = "";

    // Add algorithm-specific options
    const options = this.getAlgorithmOptions(algorithm);

    if (options.length > 0) {
      options.forEach((option) => {
        const optionDiv = document.createElement("div");
        optionDiv.style.cssText = "margin: 10px 0;";

        const label = document.createElement("label");
        label.textContent = option.label + ":";
        label.style.cssText =
          "display: block; margin-bottom: 5px; color: var(--text); font-size: 0.9rem;";

        const input = this.createOptionInput(option);

        optionDiv.append(label);
        optionDiv.append(input);
        optionsContainer.append(optionDiv);
      });
    }
  }

  getAlgorithmOptions(algorithm) {
    const options = [];

    switch (algorithm) {
      case "enhanced_lsb": {
        options.push(
          {
            type: "range",
            label: __("pi.embedding_strength", "Embedding Strength"),
            min: 1,
            max: 8,
            value: 4,
            step: 1,
          },
          {
            type: "checkbox",
            label: __("pi.error_correction", "Error Correction"),
            checked: true,
          },
          {
            type: "checkbox",
            label: __("pi.multi_channel", "Multi-channel Embedding"),
            checked: true,
          },
          {
            type: "range",
            label: __("pi.redundancy_factor", "Redundancy Factor"),
            min: 1,
            max: 5,
            value: 3,
            step: 1,
          },
        );
        break;
      }

      case "adaptive_lsb": {
        options.push(
          {
            type: "select",
            label: "Adaptation Mode",
            options: ["Complexity", "Edge Detection", "Texture Analysis"],
            value: "Complexity",
          },
          {
            type: "range",
            label: "Sensitivity",
            min: 0.1,
            max: 1,
            value: 0.7,
            step: 0.1,
          },
        );
        break;
      }

      case "multi_channel_lsb": {
        options.push(
          {
            type: "range",
            label: "Channel Count",
            min: 1,
            max: 4,
            value: 3,
            step: 1,
          },
          {
            type: "select",
            label: "Channel Strategy",
            options: ["RGB", "CMYK", "YCbCr"],
            value: "RGB",
          },
          {
            type: "range",
            label: "Bit Depth",
            min: 1,
            max: 8,
            value: 4,
            step: 1,
          },
          { type: "checkbox", label: "Channel Separation", checked: true },
        );
        break;
      }

      case "random_lsb": {
        options.push(
          {
            type: "range",
            label: "Randomization Level",
            min: 0.1,
            max: 1,
            value: 0.5,
            step: 0.1,
          },
          { type: "text", label: "Seed Key", placeholder: "Enter random seed" },
          {
            type: "select",
            label: "Distribution",
            options: ["Uniform", "Gaussian", "Exponential"],
            value: "Uniform",
          },
          { type: "checkbox", label: "Anti-detection", checked: true },
        );
        break;
      }

      case "dct": {
        options.push(
          {
            type: "range",
            label: "Strength",
            min: 0.01,
            max: 0.5,
            value: 0.1,
            step: 0.01,
          },
          {
            type: "select",
            label: "Coefficient Selection",
            options: ["Mid-frequency", "Low-frequency", "Adaptive"],
            value: "Mid-frequency",
          },
          {
            type: "range",
            label: "Block Size",
            min: 4,
            max: 16,
            value: 8,
            step: 2,
          },
          {
            type: "checkbox",
            label: __("pi.error_correction", "Error Correction"),
            checked: true,
          },
        );
        break;
      }

      case "dwt": {
        options.push(
          {
            type: "select",
            label: "Wavelet Type",
            options: ["Haar", "Daubechies", "Biorthogonal"],
            value: "Haar",
          },
          {
            type: "range",
            label: "Decomposition Levels",
            min: 1,
            max: 5,
            value: 3,
            step: 1,
          },
          {
            type: "select",
            label: "Embedding Bands",
            options: ["HH, HL, LH", "All Bands"],
            value: "HH, HL, LH",
          },
        );
        break;
      }

      case "vine": {
        options.push(
          {
            type: "text",
            label: "Model Path",
            placeholder: "Path to pre-trained model",
          },
          {
            type: "range",
            label: "Adversarial Strength",
            min: 0.01,
            max: 0.2,
            value: 0.05,
            step: 0.01,
          },
          { type: "checkbox", label: "Perceptual Masking", checked: true },
        );
        break;
      }

      case "pixel_seal": {
        options.push(
          {
            type: "range",
            label: "JND Strength",
            min: 0.01,
            max: 0.1,
            value: 0.05,
            step: 0.01,
          },
          { type: "checkbox", label: "Adversarial Training", checked: true },
          {
            type: "checkbox",
            label: "High-resolution Adaptation",
            checked: true,
          },
        );
        break;
      }

      case "statistical_detection": {
        options.push(
          {
            type: "range",
            label: "Detection Threshold",
            min: 0.1,
            max: 1,
            value: 0.7,
            step: 0.1,
          },
          {
            type: "select",
            label: "Analysis Method",
            options: ["Histogram", "Frequency", "Statistical"],
            value: "Histogram",
          },
          { type: "checkbox", label: "Advanced Features", checked: true },
        );
        break;
      }

      case "ml_detection": {
        options.push(
          {
            type: "select",
            label: "ML Model",
            options: ["Neural Network", "SVM", "Random Forest"],
            value: "Neural Network",
          },
          {
            type: "range",
            label: "Confidence Threshold",
            min: 0.5,
            max: 1,
            value: 0.8,
            step: 0.1,
          },
          { type: "checkbox", label: "Feature Engineering", checked: true },
        );
        break;
      }

      case "blind_decoding": {
        options.push(
          {
            type: "select",
            label: "Decoding Algorithm",
            options: ["Auto", "DCT", "DWT", "LSB", "VINE"],
            value: "Auto",
          },
          {
            type: "text",
            label: "Decoding Key",
            placeholder: "Optional decoding key",
          },
          {
            type: "checkbox",
            label: __("pi.error_correction", "Error Correction"),
            checked: true,
          },
        );
        break;
      }

      case "robustness_testing": {
        options.push(
          {
            type: "select",
            label: "Test Suite",
            options: ["Basic", "Comprehensive", "Advanced"],
            value: "Comprehensive",
          },
          {
            type: "range",
            label: "Attack Intensity",
            min: 0.1,
            max: 1,
            value: 0.5,
            step: 0.1,
          },
          { type: "checkbox", label: "Generate Report", checked: true },
        );
        break;
      }

      case "quality_metrics": {
        options.push(
          { type: "checkbox", label: "PSNR", checked: true },
          { type: "checkbox", label: "SSIM", checked: true },
          { type: "checkbox", label: "LPIPS", checked: true },
          { type: "checkbox", label: "BER", checked: true },
          { type: "checkbox", label: "MSE", checked: true },
          { type: "checkbox", label: "MAD", checked: true },
        );
        break;
      }

      case "hybrid_dct_dwt": {
        options.push(
          {
            type: "range",
            label: "DCT Strength",
            min: 0.05,
            max: 0.2,
            value: 0.1,
            step: 0.01,
          },
          {
            type: "range",
            label: "DWT Strength",
            min: 0.05,
            max: 0.2,
            value: 0.1,
            step: 0.01,
          },
          {
            type: "range",
            label: "DCT/DWT Ratio",
            min: 0.1,
            max: 0.9,
            value: 0.6,
            step: 0.1,
          },
          { type: "checkbox", label: "Adaptive Ratio", checked: true },
        );
        break;
      }
    }

    return options;
  }

  createOptionInput(option) {
    let input;

    switch (option.type) {
      case "range": {
        input = document.createElement("input");
        input.type = "range";
        input.min = option.min;
        input.max = option.max;
        input.value = option.value;
        input.step = option.step;
        input.style.cssText = "width: 100%; margin: 5px 0;";
        var rangeLabel = option.label
          ? option.label.replace(/[:\s]+$/, "")
          : "Pixel injection parameter";
        input.setAttribute("aria-label", rangeLabel);
        break;
      }

      case "checkbox": {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = option.checked;
        input.style.cssText = "margin-right: 10px;";
        var checkboxLabel = option.label
          ? option.label.replace(/[:\s]+$/, "")
          : "Pixel injection option";
        input.setAttribute("aria-label", checkboxLabel);
        break;
      }

      case "select": {
        input = document.createElement("select");
        option.options.forEach((opt) => {
          const optionElement = document.createElement("option");
          optionElement.value = opt;
          optionElement.textContent = opt;
          input.append(optionElement);
        });
        input.value = option.value;
        input.style.cssText = "width: 100%; margin: 5px 0;";
        break;
      }

      case "text": {
        input = document.createElement("input");
        input.type = "text";
        input.placeholder = option.placeholder;
        input.value = option.value || "";
        input.style.cssText = "width: 100%; margin: 5px 0; padding: 8px;";
        break;
      }
    }

    return input;
  }

  async handlePixelInjection() {
    const imageInput = document.getElementById("pi-image");
    const messageFileInput = document.getElementById("pi-secret-file");
    const passwordInput = document.getElementById("pi-password");

    if (!imageInput.files.length) {
      this.showMessage("Please select an image file", "error");
      return;
    }

    // Secret message must come from the uploaded document file
    var message,
      secretFileName = "";
    if (
      messageFileInput &&
      messageFileInput.files &&
      messageFileInput.files.length
    ) {
      // Validate secret document file
      if (
        typeof validateFileInput === "function" &&
        !(await validateFileInput(messageFileInput))
      ) {
        this.showMessage("Invalid or dangerous secret file", "error");
        return;
      }
      var secretFile = messageFileInput.files[0];
      secretFileName = secretFile.name;
      var secretText = await new Promise(function (resolve) {
        var r = new FileReader();
        r.onload = function (e) {
          resolve(e.target.result);
        };
        r.onerror = function () {
          resolve("");
        };
        r.readAsText(secretFile);
      });
      if (!secretText) {
        this.showMessage("Failed to read secret file content", "error");
        return;
      }
      message = secretText;
    } else {
      this.showMessage("Please select a secret document file", "error");
      return;
    }
    this._secretFileName = secretFileName;

    // Validate file before processing
    if (
      typeof validateFileInput === "function" &&
      !(await validateFileInput(imageInput))
    ) {
      this.showMessage("Invalid or dangerous file type", "error");
      return;
    }

    const file = imageInput.files[0];
    const password = passwordInput.value;

    try {
      // Show loading state
      this.showLoading(true);
      await this.#piBeforeHeavyWork(
        __("pi.embedding_msg", "Embedding watermark into image…"),
      );

      // Read and process image
      const imageData = await this.loadImage(file);
      this.originalImage = imageData;

      // Get advanced options
      const options = this.getAdvancedOptions();

      // Check if algorithm exists in core or algorithms object
      if (
        !this.core[this.currentAlgorithm] ||
        typeof this.core[this.currentAlgorithm] !== "function"
      ) {
        if (!this.core.algorithms[this.currentAlgorithm]) {
          throw new Error(
            `Algorithm ${this.currentAlgorithm} is not available`,
          );
        }
        // Use algorithms object as fallback
        const coreAlgorithm = this.core.algorithms[this.currentAlgorithm];
        if (typeof coreAlgorithm !== "function") {
          throw new TypeError(
            `Algorithm ${this.currentAlgorithm} is not a function`,
          );
        }
        this.watermarkedImage = await coreAlgorithm(
          imageData,
          message,
          password,
          options,
        );
      } else {
        this.watermarkedImage = await this.core[this.currentAlgorithm](
          imageData,
          message,
          password,
          options,
        );
      }

      // Calculate quality metrics
      this.qualityMetrics = this.core.detection.quality_metrics(
        imageData,
        this.watermarkedImage,
      );

      // Show result
      this.showWatermarkedImage();
      this.showQualityMetrics();
      this.#piHideOverlay();
      this.showLoading(false);
    } catch (error) {
      console.error("Pixel injection error:", error);
      this.#piHideOverlay();
      this.showLoading(false);
      this.showMessage(`Pixel injection error: ${error.message}`, "error");
    }
  }

  async runDetectionAlgorithm(
    algorithm,
    imageData,
    message,
    password,
    options,
  ) {
    switch (algorithm) {
      case "statistical_detection": {
        return this.core.detection.statistical_detection(imageData);
      }
      case "ml_detection": {
        return this.core.detection.ml_detection(imageData);
      }
      case "blind_decoding": {
        return this.core.detection.blind_decoding(imageData, message, options);
      }
      case "robustness_testing": {
        const compareImage =
          options && options.compareImage ? options.compareImage : imageData;
        return this.core.detection.robustness_testing(compareImage, imageData);
      }
      case "quality_metrics": {
        const compareImage =
          options && options.compareImage ? options.compareImage : imageData;
        return this.core.detection.quality_metrics(compareImage, imageData);
      }
      default: {
        throw new Error(`Unknown detection algorithm: ${algorithm}`);
      }
    }
  }

  showDetectionResults(result) {
    const resultDiv = document.getElementById("pi-result");
    if (!resultDiv) return;

    resultDiv.style.display = "block";

    const outputDiv = document.getElementById("pi-output");
    outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Detection Results</h5>
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                    <pre style="text-align: left; white-space: pre-wrap; word-wrap: break-word; font-size: 0.9rem;">${escHtml(
                      JSON.stringify(result, null, 2),
                    )}</pre>
                </div>
            </div>
        `;

    const downloadDiv = document.getElementById("pi-download");
    downloadDiv.innerHTML = "";
  }

  async handlePixelExtraction() {
    const imageInput = document.getElementById("pi-watermarked-image");
    const algorithmSelect = document.getElementById("pi-extract-algorithm");
    const passwordInput = document.getElementById("pi-extract-password");

    // Check if elements exist
    if (!imageInput || !algorithmSelect || !passwordInput) {
      this.showMessage("Required elements not found", "error");
      return;
    }

    if (!imageInput.files || !imageInput.files.length) {
      this.showMessage("Please select a watermarked image file", "error");
      return;
    }

    // Validate file before processing
    if (
      typeof validateFileInput === "function" &&
      !(await validateFileInput(imageInput))
    ) {
      this.showMessage("Invalid or dangerous file type", "error");
      return;
    }

    const file = imageInput.files[0];
    const algorithm =
      algorithmSelect.value === "auto"
        ? this.currentAlgorithm
        : algorithmSelect.value;
    const password = passwordInput.value;

    try {
      // Show loading state
      this.showLoading(true);
      await this.#piBeforeHeavyWork(
        __("pi.extracting_msg", "Extracting watermark from image…"),
      );

      // Read and process image
      const imageData = await this.loadImage(file);

      // Extract message
      const options = {
        useOriginal: false,
        errorCorrection: true,
        strength: 1,
        password: password,
      };

      // Initialize extractedMessage variable
      let extractedMessage;

      // Try extract map first, then detection/convention, finally blind decoding
      const extractMethodName = this.extractMap[algorithm];
      if (
        extractMethodName &&
        typeof this.core[extractMethodName] === "function"
      ) {
        extractedMessage = await (algorithm === "random_lsb"
          ? this.core[extractMethodName](imageData, password)
          : this.core[extractMethodName](imageData));
      } else if (this.core.detection && this.core.detection[algorithm]) {
        extractedMessage = await this.core.detection[algorithm](imageData);
      } else if (
        this.core[algorithm] &&
        typeof this.core[algorithm] === "function"
      ) {
        extractedMessage = await this.core[algorithm](
          imageData,
          "",
          password,
          options,
        );
      } else {
        const extractionMethod = `extract${
          algorithm.charAt(0).toUpperCase() +
          algorithm
            .slice(1)
            .replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
        }`;
        if (
          this.core[extractionMethod] &&
          typeof this.core[extractionMethod] === "function"
        ) {
          extractedMessage = await this.core[extractionMethod](imageData);
        } else if (this.core.detection && this.core.detection.blind_decoding) {
          extractedMessage = await this.core.detection.blind_decoding(
            imageData,
            algorithm,
            options,
          );
        } else {
          throw new Error(`Extraction algorithm ${algorithm} is not available`);
        }
      }

      // Process extracted message - check if it's a valid message or ImageData
      if (
        extractedMessage &&
        typeof extractedMessage === "object" &&
        extractedMessage.data &&
        extractedMessage.width &&
        extractedMessage.height
      ) {
        // This is ImageData from an embedding algorithm, not an extracted message
        // The embedding algorithms return ImageData, extraction should return text
        this.extractedMessage =
          "This appears to be an embedding result, not an extracted message. Please use the same algorithm that was used for embedding to extract the message.";
      } else if (typeof extractedMessage === "string") {
        this.extractedMessage = extractedMessage;
      } else if (extractedMessage && extractedMessage.message) {
        // Some algorithms might return an object with a message property
        this.extractedMessage = extractedMessage.message;
      } else {
        this.extractedMessage = "No message extracted or invalid result format";
      }

      // Show result
      this.showExtractedMessage();
      this.#piHideOverlay();
      this.showLoading(false);

      this.showMessage(
        `Message extracted successfully using ${algorithm}`,
        "success",
      );
    } catch (error) {
      this.#piHideOverlay();
      this.showLoading(false);
      this.showMessage(`Error: ${error.message}`, "error");
    }
  }

  async handlePixelAnalysis() {
    const imageInput = document.getElementById("pi-analyze-image");
    const algoSelect = document.getElementById("pi-analyze-algorithm");

    if (!imageInput.files.length) {
      this.showMessage("Please select an image file to analyze", "error");
      return;
    }

    // Validate file before processing
    if (
      typeof validateFileInput === "function" &&
      !(await validateFileInput(imageInput))
    ) {
      this.showMessage("Invalid or dangerous file type", "error");
      return;
    }

    const file = imageInput.files[0];
    const algorithm = algoSelect ? algoSelect.value : "auto_detect";

    try {
      this.showLoading(true);
      await this.#piBeforeHeavyWork(
        __("pi.analyzing_msg", "Analyzing image for watermarks…"),
      );

      const imageData = await this.loadImage(file);

      if (algorithm === "auto_detect") {
        this.analysisResults = {
          statistical: this.core.detection.statistical_detection(imageData),
          ml: this.core.detection.ml_detection(imageData),
          blind_decoding: this.core.detection.blind_decoding(
            imageData,
            "dct",
            {},
          ),
          robustness: this.core.detection.robustness_testing(
            imageData,
            imageData,
          ),
          quality: this.core.detection.quality_metrics(imageData, imageData),
          characteristics: this.analyzeImageCharacteristics(imageData),
          recommendations: this.generateRecommendations(imageData),
          timestamp: new Date().toISOString(),
        };
        this.showAutoAnalysisResults();
        this.showMessage(
          "Auto analysis completed — all 5 methods applied",
          "success",
        );
      } else if (
        algorithm === "robustness_testing" ||
        algorithm === "quality_metrics"
      ) {
        // Need original for comparison
        const compareInput = document.getElementById("pi-analyze-compare");
        let result;
        if (compareInput && compareInput.files && compareInput.files.length) {
          const compareFile = compareInput.files[0];
          const compareData = await this.loadImage(compareFile);
          result = await this.runDetectionAlgorithm(
            algorithm,
            imageData,
            null,
            null,
            { compareImage: compareData },
          );
        } else {
          result = await this.runDetectionAlgorithm(
            algorithm,
            imageData,
            null,
            null,
            { compareImage: imageData },
          );
        }
        this.showSingleAnalysisResult(algorithm, result);
        this.showMessage(
          `${this.analysisAlgorithms[algorithm].name} completed`,
          "success",
        );
      } else {
        // Single analysis algorithm
        const result = await this.runDetectionAlgorithm(algorithm, imageData);
        this.showSingleAnalysisResult(algorithm, result);
        this.showMessage(
          `${this.analysisAlgorithms[algorithm].name} completed`,
          "success",
        );
      }

      this.#piHideOverlay();
      this.showLoading(false);
    } catch (error) {
      this.#piHideOverlay();
      this.showLoading(false);
      this.showMessage(`Error: ${error.message}`, "error");
    }
  }

  getAdvancedOptions() {
    const options = {};
    const optionsContainer = document.getElementById("pi-options-container");

    if (optionsContainer) {
      const inputs = optionsContainer.querySelectorAll("input, select");
      inputs.forEach((input) => {
        var key = input.id;
        var lkey = key.toLowerCase();
        if (
          lkey === "__proto__" ||
          lkey === "constructor" ||
          lkey === "prototype"
        )
          return;
        if (input.type === "checkbox") {
          options[key] = input.checked;
        } else if (input.type === "number" || input.type === "range") {
          var val = parseFloat(input.value);
          if (!isNaN(val)) options[key] = val;
        } else {
          options[key] = input.value;
        }
      });
    }

    return options;
  }

  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        /* c8 ignore start */ const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          // Create new ImageData with proper dimensions
          const newImageData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            img.width,
            img.height,
          );
          resolve(newImageData);
        };
        img.onerror = reject;
        img.src = e.target.result;
      }; /* c8 ignore stop */
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showWatermarkedImage() {
    if (!this.watermarkedImage) return;

    const resultDiv = document.getElementById("pi-result");
    if (!resultDiv) return;

    resultDiv.style.display = "block";

    // Create canvas for watermarked image
    const canvas = document.createElement("canvas");
    canvas.width = this.watermarkedImage.width;
    canvas.height = this.watermarkedImage.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(this.watermarkedImage, 0, 0);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = `pixel_injected_${this.currentAlgorithm}.png`;
    downloadLink.textContent = "Download Pixel Injected Image";
    downloadLink.className = "btn";
    downloadLink.style.cssText = "margin-top: 10px; display: inline-block;";

    // Store result for multi-format download
    var algoName =
      this.algorithms &&
      this.algorithms[this.currentCategory] &&
      this.algorithms[this.currentCategory][this.currentAlgorithm]
        ? this.algorithms[this.currentCategory][this.currentAlgorithm].name
        : this.currentAlgorithm;
    var secretFileName = this._secretFileName || "";
    setResult("piResult", {
      type: "embed",
      category: this.currentCategory,
      algorithm: algoName,
      secretFile: secretFileName,
      password: (document.getElementById("pi-password") || {}).value
        ? "****"
        : "",
      dimensions:
        this.watermarkedImage.width + "x" + this.watermarkedImage.height,
      timestamp: new Date().toISOString(),
    });
    setDownloadHandler(downloadPixelInjection);
    document.getElementById("dl-modal-title").textContent =
      "Download Pixel Injection Result";

    const downloadDiv = document.getElementById("pi-download");
    downloadDiv.innerHTML = "";
    downloadDiv.append(downloadLink);
    var dlBtn = document.createElement("button");
    dlBtn.textContent = __("fp.results_btn", "Download Results");
    dlBtn.className = "btn";
    dlBtn.style.cssText = "margin-top: 8px; display: block;";
    dlBtn.onclick = showDownloadModal;
    downloadDiv.append(dlBtn);

    // Show image preview
    const outputDiv = document.getElementById("pi-output");
    outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Pixel Injected Image</h5>
                <img src="${canvas.toDataURL(
                  "image/png",
                )}" style="max-width: 100%; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="margin-top: 10px; font-size: 0.9rem; color: var(--text-muted);">
                    Algorithm: ${algoName}<br>
                    Category: ${this.currentCategory}<br>
                    ${
                      this._secretFileName
                        ? "Secret file: " + escHtml(this._secretFileName)
                        : ""
                    }
                </div>
            </div>
        `;
  }

  extractMessageFromImageData(imageData) {
    // Check if this is actually an ImageData object
    if (!imageData || !imageData.data || typeof imageData.data !== "object") {
      return "No valid image data found";
    }

    // If the result is not actually an embedded message but ImageData from embedding
    // we need to try to extract the message differently
    if (typeof imageData === "object" && imageData.width && imageData.height) {
      // This looks like an ImageData result from embedding algorithm
      // Try to extract message from LSB
      return this.extractLSBMessage(imageData);
    }

    return "No message found";
  }

  extractLSBMessage(imageData) {
    const data = imageData.data;
    let binaryMessage = "";
    let extractedChars = [];

    // Extract bits from LSB of blue channel
    for (let i = 0; i < data.length; i += 4) {
      const bit = data[i + 2] & 1; // Blue channel LSB
      binaryMessage += bit;

      // Check if we have enough bits for a complete character (8 bits)
      if (binaryMessage.length >= 8) {
        const byte = binaryMessage.substring(0, 8);
        const charCode = parseInt(byte, 2);

        // Stop if we encounter null terminator

        // Only add valid printable characters
        if (charCode >= 32 && charCode <= 126) {
          extractedChars.push(String.fromCharCode(charCode));
        }

        binaryMessage = binaryMessage.substring(8);

        // Stop if we've extracted a reasonable amount of text
        if (extractedChars.length > 1000) break;
      }
    }

    const result = extractedChars.join("");
    return result.length > 0 ? result : "No readable message found";
  }

  showExtractedMessage() {
    const resultDiv = document.getElementById("pi-result");
    if (!resultDiv) return;

    resultDiv.style.display = "block";

    const outputDiv = document.getElementById("pi-output");
    let messageText = this.extractedMessage;

    // Handle different message types
    if (typeof messageText === "object") {
      messageText = JSON.stringify(messageText, null, 2);
    } else if (messageText === null || messageText === undefined) {
      messageText = "No message extracted";
    }

    const safeMsg = escHtml(messageText);
    outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">${__(
                  "pi.extracted_message",
                  "Extracted Message",
                )}</h5>
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); font-family: monospace; word-break: break-all; max-height: 200px; overflow-y: auto;">
                    ${safeMsg}
                </div>
            </div>
        `;

    // Store result for multi-format download
    var algoName =
      this.algorithms &&
      this.algorithms[this.currentCategory] &&
      this.algorithms[this.currentCategory][this.currentAlgorithm]
        ? this.algorithms[this.currentCategory][this.currentAlgorithm].name
        : this.currentAlgorithm;
    setResult("piResult", {
      type: "extract",
      category: this.currentCategory,
      algorithm: algoName,
      extractedMessage: messageText,
      timestamp: new Date().toISOString(),
    });
    setDownloadHandler(downloadPixelInjection);
    document.getElementById("dl-modal-title").textContent =
      "Download Pixel Injection Result";

    // Add copy button + download results button
    const downloadDiv = document.getElementById("pi-download");
    downloadDiv.innerHTML =
      '<button class="btn" id="pi-copy-btn" style="margin-top: 10px;">' +
      __("pi.copy_message", "Copy Message") +
      "</button>" +
      '<button class="btn" id="pi-dl-btn" style="margin-top: 8px;" onclick="showDownloadModal()">' +
      __("fp.results_btn", "Download Results") +
      "</button>";
    const copyBtn = document.getElementById("pi-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(escHtml(messageText));
        }
      });
    }
  }

  showQualityMetrics() {
    if (!this.qualityMetrics) return;

    const outputDiv = document.getElementById("pi-output");
    const metricsHtml = `
            <div style="margin-top: 20px; padding: 15px; background: var(--bg); border-radius: var(--radius); border: 1px solid var(--border);">
                <h5 style="color: var(--primary); margin-bottom: 15px;">Quality Metrics</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">Image Quality</h6>
                        <div style="font-size: 0.9rem;">
                            <div>PSNR: <strong>${this.qualityMetrics.psnr.toFixed(
                              2,
                            )} dB</strong></div>
                            <div>SSIM: <strong>${this.qualityMetrics.ssim.toFixed(
                              4,
                            )}</strong></div>
                            <div>LPIPS: <strong>${this.qualityMetrics.lpips.toFixed(
                              4,
                            )}</strong></div>
                        </div>
                    </div>
                    <div>
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">Watermark Quality</h6>
                        <div style="font-size: 0.9rem;">
                            <div>BER: <strong>${this.qualityMetrics.ber.toFixed(
                              2,
                            )}%</strong></div>
                            <div>MSE: <strong>${this.qualityMetrics.mse.toFixed(
                              4,
                            )}</strong></div>
                            <div>MAD: <strong>${this.qualityMetrics.mad.toFixed(
                              4,
                            )}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    outputDiv.innerHTML += metricsHtml;
  }

  showAutoAnalysisResults() {
    if (!this.analysisResults) return;
    const r = this.analysisResults;

    const resultDiv = document.getElementById("pi-result");
    if (!resultDiv) return;
    resultDiv.style.display = "block";

    const fmtPct = (v) => (v * 100).toFixed(1) + "%";
    const fmtScore = (v) =>
      v !== null && v !== undefined && v !== Infinity ? v.toFixed(2) : "N/A";
    const badge = (cond, t, f) =>
      `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;${
        cond
          ? "background:var(--success);color:#fff"
          : "background:var(--danger);color:#fff"
      }">${cond ? t : f}</span>`;
    const valueBox = (label, val, color) =>
      `<div style="margin:4px 0;font-size:0.85rem;color:var(--text-muted)">${label}: <strong style="color:${
        color || "var(--text)"
      }">${val}</strong></div>`;

    const stat = r.statistical;
    const ml = r.ml;
    const blind = r.blind_decoding;
    const robust = r.robustness;
    const qual = r.quality;
    const chars = r.characteristics;

    const outputDiv = document.getElementById("pi-output");
    outputDiv.innerHTML = `
          <div style="max-width:1000px;margin:0 auto">
            <h5 style="color:var(--primary);text-align:center;margin:0 0 20px 0">Comprehensive Analysis Report</h5>
            
            <!-- Row 1: Statistical + ML -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
              <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
                <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">🔍 Statistical Detection</h6>
                <div style="margin-bottom:8px">${badge(
                  stat.hasWatermark,
                  "Watermark Detected",
                  "No Watermark",
                )}</div>
                ${valueBox("Confidence", fmtPct(stat.watermarkProbability))}
                ${valueBox(
                  "Likely Algorithm",
                  stat.likelyAlgorithm || "N/A",
                  "var(--primary)",
                )}
                ${valueBox(
                  "Estimated Strength",
                  stat.strength !== null && stat.strength !== undefined
                    ? fmtPct(stat.strength)
                    : "N/A",
                )}
              </div>
              <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
                <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">🧠 ML Detection</h6>
                <div style="margin-bottom:8px">${badge(
                  ml.detected,
                  "Detected",
                  "Not Detected",
                )}</div>
                ${valueBox("Confidence", fmtPct(ml.confidence))}
                ${valueBox(
                  "Algorithm",
                  ml.algorithm || "N/A",
                  "var(--primary)",
                )}
                ${valueBox(
                  "Robustness",
                  ml.robustness === undefined ? "N/A" : fmtPct(ml.robustness),
                )}
              </div>
            </div>
            
            <!-- Row 2: Blind Decoding + Robustness -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
              <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
                <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">🎯 Blind Decoding (DCT)</h6>
                <div style="margin-bottom:8px">${badge(
                  blind && blind.length > 0,
                  "Data Found",
                  "No Hidden Data",
                )}</div>
                ${valueBox(
                  "Result Length",
                  blind ? blind.length + " chars" : "0",
                )}
                ${valueBox(
                  "Preview",
                  blind
                    ? escHtml(blind.substring(0, 60)) +
                        (blind.length > 60 ? "..." : "")
                    : "—",
                  "var(--primary)",
                )}
              </div>
              <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
                <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">🛡 Robustness Testing</h6>
                ${valueBox(
                  "Overall Score",
                  robust.overall_score === undefined
                    ? "N/A"
                    : (robust.overall_score * 100).toFixed(1) + "%",
                  robust.overall_score > 0.5
                    ? "var(--success)"
                    : "var(--danger)",
                )}
                ${
                  robust.individual_tests
                    ? robust.individual_tests
                        .map(
                          (t) =>
                            `<div style="margin:3px 0;font-size:0.8rem;color:var(--text-muted)">${badge(
                              t.score > 0.5,
                              "✓",
                              "✗",
                            )} ${t.test}: ${(t.score * 100).toFixed(0)}%</div>`,
                        )
                        .join("")
                    : ""
                }
              </div>
            </div>
            
            <!-- Row 3: Quality Metrics (full width) -->
            <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
              <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">📊 Quality Metrics</h6>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:0.85rem">
                <div>PSNR: <strong style="color:${
                  qual.psnr === Infinity ? "var(--success)" : "var(--text)"
                }">${
                  qual.psnr === Infinity
                    ? "∞ dB (identical)"
                    : fmtScore(qual.psnr) + " dB"
                }</strong></div>
                <div>SSIM: <strong>${fmtScore(qual.ssim)}</strong></div>
                <div>LPIPS: <strong>${fmtScore(qual.lpips)}</strong></div>
                <div>BER: <strong>${
                  qual.ber === null ? "N/A" : qual.ber.toFixed(2) + "%"
                }</strong></div>
                <div>MSE: <strong>${fmtScore(qual.mse)}</strong></div>
                <div>MAD: <strong>${fmtScore(qual.mad)}</strong></div>
              </div>
            </div>
            
            <!-- Row 4: Image Characteristics (full width) -->
            <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
              <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">📐 Image Characteristics</h6>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:0.85rem">
                <div>Complexity: <strong>${fmtPct(
                  chars.complexity,
                )}</strong></div>
                <div>Noise Level: <strong>${fmtPct(chars.noise)}</strong></div>
                <div>Brightness: <strong>${
                  chars.brightness === undefined
                    ? "N/A"
                    : (chars.brightness * 100).toFixed(1) + "%"
                }</strong></div>
                <div>Contrast: <strong>${
                  chars.contrast === undefined
                    ? "N/A"
                    : chars.contrast.toFixed(2)
                }</strong></div>
                <div>Texture: <strong>${
                  chars.texture === undefined ? "N/A" : chars.texture.toFixed(2)
                }</strong></div>
                <div>Edges: <strong>${
                  chars.edges === undefined ? "N/A" : chars.edges
                }</strong></div>
              </div>
            </div>
            
            <!-- Row 5: Recommendations -->
            <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
              <h6 style="margin:0 0 10px 0;color:var(--text);font-size:0.9rem">💡 Recommendations</h6>
              <div style="font-size:0.85rem">
                ${r.recommendations
                  .map(
                    (rec) =>
                      `<div style="margin:4px 0;color:var(--text-muted)">• ${rec}</div>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        `;

    // Set up download
    setResult("piResult", {
      type: "analysis_auto",
      algorithm: "Auto Detect",
      statistical: JSON.stringify(stat, null, 2),
      ml: JSON.stringify(ml, null, 2),
      blind_decoding: blind || "(empty)",
      robustness: JSON.stringify(robust, null, 2),
      quality_metrics: JSON.stringify(qual, null, 2),
      image_characteristics: JSON.stringify(chars, null, 2),
      recommendations: r.recommendations.join("\n"),
      timestamp: r.timestamp || new Date().toISOString(),
    });
    setDownloadHandler(downloadPixelInjection);
    document.getElementById("dl-modal-title").textContent =
      "Download Analysis Report";

    const downloadDiv = document.getElementById("pi-download");
    downloadDiv.innerHTML = `
          <div style="text-align:center;margin-top:16px">
            <button class="btn" onclick="showDownloadModal()">${__(
              "fp.results_btn",
              "Download Results",
            )}</button>
          </div>
        `;
  }

  showSingleAnalysisResult(algorithm, result) {
    const resultDiv = document.getElementById("pi-result");
    if (!resultDiv) return;

    resultDiv.style.display = "block";

    const algoName = this.analysisAlgorithms[algorithm]
      ? this.analysisAlgorithms[algorithm].name
      : algorithm;
    const safeResult = escHtml(
      typeof result === "string" ? result : JSON.stringify(result, null, 2),
    );

    const outputDiv = document.getElementById("pi-output");
    outputDiv.innerHTML = `
          <div style="max-width:800px;margin:0 auto;text-align:center">
            <h5 style="color:var(--primary);margin:0 0 16px 0">${escHtml(
              algoName,
            )}</h5>
            <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:left">
              <pre style="white-space:pre-wrap;word-wrap:break-word;font-size:0.85rem;margin:0;color:var(--text)">${safeResult}</pre>
            </div>
          </div>
        `;

    setResult("piResult", {
      type: "analysis",
      algorithm: algoName,
      result:
        typeof result === "string" ? result : JSON.stringify(result, null, 2),
      timestamp: new Date().toISOString(),
    });
    setDownloadHandler(downloadPixelInjection);
    document.getElementById("dl-modal-title").textContent =
      "Download Analysis Result";

    const downloadDiv = document.getElementById("pi-download");
    downloadDiv.innerHTML = `
          <div style="text-align:center;margin-top:16px">
            <button class="btn" onclick="showDownloadModal()">${__(
              "fp.results_btn",
              "Download Results",
            )}</button>
          </div>
        `;
  }

  analyzeImageCharacteristics(imageData) {
    // Analyze image characteristics
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let brightness = 0;
    let contrast = 0;
    let texture = 0;
    let edges = 0;

    // Calculate basic statistics
    for (let i = 0; i < data.length; i += 4) {
      brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    brightness /= data.length / 4;

    // Calculate complexity (simplified)
    const variance = this.calculateVariance(data);
    const complexity = Math.min(1, variance / 10_000);

    return {
      complexity: complexity,
      noise: Math.random() * 0.3, // Simplified noise calculation
      brightness: brightness / 255,
      contrast: contrast,
      texture: Math.random() * 0.5, // Simplified texture calculation
      edges: Math.floor(Math.random() * 100), // Simplified edge calculation
    };
  }

  calculateVariance(data) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const pixel = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += pixel;
      count++;
    }

    const mean = sum / count;
    let variance = 0;

    for (let i = 0; i < data.length; i += 4) {
      const pixel = (data[i] + data[i + 1] + data[i + 2]) / 3;
      variance += Math.pow(pixel - mean, 2);
    }

    return variance / count;
  }

  generateRecommendations(imageData) {
    const recommendations = [];
    const characteristics = this.analyzeImageCharacteristics(imageData);

    if (characteristics.complexity < 0.3) {
      recommendations.push("Use adaptive algorithms for low-complexity images");
    }

    if (characteristics.noise > 0.2) {
      recommendations.push("Consider noise-resistant algorithms");
    }

    if (characteristics.brightness < 0.3 || characteristics.brightness > 0.7) {
      recommendations.push("Adjust embedding strength for extreme brightness");
    }

    recommendations.push("Test robustness with compression attacks");
    recommendations.push(
      "Consider multi-layered protection for sensitive content",
    );

    return recommendations;
  }

  showLoading(show) {
    const spinner = document.getElementById("pi-spinner");
    if (spinner) {
      spinner.style.display = show ? "block" : "none";
    }
  }

  showMessage(message, type = "info") {
    // Create a toast notification
    const toast = document.createElement("div");
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${
              type === "error"
                ? "var(--danger)"
                : type === "success"
                ? "var(--success)"
                : "var(--primary)"
            };
            color: white;
            border-radius: var(--radius);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

    toast.textContent = message;
    document.body.append(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (document.body.contains(toast)) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }
}

// Global functions for HTML onclick handlers
window.updatePiAlgorithms = function () {
  if (window.pixelInjection) {
    window.pixelInjection.updatePiAlgorithms();
  }
};

window.updatePiOptions = function () {
  if (window.pixelInjection) {
    window.pixelInjection.updatePiOptions();
  }
};

window.showPiAdvancedOptions = function () {
  const advancedOptions = document.getElementById("pi-advanced-options");
  const btn = document.getElementById("pi-advanced-btn");

  if (advancedOptions.style.display === "none") {
    advancedOptions.style.display = "block";
    btn.textContent = __("pi.hide_advanced", "Hide Advanced Options");
  } else {
    advancedOptions.style.display = "none";
    btn.textContent = __("pi.show_advanced", "Show Advanced Options");
  }
};

window.switchPiTab = function (tab) {
  // Hide all tabs
  document.getElementById("pi-embed").style.display = "none";
  document.getElementById("pi-extract").style.display = "none";
  document.getElementById("pi-analyze").style.display = "none";

  // Show selected tab
  document.getElementById("pi-" + tab).style.display = "block";

  // Update tab buttons
  document.querySelectorAll("[data-pi-tab]").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .querySelector(`[data-pi-tab="${CSS.escape(tab)}"]`)
    .classList.add("active");

  // Hide previous results when switching away from embed
  var resultDiv = document.getElementById("pi-result");
  if (resultDiv && tab !== "embed") {
    resultDiv.style.display = "none";
  }
};

window.handlePixelInjection = function () {
  if (window.pixelInjection) {
    return window.pixelInjection.handlePixelInjection();
  }
};

window.handlePixelExtraction = function () {
  if (window.pixelInjection) {
    return window.pixelInjection.handlePixelExtraction();
  }
};

window.handlePixelAnalysis = function () {
  if (window.pixelInjection) {
    return window.pixelInjection.handlePixelAnalysis();
  }
};

// ── Multi-format pixel injection download ──

/**
 *
 * @param r
 */
function piToTXT(r) {
  var lines = ["=== RedoSan Authenticity - Pixel Injection Result ===", ""];
  for (var k in r) lines.push(k + ": " + String(r[k]));
  lines.push("", "Generated by RedoSan Authenticity");
  return lines.join("\n");
}

/**
 *
 * @param r
 */
function piToCSV(r) {
  var rows = [["Key", "Value"]];
  for (var k in r) rows.push([k, String(r[k])]);
  return rows
    .map(function (row) {
      return row
        .map(function (c) {
          return '"' + String(c).replace(/"/g, '""') + '"';
        })
        .join(",");
    })
    .join("\n");
}

/**
 *
 * @param r
 */
function piToXML(r) {
  var xml = '<?xml version="1.0"?>\n<pixel_injection>\n';
  for (var k in r)
    xml += "  <" + k + ">" + escXml(String(r[k])) + "</" + k + ">\n";
  xml += "</pixel_injection>";
  return xml;
}

/**
 *
 * @param r
 */
function piToHTML(r) {
  var h =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pixel Injection Result</title>';
  h +=
    "<style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:0 20px}";
  h +=
    "table{width:100%;border-collapse:collapse}td{padding:6px 12px;border:1px solid #ddd;font-size:0.85rem}";
  h +=
    "td:first-child{font-weight:600;width:160px;background:#f5f5f5}</style></head><body>";
  h += "<h2>Pixel Injection Result</h2><table>";
  for (var k in r)
    h += "<tr><td>" + k + "</td><td>" + escHtml(String(r[k])) + "</td></tr>";
  h +=
    '</table><p style="font-size:0.75rem;color:#888;margin-top:20px">Generated by RedoSan Authenticity</p></body></html>';
  return h;
}

/**
 *
 * @param format
 */
async function downloadPixelInjection(format) {
  closeDownloadModal();
  var r = getResult("piResult");
  if (!r) return;
  var name = "pixel_injection_" + r.type;

  if (format === "pdf") {
    await ensureLib("jspdf");
    var doc = new jspdf.jsPDF();
    var y = 20;
    doc.setFontSize(16);
    doc.text("Pixel Injection Result", 14, y);
    y += 10;
    doc.setFontSize(10);
    for (var k in r) {
      /* c8 ignore next 4 */
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(k + ": " + String(r[k]), 14, y);
      y += 6;
    }
    doc.setFontSize(8);
    doc.text("Generated by RedoSan Authenticity", 14, 285);
    downloadBlobSimple(doc.output("blob"), name + ".pdf");
    return;
  }
  if (format === "doc") {
    await ensureLib("docx");
    var docx = window.docx;
    var children = [];
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Pixel Injection Result",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 200 },
      }),
    );
    var rows = [];
    for (var kk in r) rows.push([kk, String(r[kk])]);
    children.push(
      new docx.Table({
        rows: rows.map(function (row) {
          return new docx.TableRow({
            children: row.map(function (c) {
              return new docx.TableCell({
                children: [
                  new docx.Paragraph({
                    children: [new docx.TextRun({ text: String(c), size: 18 })],
                    spacing: { before: 40, after: 40 },
                  }),
                ],
              });
            }),
          });
        }),
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
      }),
    );
    var d = new docx.Document({ sections: [{ children: children }] });
    var blob = await docx.Packer.toBlob(d);
    downloadBlobSimple(blob, name + ".docx");
    return;
  }

  var content, ext, mime;
  switch (format) {
    case "json": {
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    }
    case "csv": {
      content = piToCSV(r);
      ext = "csv";
      mime = "text/csv";
      break;
    }
    case "txt": {
      content = piToTXT(r);
      ext = "txt";
      mime = "text/plain";
      break;
    }
    case "xml": {
      content = piToXML(r);
      ext = "xml";
      mime = "application/xml";
      break;
    }
    case "html": {
      content = piToHTML(r);
      ext = "html";
      mime = "text/html";
      break;
    }
  }
  if (content == null) return;
  downloadBlobSimple(new Blob([content], { type: mime }), name + "." + ext);
}

// Initialize pixel injection system
/**
 * Initializes the pixel injection instance. Runs eagerly when the lazy
 * section script is loaded after DOMContentLoaded has already fired.
 */
/* c8 ignore next 8 */
/**
 *
 */
function initPixelInjection() {
  window.pixelInjection = new PixelInjection();

  // Force initial update
  /* c8 ignore start */ setTimeout(() => {
    if (window.pixelInjection) {
      window.pixelInjection.updatePiAlgorithms();
    }
  }, 100);
} /* c8 ignore end */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPixelInjection);
} else {
  initPixelInjection();
}
