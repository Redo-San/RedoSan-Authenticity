# Spec: Comprehensive PR — Restore Quality Tooling + Fix Vulnerabilities

## Objective
إعداد PR شامل من `prepare/pr` إلى `main` يعيد كل أدوات الجودة وملفات الإعدادات وخطوط CI/CD التي فُقدت في PRs #221–#243، ويصلح الثغرات الأمنية. هذا PR واحد يرفع كل شيء معاً.

**Success**: `npm run check` يمر بالكامل، `npm audit` لا ثغرات، CodeQL 0 alerts، workflows الـ 51 كلها موجودة.

## Tech Stack
- Node.js 20/22
- Vanilla JS (لا إطار)
- npm ≥ 11
- ESLint 10 + Biome 2.5 + Stylelint 16.26
- Workbox 7.4 + BackstopJS 6.3 + LHCI 0.15
- Husky 9 + commitlint 19
- Playwright 1.52 + axe-core 4.10

## Commands
```bash
npm run lint              # ESLint — يجب أن يمر بـ 0 errors
npm run biome             # Biome format + lint — 0 issues
npm run stylelint         # Stylelint — 0 errors
npm run test:core         # 87 unit tests — all pass
npm run check             # lint + biome + stylelint + test:core
npm run audit             # no critical/high vulns
npm run madge:circular    # 0 circular deps
```

## Project Structure
```
.husky/                   ← pre-commit + commit-msg hooks
.github/workflows/        ← 51 workflows (إضافة a11y, lint, performance, security)
eslint.config.mjs         ← ESLint 10 flat config (بعد تعديل unicorn v65)
.stylelintrc.json         ← Stylelint standard config
biome.json                ← Biome config
cspell.json               ← CSpell word list
commitlint.config.cjs     ← Conventional Commits
.pa11yci                  ← Pa11y a11y config
.lighthouserc.js          ← LHCI perf budgets
backstop.json             ← Visual regression
.markdownlint.json        ← Markdown rules
.lintstagedrc.json        ← lint-staged config
package.json              ← deps محدّثة, scripts كاملة
```

## Code Style
اتباع النمط الموجود: ESLint flat config مع `@eslint/js` و `eslint-plugin-unicorn@65` و `globals`. ملفات الإعدادات إما .mjs أو .cjs حسب السياق.

## Testing Strategy
- `npm run test:core`: 87 اختبار أساسي — يجب أن يمر قبل الـ commit
- `npm run test:pixel`, `test:advwm`, `test:c2pa`, إلخ — اختبارات إضافية
- `npm run check` يشغّل lint + biome + stylelint + core tests

## Boundaries
- **Always**: تشغيل `npm run lint && npm run test:core` قبل كل commit
- **Ask first**: إضافة/إزالة dependencies، تغيير CI workflows، تغيير ESLint rules
- **Never**: لمس `index.html`، لمس `Style/pages/`، تغيير shared JS files، لمس `sw.js` دون سبب

## Tasks (ordered by dependency)

1. **ترقية eslint-plugin-unicorn → ^65.0.1** مع تحديث eslint.config.mjs
2. **إصلاح Dependabot alerts** — npm audit fix + التحديثات اليدوية اللازمة
3. **إعادة ملفات إعدادات الجودة** — .stylelintrc.json, biome.json, cspell.json, commitlint.config.cjs, .pa11yci, .lighthouserc.js, backstop.json, .markdownlint.json, lint-staged config
4. **إعادة Husky hooks** — .husky/pre-commit, .husky/commit-msg
5. **إضافة workflows المفقودة** — a11y.yml, lint.yml, performance.yml, security.yml
6. **إصلاح CodeQL alerts** — معالجة أي alerts متبقية
7. **تحديث package.json scripts** — إضافة/تصحيح scripts المفقودة
8. **تشغيل `npm run check` للتأكيد** — يجب أن يمر بالكامل
9. **اختبار شامل** — كل test suites تمر
10. **commit → push → PR**

## Success Criteria
- [ ] `npm run lint` = 0 errors, 0 warnings
- [ ] `npm run biome` = 0 issues
- [ ] `npm run stylelint` = 0 errors
- [ ] `npm run test:core` = all 87 tests pass
- [ ] `npm audit` = 0 critical + 0 high vulnerabilities
- [ ] CodeQL = 0 alerts (أو معلّلة)
- [ ] `.husky/` موجود مع pre-commit + commit-msg hooks
- [ ] `.github/workflows/` يحتوي كل 51 workflows (a11y, lint, performance, security بالإضافة)
- [ ] commitlint يمر على رسائل Conventional Commits

## Open Questions
- هل نريد إصلاح CodeQL alerts المتعلقة بـ `innerHTML` و `unsafe-regular-expression` ضمن هذا PR؟
