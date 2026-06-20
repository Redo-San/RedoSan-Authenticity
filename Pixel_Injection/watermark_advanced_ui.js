(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Advanced Watermarking UI ──
// Enhanced UI for 20+ advanced watermarking algorithms

class AdvancedWatermarkUI {
    constructor() {
        this.core = new WatermarkCore();
        this.currentAlgorithm = 'enhanced_lsb';
        this.watermarkedImage = null;
        this.originalImage = null;
        this.extractedMessage = '';
        this.qualityMetrics = null;
        this.robustnessResults = null;
        
        this.initializeUI();
        this.bindEvents();
    }
    
    initializeUI() {
        // Create advanced algorithm selection
        this.createAlgorithmSelector();
        this.createAdvancedOptions();
        this.createQualityMetrics();
        this.createRobustnessTesting();
        this.createExtractionPanel();
    }
    
    createAlgorithmSelector() {
        // This class was designed for pixel injection but wrongly targeted #wm-type,
        // contaminating the watermark module's algorithms with pixel injection ones.
        // Pixel injection uses its own selector (#pi-algorithm) handled by PixelInjection class.
        return;
    }
    
    createAdvancedOptions() {
        const embedSection = document.getElementById('wm-embed');
        if (!embedSection) return;
        
        // Create advanced options container
        let optionsContainer = document.querySelector('.wm-advanced-options');
        if (!optionsContainer) {
            optionsContainer = document.createElement('div');
            optionsContainer.className = 'wm-advanced-options';
            optionsContainer.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                display: none;
            `;
            
            // Insert after password field
            const passwordField = document.getElementById('wm-password').parentElement;
            passwordField.parentNode.insertBefore(optionsContainer, passwordField.nextSibling);
        }
        
        this.updateAdvancedOptions();
    }
    
    updateAdvancedOptions() {
        const optionsContainer = document.querySelector('.wm-advanced-options');
        if (!optionsContainer) return;
        
        // Clear existing options
        optionsContainer.innerHTML = '';
        
        // Create options based on current algorithm
        const options = this.getAlgorithmOptions(this.currentAlgorithm);
        
        if (options.length > 0) {
            optionsContainer.style.display = 'block';
            
            const title = document.createElement('h4');
            title.textContent = 'Advanced Options';
            title.style.cssText = 'margin: 0 0 15px 0; color: var(--primary);';
            optionsContainer.appendChild(title);
            
            options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.style.cssText = 'margin: 10px 0;';
                
                const label = document.createElement('label');
                label.textContent = option.label + ':';
                label.style.cssText = 'display: block; margin-bottom: 5px; color: var(--text);';
                
                const input = this.createOptionInput(option);
                
                optionDiv.appendChild(label);
                optionDiv.appendChild(input);
                optionsContainer.appendChild(optionDiv);
            });
        } else {
            optionsContainer.style.display = 'none';
        }
    }
    
    getAlgorithmOptions(algorithm) {
        const options = [];
        
        switch (algorithm) {
            case 'enhanced_lsb':
                options.push(
                    { type: 'range', label: __('pi.embedding_strength', 'Embedding Strength'), min: 1, max: 8, value: 4, step: 1 },
                    { type: 'checkbox', label: __('pi.error_correction', 'Error Correction'), checked: true },
                    { type: 'checkbox', label: __('pi.multi_channel', 'Multi-channel Embedding'), checked: true },
                    { type: 'range', label: __('pi.redundancy_factor', 'Redundancy Factor'), min: 1, max: 5, value: 3, step: 1 }
                );
                break;
                
            case 'adaptive_lsb':
                options.push(
                    { type: 'select', label: 'Adaptation Mode', options: ['Complexity', 'Edge Detection', 'Texture Analysis'], value: 'Complexity' },
                    { type: 'range', label: 'Sensitivity', min: 0.1, max: 1.0, value: 0.7, step: 0.1 }
                );
                break;
                
            case 'dct':
                options.push(
                    { type: 'range', label: 'Strength', min: 0.01, max: 0.5, value: 0.1, step: 0.01 },
                    { type: 'select', label: 'Coefficient Selection', options: ['Mid-frequency', 'Low-frequency', 'Adaptive'], value: 'Mid-frequency' },
                    { type: 'range', label: 'Block Size', min: 4, max: 16, value: 8, step: 2 },
                    { type: 'checkbox', label: __('pi.error_correction', 'Error Correction'), checked: true }
                );
                break;
                
            case 'dwt':
                options.push(
                    { type: 'select', label: 'Wavelet Type', options: ['Haar', 'Daubechies', 'Biorthogonal'], value: 'Haar' },
                    { type: 'range', label: 'Decomposition Levels', min: 1, max: 5, value: 3, step: 1 },
                    { type: 'select', label: 'Embedding Bands', options: ['HH, HL, LH', 'All Bands'], value: 'HH, HL, LH' }
                );
                break;
                
            case 'hybrid_dct_dwt':
                options.push(
                    { type: 'range', label: 'DCT Strength', min: 0.05, max: 0.2, value: 0.1, step: 0.01 },
                    { type: 'range', label: 'DWT Strength', min: 0.05, max: 0.2, value: 0.1, step: 0.01 },
                    { type: 'range', label: 'DCT/DWT Ratio', min: 0.1, max: 0.9, value: 0.6, step: 0.1 },
                    { type: 'checkbox', label: 'Adaptive Ratio', checked: true }
                );
                break;
                
            case 'vine':
                options.push(
                    { type: 'text', label: 'Model Path', placeholder: 'Path to pre-trained model' },
                    { type: 'range', label: 'Adversarial Strength', min: 0.01, max: 0.2, value: 0.05, step: 0.01 },
                    { type: 'checkbox', label: 'Perceptual Masking', checked: true }
                );
                break;
                
            case 'pixel_seal':
                options.push(
                    { type: 'range', label: 'JND Strength', min: 0.01, max: 0.1, value: 0.05, step: 0.01 },
                    { type: 'checkbox', label: 'Adversarial Training', checked: true },
                    { type: 'checkbox', label: 'High-resolution Adaptation', checked: true }
                );
                break;
                
            case 'nullguard':
                options.push(
                    { type: 'text', label: 'Null Space Detection', placeholder: 'Auto-detect' },
                    { type: 'range', label: __('pi.embedding_strength', 'Embedding Strength'), min: 0.01, max: 0.1, value: 0.03, step: 0.01 }
                );
                break;
        }
        
        return options;
    }
    
    createOptionInput(option) {
        let input;
        
        switch (option.type) {
            case 'range':
                input = document.createElement('input');
                input.type = 'range';
                input.min = option.min;
                input.max = option.max;
                input.value = option.value;
                input.step = option.step;
                input.style.cssText = 'width: 100%; margin: 5px 0;';
                break;
                
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = option.checked;
                input.style.cssText = 'margin-right: 10px;';
                break;
                
            case 'select':
                input = document.createElement('select');
                option.options.forEach(opt => {
                    const optionElement = document.createElement('option');
                    optionElement.value = opt;
                    optionElement.textContent = opt;
                    input.appendChild(optionElement);
                });
                input.value = option.value;
                input.style.cssText = 'width: 100%; margin: 5px 0;';
                break;
                
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.placeholder = option.placeholder;
                input.value = option.value || '';
                input.style.cssText = 'width: 100%; margin: 5px 0; padding: 8px;';
                break;
        }
        
        return input;
    }
    
    createQualityMetrics() {
        const embedSection = document.getElementById('wm-embed');
        if (!embedSection) return;
        
        // Create quality metrics container
        let qualityContainer = document.querySelector('.wm-quality-metrics');
        if (!qualityContainer) {
            qualityContainer = document.createElement('div');
            qualityContainer.className = 'wm-quality-metrics';
            qualityContainer.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                display: none;
            `;
            
            embedSection.appendChild(qualityContainer);
        }
        
        // Create quality metrics display
        qualityContainer.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--primary);">Quality Metrics</h4>
            <div class="quality-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Image Quality</h5>
                    <div class="metric">
                        <span>PSNR:</span> <span id="psnr-value">--</span> dB
                    </div>
                    <div class="metric">
                        <span>SSIM:</span> <span id="ssim-value">--</span>
                    </div>
                    <div class="metric">
                        <span>LPIPS:</span> <span id="lpips-value">--</span>
                    </div>
                </div>
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Watermark Quality</h5>
                    <div class="metric">
                        <span>BER:</span> <span id="ber-value">--</span> %
                    </div>
                    <div class="metric">
                        <span>Capacity:</span> <span id="capacity-value">--</span> bits
                    </div>
                    <div class="metric">
                        <span>Robustness:</span> <span id="robustness-value">--</span> %
                    </div>
                </div>
            </div>
        `;
    }
    
    createRobustnessTesting() {
        const embedSection = document.getElementById('wm-embed');
        if (!embedSection) return;
        
        // Create robustness testing container
        let testingContainer = document.querySelector('.wm-robustness-testing');
        if (!testingContainer) {
            testingContainer = document.createElement('div');
            testingContainer.className = 'wm-robustness-testing';
            testingContainer.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                display: none;
            `;
            
            embedSection.appendChild(testingContainer);
        }
        
        // Create robustness testing controls
        testingContainer.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--primary);">Robustness Testing</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Attack Simulation</h5>
                    <button class="btn" onclick="advancedWatermarkUI.testCompression()" style="margin: 5px;">Test Compression</button>
                    <button class="btn" onclick="advancedWatermarkUI.testCropping()" style="margin: 5px;">Test Cropping</button>
                    <button class="btn" onclick="advancedWatermarkUI.testRotation()" style="margin: 5px;">Test Rotation</button>
                    <button class="btn" onclick="advancedWatermarkUI.testScaling()" style="margin: 5px;">Test Scaling</button>
                </div>
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Detection Testing</h5>
                    <button class="btn" onclick="advancedWatermarkUI.testStatisticalDetection()" style="margin: 5px;">Statistical Detection</button>
                    <button class="btn" onclick="advancedWatermarkUI.testMLDetection()" style="margin: 5px;">ML Detection</button>
                    <button class="btn" onclick="advancedWatermarkUI.testBlindDecoding()" style="margin: 5px;">Blind Decoding</button>
                </div>
            </div>
            <div id="robustness-results" style="margin-top: 15px; padding: 15px; background: var(--bg); border-radius: var(--radius); display: none;">
                <h5 style="margin: 0 0 10px 0; color: var(--primary);">Test Results</h5>
                <div id="robustness-output"></div>
            </div>
        `;
    }
    
    createExtractionPanel() {
        const extractSection = document.getElementById('wm-extract');
        if (!extractSection) return;
        
        // Create advanced extraction controls
        let extractControls = document.querySelector('.wm-extraction-controls');
        if (!extractControls) {
            extractControls = document.createElement('div');
            extractControls.className = 'wm-extraction-controls';
            extractControls.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
            `;
            
            extractSection.appendChild(extractControls);
        }
        
        extractControls.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--primary);">Advanced Extraction</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Algorithm Detection</h5>
                    <button class="btn" onclick="advancedWatermarkUI.autoDetectAlgorithm()" style="margin: 5px;">Auto Detect Algorithm</button>
                    <select id="extraction-algorithm" style="width: 100%; margin: 5px 0;">
                        <option value="">Select Algorithm</option>
                        <option value="lsb">LSB</option>
                        <option value="dct">DCT</option>
                        <option value="dwt">DWT</option>
                        <option value="vine">VINE</option>
                        <option value="pixel_seal">Pixel Seal</option>
                    </select>
                </div>
                <div>
                    <h5 style="margin: 0 0 10px 0; color: var(--text);">Extraction Options</h5>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="use-original-image" style="margin-right: 10px;">
                            Use Original Image (if available)
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="error-correction" checked style="margin-right: 10px;">
                            Apply Error Correction
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="extraction-strength">Extraction Strength:</label>
                        <input type="range" id="extraction-strength" min="0.1" max="1.0" value="1.0" step="0.1" style="width: 100%;">
                    </div>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        // Intentionally empty — was overriding window.handleWatermarkEmbed and
        // window.handleWatermarkExtract, which broke the watermark module.
        // The pixel injection module has its own handler via PixelInjection class.
    }
    
    async handleAdvancedEmbed() {
        const fileInput = document.getElementById('wm-image');
        var messageInput = document.getElementById('wm-message');
        const passwordInput = document.getElementById('wm-password');
        
        if (!fileInput.files.length) {
            this.showMessage('Please select an image file', 'error');
            return;
        }
        
        var message = messageInput ? messageInput.value : '';
        // Fallback: use secret file name as message if wm-message is not present
        if (!message) {
            const secretInput = document.getElementById('wm-secret');
            if (secretInput && secretInput.files && secretInput.files.length) {
                message = secretInput.files[0].name;
            }
        }
        
        if (!message) {
            this.showMessage('Please enter a message to embed', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const password = passwordInput.value;
        
        try {
            // Show loading state
            this.showLoading(true);
            
            // Read and process image
            const imageData = await this.loadImage(file);
            
            // Get advanced options
            const options = this.getAdvancedOptions();
            
            // Apply watermark
            this.watermarkedImage = await this.core.algorithms[this.currentAlgorithm](imageData, message, password, options);
            
            // Calculate quality metrics
            this.qualityMetrics = this.core.detection.quality_metrics(imageData, this.watermarkedImage);
            this.updateQualityDisplay();
            
            // Show result
            this.showWatermarkedImage();
            this.showLoading(false);
            
            this.showMessage(`Watermark embedded successfully using ${this.currentAlgorithm}`, 'success');
            
        } catch (error) {
            this.showLoading(false);
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }
    
    async handleAdvancedExtract() {
        const fileInput = document.getElementById('wm-image-ex');
        const algorithmSelect = document.getElementById('extraction-algorithm');
        const useOriginal = document.getElementById('use-original-image').checked;
        const errorCorrection = document.getElementById('error-correction').checked;
        const extractionStrength = parseFloat(document.getElementById('extraction-strength').value);
        
        if (!fileInput.files.length) {
            this.showMessage('Please select a watermarked image file', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const algorithm = algorithmSelect.value || this.currentAlgorithm;
        
        try {
            // Show loading state
            this.showLoading(true);
            
            // Read and process image
            const imageData = await this.loadImage(file);
            
            // Extract watermark
            const options = {
                useOriginal: useOriginal,
                errorCorrection: errorCorrection,
                strength: extractionStrength
            };
            
            this.extractedMessage = await this.core.detection.blind_decoding(imageData, algorithm, options);
            
            // Show result
            this.showExtractedMessage();
            this.showLoading(false);
            
            this.showMessage(`Watermark extracted successfully using ${algorithm}`, 'success');
            
        } catch (error) {
            this.showLoading(false);
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }
    
    getAdvancedOptions() {
        const options = {};
        const optionsContainer = document.querySelector('.wm-advanced-options');
        
        if (optionsContainer) {
            const inputs = optionsContainer.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (input.type === 'checkbox') {
                    options[input.id] = input.checked;
                } else if (input.type === 'range') {
                    options[input.id] = parseFloat(input.value);
                } else {
                    options[input.id] = input.value;
                }
            });
        }
        
        return options;
    }
    
    async loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    imageData.w = img.width;
                    imageData.h = img.height;
                    resolve(imageData);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    showWatermarkedImage() {
        if (!this.watermarkedImage) return;
        
        const resultDiv = document.getElementById('wm-result');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        
        // Create canvas for watermarked image
        const canvas = document.createElement('canvas');
        canvas.width = this.watermarkedImage.width;
        canvas.height = this.watermarkedImage.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(this.watermarkedImage, 0, 0);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = 'watermarked_image.png';
        downloadLink.textContent = 'Download Watermarked Image';
        downloadLink.className = 'btn';
        downloadLink.style.cssText = 'margin-top: 10px; display: inline-block;';
        
        const downloadDiv = document.getElementById('wm-download');
        downloadDiv.innerHTML = '';
        downloadDiv.appendChild(downloadLink);
        
        // Show image preview
        const outputDiv = document.getElementById('wm-output');
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Watermarked Image</h5>
                <img src="${canvas.toDataURL('image/png')}" style="max-width: 100%; border: 1px solid var(--border); border-radius: var(--radius);">
            </div>
        `;
    }
    
    showExtractedMessage() {
        const resultDiv = document.getElementById('wm-result');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        
        const outputDiv = document.getElementById('wm-output');
        const safeMsg = escHtml(this.extractedMessage);
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">${__('pi.extracted_message', 'Extracted Message')}</h5>
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); font-family: monospace; word-break: break-all;">
                    ${safeMsg}
                </div>
            </div>
        `;
        
        // Add copy button
        const downloadDiv = document.getElementById('wm-download');
        downloadDiv.innerHTML = '<button class="btn" id="wm-copy-btn" style="margin-top: 10px;">' + __('pi.copy_message', 'Copy Message') + '</button>';
        const copyBtn = document.getElementById('wm-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(escHtml(this.extractedMessage));
            }.bind(this));
        }
    }
    
    updateQualityDisplay() {
        if (!this.qualityMetrics) return;
        
        document.getElementById('psnr-value').textContent = this.qualityMetrics.psnr.toFixed(2);
        document.getElementById('ssim-value').textContent = this.qualityMetrics.ssim.toFixed(4);
        document.getElementById('lpips-value').textContent = this.qualityMetrics.lpips.toFixed(4);
        document.getElementById('ber-value').textContent = this.qualityMetrics.ber.toFixed(2);
        document.getElementById('capacity-value').textContent = this.calculateCapacity();
        document.getElementById('robustness-value').textContent = this.calculateRobustness();
        
        // Show quality metrics container
        document.querySelector('.wm-quality-metrics').style.display = 'block';
    }
    
    calculateCapacity() {
        // Calculate embedding capacity based on algorithm
        const capacities = {
            'enhanced_lsb': 12, // 3 channels * 4 bits
            'adaptive_lsb': 8,
            'dct': 64,
            'dwt': 128,
            'vine': 256,
            'pixel_seal': 512
        };
        
        return capacities[this.currentAlgorithm] || 0;
    }
    
    calculateRobustness() {
        // Calculate robustness score based on algorithm and quality metrics
        const baseRobustness = {
            'enhanced_lsb': 20,
            'adaptive_lsb': 35,
            'dct': 65,
            'dwt': 75,
            'vine': 85,
            'pixel_seal': 90
        };
        
        const qualityFactor = this.qualityMetrics ? (this.qualityMetrics.psnr / 40 + this.qualityMetrics.ssim) / 2 : 1;
        
        return Math.min(95, (baseRobustness[this.currentAlgorithm] || 0) * qualityFactor);
    }
    
    async testCompression() {
        if (!this.watermarkedImage || !this.originalImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing compression robustness...', 'info');
        
        // Simulate compression attacks
        const compressionLevels = [0.7, 0.5, 0.3];
        const results = [];
        
        for (const quality of compressionLevels) {
            const compressed = await this.simulateCompression(this.watermarkedImage, quality);
            const extracted = await this.core.detection.blind_decoding(compressed, this.currentAlgorithm);
            const ber = this.calculateBER(this.extractedMessage, this.getOriginalMessage());
            
            results.push({
                test: `Compression ${quality}`,
                quality: quality,
                ber: ber,
                passed: ber < 0.1
            });
        }
        
        this.displayRobustnessResults(results);
    }
    
    async testCropping() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing cropping robustness...', 'info');
        
        // Simulate cropping attacks
        const cropSizes = [0.9, 0.7, 0.5];
        const results = [];
        
        for (const scale of cropSizes) {
            const cropped = await this.simulateCropping(this.watermarkedImage, scale);
            const extracted = await this.core.detection.blind_decoding(cropped, this.currentAlgorithm);
            const ber = this.calculateBER(this.extractedMessage, this.getOriginalMessage());
            
            results.push({
                test: `Cropping ${scale}`,
                scale: scale,
                ber: ber,
                passed: ber < 0.15
            });
        }
        
        this.displayRobustnessResults(results);
    }
    
    async testRotation() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing rotation robustness...', 'info');
        
        // Simulate rotation attacks
        const angles = [15, 30, 45];
        const results = [];
        
        for (const angle of angles) {
            const rotated = await this.simulateRotation(this.watermarkedImage, angle);
            const extracted = await this.core.detection.blind_decoding(rotated, this.currentAlgorithm);
            const ber = this.calculateBER(this.extractedMessage, this.getOriginalMessage());
            
            results.push({
                test: `Rotation ${angle}°`,
                angle: angle,
                ber: ber,
                passed: ber < 0.2
            });
        }
        
        this.displayRobustnessResults(results);
    }
    
    async testScaling() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing scaling robustness...', 'info');
        
        // Simulate scaling attacks
        const scales = [0.8, 0.6, 0.4];
        const results = [];
        
        for (const scale of scales) {
            const scaled = await this.simulateScaling(this.watermarkedImage, scale);
            const extracted = await this.core.detection.blind_decoding(scaled, this.currentAlgorithm);
            const ber = this.calculateBER(this.extractedMessage, this.getOriginalMessage());
            
            results.push({
                test: `Scaling ${scale}`,
                scale: scale,
                ber: ber,
                passed: ber < 0.25
            });
        }
        
        this.displayRobustnessResults(results);
    }
    
    async testStatisticalDetection() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing statistical detection...', 'info');
        
        const result = this.core.detection.statistical_detection(this.watermarkedImage);
        
        this.displayRobustnessResults([{
            test: 'Statistical Detection',
            detected: result.hasWatermark,
            confidence: result.confidence,
            algorithm: result.algorithm,
            strength: result.strength
        }]);
    }
    
    async testMLDetection() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing ML-based detection...', 'info');
        
        const result = this.core.detection.ml_detection(this.watermarkedImage);
        
        this.displayRobustnessResults([{
            test: 'ML Detection',
            detected: result.detected,
            confidence: result.confidence,
            algorithm: result.algorithm,
            robustness: result.robustness
        }]);
    }
    
    async testBlindDecoding() {
        if (!this.watermarkedImage) {
            this.showMessage('Please embed a watermark first', 'error');
            return;
        }
        
        this.showMessage('Testing blind decoding...', 'info');
        
        const result = await this.core.detection.blind_decoding(this.watermarkedImage, this.currentAlgorithm);
        
        this.displayRobustnessResults([{
            test: 'Blind Decoding',
            extracted: result,
            success: result.length > 0
        }]);
    }
    
    async autoDetectAlgorithm() {
        const fileInput = document.getElementById('wm-image-ex');
        if (!fileInput.files.length) {
            this.showMessage('Please select a watermarked image file', 'error');
            return;
        }
        
        this.showMessage('Auto-detecting algorithm...', 'info');
        
        const file = fileInput.files[0];
        const imageData = await this.loadImage(file);
        const result = this.core.detection.statistical_detection(imageData);
        
        document.getElementById('extraction-algorithm').value = result.algorithm || 'dct';
        this.showMessage(`Detected algorithm: ${result.algorithm || 'DCT'}`, 'success');
    }
    
    displayRobustnessResults(results) {
        const resultsDiv = document.getElementById('robustness-results');
        resultsDiv.style.display = 'block';
        
        const outputDiv = document.getElementById('robustness-output');
        outputDiv.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background: var(--primary); color: white;">
                        <th style="padding: 10px; text-align: left;">Test</th>
                        <th style="padding: 10px; text-align: center;">Parameter</th>
                        <th style="padding: 10px; text-align: center;">BER</th>
                        <th style="padding: 10px; text-align: center;">Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid var(--border);">${result.test}</td>
                            <td style="padding: 8px; border: 1px solid var(--border); text-align: center;">${result.parameter || result.scale || result.angle || '--'}</td>
                            <td style="padding: 8px; border: 1px solid var(--border); text-align: center; color: ${result.passed ? 'var(--success)' : 'var(--danger)'};">${result.ber !== undefined ? result.ber.toFixed(4) : (result.success ? 'PASS' : 'FAIL')}</td>
                            <td style="padding: 8px; border: 1px solid var(--border); text-align: center; color: ${result.passed ? 'var(--success)' : 'var(--danger)'};">${result.passed ? 'PASS' : 'FAIL'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    simulateCompression(imageData, quality) {
        // Simulate JPEG compression
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
            
            canvas.toBlob(resolve, 'image/jpeg', quality);
        });
    }
    
    simulateCropping(imageData, scale) {
        // Simulate cropping
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            const newWidth = Math.floor(imageData.width * scale);
            const newHeight = Math.floor(imageData.height * scale);
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight);
            
            const croppedImageData = ctx.getImageData(0, 0, newWidth, newHeight);
            resolve(croppedImageData);
        });
    }
    
    simulateRotation(imageData, angle) {
        // Simulate rotation
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle * Math.PI / 180);
            ctx.putImageData(imageData, -imageData.width / 2, -imageData.height / 2);
            ctx.restore();
            
            const rotatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve(rotatedImageData);
        });
    }
    
    simulateScaling(imageData, scale) {
        // Simulate scaling
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            const newWidth = Math.floor(imageData.width * scale);
            const newHeight = Math.floor(imageData.height * scale);
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0, newWidth, newHeight);
            
            const scaledImageData = ctx.getImageData(0, 0, newWidth, newHeight);
            resolve(scaledImageData);
        });
    }
    
    getOriginalMessage() {
        // Return the original message for BER calculation
        return document.getElementById('wm-message')?.value || 'Test Message';
    }
    
    showLoading(show) {
        const spinner = document.getElementById('wm-spinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }
    
    showMessage(message, type = 'info') {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)'};
            color: white;
            border-radius: var(--radius);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Initialize the advanced watermarking UI
// let advancedWatermarkUI;
// document.addEventListener('DOMContentLoaded', () => {
//     advancedWatermarkUI = new AdvancedWatermarkUI();
// });
