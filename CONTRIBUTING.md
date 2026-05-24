# Contributing

Thanks for considering contributing to RedoSan Authenticity!

## How to contribute

1. Fork the repository
2. Create a feature branch (`feat/my-feature`, `fix/my-bug`)
3. Make your changes
4. Test in browser (open `index.html` locally)
5. Submit a Pull Request to `beta-release`

## Code conventions

- **No comments** in code unless absolutely necessary
- Follow existing patterns in neighboring files
- All UI text must have i18n keys (check `en.json` + other langs)
- New `.js` files must be added to `sw.js` and `404.html` JS_WHITELIST
- New page sections need sidebar link + home card in `index.html` + entries in `navigation.js`
- New workflows need `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- Avoid external dependencies; this project is 100% browser-based

## Pull request

- Use a conventional branch name: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`
- Fill out the PR template
- Make sure cross-reference checks pass

## Questions

Open a Discussion or issue.
