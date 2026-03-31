/**
 * Bundles the autoconfig CLI into `autoconfig-build/` and copies runtime
 * support files (CSV templates, settings template, and build metadata).
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { Command } = require('commander');

// Default output folder for generated standalone autoconfig artifacts.
const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'autoconfig-build');


/**
 * Converts a byte count into a human-readable size string.
 * @param {number} bytes - Raw size in bytes.
 * @returns {string} Formatted size with unit suffix.
 */
function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  return `${(kib / 1024).toFixed(1)} MiB`;
}


/**
 * Recursively lists files in the build output and computes total size.
 * @param {string} buildDir - Build output directory path.
 * @returns {{
 *   files: {relativePath: string, sizeBytes: number}[],
 *   totalBytes: number
 * }}
 *   Sorted file list with byte sizes and aggregate total.
 */
function getOutputFilesSummary(buildDir) {
  const files = [];

  const visit = (dirPath) => {
    fs.readdirSync(dirPath, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        return;
      }
      const relativePath = path.relative(buildDir, fullPath);
      const sizeBytes = fs.statSync(fullPath).size;
      files.push({ relativePath, sizeBytes });
    });
  };

  if (fs.existsSync(buildDir)) {
    visit(buildDir);
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  return { files, totalBytes };
}


/**
 * Prints a size summary for generated build output files.
 * @param {string} buildDir - Build output directory path.
 * @returns {void}
 */
function printOutputFilesSummary(buildDir) {
  const { files, totalBytes } = getOutputFilesSummary(buildDir);

  process.stdout.write('\nOutput file sizes:\n');
  files.forEach(({ relativePath, sizeBytes }) => {
    process.stdout.write(
      `- ${relativePath}: ${formatBytes(sizeBytes)} (${sizeBytes} B)\n`
    );
  });
  process.stdout.write(
    `Total: ${formatBytes(totalBytes)} (${totalBytes} B)\n\n`
  );
}


/**
 * Resolves the build directory from env override or default location.
 * @returns {string} Absolute/relative build directory path.
 */
function getBuildDir() {
  const customDir = process.env.AUTOCONFIG_BUILD_DIR;
  if (customDir) {
    return path.resolve(customDir);
  }
  return DEFAULT_BUILD_DIR;
}


/**
 * Parses CLI flags for the build script.
 * @param {string[]} [argv=process.argv.slice(2)] - User CLI arguments.
 * @returns {{showMetafileAnalysis: boolean}} Parsed options.
 */
function parseBuildArgs(argv = process.argv.slice(2)) {
  const program = new Command();
  program
    .name('build-autoconfig')
    .usage('[options]')
    .description(
      'Bundle autoconfig CLI into autoconfig-build and copy support files.'
    )
    .allowUnknownOption(false)
    .option(
      '--metafile-analysis',
      'output esbuild metafile analysis results'
    );

  program.parse(argv, { from: 'user' });
  const options = program.opts();
  return {
    showMetafileAnalysis: Boolean(options.metafileAnalysis)
  };
}


/**
 * Returns true when the resolved path is the safe default build directory.
 * Also validates expected location constraints for destructive cleanup.
 * @param {string} buildDir - Candidate build output directory.
 * @returns {boolean} Whether the candidate equals the default build directory.
 * @throws {Error} If default path safety invariants are violated.
 */
function isDefaultBuildDir(buildDir) {
  const resolvedBuildDir = path.resolve(buildDir);
  const resolvedDefaultBuildDir = path.resolve(DEFAULT_BUILD_DIR);
  if (resolvedBuildDir !== resolvedDefaultBuildDir) {
    return false;
  }
  const projectRoot = path.resolve(__dirname, '..');
  const relativeToRoot = path.relative(projectRoot, resolvedBuildDir);
  const isInsideProjectRoot =
    relativeToRoot !== '' &&
    !relativeToRoot.startsWith('..') &&
    !path.isAbsolute(relativeToRoot);
  if (!isInsideProjectRoot) {
    throw new Error(
      'DEFAULT_BUILD_DIR is not inside project root.'
    );
  }

  if (path.basename(resolvedBuildDir) !== 'autoconfig-build') {
    throw new Error(
      'DEFAULT_BUILD_DIR directory name must be "autoconfig-build".'
    );
  }
  return true;
}


/**
 * Copies non-bundled support files required by the autoconfig runtime.
 * @param {string} [buildDir=getBuildDir()] - Build output directory.
 * @returns {void}
 */
function copyAutoconfigSupportFiles(buildDir = getBuildDir()) {
  const buildConfDir = path.join(buildDir, 'conf');
  const outputCsvDir = path.join(buildConfDir, 'csv');
  const sourceCsvDir = path.join(__dirname, '..', 'src', 'conf', 'csv');
  const defaultCsvFiles = ['desc-default-R4.csv', 'desc-default-R5.csv'];

  fs.mkdirSync(outputCsvDir, { recursive: true });

  defaultCsvFiles.forEach((fileName) => {
    fs.copyFileSync( path.join(sourceCsvDir, fileName),
      path.join(outputCsvDir, fileName) );
  });

  fs.copyFileSync( path.join(__dirname, 'conf', 'settings-initial.json5'),
    path.join(buildConfDir, 'settings-initial.json5'));

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  fs.writeFileSync( path.join(buildConfDir, 'build-info.json'),
    JSON.stringify({ rdfVersion: packageJson.version }, null, 2) );
}


/**
 * Builds the autoconfig bundle and stages required support files.
 * @param {string} [buildDir=getBuildDir()] - Build output directory.
 * @param {{showMetafileAnalysis?: boolean}} [options] - Build options.
 * @returns {Promise<void>}
 */
async function buildAutoconfigBundle(
  buildDir = getBuildDir(),
  { showMetafileAnalysis = false } = {}
) {
  const resolvedBuildDir = path.resolve(buildDir);
  if (isDefaultBuildDir(resolvedBuildDir)) {
    fs.rmSync(resolvedBuildDir, { recursive: true, force: true });
  }

  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'autoconfig.js')],
    bundle: true,
    platform: 'node',
    sourcemap: true,
    outfile: path.join(resolvedBuildDir, 'autoconfig.js'),
    metafile: true
  });

  if (showMetafileAnalysis) {
    const analysis = await esbuild.analyzeMetafile(result.metafile, {
      color: true
    });
    process.stdout.write(`${analysis}\n`);
  }

  copyAutoconfigSupportFiles(resolvedBuildDir);
  printOutputFilesSummary(resolvedBuildDir);
}


// CLI entrypoint for direct execution from npm scripts or terminal.
if (require.main === module) {
  const { showMetafileAnalysis } = parseBuildArgs();
  buildAutoconfigBundle(getBuildDir(), { showMetafileAnalysis })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}


// Exported for tests and programmatic reuse.
module.exports = {
  buildAutoconfigBundle,
  copyAutoconfigSupportFiles,
  getBuildDir,
  parseBuildArgs,
  isDefaultBuildDir,
  getOutputFilesSummary,
  printOutputFilesSummary
};
