# Tauri License Election — MIT

RedoSan Authenticity is licensed **GPL-2.0-or-later** (see the repository root
`LICENSE`). The desktop app links the Tauri crates, which are **dual-licensed
"Apache-2.0 OR MIT"**. In accordance with that dual license, we hereby
**elect the MIT license** for the Tauri components used in this application.

## Covered components

- `tauri`, `tauri-build`, `tauri-plugin-opener` — as declared in
  `src-tauri/Cargo.toml`, plus the transitive Tauri-project crates pinned in
  `src-tauri/Cargo.lock`.
- This election covers the Tauri crates only. All other dependencies keep
  their own licenses as recorded in their upstream manifests.

## Verification (primary sources)

- `tauri` 2.12.5 crate manifest: `license = "Apache-2.0 OR MIT"`.
- The crate ships `LICENSE-MIT` and `LICENSE-APACHE-2.0` alongside its
  sources in the cargo registry cache.
- Upstream project: <https://github.com/tauri-apps/tauri>

## Why MIT (and not Apache-2.0)

Both options are GPL-2.0-compatible. MIT is the shorter, attribution-only
notice and is the election recorded here; the Apache-2.0 option is expressly
not exercised. The full Apache-2.0 text remains available upstream for
reference.

## MIT license text (as shipped with the Tauri crates)

```text
MIT License

Copyright (c) 2017 - Present Tauri Apps Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
