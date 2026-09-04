const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// Load face_engine.js
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_engine.js"),
  "utf8",
);
vm.runInThisContext(engineSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_engine.js",
  ),
});

// ── Helpers ──

function makeDescriptor(values) {
  const arr = new Float32Array(128);
  for (let i = 0; i < 128 && i < values.length; i++) arr[i] = values[i];
  return arr;
}

// ── Tests ──

describe("FaceEngine — constructor and isLoaded", () => {
  it("should create instance with default options", () => {
    const engine = new FaceEngine();
    assert.ok(engine instanceof FaceEngine);
    assert.equal(engine._loaded, false);
    assert.equal(
      engine._modelBasePath,
      "https://cdn.jsdelivr.net/npm/@vladmandic/human/models/",
    );
    assert.equal(engine._tinyDetector, false);
  });

  it("should accept custom options", () => {
    const engine = new FaceEngine({
      tinyDetector: true,
      modelBasePath: "/custom/",
    });
    assert.equal(engine._tinyDetector, true);
    assert.equal(engine._modelBasePath, "/custom/");
  });

  it("should accept pre-configured human instance", () => {
    const mockHuman = { constructor: function FakeHuman() {} };
    const engine = new FaceEngine({ human: mockHuman });
    assert.equal(engine._human, mockHuman);
  });

  it("isLoaded should return false initially", () => {
    const engine = new FaceEngine();
    assert.equal(engine.isLoaded(), false);
  });
});

describe("FaceEngine — compareDescriptors", () => {
  it("should return 0 for identical descriptors", () => {
    const a = makeDescriptor([0.5, 0.5, 0.5]);
    const b = makeDescriptor([0.5, 0.5, 0.5]);
    assert.equal(FaceEngine.compareDescriptors(a, b), 0);
  });

  it("should return positive distance for different values", () => {
    const a = makeDescriptor([0, 0, 0]);
    const b = makeDescriptor([1, 1, 1]);
    const dist = FaceEngine.compareDescriptors(a, b);
    assert.ok(dist > 0);
    assert.equal(dist, Math.sqrt(3));
  });

  it("should return Infinity if a is null", () => {
    assert.equal(
      FaceEngine.compareDescriptors(null, makeDescriptor([0.5])),
      Infinity,
    );
  });

  it("should return Infinity if b is null", () => {
    assert.equal(
      FaceEngine.compareDescriptors(makeDescriptor([0.5]), null),
      Infinity,
    );
  });

  it("should return Infinity if both are null", () => {
    assert.equal(FaceEngine.compareDescriptors(null, null), Infinity);
  });
});

describe("FaceEngine — cosineSimilarity", () => {
  it("should return ~1 for identical vectors", () => {
    const a = makeDescriptor([0.5, 0.5, 0.5]);
    const sim = FaceEngine.cosineSimilarity(a, a);
    assert.ok(Math.abs(sim - 1) < 0.0001);
  });

  it("should return -1 for opposite vectors", () => {
    const a = makeDescriptor([1, 0]);
    const b = makeDescriptor([-1, 0]);
    assert.equal(FaceEngine.cosineSimilarity(a, b), -1);
  });

  it("should return -1 when a is null", () => {
    assert.equal(FaceEngine.cosineSimilarity(null, makeDescriptor([0.5])), -1);
  });

  it("should return -1 when b is null", () => {
    assert.equal(FaceEngine.cosineSimilarity(makeDescriptor([0.5]), null), -1);
  });

  it("should return 0 for zero-magnitude vectors", () => {
    const zero = makeDescriptor([0, 0]);
    assert.equal(FaceEngine.cosineSimilarity(zero, zero), 0);
  });

  it("should return value between -1 and 1 for arbitrary vectors", () => {
    const a = makeDescriptor([1, 2, 3]);
    const b = makeDescriptor([4, 5, 6]);
    const sim = FaceEngine.cosineSimilarity(a, b);
    assert.ok(sim >= -1 && sim <= 1, "similarity should be in [-1, 1]");
  });
});

