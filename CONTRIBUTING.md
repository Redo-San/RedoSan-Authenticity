# Contributing

Thanks for considering contributing to RedoSan Authenticity!

The project is in active development on `main` — the only permanent branch. All work flows through pull requests.

## How to contribute

1. Fork the repository
2. Create a feature branch from `main` (`feat/my-feature`, `fix/my-bug`, `chore/...`, `docs/...`, `refactor/...`, `test/...`, `ci/...`)
3. Make your changes
4. Run the dev server (`node dev-server.js` or `start_dev_local_server.bat`) and test in the browser — both SPA (`index.html`) and MPA (`Style/pages/{name}/index.html`) entry points
5. Run the checks below
6. Submit a Pull Request to `main` and fill out the PR template

## Development setup

```bash
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
npm install
npm link        # makes the 'redosan' CLI available globally
node dev-server.js   # local dev server on http://localhost:8080
```

## Code conventions

- **No comments** in code unless absolutely necessary
- Follow existing patterns in neighboring files (Vanilla JS IIFEs attached to `window`, no frameworks)
- All UI text must have i18n keys — check `Style/lang/` (8 languages) and `Style/i18n.js`
- New `.js` files must be added to the whitelists in `sw.js` and `404.html`
- New MPA pages need: `Style/pages/{name}/index.html` + sidebar link + entry in `Style/navigation.js` (and the search index when applicable)
- New workflows need `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- Avoid external dependencies; this project is 100% browser-based
- Do not change line endings (CRLF) or run tools that reformat entire files — keep diffs minimal

## Commit convention

Conventional Commits are enforced by commitlint (husky pre-commit + CI):

`type(scope): message` — `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`

Examples: `feat(face): add registration UI`, `fix(mpa): hide stale results before page swap`

## Pre-commit (husky + lint-staged)

On every commit, the following run automatically:

- `scripts/secret-scan-precommit.ps1` — blocks secrets/tokens/private keys in the diff
- lint-staged: ESLint (JS), Stylelint (CSS), Biome (JSON/YAML/Markdown)

If a commit is rejected, fix the issue and commit again — do not bypass hooks.

## Checks

```bash
npm run check       # lint + biome + stylelint + madge + core tests
npm run check:fix   # auto-fix lint/style issues
npm run check:full  # full audit (markdownlint, cspell, depcheck, ...)
npm run coverage    # c8 coverage report
```

## Testing

- **Unit tests**: `node:test` files in `cli/tests/` (`npm run test:core`, `npm run test:{feature}`)
- **E2E tests**: Playwright suites in `cli/tests/e2e/` (`npm run test:e2e-all`, `npm run test:e2e-mpa`)
- Run relevant tests for your change before pushing; CI runs the full matrix on Node 22/24

## Security

- Never commit secrets, tokens, or private keys — the pre-commit secret scanner will block them
- Report vulnerabilities privately (GitHub Private Vulnerability Reporting), not as public issues
- See `.github/SECURITY.md` for the full security policy

## Questions

Open a Discussion or an issue.
