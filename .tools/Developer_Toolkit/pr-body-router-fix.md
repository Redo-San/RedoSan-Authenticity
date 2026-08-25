## Bug

Entering Professional Mode then choosing **Face Biometric** renders
the *Upload Photo* / *Capture with Camera* buttons with browser-default
white styling. A hard reload of the standalone page fixes it.

## Root cause

Face-biometric defers its page stylesheet with the perf pattern
`<link rel=stylesheet media=print onload="this.media='all'">`. When
mpa-router injects missing page CSS after an AJAX swap it copied
`media="print"` verbatim — and the inline onload flip never exists on
programmatically created links — so the sheet applied to print only.

Other pages were unaffected because their css/style.css is still
render-blocking; face-biometric was the only page using the deferred
pattern for its page-specific sheet.

## Fix

loadMissingStyles now drops the print condition when creating the
live link (any other, genuinely media-scoped value is preserved).

## Verification

Real-browser repro of the exact user flow (home -> professional mode
-> face biometric card) via Playwright against the dev server:

- injected link resolves to media="(all)"
- .face-tab-btn computes --primary background, white text, 8px radius
  on the FIRST ajax entry — no reload needed
- prettier + eslint clean (0 errors)
