# AGENTS Guide for `fhir-obs-viewer`

## Big Picture
- This repo has two coupled deliverables: Angular UI in `src/` and a Node CLI in `autoconfig-src/`.
- The UI is a step-based cohort workflow (settings -> action -> cohort -> pull data) centered in `src/app/modules/stepper/stepper.component.ts`.
- FHIR I/O is centralized in `src/app/shared/fhir-backend/fhir-backend.service.ts`; it wraps `FhirBatchQuery`, tracks connection state, and handles SMART, OAuth2, and RAS transitions.
- App startup depends on `SettingsService.loadJsonConfig()` via `provideAppInitializer` in `src/app/app.module.ts`; avoid bypassing this when adding early boot logic.
- The autoconfig CLI (`autoconfig-src/autoconfig.js`) reuses the same `FhirBatchQuery` class as the UI for parity in server capability detection.

## Architecture and Data Flow Patterns
- Settings and per-server definitions are loaded separately: JSON5 config from `src/assets/settings.json5`, then CSV definitions from `src/conf/csv/` via `SettingsService.loadCsvDefinitions()`.
- Definitions CSV rows drive both search parameter availability and table columns; row semantics are enforced in `autoconfig-src/definitions-generator.js`.
- Search parameter inclusion combines capability checks and real data probes (`checkSearchParamHasData`), not capability alone.
- Column filtering is opt-in (`--exclude-empty-columns`); default behavior keeps all columns for supported resources.
- Combined search params (`code,medication`) and polymorphic paths (`abatement[x]`) are first-class cases; preserve existing handling in generator + tests/harness.

## Build and Generation Workflow (Project-Specific)
- `npm run build` builds Angular and then runs `npm run build-autoconfig` (see `package.json`).
- `npm run build-autoconfig` runs `autoconfig-src/build-autoconfig.js` and prepares self-contained assets in `autoconfig-build/conf/`.
- `npm run autoconfig -- init <url> --output ./output` runs bundled CLI (`autoconfig-build/autoconfig.js`) with `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Webpack extra config (`webpack/extra-webpack.config.js`) updates CSV/settings from XLSX and injects custom loaders for definitions + `package.json` version imports.
- `import pkg from '../../../../package.json'` works because `webpack/package-json-loader.js` strips JSON to `{ version }`.

## Testing and Validation Workflow
- UI unit tests: `npm run unit`; lint: `npm run lint`; full suite: `npm test`.
- Autoconfig unit tests: `npm run test-autoconfig` (`node --test autoconfig-src/autoconfig.test.js`).
- Offline autoconfig behavior checks: `node autoconfig-src/autoconfig-harness.js` (writes fixture outputs under `autoconfig-src/fixtures/`).
- If terminal `node`/`npm` is unavailable, run `source ./bashrc` from repo root, then retry.

## Conventions That Matter Here
- Treat `src/conf/csv/*.csv` as source templates; do not hand-edit generated outputs in `public/` or `autoconfig-build/` unless explicitly requested.
- Keep edits narrow and behavior-preserving; this codebase has many workflow flags tied to URL params (`server`, `prev-version`, `isSmart`, `ras`).
- Preserve existing style: minimal dependencies, sparse comments, and two blank lines between declarations (including tests/JSDoc blocks).
- For autoconfig changes, keep files under `autoconfig-build/` independent from paths outside that folder.
- Use fixtures for deterministic tests; avoid introducing network dependence unless intentionally integration-level.

## Key Integration Points
- OAuth2 callback route: `src/app/modules/oauth2-token-callback/`; RAS callback route: `src/app/modules/ras-token-callback/`.
- SMART launch flow route: `src/app/modules/launch/` triggered by `FhirBackendService.isSmartOnFhir`.
- Shared FHIR definitions compilation: `src/app/shared/definitions/webpack-loader.js` with options in `src/app/shared/definitions/webpack-options.json`.
- Autoconfig capability/data filtering core: `autoconfig-src/definitions-generator.js`; orchestration + CLI surface: `autoconfig-src/autoconfig.js`.

