# Autoconfig CSV Generator

This folder contains the CLI used to generate `settings.json5` and a
server-specific resource definitions CSV by checking a FHIR server's
capabilities.

## Usage

Build the CLI bundle and run the generator against a server URL:

```bash
npm run build-autoconfig
npm run autoconfig -- init https://example.fhir.server/baseR4 --output ./output
```

The `npm run build-autoconfig` step also copies default template CSV and JSON5
files to:

- `autoconfig-build/conf/csv/desc-default-R4.csv`
- `autoconfig-build/conf/csv/desc-default-R5.csv`
- `autoconfig-build/conf/settings-initial.json5`
- `autoconfig-build/conf/build-info.json`

When `npm run autoconfig` runs from the built bundle, the CLI reads templates
from `autoconfig-build/conf/csv/` first, and falls back to `src/conf/csv/` if
needed.

Optional flags (for debugging or custom use cases):

- `--definitions-base <path>`: override the base CSV template.
- `--capability-file <path>`: use a local CapabilityStatement JSON file.
- `--sample-resource-dir <path>`: use local sample resources for column checks.
- `--definitions-file-name <name>`: set the output CSV filename.
- `--exclude-empty-columns`: remove column descriptions that have no data
  in collected sample resources.

Column behavior:

- By default, all columns from the source CSV are preserved for resource
  types included in output.
- Use `--exclude-empty-columns` to enable data-based column filtering.

## Unit tests

Run the autoconfig unit tests:

```bash
npm run test-autoconfig
```

## Offline harness

The harness uses local fixtures to validate CSV parsing and filtering without
calling a live server.

```bash
node autoconfig-src/autoconfig-harness.js
```

It writes the filtered CSV to:

- `autoconfig-src/fixtures/definitions.sample.csv`
- `autoconfig-src/fixtures/definitions.combined.sample.csv`
- `autoconfig-src/fixtures/definitions.choice.sample.csv`
