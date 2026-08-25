## Bug (mobile browsers)

Face Biometric on phones: after consenting, uploading a photo and typing a
Name/Label, **Generate Identifiers stays disabled** with
*"Register a passkey to enable generation."*

Also: the consent checkbox renders tiny (dot-sized) on phones.

## Root cause

`FaceWebauthn.isAvailable()` only probed **API presence**
(`navigator.credentials` + secure context). That is true on virtually every
mobile browser *and* every in-app webview — even where the passkey ceremony
always fails:

- WebViews inside Facebook/Instagram/TikTok run without the platform
  Credential Manager bridge → WebAuthn calls silently fail
  (passkeys.dev Android/iOS references; MojoAuth "known broken combos").
- Devices without a platform authenticator report the API but have nothing
  to enroll with. Apple even changed UVPA semantics in iOS 26.2 to return
  `false` when no passkey manager is configured (Apple Developer thread
  808367) — so API-presence checks are now provably wrong.

Current best practice (passkeys.dev, FIDO guidance): **feature-detect with
`isUserVerifyingPlatformAuthenticatorAvailable()` and always ship a fallback
path** for incapable clients.

The consent checkbox issue was plain missing sizing CSS.

## Fixes

1. **`face_webauthn.js`** — new async `isFullyCapable()`:
   `isAvailable()` ∧ `!inAppWebView(UA)` ∧
   `UVPA === true` (3 s timeout, cached promise).
2. **`face_ui.js`** — capability probe kicked off at init caches the result;
   both gates (`ensureFacePasskeyForAction`, `updateFaceRunState`) treat
   incapable clients as satisfied via `_faceWaUnavailable`, reusing the same
   skip path already trusted for no-WebAuthn desktops. Capable clients keep
   the unchanged register + step-up flow.
3. **Consent checkbox**: explicit 20×20 target, `accent-color`,
   non-shrinking in flex.
4. cspell: add `UVPA`, `Bytedance`.

## Verified in-browser (390×844, real flows)

| Scenario | Result |
|---|---|
| Capable client (probe=true) | Upload gate still demands passkey registration — unchanged |
| Incapable client (probe=false / webview UA) | Upload proceeds, canvas loads, **button ENABLES**, status "Photo loaded…" |
| Consent checkbox computed size | 20px × 20px |

Console clean throughout. Desktop capable-path untouched by design.
