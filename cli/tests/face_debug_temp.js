const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/" };
globalThis.escHtml = function(s) { return String(s || ""); };
globalThis.downloadBlobSimple = function() {};
globalThis.confirm = function() { return true; };

const engineSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Face_Biometric", "face_engine.js"), "utf8");
vm.runInThisContext(engineSrc);

const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const regSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Face_Biometric", "face_registry.js"), "utf8");
vm.runInThisContext(regSrc);

const uiSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Face_Biometric", "face_ui.js"), "utf8");
vm.runInThisContext(uiSrc);

describe("Debug listRegisteredFaces", () => {
  it("should set status when registry is null", async () => {
    // First init to simulate prior test interference
    globalThis._lastDescriptor = new Float32Array([0.1]);
    globalThis.faceRegistry = { addFace: async function(l, d) { return 1; } };
    globalThis.listRegisteredFaces = function() {};

    // Now the actual listRegisteredFaces test
    const statusEl = { textContent: "" };
    globalThis.document = {
      getElementById: function(id) {
        const store = {
          "face-status": statusEl,
          "face-list": { innerHTML: "" },
          "face-count": { textContent: "" }
        };
        return store[id] !== undefined ? store[id] : null;
      },
      querySelectorAll: function() { return []; },
      querySelector: function() { return null; },
      createElement: function() { return { className: "", innerHTML: "", style: {}, append: function() {} }; }
    };

    console.log("DEBUG: faceRegistry before null =", globalThis.faceRegistry);
    console.log("DEBUG: faceRegistry === null:", globalThis.faceRegistry === null);
    globalThis.faceRegistry = null;
    console.log("DEBUG: faceRegistry after null =", globalThis.faceRegistry);

    await globalThis.listRegisteredFaces();
    console.log("DEBUG: statusEl.textContent =", JSON.stringify(statusEl.textContent));

    assert.equal(statusEl.textContent, "Face Registry not initialized.");
  });
});