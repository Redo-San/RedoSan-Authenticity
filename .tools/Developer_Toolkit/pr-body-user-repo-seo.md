## Why

Googlebot (and RFC 9309 crawlers) fetch robots.txt at the **host root
only**. Until now `https://redo-san.github.io/robots.txt` was a 404, so
the `Sitemap:` directive that lives in the project-level
`/RedoSan-Authenticity/robots.txt` was never seen during Google's
host-level robots fetch.

## What

- **robots.txt** — host-root policy declaring the absolute project
  sitemap URL (`https://redo-san.github.io/RedoSan-Authenticity/sitemap.xml`).
  Same-host subpath targets are valid per the sitemaps protocol.
- **sitemap.xml** — host-root **sitemap index** pointing at the project
  sitemap. This makes tools that resolve `/sitemap.xml` against the bare
  host (e.g. a Search Console property whose origin is
  `https://redo-san.github.io/`) receive a parseable file and follow
  through to all 20 real URLs instead of hitting a 404 ("Couldn't
  fetch" / type "Unknown").

## Effect

- Organic sitemap discovery starts working for every compliant crawler,
  independent of how any Search Console property is configured.
- An existing GSC submission of `/sitemap.xml` on a root-origin property
  can flip from *Couldn't fetch* to *Success* once Pages redeploys — no
  GSC changes needed.
- The existing redirect page is untouched.

## Post-merge sanity checks

```
curl -sI https://redo-san.github.io/robots.txt    # 200 text/plain
curl -s  https://redo-san.github.io/sitemap.xml   # <sitemapindex> ... project URL
curl -sI https://redo-san.github.io/              # still 200 redirect page
```