describe("FaceEngine — matchInRegistry", () => {
  it("should find exact match in registry", () => {
    const desc = makeDescriptor([0.5, 0.5, 0.5]);
    const registry = [
      { descriptor: makeDescriptor([1, 1, 1]), label: "bob" },
      { descriptor: makeDescriptor([0.5, 0.5, 0.5]), label: "alice" },
    ];
    const result = FaceEngine.matchInRegistry(desc, registry, 0.6);
    assert.notEqual(result.match, null);
    assert.equal(result.match.label, "alice");
    assert.equal(result.distance, 0);
  });

  it("should return no match when above threshold", () => {
    const desc = makeDescriptor([1, 1, 1]);
    const registry = [
      { descriptor: makeDescriptor([-1, -1, -1]), label: "far" },
    ];
    const result = FaceEngine.matchInRegistry(desc, registry, 0.1);
    assert.equal(result.match, null);
    assert.ok(result.distance > 0.1);
  });

  it("should return no match for empty registry (cover lines 174-176)", () => {
    const desc = makeDescriptor([0.5, 0.5]);
    const result = FaceEngine.matchInRegistry(desc, [], 0.6);
    assert.equal(result.match, null);
    assert.equal(result.distance, Infinity);
  });

  it("should use default threshold of 0.6", () => {
    const desc = makeDescriptor([0.5, 0.5]);
    const registry = [
      { descriptor: makeDescriptor([0.5, 0.5]), label: "match" },
    ];
    const result = FaceEngine.matchInRegistry(desc, registry);
    assert.notEqual(result.match, null);
    assert.equal(typeof result.distance, "number");
  });
});

// ── loadModels tests with mock Human ──

describe("FaceEngine — loadModels with mock Human", () => {
  let mockLoadHistory;

  beforeEach(() => {
    mockLoadHistory = [];
    function MockHuman(config) {
      this._config = config;
    }
    MockHuman.prototype.load = async function (cfg) {
      mockLoadHistory.push(cfg.backend || "unknown");
    };
    MockHuman.prototype.detect = async function () {
      return { face: [] };
    };
    globalThis.Human = MockHuman;
    globalThis.document = {
      createElement: function () {
        return {
          getContext: function () {
            return {}; // WebGL available
          },
        };
      },
    };
  });

  afterEach(() => {
    delete globalThis.Human;
    delete globalThis.document;
  });

  it("should successfully load models (cover lines 41-88 happy path)", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    assert.ok(engine.isLoaded(), "engine should be loaded");
    assert.ok(engine._human instanceof globalThis.Human);
    assert.equal(mockLoadHistory.length, 1);
    assert.equal(mockLoadHistory[0], "webgl");
  });

  it("should be idempotent on second call", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    const human1 = engine._human;
    await engine.loadModels();
    assert.equal(engine._human, human1, "should reuse existing instance");
    assert.equal(mockLoadHistory.length, 1, "load should only be called once");
  });

  it("should throw if Human is not available on globalThis", async () => {
    delete globalThis.Human;
    const engine = new FaceEngine();
    await assert.rejects(async function () {
      await engine.loadModels();
    }, /@vladmandic\/human is not loaded/);
  });

  it("should fall back to CPU if WebGL context unavailable (cover line 42-44)", async () => {
    globalThis.document = {
      createElement: function () {
        return {
          getContext: function () {
            return null;
          },
        };
      },
    };
    const engine = new FaceEngine();
    await engine.loadModels();
    assert.ok(engine.isLoaded());
    assert.equal(mockLoadHistory.length, 1);
    assert.equal(mockLoadHistory[0], "cpu");
  });

  it("should handle getContext exception (cover line 45)", async () => {
    globalThis.document = {
      createElement: function () {
        return {
          getContext: function () {
            throw new Error("WebGL crash");
          },
        };
      },
    };
    const engine = new FaceEngine();
    await engine.loadModels();
    assert.ok(engine.isLoaded());
    assert.equal(mockLoadHistory.length, 1);
    assert.equal(mockLoadHistory[0], "cpu");
  });

  it("should retry with CPU after WebGL load failure (cover lines 70-77)", async () => {
    function FailingWebGLHuman(config) {
      this._config = config;
    }
    FailingWebGLHuman.prototype.load = async function (cfg) {
      if (cfg.backend === "webgl") throw new Error("WebGL failed");
      // CPU succeeds
    };
    FailingWebGLHuman.prototype.detect = async function () {
      return { face: [] };
    };
    globalThis.Human = FailingWebGLHuman;

    const engine = new FaceEngine();
    await engine.loadModels();
    assert.ok(engine.isLoaded());
  });

  it("should throw when both backends fail (cover lines 78-87)", async () => {
    function AlwaysFailingHuman(config) {
      this._config = config;
    }
    AlwaysFailingHuman.prototype.load = async function () {
      throw new Error("model load failed");
    };
    AlwaysFailingHuman.prototype.detect = async function () {
      return { face: [] };
    };
    globalThis.Human = AlwaysFailingHuman;

    const engine = new FaceEngine();
    await assert.rejects(async function () {
      await engine.loadModels();
    }, /model load failed/);
    assert.equal(engine.isLoaded(), false);
  });

  it("should use pre-configured human instance", async () => {
    function PreConfigHuman() {
      this._config = {};
    }
    PreConfigHuman.prototype.load = async function () {};
    PreConfigHuman.prototype.detect = async function () {
      return { face: [] };
    };
    const preHuman = new PreConfigHuman();
    const engine = new FaceEngine({ human: preHuman });
    await engine.loadModels();
    assert.ok(engine.isLoaded());
    // Should NOT create a new Human instance
    assert.ok(engine._human instanceof PreConfigHuman);
  });
});

