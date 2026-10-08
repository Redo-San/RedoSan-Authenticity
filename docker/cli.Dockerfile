# syntax=docker/dockerfile:1
# RedoSan Authenticity — CLI image; ships exactly the npm package file set
# (package.json "files") so it behaves like `npm i -g redosan-authenticity-cli`.
#
#   docker run --rm -v "$PWD:/work" -w /work \
#     ghcr.io/redo-san/redosan-authenticity-cli:latest fingerprint --help

FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build

# `npm ci` runs the `prepare` (husky) lifecycle script; HUSKY=0 skips it.
ENV HUSKY=0

# canvas is native: build tools cover the case where no prebuilt binary
# matches the platform (prebuilt is the fast path when it does).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential python3 make pkg-config \
        libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# .npmrc carries legacy-peer-deps=true — the lockfile was resolved with it,
# so `npm ci` fails with Invalid/Missing errors when it is absent.
# scripts.prepare (husky) must go: husky is a devDependency, so with
# --omit=dev the `husky` binary would not exist and prepare exits 127.
COPY package.json package-lock.json .npmrc ./
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

# Mirror of package.json "files" (cli/tests is excluded via .dockerignore).
COPY LICENSE README.md DISCLOSURE ./
COPY Watermark Audio_Watermark Pixel_Injection Document_Watermark Fingerprint \
     C2PA Certificate Decentralized_Identity_DID Timestamp Metadata Forensic \
     ID_Forge Converter vendor ./
COPY cli ./cli

FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

# Runtime shared libraries for canvas (incl. fontconfig + a font: text
# watermarks render through pango, which needs at least one system font).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
        fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app /app

ENTRYPOINT ["node", "cli/index.js"]
CMD ["--help"]
