/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face ONNX Embedder: MobileFaceNet (ArcFace w600k) via onnxruntime-web ──

/**
 * Optional high-accuracy face embedder. Uses the MobileFaceNet ONNX model
 * (ArcFace w600k, 512-d embeddings) through onnxruntime-web.
 *
 * Loads lazily (runtime + ~13 MB model on first use). Execution providers are
 * tried in order webgpu → wasm → cpu. When the runtime or model cannot be
 * loaded, load() returns false and the caller falls back to the Human HSE
 * embedder — the module never throws on load failures.
 */
var FaceONNXEmbedder = {
    /** Embedding version label stored in the registry/report. */
    VERSION: 'arcface-mbf',
    /** Embedding dimensionality produced by the model. */
    DIMS: 512,
    /** Default MobileFaceNet (ArcFace w600k) model URL. */
    MODEL_URL: 'https://cdn.jsdelivr.net/gh/garavv/arcface-onnx@master/models/mobilefacenet.onnx',
    /** Default onnxruntime-web UMD bundle URL. */
    RUNTIME_URL: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js',
    /** Default model input tensor name. */
    INPUT_NAME: 'input',

    _runtime: null,
    _session: null,
    _backend: null,
    _error: null,
    _inputName: null,

    /** @returns {boolean} */
    isReady: function () {
        return !!this._session;
    },

    /** @returns {string|null} active execution provider ('webgpu' | 'wasm' | 'cpu') */
    getBackend: function () {
        return this._backend;
    },

    /** @returns {string|null} last load error message */
    getError: function () {
        return this._error;
    },

    /** Drop any loaded session/runtime (mainly for tests). */
    reset: function () {
        this._runtime = null;
        this._session = null;
        this._backend = null;
        this._error = null;
        this._inputName = null;
    },

    /**
     * Load the ONNX runtime (lazy) and the MobileFaceNet model.
     * @param {object} [options]
     * @param {object} [options.runtime] Injected ort-compatible runtime (tests)
     * @param {string} [options.runtimeUrl] Runtime bundle URL override
     * @param {string} [options.modelUrl] Model URL override
     * @param {string} [options.inputName] Model input tensor name override
     * @returns {Promise<boolean>}
     */
    load: async function (options) {
        var ort, modelUrl, inputName, backends, i, err, session;
        if (this._session) return true;
        options = options || {};
        ort = options.runtime || (typeof window !== 'undefined' && window.ort ? window.ort : null);
        modelUrl = options.modelUrl || this.MODEL_URL;
        inputName = options.inputName || this.INPUT_NAME;
        if (!ort) {
            if (options.runtime) {
                this._error = 'Provided runtime is unusable.';
                return false;
            }
            try {
                ort = await this._loadRuntime(options.runtimeUrl || this.RUNTIME_URL);
            } catch (e) {
                this._error = e.message;
                return false;
            }
        }
        this._runtime = ort;
        this._inputName = inputName;
        backends = ['webgpu', 'wasm', 'cpu'];
        err = null;
        for (i = 0; i < backends.length; i++) {
            try {
                session = await ort.InferenceSession.create(modelUrl, { executionProviders: [backends[i]] });
                this._session = session;
                this._backend = backends[i];
                return true;
            } catch (e) {
                err = e;
            }
        }
        this._error = err ? err.message : 'No ONNX execution provider succeeded.';
        return false;
    },

    /**
     * Inject the onnxruntime-web UMD bundle via a <script> tag.
     * @param {string} url
     * @returns {Promise<object>} window.ort
     */
    _loadRuntime: function (url) {
        return new Promise(function (resolve, reject) {
            var script;
            if (typeof document === 'undefined' || !document.createElement) {
                reject(new Error('onnxruntime-web is not available in this environment.'));
                return;
            }
            script = document.createElement('script');
            script.src = url;
            script.onload = function () {
                if (window.ort) resolve(window.ort);
                else reject(new Error('window.ort was not found after loading the runtime.'));
            };
            script.onerror = function () {
                reject(new Error('Failed to load onnxruntime-web from ' + url));
            };
            document.head.appendChild(script);
        });
    },

    /**
     * Convert a 112×112 RGB(A) canvas into a CHW float32 tensor with the
     * standard ArcFace normalization ((v − 127.5) / 127.5).
     * @param {HTMLCanvasElement} canvas112
     * @returns {Float32Array} 112×112×3 values in CHW order
     */
    preprocess: function (canvas112) {
        var ctx, img, n, out, i, r, g, b;
        if (!canvas112 || typeof canvas112.getContext !== 'function') {
            throw new Error('A canvas is required for preprocessing.');
        }
        ctx = canvas112.getContext('2d');
        img = ctx.getImageData(0, 0, canvas112.width, canvas112.height);
        n = canvas112.width * canvas112.height;
        out = new Float32Array(n * 3);
        for (i = 0; i < n; i++) {
            r = img.data[i * 4];
            g = img.data[i * 4 + 1];
            b = img.data[i * 4 + 2];
            out[i] = (r - 127.5) / 127.5;
            out[n + i] = (g - 127.5) / 127.5;
            out[2 * n + i] = (b - 127.5) / 127.5;
        }
        return out;
    },

    /**
     * L2-normalize a descriptor array in place of its magnitude.
     * @param {ArrayLike<number>} arr
     * @returns {Float32Array|null}
     */
    normalize: function (arr) {
        var out, sum, i, v;
        if (!arr || typeof arr.length !== 'number' || arr.length === 0) return null;
        sum = 0;
        for (i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
        sum = Math.sqrt(sum);
        if (!isFinite(sum) || sum === 0) return null;
        out = new Float32Array(arr.length);
        for (i = 0; i < arr.length; i++) {
            v = arr[i] / sum;
            out[i] = v;
        }
        return out;
    },

    /**
     * Embed an aligned 112×112 face canvas into a normalized 512-d descriptor.
     * @param {HTMLCanvasElement} canvas112
     * @returns {Promise<Float32Array|null>}
     */
    embed: async function (canvas112) {
        var input, tensor, feeds, outputs, name, data;
        if (!this._session) throw new Error('FaceONNXEmbedder is not loaded. Call load() first.');
        input = this.preprocess(canvas112);
        tensor = new this._runtime.Tensor('float32', input, [1, 3, canvas112.width, canvas112.height]);
        feeds = {};
        feeds[this._inputName || this.INPUT_NAME] = tensor;
        outputs = await this._session.run(feeds);
        name = this._session.outputNames && this._session.outputNames[0];
        if (!outputs || !name || !outputs[name] || !outputs[name].data) {
            throw new Error('Unexpected ONNX output shape.');
        }
        data = this.normalize(outputs[name].data);
        if (!data) throw new Error('ONNX embedding could not be normalized.');
        return data;
    },
};

/* c8 ignore start */
if (typeof window !== 'undefined') window.FaceONNXEmbedder = FaceONNXEmbedder;
/* c8 ignore stop */