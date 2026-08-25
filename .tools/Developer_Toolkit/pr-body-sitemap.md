## Context

Google Search Console reports **Couldn't fetch** for `/sitemap.xml`
(type "Unknown", empty last-read date, 0 discovered pages).

Live probes of the deployed site prove the artifacts are healthy:

| Asset | Result |
|---|---|
| `https://redo-san.github.io/RedoSan-Authenticity/sitemap.xml` | HTTP 200, `application/xml`, 20 valid absolute URLs |
| `https://redo-san.github.io/sitemap.xml` | **404** — what GSC actually requests |
| `/RedoSan-Authenticity/robots.txt` | Declares the full absolute sitemap URL |

This matches the documented Search Console fetch-error class
*"The URL provided for the sitemap is wrong (HTTP 404)"*: GSC resolves
the submitted path against the **property origin**, so a Domain
property (`redo-san.github.io`) or a root URL-prefix property hits the
404ing host-root path. GitHub Pages project sites cannot serve
host-root files.

## What this PR ships

`scripts/generate-sitemap.js` gains an env override for the canonical
origin so a future custom-domain migration is one CI variable:

```
SITE_BASE_URL=https://yourdomain.com npm run sitemap
```

Default behaviour is byte-identical (verified: regenerated sitemap =
20 URLs, same base). No workflow changes.

## Operator checklist (outside the repo)

1. In Search Console add a **URL-prefix** property exactly:
   `https://redo-san.github.io/RedoSan-Authenticity/`
   (verify via HTML file in repo root or meta tag).
2. Pre-check with **URL Inspection → Live test** on the full sitemap
   URL; require *Page fetch: Successful*.
3. Submit `sitemap.xml` inside that new property.
4. If it still shows Couldn't fetch after days: that matches the
   community-documented Googlebot edge issue on *.github.io
   (GitHub community discussion #149884); Bing is unaffected and the
   durable fix there is a custom domain — now a one-variable change.
