## What

Brand marks no longer use `<img>` — they are **CSS `background-image`
divs**, exactly like the main project's `.logo-white/.logo-black`
pattern. Browser context menus never offer *Open image / Save image as*
for backgrounds, and native image drag disappears.

## Extra hardening

- `user-select: none`, `-webkit-user-drag: none`,
  `-webkit-touch-callout: none`
- Scoped `contextmenu` + `dragstart` preventDefault guard for
  `.logo-mark` elements

Accessibility preserved: the visible variant carries
`role="img"` + `aria-label="RedoSan logo"`; the hidden variant is
`aria-hidden`.

> Honest limit (documented): direct asset URLs remain fetchable on a
> static host — this stops casual page-level saving/dragging and matches
> the main project's existing posture.

## Verified in-browser

- Zero `<img>` elements inside `.hero`
- Correct background per theme (`logo.webp` / `logo-black.png`)
- Rendered at 88×59 with radius
- Dispatched `contextmenu` event is prevented
- Console clean
