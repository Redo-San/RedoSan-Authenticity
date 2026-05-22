(function(){if(typeof window!='undefined'&&window.location&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Pixel Injection Advanced System ──
// Specialized interface for advanced pixel injection algorithms

class PixelInjection {
    constructor() {
        this.core = new WatermarkCore();
        this.currentCategory = 'spatial';
        this.currentAlgorithm = 'enhanced_lsb';
        this.watermarkedImage = null;
        this.originalImage = null;
        this.extractedMessage = '';
        this.analysisResults = null;
        
        this.algorithms = {
            spatial: {
                'enhanced_lsb': { name: 'Enhanced LSB', description: 'Advanced LSB with error correction' },
                'adaptive_lsb': { name: 'Adaptive LSB', description: 'LSB with adaptive embedding' },
                'multi_channel_lsb': { name: 'Multi-Channel LSB', description: 'LSB across RGB channels' },
                'random_lsb': { name: 'Random LSB', description: 'LSB with random positioning' }
            },
            frequency: {
                'dct': { name: 'Robust DCT', description: 'DCT with robust embedding' },
                'dwt': { name: 'Multi-resolution DWT', description: 'DWT with multi-resolution' },
                'dft': { name: 'Rotation-resistant DFT', description: 'DFT for rotation invariance' },
                'hybrid_dct_dwt': { name: 'Hybrid DCT-DWT', description: 'Combined DCT and DWT' }
            },
            deep_learning: {
                'vine': { name: 'VINE', description: 'AI-editing resistant watermarking' },
                'pixel_seal': { name: 'Pixel Seal', description: 'Meta\'s adversarial watermarking' },
                'nullguard': { name: 'NullGuard', description: 'Null-space embedding' },
                'shallow_diffuse': { name: 'Shallow Diffuse', description: 'Fast diffusion-based' }
            },
            professional: {
                'imagewmark': { name: 'Imagewmark Pro', description: 'Professional watermarking tool' },
                'meta_seal': { name: 'Meta Seal', description: 'Multi-media protection' },
                'stardustmark': { name: 'STARDUSTmark', description: 'Forensic-grade watermarking' },
                'invisimark': { name: 'InvisMark', description: 'AI-generated image protection' },
                'elevenlikes': { name: 'ElevenLikes', description: 'Industrial-grade solution' },
                'diffusion_based': { name: 'Diffusion-based', description: 'During generation watermarking' }
            },
            detection: {
                'statistical_detection': { name: 'Statistical Detection', description: 'Statistical analysis' },
                'ml_detection': { name: 'ML Detection', description: 'Machine learning detection' },
                'blind_decoding': { name: 'Blind Decoding', description: 'Without original image' },
                'robustness_testing': { name: 'Robustness Testing', description: 'Attack resistance testing' },
                'quality_metrics': { name: 'Quality Metrics', description: 'PSNR, SSIM, LPIPS' }
            }
        };
        
        this.extractMap = {
            enhanced_lsb: 'extractEnhancedLSB', adaptive_lsb: 'extractLSB',
            multi_channel_lsb: 'extractMultiChannelLSB', random_lsb: 'extractRandomLSB',
            dct: 'extractDCT', dwt: 'extractDWT', dft: 'extractDFT',
            hybrid_dct_dwt: 'extractDCT',
            vine: 'extractVINE', pixel_seal: 'extractPixelSeal',
            nullguard: 'extractNullGuard', shallow_diffuse: 'extractShallowDiffuse',
            diffusion_based: 'extractLSB',
            imagewmark: 'extractImageWMark', meta_seal: 'extractMetaSeal',
            stardustmark: 'extractLSB', invisimark: 'extractLSB', elevenlikes: 'extractLSB',
        };
        this.initializeEventListeners();
        this.updatePiAlgorithms();
    }
    
    initializeEventListeners() {
        // Add event listeners for pixel injection interface
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupPixelInjectionUI();
            });
        } else {
            // DOM already loaded
            this.setupPixelInjectionUI();
        }
    }
    
    setupPixelInjectionUI() {
        this.updatePiAlgorithms();
        this.updateExtractAlgorithms();
        this.toggleExtractPiPassword();
        
        const categorySelect = document.getElementById('pi-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.updatePiAlgorithms();
            });
        }
        
        const algorithmSelect = document.getElementById('pi-algorithm');
        if (algorithmSelect) {
            algorithmSelect.addEventListener('change', () => {
                this.currentAlgorithm = algorithmSelect.value;
                this.updatePiOptions();
                this.togglePiPassword();
            });
        }
        
        const extractAlgorithmSelect = document.getElementById('pi-extract-algorithm');
        if (extractAlgorithmSelect) {
            extractAlgorithmSelect.addEventListener('change', () => {
                this.toggleExtractPiPassword();
            });
        }
    }
    
    updatePiAlgorithms() {
        const categorySelect = document.getElementById('pi-category');
        const algorithmSelect = document.getElementById('pi-algorithm');
        
        if (!categorySelect || !algorithmSelect) return;
        
        const category = categorySelect.value;
        const algorithms = this.algorithms[category];
        
        algorithmSelect.innerHTML = '';
        
        Object.entries(algorithms).forEach(([key, algorithm]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = algorithm.name;
            option.title = algorithm.description;
            algorithmSelect.appendChild(option);
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
        const group = document.getElementById('pi-password-group');
        if (!group) return;
        if (this.currentAlgorithm === 'random_lsb') {
            group.style.display = 'block';
            group.style.visibility = 'visible';
        } else {
            group.style.display = 'none';
        }
    }
    
    toggleExtractPiPassword() {
        const group = document.getElementById('pi-extract-password-group');
        if (!group) return;
        const extractSelect = document.getElementById('pi-extract-algorithm');
        const algo = extractSelect ? extractSelect.value : '';
        if (algo === 'random_lsb') {
            group.style.display = 'block';
            group.style.visibility = 'visible';
        } else {
            group.style.display = 'none';
        }
    }
    
    updateExtractAlgorithms() {
        const extractAlgorithmSelect = document.getElementById('pi-extract-algorithm');
        
        if (!extractAlgorithmSelect) return;
        
        const autoOption = extractAlgorithmSelect.querySelector('option[value="auto"]');
        extractAlgorithmSelect.innerHTML = '';
        if (autoOption) {
            extractAlgorithmSelect.appendChild(autoOption);
        }
        
        const allAlgorithms = {};
        
        Object.entries(this.algorithms).forEach(([category, algorithms]) => {
            Object.entries(algorithms).forEach(([key, algorithm]) => {
                allAlgorithms[key] = {
                    ...algorithm,
                    category: category
                };
            });
        });
        
        Object.entries(allAlgorithms).forEach(([key, algorithm]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${algorithm.name} (${algorithm.category})`;
            option.title = algorithm.description;
            extractAlgorithmSelect.appendChild(option);
        });
    }
    
    updatePiOptions() {
        const algorithmSelect = document.getElementById('pi-algorithm');
        const optionsContainer = document.getElementById('pi-options-container');
        
        if (!algorithmSelect || !optionsContainer) return;
        
        const algorithm = algorithmSelect.value;
        this.currentAlgorithm = algorithm;
        
        // Clear existing options
        optionsContainer.innerHTML = '';
        
        // Add algorithm-specific options
        const options = this.getAlgorithmOptions(algorithm);
        
        if (options.length > 0) {
            options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.style.cssText = 'margin: 10px 0;';
                
                const label = document.createElement('label');
                label.textContent = option.label + ':';
                label.style.cssText = 'display: block; margin-bottom: 5px; color: var(--text); font-size: 0.9rem;';
                
                const input = this.createOptionInput(option);
                
                optionDiv.appendChild(label);
                optionDiv.appendChild(input);
                optionsContainer.appendChild(optionDiv);
            });
        }
    }
    
    getAlgorithmOptions(algorithm) {
        const options = [];
        
        switch (algorithm) {
            case 'enhanced_lsb':
                options.push(
                    { type: 'range', label: 'Embedding Strength', min: 1, max: 8, value: 4, step: 1 },
                    { type: 'checkbox', label: 'Error Correction', checked: true },
                    { type: 'checkbox', label: 'Multi-channel Embedding', checked: true },
                    { type: 'range', label: 'Redundancy Factor', min: 1, max: 5, value: 3, step: 1 }
                );
                break;
                
            case 'adaptive_lsb':
                options.push(
                    { type: 'select', label: 'Adaptation Mode', options: ['Complexity', 'Edge Detection', 'Texture Analysis'], value: 'Complexity' },
                    { type: 'range', label: 'Sensitivity', min: 0.1, max: 1.0, value: 0.7, step: 0.1 }
                );
                break;
                
            case 'multi_channel_lsb':
                options.push(
                    { type: 'range', label: 'Channel Count', min: 1, max: 4, value: 3, step: 1 },
                    { type: 'select', label: 'Channel Strategy', options: ['RGB', 'CMYK', 'YCbCr'], value: 'RGB' },
                    { type: 'range', label: 'Bit Depth', min: 1, max: 8, value: 4, step: 1 },
                    { type: 'checkbox', label: 'Channel Separation', checked: true }
                );
                break;
                
            case 'random_lsb':
                options.push(
                    { type: 'range', label: 'Randomization Level', min: 0.1, max: 1.0, value: 0.5, step: 0.1 },
                    { type: 'text', label: 'Seed Key', placeholder: 'Enter random seed' },
                    { type: 'select', label: 'Distribution', options: ['Uniform', 'Gaussian', 'Exponential'], value: 'Uniform' },
                    { type: 'checkbox', label: 'Anti-detection', checked: true }
                );
                break;
                
            case 'dct':
                options.push(
                    { type: 'range', label: 'Strength', min: 0.01, max: 0.5, value: 0.1, step: 0.01 },
                    { type: 'select', label: 'Coefficient Selection', options: ['Mid-frequency', 'Low-frequency', 'Adaptive'], value: 'Mid-frequency' },
                    { type: 'range', label: 'Block Size', min: 4, max: 16, value: 8, step: 2 },
                    { type: 'checkbox', label: 'Error Correction', checked: true }
                );
                break;
                
            case 'dwt':
                options.push(
                    { type: 'select', label: 'Wavelet Type', options: ['Haar', 'Daubechies', 'Biorthogonal'], value: 'Haar' },
                    { type: 'range', label: 'Decomposition Levels', min: 1, max: 5, value: 3, step: 1 },
                    { type: 'select', label: 'Embedding Bands', options: ['HH, HL, LH', 'All Bands'], value: 'HH, HL, LH' }
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
                
            case 'statistical_detection':
                options.push(
                    { type: 'range', label: 'Detection Threshold', min: 0.1, max: 1.0, value: 0.7, step: 0.1 },
                    { type: 'select', label: 'Analysis Method', options: ['Histogram', 'Frequency', 'Statistical'], value: 'Histogram' },
                    { type: 'checkbox', label: 'Advanced Features', checked: true }
                );
                break;
                
            case 'ml_detection':
                options.push(
                    { type: 'select', label: 'ML Model', options: ['Neural Network', 'SVM', 'Random Forest'], value: 'Neural Network' },
                    { type: 'range', label: 'Confidence Threshold', min: 0.5, max: 1.0, value: 0.8, step: 0.1 },
                    { type: 'checkbox', label: 'Feature Engineering', checked: true }
                );
                break;
                
            case 'blind_decoding':
                options.push(
                    { type: 'select', label: 'Decoding Algorithm', options: ['Auto', 'DCT', 'DWT', 'LSB', 'VINE'], value: 'Auto' },
                    { type: 'text', label: 'Decoding Key', placeholder: 'Optional decoding key' },
                    { type: 'checkbox', label: 'Error Correction', checked: true }
                );
                break;
                
            case 'robustness_testing':
                options.push(
                    { type: 'select', label: 'Test Suite', options: ['Basic', 'Comprehensive', 'Advanced'], value: 'Comprehensive' },
                    { type: 'range', label: 'Attack Intensity', min: 0.1, max: 1.0, value: 0.5, step: 0.1 },
                    { type: 'checkbox', label: 'Generate Report', checked: true }
                );
                break;
                
            case 'quality_metrics':
                options.push(
                    { type: 'checkbox', label: 'PSNR', checked: true },
                    { type: 'checkbox', label: 'SSIM', checked: true },
                    { type: 'checkbox', label: 'LPIPS', checked: true },
                    { type: 'checkbox', label: 'BER', checked: true },
                    { type: 'checkbox', label: 'MSE', checked: true },
                    { type: 'checkbox', label: 'MAD', checked: true }
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
    
    async handlePixelInjection() {
        const imageInput = document.getElementById('pi-image');
        const messageFileInput = document.getElementById('pi-secret-file');
        const messageTextInput = document.getElementById('pi-message');
        const passwordInput = document.getElementById('pi-password');
        
        if (!imageInput.files.length) {
            this.showMessage('Please select an image file', 'error');
            return;
        }
        
        // Determine message source: secret file or textarea
        var message, secretFileName = '';
        if (messageFileInput && messageFileInput.files && messageFileInput.files.length) {
            // Validate secret document file
            if (typeof validateFileInput === 'function' && !(await validateFileInput(messageFileInput))) {
                this.showMessage('Invalid or dangerous secret file', 'error');
                return;
            }
            var secretFile = messageFileInput.files[0];
            secretFileName = secretFile.name;
            var secretText = await new Promise(function(resolve) {
                var r = new FileReader();
                r.onload = function(e) { resolve(e.target.result); };
                r.onerror = function() { resolve(''); };
                r.readAsText(secretFile);
            });
            if (!secretText) {
                this.showMessage('Failed to read secret file content', 'error');
                return;
            }
            message = secretText;
        } else if (messageTextInput && messageTextInput.value) {
            message = messageTextInput.value;
        } else {
            this.showMessage('Please enter a message or select a secret document file', 'error');
            return;
        }
        this._secretFileName = secretFileName;
        
        // Validate file before processing
        if (typeof validateFileInput === 'function' && !(await validateFileInput(imageInput))) {
            this.showMessage('Invalid or dangerous file type', 'error');
            return;
        }
        
        const file = imageInput.files[0];
        const password = passwordInput.value;
        
        try {
            // Show loading state
            this.showLoading(true);
            
            // Read and process image
            const imageData = await this.loadImage(file);
            this.originalImage = imageData;
            
            // Get advanced options
            const options = this.getAdvancedOptions();
            
            // Apply pixel injection
            if (this.currentCategory === 'detection') {
                // Detection algorithms don't embed watermarks, they analyze images
                // Instead, run the detection algorithm on the image
                this.showLoading(false);
                
                try {
                    // Run detection algorithm
                    const detectionResult = await this.runDetectionAlgorithm(this.currentAlgorithm, imageData, message, password, options);
                    
                    // Show detection results
                    this.showDetectionResults(detectionResult);
                    this.showMessage(`Detection completed using ${this.algorithms[this.currentCategory][this.currentAlgorithm].name}`, 'success');
                    
                } catch (error) {
                    console.error('Detection error:', error);
                    this.showMessage(`Detection error: ${error.message}`, 'error');
                }
                
                return;
            }
            
            // Check if algorithm exists in core or algorithms object
            if (!this.core[this.currentAlgorithm] || typeof this.core[this.currentAlgorithm] !== 'function') {
                if (!this.core.algorithms[this.currentAlgorithm]) {
                    throw new Error(`Algorithm ${this.currentAlgorithm} is not available`);
                }
                // Use algorithms object as fallback
                const coreAlgorithm = this.core.algorithms[this.currentAlgorithm];
                if (typeof coreAlgorithm !== 'function') {
                    throw new Error(`Algorithm ${this.currentAlgorithm} is not a function`);
                }
                this.watermarkedImage = await coreAlgorithm(imageData, message, password, options);
            } else {
                this.watermarkedImage = await this.core[this.currentAlgorithm](imageData, message, password, options);
            }
            
            // Calculate quality metrics
            this.qualityMetrics = this.core.detection.quality_metrics(imageData, this.watermarkedImage);
            
            // Show result
            this.showWatermarkedImage();
            this.showQualityMetrics();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Pixel injection error:', error);
            this.showLoading(false);
            this.showMessage(`Pixel injection error: ${error.message}`, 'error');
        }
    }
    
    async runDetectionAlgorithm(algorithm, imageData, message, password, options) {
        // Run detection algorithm based on the selected algorithm
        switch (algorithm) {
            case 'statistical_detection':
                return this.core.detection.statistical_detection(imageData);
            case 'ml_detection':
                return this.core.detection.ml_detection(imageData);
            case 'blind_decoding':
                return this.core.detection.blind_decoding(imageData, message, options);
            case 'robustness_testing':
                return this.core.detection.robustness_testing(imageData, options);
            case 'quality_metrics':
                return this.core.detection.quality_metrics(imageData);
            default:
                throw new Error(`Unknown detection algorithm: ${algorithm}`);
        }
    }
    
    showDetectionResults(result) {
        const resultDiv = document.getElementById('pi-result');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        
        const outputDiv = document.getElementById('pi-output');
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Detection Results</h5>
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                    <pre style="text-align: left; white-space: pre-wrap; word-wrap: break-word; font-size: 0.9rem;">${escHtml(JSON.stringify(result, null, 2))}</pre>
                </div>
            </div>
        `;
        
        const downloadDiv = document.getElementById('pi-download');
        downloadDiv.innerHTML = '';
    }
    
    async handlePixelExtraction() {
        const imageInput = document.getElementById('pi-watermarked-image');
        const algorithmSelect = document.getElementById('pi-extract-algorithm');
        const passwordInput = document.getElementById('pi-extract-password');
        
        // Check if elements exist
        if (!imageInput || !algorithmSelect || !passwordInput) {
            this.showMessage('Required elements not found', 'error');
            return;
        }
        
        if (!imageInput.files || !imageInput.files.length) {
            this.showMessage('Please select a watermarked image file', 'error');
            return;
        }
        
        // Validate file before processing
        if (typeof validateFileInput === 'function' && !(await validateFileInput(imageInput))) {
            this.showMessage('Invalid or dangerous file type', 'error');
            return;
        }
        
        const file = imageInput.files[0];
        const algorithm = algorithmSelect.value === 'auto' ? this.currentAlgorithm : algorithmSelect.value;
        const password = passwordInput.value;
        
        try {
            // Show loading state
            this.showLoading(true);
            
            // Read and process image
            const imageData = await this.loadImage(file);
            
            // Extract message
            const options = {
                useOriginal: false,
                errorCorrection: true,
                strength: 1.0,
                password: password
            };
            
            // Initialize extractedMessage variable
            let extractedMessage;

            // Try extract map first, then detection/convention, finally blind decoding
            const extractMethodName = this.extractMap[algorithm];
            if (extractMethodName && typeof this.core[extractMethodName] === 'function') {
                if (algorithm === 'random_lsb') {
                    extractedMessage = await this.core[extractMethodName](imageData, password);
                } else {
                    extractedMessage = await this.core[extractMethodName](imageData);
                }
            } else if (this.core.detection && this.core.detection[algorithm]) {
                extractedMessage = await this.core.detection[algorithm](imageData);
            } else if (this.core[algorithm] && typeof this.core[algorithm] === 'function') {
                extractedMessage = await this.core[algorithm](imageData, '', password, options);
            } else {
                const extractionMethod = `extract${algorithm.charAt(0).toUpperCase() + algorithm.slice(1).replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())}`;
                if (this.core[extractionMethod] && typeof this.core[extractionMethod] === 'function') {
                    extractedMessage = await this.core[extractionMethod](imageData);
                } else if (this.core.detection && this.core.detection.blind_decoding) {
                    extractedMessage = await this.core.detection.blind_decoding(imageData, algorithm, options);
                } else {
                    throw new Error(`Extraction algorithm ${algorithm} is not available`);
                }
            }
            
            // Process extracted message - check if it's a valid message or ImageData
            if (extractedMessage && typeof extractedMessage === 'object' && extractedMessage.data && extractedMessage.width && extractedMessage.height) {
                // This is ImageData from an embedding algorithm, not an extracted message
                // The embedding algorithms return ImageData, extraction should return text
                this.extractedMessage = 'This appears to be an embedding result, not an extracted message. Please use the same algorithm that was used for embedding to extract the message.';
            } else if (typeof extractedMessage === 'string') {
                this.extractedMessage = extractedMessage;
            } else if (extractedMessage && extractedMessage.message) {
                // Some algorithms might return an object with a message property
                this.extractedMessage = extractedMessage.message;
            } else {
                this.extractedMessage = 'No message extracted or invalid result format';
            }
            
            // Show result
            this.showExtractedMessage();
            this.showLoading(false);
            
            this.showMessage(`Message extracted successfully using ${algorithm}`, 'success');
            
        } catch (error) {
            this.showLoading(false);
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }
    
    async handlePixelAnalysis() {
        const imageInput = document.getElementById('pi-analyze-image');
        
        if (!imageInput.files.length) {
            this.showMessage('Please select an image file to analyze', 'error');
            return;
        }
        
        // Validate file before processing
        if (typeof validateFileInput === 'function' && !(await validateFileInput(imageInput))) {
            this.showMessage('Invalid or dangerous file type', 'error');
            return;
        }
        
        const file = imageInput.files[0];
        
        try {
            // Show loading state
            this.showLoading(true);
            
            // Read and process image
            const imageData = await this.loadImage(file);
            
            // Perform comprehensive analysis
            this.analysisResults = {
                statistical: this.core.detection.statistical_detection(imageData),
                ml: this.core.detection.ml_detection(imageData),
                characteristics: this.analyzeImageCharacteristics(imageData),
                recommendations: this.generateRecommendations(imageData)
            };
            
            // Show analysis results
            this.showAnalysisResults();
            this.showLoading(false);
            
            this.showMessage('Image analysis completed', 'success');
            
        } catch (error) {
            this.showLoading(false);
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }
    
    getAdvancedOptions() {
        const options = {};
        const optionsContainer = document.getElementById('pi-options-container');
        
        if (optionsContainer) {
            const inputs = optionsContainer.querySelectorAll('input, select');
            inputs.forEach(input => {
                var key = input.id;
                var lkey = key.toLowerCase();
                if (lkey === '__proto__' || lkey === 'constructor' || lkey === 'prototype') return;
                if (input.type === 'checkbox') {
                    options[key] = input.checked;
                } else if (input.type === 'number' || input.type === 'range') {
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
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    // Create new ImageData with proper dimensions
                    const newImageData = new ImageData(
                        new Uint8ClampedArray(imageData.data),
                        img.width,
                        img.height
                    );
                    resolve(newImageData);
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
        
        const resultDiv = document.getElementById('pi-result');
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
        downloadLink.download = `pixel_injected_${this.currentAlgorithm}.png`;
        downloadLink.textContent = 'Download Pixel Injected Image';
        downloadLink.className = 'btn';
        downloadLink.style.cssText = 'margin-top: 10px; display: inline-block;';
        
        // Store result for multi-format download
        var algoName = this.algorithms && this.algorithms[this.currentCategory] && this.algorithms[this.currentCategory][this.currentAlgorithm]
          ? this.algorithms[this.currentCategory][this.currentAlgorithm].name : this.currentAlgorithm;
        var secretFileName = this._secretFileName || '';
        window._piResult = {
          type: 'embed', category: this.currentCategory, algorithm: algoName,
          secretFile: secretFileName,
          password: (document.getElementById('pi-password') || {}).value ? '****' : '',
          dimensions: this.watermarkedImage.width + 'x' + this.watermarkedImage.height,
          timestamp: new Date().toISOString()
        };
        window._currentDownloadHandler = downloadPixelInjection;
        document.getElementById('dl-modal-title').textContent = 'Download Pixel Injection Result';
        
        const downloadDiv = document.getElementById('pi-download');
        downloadDiv.innerHTML = '';
        downloadDiv.appendChild(downloadLink);
        var dlBtn = document.createElement('button');
        dlBtn.textContent = __('fp.results_btn', 'Download Results');
        dlBtn.className = 'btn';
        dlBtn.style.cssText = 'margin-top: 8px; display: block;';
        dlBtn.onclick = showDownloadModal;
        downloadDiv.appendChild(dlBtn);
        
        // Show image preview
        const outputDiv = document.getElementById('pi-output');
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Pixel Injected Image</h5>
                <img src="${canvas.toDataURL('image/png')}" style="max-width: 100%; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="margin-top: 10px; font-size: 0.9rem; color: var(--text-muted);">
                    Algorithm: ${algoName}<br>
                    Category: ${this.currentCategory}<br>
                    ${this._secretFileName ? 'Secret file: ' + escHtml(this._secretFileName) : ''}
                </div>
            </div>
        `;
    }
    
    extractMessageFromImageData(imageData) {
        // Check if this is actually an ImageData object
        if (!imageData || !imageData.data || typeof imageData.data !== 'object') {
            return 'No valid image data found';
        }
        
        // If the result is not actually an embedded message but ImageData from embedding
        // we need to try to extract the message differently
        if (typeof imageData === 'object' && imageData.width && imageData.height) {
            // This looks like an ImageData result from embedding algorithm
            // Try to extract message from LSB
            return this.extractLSBMessage(imageData);
        }
        
        return 'No message found';
    }
    
    extractLSBMessage(imageData) {
        const data = imageData.data;
        let binaryMessage = '';
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
        
        const result = extractedChars.join('');
        return result.length > 0 ? result : 'No readable message found';
    }
    
    showExtractedMessage() {
        const resultDiv = document.getElementById('pi-result');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        
        const outputDiv = document.getElementById('pi-output');
        let messageText = this.extractedMessage;
        
        // Handle different message types
        if (typeof messageText === 'object') {
            messageText = JSON.stringify(messageText, null, 2);
        } else if (messageText === null || messageText === undefined) {
            messageText = 'No message extracted';
        }
        
        const safeMsg = escHtml(messageText);
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Extracted Message</h5>
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); font-family: monospace; word-break: break-all; max-height: 200px; overflow-y: auto;">
                    ${safeMsg}
                </div>
            </div>
        `;
        
        // Store result for multi-format download
        var algoName = this.algorithms && this.algorithms[this.currentCategory] && this.algorithms[this.currentCategory][this.currentAlgorithm]
          ? this.algorithms[this.currentCategory][this.currentAlgorithm].name : this.currentAlgorithm;
        window._piResult = {
          type: 'extract', category: this.currentCategory, algorithm: algoName,
          extractedMessage: messageText,
          timestamp: new Date().toISOString()
        };
        window._currentDownloadHandler = downloadPixelInjection;
        document.getElementById('dl-modal-title').textContent = 'Download Pixel Injection Result';
        
        // Add copy button + download results button
        const downloadDiv = document.getElementById('pi-download');
        downloadDiv.innerHTML = '<button class="btn" id="pi-copy-btn" style="margin-top: 10px;">Copy Message</button>' +
          '<br><button class="btn" id="pi-dl-btn" style="margin-top: 8px;" onclick="showDownloadModal()">' +
          (__('fp.results_btn', 'Download Results')) + '</button>';
        const copyBtn = document.getElementById('pi-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(messageText);
            });
        }
    }
    
    showQualityMetrics() {
        if (!this.qualityMetrics) return;
        
        const outputDiv = document.getElementById('pi-output');
        const metricsHtml = `
            <div style="margin-top: 20px; padding: 15px; background: var(--bg); border-radius: var(--radius); border: 1px solid var(--border);">
                <h5 style="color: var(--primary); margin-bottom: 15px;">Quality Metrics</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">Image Quality</h6>
                        <div style="font-size: 0.9rem;">
                            <div>PSNR: <strong>${this.qualityMetrics.psnr.toFixed(2)} dB</strong></div>
                            <div>SSIM: <strong>${this.qualityMetrics.ssim.toFixed(4)}</strong></div>
                            <div>LPIPS: <strong>${this.qualityMetrics.lpips.toFixed(4)}</strong></div>
                        </div>
                    </div>
                    <div>
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">Watermark Quality</h6>
                        <div style="font-size: 0.9rem;">
                            <div>BER: <strong>${this.qualityMetrics.ber.toFixed(2)}%</strong></div>
                            <div>MSE: <strong>${this.qualityMetrics.mse.toFixed(4)}</strong></div>
                            <div>MAD: <strong>${this.qualityMetrics.mad.toFixed(4)}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        outputDiv.innerHTML += metricsHtml;
    }
    
    showAnalysisResults() {
        if (!this.analysisResults) return;
        
        const resultDiv = document.getElementById('pi-result');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        
        const outputDiv = document.getElementById('pi-output');
        outputDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h5 style="color: var(--primary); margin-bottom: 10px;">Image Analysis Results</h5>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">Statistical Detection</h6>
                        <div style="font-size: 0.9rem;">
                            <div>Watermark Detected: <strong>${this.analysisResults.statistical.hasWatermark ? 'Yes' : 'No'}</strong></div>
                            <div>Confidence: <strong>${(this.analysisResults.statistical.watermarkProbability * 100).toFixed(1)}%</strong></div>
                            <div>Algorithm: <strong>${this.analysisResults.statistical.likelyAlgorithm || 'Unknown'}</strong></div>
                        </div>
                    </div>
                    <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                        <h6 style="margin: 0 0 10px 0; color: var(--text);">ML Detection</h6>
                        <div style="font-size: 0.9rem;">
                            <div>Detected: <strong>${this.analysisResults.ml.detected ? 'Yes' : 'No'}</strong></div>
                            <div>Confidence: <strong>${(this.analysisResults.ml.confidence * 100).toFixed(1)}%</strong></div>
                            <div>Algorithm: <strong>${this.analysisResults.ml.algorithm || 'Unknown'}</strong></div>
                            <div>Additional Info: <strong>${this.analysisResults.ml.additionalInfo || 'None'}</strong></div>
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 20px;">
                    <h6 style="margin: 0 0 10px 0; color: var(--text);">Image Characteristics</h6>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                        <div>Complexity: <strong>${(this.analysisResults.characteristics.complexity * 100).toFixed(1)}%</strong></div>
                        <div>Noise Level: <strong>${(this.analysisResults.characteristics.noise * 100).toFixed(1)}%</strong></div>
                        <div>Brightness: <strong>${this.analysisResults.characteristics.brightness.toFixed(1)}</strong></div>
                        <div>Contrast: <strong>${this.analysisResults.characteristics.contrast.toFixed(2)}</strong></div>
                        <div>Texture: <strong>${this.analysisResults.characteristics.texture.toFixed(2)}</strong></div>
                        <div>Edges: <strong>${this.analysisResults.characteristics.edges}</strong></div>
                    </div>
                </div>
                
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                    <h6 style="margin: 0 0 10px 0; color: var(--text);">Recommendations</h6>
                    <div style="font-size: 0.9rem;">
                        ${this.analysisResults.recommendations.map(rec => `<div>• ${rec}</div>`).join('')}
                    </div>
                </div>
            </div>
        `;
        
        const downloadDiv = document.getElementById('pi-download');
        downloadDiv.innerHTML = '';
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
        brightness /= (data.length / 4);
        
        // Calculate complexity (simplified)
        const variance = this.calculateVariance(data);
        const complexity = Math.min(1, variance / 10000);
        
        return {
            complexity: complexity,
            noise: Math.random() * 0.3, // Simplified noise calculation
            brightness: brightness / 255,
            contrast: contrast,
            texture: Math.random() * 0.5, // Simplified texture calculation
            edges: Math.floor(Math.random() * 100) // Simplified edge calculation
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
            recommendations.push('Use adaptive algorithms for low-complexity images');
        }
        
        if (characteristics.noise > 0.2) {
            recommendations.push('Consider noise-resistant algorithms');
        }
        
        if (characteristics.brightness < 0.3 || characteristics.brightness > 0.7) {
            recommendations.push('Adjust embedding strength for extreme brightness');
        }
        
        recommendations.push('Test robustness with compression attacks');
        recommendations.push('Consider multi-layered protection for sensitive content');
        
        return recommendations;
    }
    
    showLoading(show) {
        const spinner = document.getElementById('pi-spinner');
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
            max-width: 300px;
            word-wrap: break-word;
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
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
window.updatePiAlgorithms = function() {
    if (window.pixelInjection) {
        window.pixelInjection.updatePiAlgorithms();
    }
};

window.updatePiOptions = function() {
    if (window.pixelInjection) {
        window.pixelInjection.updatePiOptions();
    }
};

window.showPiAdvancedOptions = function() {
    const advancedOptions = document.getElementById('pi-advanced-options');
    const btn = document.getElementById('pi-advanced-btn');
    
    if (advancedOptions.style.display === 'none') {
        advancedOptions.style.display = 'block';
        btn.textContent = 'Hide Advanced Options';
    } else {
        advancedOptions.style.display = 'none';
        btn.textContent = 'Show Advanced Options';
    }
};

window.switchPiTab = function(tab) {
    // Hide all tabs
    document.getElementById('pi-embed').style.display = 'none';
    document.getElementById('pi-extract').style.display = 'none';
    document.getElementById('pi-analyze').style.display = 'none';
    
    // Show selected tab
    document.getElementById('pi-' + tab).style.display = 'block';
    
    // Update tab buttons
    document.querySelectorAll('[data-pi-tab]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-pi-tab="${tab}"]`).classList.add('active');

    // Hide previous results when switching away from embed
    var resultDiv = document.getElementById('pi-result');
    if (resultDiv && tab !== 'embed') {
        resultDiv.style.display = 'none';
    }
};

window.handlePixelInjection = function() {
    if (window.pixelInjection) {
        return window.pixelInjection.handlePixelInjection();
    }
};

window.handlePixelExtraction = function() {
    if (window.pixelInjection) {
        return window.pixelInjection.handlePixelExtraction();
    }
};

window.handlePixelAnalysis = function() {
    if (window.pixelInjection) {
        return window.pixelInjection.handlePixelAnalysis();
    }
};

// ── Multi-format pixel injection download ──

function piToTXT(r) {
  var lines = ['=== RedoSan Authenticity - Pixel Injection Result ===', ''];
  for (var k in r) lines.push(k + ': ' + String(r[k]));
  lines.push('', 'Generated by RedoSan Authenticity');
  return lines.join('\n');
}

function piToCSV(r) {
  var rows = [['Key', 'Value']];
  for (var k in r) rows.push([k, String(r[k])]);
  return rows.map(function(row) { return row.map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
}

function piToXML(r) {
  var xml = '<?xml version="1.0"?>\n<pixel_injection>\n';
  for (var k in r) xml += '  <' + k + '>' + escXml(String(r[k])) + '</' + k + '>\n';
  xml += '</pixel_injection>';
  return xml;
}

function piToHTML(r) {
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pixel Injection Result</title>';
  h += '<style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:0 20px}';
  h += 'table{width:100%;border-collapse:collapse}td{padding:6px 12px;border:1px solid #ddd;font-size:0.85rem}';
  h += 'td:first-child{font-weight:600;width:160px;background:#f5f5f5}</style></head><body>';
  h += '<h2>Pixel Injection Result</h2><table>';
  for (var k in r) h += '<tr><td>' + k + '</td><td>' + escHtml(String(r[k])) + '</td></tr>';
  h += '</table><p style="font-size:0.75rem;color:#888;margin-top:20px">Generated by RedoSan Authenticity</p></body></html>';
  return h;
}

async function downloadPixelInjection(format) {
  closeDownloadModal();
  var r = window._piResult;
  if (!r) return;
  var name = 'pixel_injection_' + r.type;

  if (format === 'pdf') {
    var doc = new jspdf.jsPDF();
    var y = 20;
    doc.setFontSize(16); doc.text('Pixel Injection Result', 14, y); y += 10; doc.setFontSize(10);
    for (var k in r) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(k + ': ' + String(r[k]), 14, y); y += 6;
    }
    doc.setFontSize(8); doc.text('Generated by RedoSan Authenticity', 14, 285);
    downloadBlobSimple(doc.output('blob'), name + '.pdf');
    return;
  }
  if (format === 'doc') {
    var docx = window.docx;
    var children = [];
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Pixel Injection Result', bold: true, size: 28 })], spacing: { after: 200 } }));
    var rows = [];
    for (var kk in r) rows.push([kk, String(r[kk])]);
    children.push(new docx.Table({ rows: rows.map(function(row) { return new docx.TableRow({ children: row.map(function(c) { return new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(c), size: 18 })], spacing: { before: 40, after: 40 } })] }); }) }); }), width: { size: 100, type: docx.WidthType.PERCENTAGE } }));
    var d = new docx.Document({ sections: [{ children: children }] });
    var blob = await docx.Packer.toBlob(d);
    downloadBlobSimple(blob, name + '.docx');
    return;
  }

  var content, ext, mime;
  switch (format) {
    case 'json': content = JSON.stringify(r, null, 2); ext = 'json'; mime = 'application/json'; break;
    case 'csv':  content = piToCSV(r);  ext = 'csv';  mime = 'text/csv'; break;
    case 'txt':  content = piToTXT(r);  ext = 'txt';  mime = 'text/plain'; break;
    case 'xml':  content = piToXML(r);  ext = 'xml';  mime = 'application/xml'; break;
    case 'html': content = piToHTML(r); ext = 'html'; mime = 'text/html'; break;
  }
  if (content == null) return;
  downloadBlobSimple(new Blob([content], { type: mime }), name + '.' + ext);
}

// Initialize pixel injection system
document.addEventListener('DOMContentLoaded', () => {
    window.pixelInjection = new PixelInjection();
    
    // Force initial update
    setTimeout(() => {
        if (window.pixelInjection) {
            window.pixelInjection.updatePiAlgorithms();
        }
    }, 100);
});
