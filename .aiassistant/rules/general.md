---
apply: always
---

# JetBrains AI Assistant Rules for `fhir-obs-viewer`

## Project overview

- This is an Angular application (TypeScript) for querying FHIR servers and
  pulling cohort data.
- It also includes a Node.js CLI in `autoconfig-src/` for generating
  `settings.json5` and server-specific CSV definitions.
- Main build/test tooling uses npm scripts from `package.json`.

## Environment setup in terminal sessions

- For npm/node commands, try running the command first.
- If the command fails because `node` is not found, run
  `source ./bashrc` from the project root and then re-run the same command.
- If `ng test`/Karma fails in sandbox with `EPERM` while binding
  `0.0.0.0:9876`, rerun the command with escalated permissions.

## Priority areas and key files

- UI app code: `src/app/`
- Autoconfig CLI entry: `autoconfig-src/autoconfig.js`
- CSV definition helpers: `autoconfig-src/definitions-generator.js`
- Autoconfig docs: `autoconfig-src/README.md`
- Root docs: `README.md`

## Coding expectations

- Prefer small, focused edits that preserve existing behavior unless explicitly
  requested.
- Keep code style consistent with nearby files (naming, import style, quote
  style, async patterns).
- Add comments only for non-obvious logic.
- Use ASCII unless the file already uses Unicode.
- Do not add new dependencies unless necessary; reuse existing utilities first.
- Code lines should be at most 80 characters when practical without harming
  readability.
- Leave two blank lines between declarations of functions, methods, and
  classes, and between test case descriptions.
- Treat JSDoc as part of the function declaration:
  two blank lines go above the JSDoc block, not between JSDoc and `function`.

## AI chat file references (WebStorm)

- In AI chat responses, use plain file references in `path:line` format.
- Prefer project-relative paths, for example:
  `src/app/shared/query-params/query-params.service.ts:19`.
- Do not use Markdown links for local files, because WebStorm AI chat may not
  open them reliably.

## CSV/autoconfig-specific guidance

- Treat base CSV files under `src/conf/csv/` as source templates.
- Files in `autoconfig-build/` must not depend on files outside
  `autoconfig-build/`, because this folder may be moved independently.
- For resource/search parameter inclusion, rely on both:
  - CapabilityStatement support (when available), and
  - actual server data checks via autoconfig query helpers.
- Keep behavior aligned with current autoconfig rules:
  - default output includes all columns for included resource types,
  - `--exclude-empty-columns` opt-in removes columns with no data.
- Preserve support for combined search params (for example `code,medication`)
  and polymorphic column paths ending in `[x]`.

## Testing and verification

- For UI/unit changes, run:

```bash
npm run unit
```

- For lint checks, run:

```bash
npm run lint
```

- For autoconfig changes, run the harness:

```bash
node autoconfig-src/autoconfig-harness.js
```

- For full local validation (slower):

```bash
npm test
```

## Build and run

```bash
npm start
npm run build
npm run build-autoconfig
npm run autoconfig -- init <FHIR_SERVER_URL> --output ./output
```

## Safe-change rules

- Do not edit generated build artifacts in `public/` unless explicitly asked.
- Do not edit generated build artifacts in `autoconfig-build/` unless
  explicitly asked.
- Prefer updating source files under `src/`, then rebuilding.
- Avoid broad refactors when fixing targeted bugs.
- If tests are updated, keep assertions tied to user-visible behavior.

## When adding or changing tests

- Keep fixtures minimal and explicit.
- Cover edge cases introduced by the change (for example combined params, `[x]`
  columns, excluded search parameter types).
- Ensure tests remain deterministic and do not require network access unless
  intentionally integration-level.
