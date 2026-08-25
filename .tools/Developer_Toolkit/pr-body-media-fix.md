## Bug (real device)

On iPhone 7 Plus (iOS 15, 414×736) every responsive breakpoint was
silently dropped: all nav page-titles crammed into the top bar instead
of the hamburger sidebar.

## Root cause

Range syntax `@media (width <= Npx)` is Media Queries **L4**:
unsupported before Safari/iOS **16.4**, Samsung Internet <20, and
several Chromium webviews — exactly the engines inside
Facebook/Instagram/TikTok in-app browsers. Unsupported queries are
discarded whole by the parser.

Compounding it: `stylelint-config-standard` now enforces
`media-feature-range-notation: context`, so the pre-commit autofix kept
converting files back and dropping the changes from commits entirely.

## Fixes

1. Convert all range media queries across `Style/` to classic
   `min-/max-width` forms (identical behavior on modern engines; works
   everywhere since forever).
2. `.stylelintrc.json`: pin `media-feature-range-notation: "prefix"` so
   the standard-config autofix stops reverting files at every commit.
3. `shared.js`: skip Service Worker registration inside known in-app
   webview UAs (FB/IG/TikTok/Threads/Snapchat/LinkedIn/Pinterest) — their
   storage is isolated/wiped (Instagram clears localStorage on
   navigation) and SW support there is unreliable.

## Verified

Live-local at 414×736: `.nav-links a[data-page]` compute `display:none`;
sidebar + hamburger intact; zero horizontal overflow.
