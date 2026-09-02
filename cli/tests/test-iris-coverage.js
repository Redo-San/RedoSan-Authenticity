// ── Iris Biometric unit test runner ──
// All tests are split into cli/tests/iris/*.test.js for maintainability.
// This file re-exports them for backward compatibility and V8 coverage merging.
//
// Run all:  node --test cli/tests/test-iris-coverage.js
// Run one:  node --test cli/tests/iris/quality.test.js
// Coverage: NODE_V8_COVERAGE=coverage/v8tmp node --test cli/tests/iris/*.test.js

require("./iris/quality.test");
require("./iris/quality-full.test");
require("./iris/engine.test");
require("./iris/matcher.test");
require("./iris/performance.test");
require("./iris/liveness.test");
require("./iris/standards.test");
require("./iris/template-protection.test");
require("./iris/camera.test");
require("./iris/storage.test");
