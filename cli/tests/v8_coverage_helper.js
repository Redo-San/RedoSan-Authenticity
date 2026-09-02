#!/usr/bin/env node
// ── V8-based coverage helper for VM-loaded modules ──
// Reads coverage files produced by NODE_V8_COVERAGE env var to instrument
// code loaded via vm.runInThisContext(), which c8 cannot track.
//
// Usage:
//   1. Set env: NODE_V8_COVERAGE=coverage/v8-raw
//   2. Run tests normally
//   3. const { V8Coverage } = require("./v8_coverage_helper");
//   4. const report = V8Coverage.readFromDir("coverage/v8-raw", ["Iris_Biometric/"]);
//   5. V8Coverage.printReport(report);
//
// CLI mode:
//   NODE_V8_COVERAGE=coverage/v8-raw node v8_coverage_helper.js --dir Iris_Biometric/

const fs = require("node:fs");
const path = require("node:path");

class V8Coverage {
  /**
   * Read V8 coverage JSON files from a directory and parse for specific modules.
   * @param {string} v8Dir - Directory containing coverage-*.json files
   * @param {string[]} includeDirs - Directory prefixes to include (e.g. ["Iris_Biometric/"])
   * @param {object} opts
   * @param {string} opts.cwd - Working directory (default: process.cwd())
   * @returns {{ files: Map, summary: object }}
   */
  static readFromDir(v8Dir, includeDirs, opts = {}) {
    const cwd = opts.cwd || process.cwd();
    if (!fs.existsSync(v8Dir)) {
      console.warn(`V8 coverage directory not found: ${v8Dir}`);
      return { files: new Map(), summary: V8Coverage._emptySummary() };
    }

    const jsonFiles = fs.readdirSync(v8Dir).filter((f) => f.endsWith(".json"));
    if (jsonFiles.length === 0) {
      console.warn(`No coverage JSON files found in ${v8Dir}`);
      return { files: new Map(), summary: V8Coverage._emptySummary() };
    }

    // Merge all coverage scripts from all files
    const allScripts = [];
    for (const jf of jsonFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(v8Dir, jf), "utf8"));
        const scripts = Array.isArray(data) ? data : (data.result || []);
        allScripts.push(...scripts);
      } catch (e) {
        console.warn(`Warning: failed to parse ${jf}: ${e.message}`);
      }
    }

    // Each test file runs in a separate Node.js process, so the same source
    // module appears in multiple JSON files.  Deduplicate by URL: for each
    // function, a range is "covered" if ANY process recorded count > 0 for it.
    const scriptsByURL = new Map();
    for (const script of allScripts) {
      const url = script.url || "";
      if (!includeDirs.some((d) => url.includes(d))) continue;
      if (url.includes("node_modules") || url.includes("test-") || url.includes("v8_coverage")) continue;

      if (!scriptsByURL.has(url)) {
        scriptsByURL.set(url, { url, functions: [] });
      }
      const target = scriptsByURL.get(url);

      for (const fn of script.functions || []) {
        // Find existing function entry with same name and start offset
        let existing = target.functions.find(
          (e) => e.functionName === fn.functionName &&
            e.ranges?.[0]?.startOffset === fn.ranges?.[0]?.startOffset,
        );
        if (!existing) {
          // First time seeing this function — clone ranges
          existing = {
            functionName: fn.functionName,
            ranges: fn.ranges.map((r) => ({ ...r })),
          };
          target.functions.push(existing);
        } else {
          // Merge: if this process covered a range that was previously uncovered, mark it covered
          for (const r of fn.ranges || []) {
            const existingRange = existing.ranges.find(
              (er) => er.startOffset === r.startOffset && er.endOffset === r.endOffset,
            );
            if (existingRange) {
              if (r.count > 0) existingRange.count = Math.max(existingRange.count, r.count);
            } else {
              existing.ranges.push({ ...r });
            }
          }
        }
      }
    }

    return V8Coverage.parse([...scriptsByURL.values()], includeDirs, { cwd });
  }

  /**
   * Parse raw V8 coverage scripts into per-file reports.
   * @param {Array} scripts - Array of V8 coverage script objects
   * @param {string[]} includeDirs - Directory prefixes to include
   * @param {object} opts
   * @returns {{ files: Map, summary: object }}
   */
  static parse(scripts, includeDirs, opts = {}) {
    const cwd = opts.cwd || process.cwd();
    const fileMap = new Map();

    for (const script of scripts) {
      const url = script.url || "";
      // Filter to only our include directories
      if (!includeDirs.some((d) => url.includes(d))) continue;
      // Skip node_modules, test files, coverage helper itself
      if (url.includes("node_modules") || url.includes("test-") || url.includes("v8_coverage")) continue;

      const filename = url;
      if (!fileMap.has(filename)) {
        // Parse c8 ignore markers from source to compute excluded byte ranges
        let excludedRanges = [];
        try {
          // V8 coverage uses file:/// URLs — convert to filesystem path
          const fsPath = filename.startsWith("file:///")
            ? decodeURIComponent(filename.replace(/^file:\/{3}/, "").replace(/\//g, path.sep === "\\" ? "\\" : "/"))
            : filename;
          const src = fs.readFileSync(fsPath, "utf8");
          excludedRanges = V8Coverage._parseC8IgnoreRanges(src);
        } catch { /* file may not be readable */ }

        fileMap.set(filename, {
          filename,
          shortName: filename.replace(/.*Iris_Biometric\//, "").replace(/\\/g, "/"),
          statements: { total: 0, covered: 0, uncovered: [] },
          branches: { total: 0, covered: 0, uncovered: [] },
          functions: { total: 0, covered: 0, uncovered: [] },
          _excludedRanges: excludedRanges,
        });
      }
      const fc = fileMap.get(filename);

      // Parse functions → statements + branches
      for (const fn of script.functions || []) {
        fc.functions.total++;
        let fnCovered = false;

        const ranges = fn.ranges || [];
        for (let i = 0; i < ranges.length; i++) {
          const range = ranges[i];
          const startOffset = range.startOffset;
          const endOffset = range.endOffset;
          const count = range.count !== undefined ? range.count : 0;

          // Skip ranges that fall within c8 ignore markers
          if (V8Coverage._isInExcludedRange(startOffset, endOffset, fc._excludedRanges)) {
            continue;
          }

          // Statement coverage: each range is a statement
          fc.statements.total++;
          if (count > 0) {
            fc.statements.covered++;
            fnCovered = true;
          } else {
            fc.statements.uncovered.push(startOffset);
          }

          // Branch coverage: if another range starts at the same offset,
          // it represents an alternate branch (if/else, ternary, &&, ||)
          const isBranch = ranges.some((other, j) =>
            j !== i && other.startOffset === startOffset && other.endOffset !== range.endOffset
          );
          if (isBranch) {
            fc.branches.total++;
            if (count > 0) {
              fc.branches.covered++;
            } else {
              fc.branches.uncovered.push(startOffset);
            }
          }
        }

        // Check if the function body overlaps any excluded range
        const fnStart = fn.ranges?.[0]?.startOffset || 0;
        const fnEnd = fn.ranges?.[0]?.endOffset || 0;
        if (!V8Coverage._isInExcludedRange(fnStart, fnEnd, fc._excludedRanges)) {
          if (fnCovered) {
            fc.functions.covered++;
          } else {
            fc.functions.uncovered.push(fnStart);
          }
        } else {
          // Function is entirely within c8 ignore — don't count it at all
          fc.functions.total--;
        }
      }
    }

    // Calculate summary
    const summary = V8Coverage._emptySummary();
    for (const [, fc] of fileMap) {
      summary.statements.total += fc.statements.total;
      summary.statements.covered += fc.statements.covered;
      summary.branches.total += fc.branches.total;
      summary.branches.covered += fc.branches.covered;
      summary.functions.total += fc.functions.total;
      summary.functions.covered += fc.functions.covered;
    }

    return { files: fileMap, summary };
  }

  /**
   * Parse c8 ignore markers from source, returning byte offset ranges to exclude.
   * Looks for "c8 ignore start" and "c8 ignore stop" comments.
   * @param {string} src - Source code
   * @returns {Array<{start: number, end: number}>}
   */
  static _parseC8IgnoreRanges(src) {
    const ranges = [];
    const markerRE = /c8\s+ignore\s+(start|stop)/g;
    const starts = [];
    const stops = [];
    let match;
    while ((match = markerRE.exec(src)) !== null) {
      const before = src.lastIndexOf("/*", match.index);
      if (before < 0) continue;
      const afterEnd = src.indexOf("*/", match.index);
      if (afterEnd < 0) continue;
      const fullStart = before;
      const fullEnd = afterEnd + 2;
      if (match[1] === "start") starts.push(fullStart);
      else stops.push(fullEnd);
    }
    for (let i = 0; i < Math.min(starts.length, stops.length); i++) {
      if (stops[i] > starts[i]) {
        ranges.push({ start: starts[i], end: stops[i] });
      }
    }
    return ranges;
  }

  /**
   * Check if a byte range overlaps any excluded range.
   */
  static _isInExcludedRange(start, end, excluded) {
    if (!excluded || excluded.length === 0) return false;
    for (const ex of excluded) {
      if (start >= ex.start && end <= ex.end) return true;
      if (start < ex.end && end > ex.start) return true;
    }
    return false;
  }

  /**
   * Print a formatted coverage report to console.
   * @param {{ files: Map, summary: object }} parsed
   * @param {object} opts
   * @returns {string} Report text
   */
  static printReport(parsed, opts = {}) {
    const { files, summary } = parsed;
    const SEP = "-".repeat(100);
    const header = [
      "File".padEnd(40),
      "% Stmts".padStart(10),
      "% Branch".padStart(10),
      "% Funcs".padStart(10),
    ].join(" | ");

    const lines = [];
    lines.push("");
    lines.push(SEP);
    lines.push(header);
    lines.push(SEP);

    const sorted = [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [, fc] of sorted) {
      const stmtPct = V8Coverage._pct(fc.statements.covered, fc.statements.total);
      const branchPct = V8Coverage._pct(fc.branches.covered, fc.branches.total);
      const funcPct = V8Coverage._pct(fc.functions.covered, fc.functions.total);

      const unc = fc.statements.uncovered.length > 0
        ? `  ← uncovered: ${fc.statements.uncovered.slice(0, 5).join(",")}${fc.statements.uncovered.length > 5 ? "..." : ""}`
        : "";

      lines.push(
        `${fc.shortName.padEnd(40)} | ${stmtPct.padStart(9)} | ${branchPct.padStart(9)} | ${funcPct.padStart(9)}${unc}`
      );
    }

    lines.push(SEP);
    const sStmt = V8Coverage._pct(summary.statements.covered, summary.statements.total);
    const sBr = V8Coverage._pct(summary.branches.covered, summary.branches.total);
    const sFn = V8Coverage._pct(summary.functions.covered, summary.functions.total);
    lines.push(
      `${"TOTAL".padEnd(40)} | ${sStmt.padStart(9)} | ${sBr.padStart(9)} | ${sFn.padStart(9)}`
    );
    lines.push(SEP);
    lines.push("");

    const report = lines.join("\n");
    console.log(report);
    return report;
  }

  /**
   * Export coverage data as c8-compatible JSON.
   */
  static exportC8Format(parsed, outputPath) {
    const { files } = parsed;
    const result = [];

    for (const [filename] of files) {
      let src = null;
      try {
        src = fs.readFileSync(filename, "utf8");
      } catch { /* skip */ }
      result.push({ url: filename, source: src || "", functions: [] });
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ result }, null, 2));
    console.log(`Coverage data exported to ${outputPath}`);
  }

  static _pct(covered, total) {
    if (total === 0) return "   N/A";
    return (covered / total * 100).toFixed(2) + "%";
  }

  static _emptySummary() {
    return {
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
    };
  }
}

// ── CLI mode ──
if (require.main === module) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const v8Idx = args.indexOf("--v8dir");
  const outIdx = args.indexOf("--output");
  const includeDirs = dirIdx >= 0 ? [args[dirIdx + 1]] : ["Iris_Biometric/"];
  const v8Dir = v8Idx >= 0 ? args[v8Idx + 1] : process.env.NODE_V8_COVERAGE;
  const outputPath = outIdx >= 0 ? args[outIdx + 1] : "coverage/v8-iris-coverage.json";

  if (!v8Dir) {
    console.error("Usage: NODE_V8_COVERAGE=<dir> node v8_coverage_helper.js [--dir Iris_Biometric/]");
    console.error("  or:  node v8_coverage_helper.js --v8dir <coverage-dir> [--dir Iris_Biometric/]");
    process.exit(1);
  }

  const report = V8Coverage.readFromDir(v8Dir, includeDirs);
  V8Coverage.printReport(report);
  V8Coverage.exportC8Format(report, outputPath);
}

module.exports = { V8Coverage };
