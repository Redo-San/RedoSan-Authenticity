## 1. Help-card text size (desktop, English)

`.help-card-body` rendered at `0.82rem` inside a wide card — the English
copy read too small. Body bumped to **0.95rem / 1.75 line-height** and the
header to **1rem** (page-scoped override in
`Style/pages/face-biometric/css/style.css`).

## 2. Passkey prompted repeatedly — explained & softened

**Why it happened:** by design, `ensureFacePasskeyForAction()` gates *every*
entry point (upload / camera / run) and retries registration while no passkey
is enrolled — so cancelling the browser dialog meant the next photo pick (and
Generate) fired it again.

**Softening shipped (security intact):**

- First cancelled/failed ceremony stores a session flag.
- Photo / camera actions then stop auto-launching the ceremony; the inline
  "Register passkey" panel is revealed instead.
- Pressing **Generate Identifiers** always passes `force=true`, so the real
  requirement is enforced exactly where it matters (#388 unchanged).
- Successful registration clears the flag.

## Verified

- Local face suites: **13 × fail 0**
- Browser flow: upload#1 → ceremony attempt + dismissal stored;
  upload#2 → proceeds with **no second prompt**, canvas loads;
  Generate remains gated on actual registration.
