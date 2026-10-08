# syntax=docker/dockerfile:1
# RedoSan Authenticity — self-hostable site image (offline / air-gapped use).
#
#   docker run --rm -p 8080:80 ghcr.io/redo-san/redosan-authenticity:latest
#
# Serves the full toolkit: SPA index + 20 MPA pages + every module + vendor.
# docker/nginx.conf rewrites the absolute /RedoSan-Authenticity/... URLs
# (GitHub Pages base path) onto the same document root.

FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Everything left in the build context (see .dockerignore for exclusions):
# this mirrors what GitHub Pages serves, so the sw.js precache list resolves.
COPY . /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