// ── detectFaces tests ──

describe("FaceEngine — detectFaces", () => {
  beforeEach(() => {
    function MockHuman(config) {
      this._config = config;
    }
    MockHuman.prototype.load = async function () {};
    MockHuman.prototype.detect = async function () {
      return { face: [] };
    };
    globalThis.Human = MockHuman;
    globalThis.document = {
      createElement: function () {
        return {
          getContext: function () {
            return {};
          },
        };
      },
    };
  });

  afterEach(() => {
    delete globalThis.Human;
    delete globalThis.document;
  });

  it("should throw if models not loaded (cover line 97)", async () => {
    const engine = new FaceEngine();
    await assert.rejects(async function () {
      await engine.detectFaces({});
    }, /Models not loaded/);
  });

  it("should return empty array when no face detected", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    const result = await engine.detectFaces({});
    assert.deepEqual(result, []);
  });

  it("should return mapped face results (cover lines 100-107)", async () => {
    function MockHuman(config) {
      this._config = config;
    }
    MockHuman.prototype.load = async function () {};
    MockHuman.prototype.detect = async function () {
      return {
        face: [
          {
            box: { x: 10, y: 20, width: 100, height: 150 },
            score: 0.95,
            landmarks: { nose: { x: 50, y: 80 } },
            embedding: new Float32Array([0.1, 0.2, 0.3]),
          },
          {
            box: { x: 200, y: 50, width: 80, height: 120 },
            score: 0.87,
            landmarks: { nose: { x: 240, y: 100 } },
            descriptor: new Float32Array([0.4, 0.5, 0.6]),
          },
        ],
      };
    };
    globalThis.Human = MockHuman;

    const engine = new FaceEngine();
    await engine.loadModels();
    const result = await engine.detectFaces({});
    assert.equal(result.length, 2);
    assert.equal(result[0].score, 0.95);
    assert.equal(result[0].box.x, 10);
    assert.deepEqual(result[0].descriptor, new Float32Array([0.1, 0.2, 0.3]));
    assert.equal(result[1].score, 0.87);
    assert.deepEqual(result[1].descriptor, new Float32Array([0.4, 0.5, 0.6]));
  });

  it("should handle null result gracefully (cover line 99)", async () => {
    function MockHuman(config) {
      this._config = config;
    }
    MockHuman.prototype.load = async function () {};
    MockHuman.prototype.detect = async function () {
      return null;
    };
    globalThis.Human = MockHuman;

    const engine = new FaceEngine();
    await engine.loadModels();
    const result = await engine.detectFaces({});
    assert.deepEqual(result, []);
  });
});

// ── extractDescriptor tests ──

describe("FaceEngine — extractDescriptor", () => {
  beforeEach(() => {
    function MockHuman(config) {
      this._config = config;
    }
    MockHuman.prototype.load = async function () {};
    MockHuman.prototype.detect = async function () {
      return {
        face: [
          {
            box: { x: 10, y: 20, width: 100, height: 150 },
            score: 0.95,
            landmarks: {},
            embedding: new Float32Array([0.1, 0.2, 0.3]),
          },
          {
            box: { x: 200, y: 50, width: 80, height: 120 },
            score: 0.87,
            landmarks: {},
            descriptor: new Float32Array([0.4, 0.5, 0.6]),
          },
        ],
      };
    };
    globalThis.Human = MockHuman;
    globalThis.document = {
      createElement: function () {
        return {
          getContext: function () {
            return {};
          },
        };
      },
    };
  });

  afterEach(() => {
    delete globalThis.Human;
    delete globalThis.document;
  });

  it("should return descriptor when position matches (cover lines 117-123)", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    const desc = await engine.extractDescriptor({}, { box: { x: 10, y: 20 } });
    assert.deepEqual(desc, new Float32Array([0.1, 0.2, 0.3]));
  });

  it("should return descriptor for second face when position matches", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    const desc = await engine.extractDescriptor({}, { box: { x: 200, y: 50 } });
    assert.deepEqual(desc, new Float32Array([0.4, 0.5, 0.6]));
  });

  it("should return null when no face matches position (cover line 126)", async () => {
    const engine = new FaceEngine();
    await engine.loadModels();
    const desc = await engine.extractDescriptor(
      {},
      { box: { x: 999, y: 999 } },
    );
    assert.equal(desc, null);
  });
});
