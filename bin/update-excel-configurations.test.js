const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { Workbook } = require('devextreme-exceljs-fork');
const readXlsxFile = require('read-excel-file/node');
const { stringify } = require('csv-stringify/sync');
const {
  updateExcelConfigurations, querySearchParameter, getCellValue
} = require('./update-excel-configurations');

const sourceDirectory = path.resolve(__dirname, '../src/conf/xlsx');
const marker = '---SERVICE BASE URL:';
const green = 'FFC6E0B4';
const gray = 'FFD0D0D0';
const red = 'FFFFC7CE';
const missingCache = 'Missing or unsupported empty cached formula result';
const cacheGuidance = 'Use a literal value, or a blank cell where allowed.';
const quiet = {
  /** Suppresses updater progress messages during offline tests. */
  log() {}
};


/**
 * Creates a temporary test directory with automatic cleanup.
 * @param {Object} t - Node test context.
 * @returns {Promise<string>} Temporary directory path.
 */
async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-update-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}


/**
 * Loads a workbook independently of the updater.
 * @param {string} filePath - Workbook path.
 * @returns {Promise<Workbook>} Parsed workbook.
 */
async function readWorkbook(filePath) {
  const workbook = new Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}


/**
 * Creates a fresh solid-fill object (never shares mutable style objects).
 * @param {string} argb - RGB or ARGB color.
 * @returns {Object} ExcelJS fill.
 */
function fill(argb) {
  return {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb }, bgColor: { indexed: 64 }
  };
}


/**
 * Captures workbook semantics, deliberately excluding ZIP/XML serialization.
 * @param {Workbook} workbook - Workbook to inspect.
 * @returns {Object[]} Ordered sheets with values, styles and dimensions.
 */
function snapshot(workbook) {
  return JSON.parse(JSON.stringify(workbook.worksheets.map((sheet) => {
    const rows = [];
    const rowCount = sheet.rowCount;
    const columnCount = sheet.columnCount;
    for (let row = 1; row <= rowCount; row++) {
      const cells = [];
      for (let column = 1; column <= columnCount; column++) {
        const cell = sheet.getCell(row, column);
        cells.push({ value: cell.value, result: cell.result, style: cell.style });
      }
      rows.push({ height: sheet.getRow(row).height, cells });
    }
    return {
      name: sheet.name,
      widths: sheet.columns.map((column) => column.width),
      rows
    };
  })));
}


/**
 * Runs the unchanged production CSV reader against temporary workbook copies.
 * Only filesystem inputs are redirected; filtering and CSV rules are not copied.
 * @param {string} directory - Temporary directory containing XLSX files.
 * @returns {Promise<Object>} Actual CSV text indexed by service URL.
 */
async function csvOutput(directory) {
  const filename = path.join(__dirname, 'sync-xlsx-config.js');
  const isolated = new Module(filename, module);
  isolated.filename = filename;
  isolated.paths = Module._nodeModulePaths(__dirname);
  const originalRequire = isolated.require.bind(isolated);
  /**
   * Redirects only workbook filesystem access in the isolated CSV module.
   * @param {string} id - Requested module identifier.
   * @returns {*} Original module or a filesystem-safe test substitute.
   */
  isolated.require = (id) => {
    if (id === 'fs') {
      return {
        ...fsSync,
        /**
         * Lists fixture workbooks instead of repository workbooks.
         * @param {string} folder - Expected production XLSX directory.
         * @returns {string[]} Fixture filenames.
         */
        readdirSync(folder) {
          assert.equal(folder, sourceDirectory);
          return fsSync.readdirSync(directory);
        },
        /**
         * Prevents the CSV comparison from writing production files.
         * @throws {Error} Always fails if a write is attempted.
         */
        writeFileSync() {
          assert.fail('CSV comparison must not write repository files');
        }
      };
    }
    if (id === 'read-excel-file/node') {
      /**
       * Reads the matching fixture with the production reader's options.
       * @param {string} file - Expected repository workbook path.
       * @param {Object} options - Worksheet selection options.
       * @returns {Promise<Array>} Parsed fixture rows or worksheet metadata.
       */
      return (file, options) => {
        assert.equal(path.dirname(file), sourceDirectory);
        return readXlsxFile(path.join(directory, path.basename(file)), options);
      };
    }
    return originalRequire(id);
  };
  isolated._compile(fsSync.readFileSync(filename, 'utf8'), filename);
  const data = await isolated.exports.prepareCsvData();
  return Object.fromEntries(Object.entries(data).map(([url, rows]) => [
    url, stringify(rows, { record_delimiter: '\n' })
  ]));
}


/**
 * Builds a fixture covering visibility rules and styled blank cells.
 * @param {Object} t - Node test context.
 * @param {Object} [cellValues] - Cell overrides indexed by sheet and address.
 * @returns {Promise<Object>} Fixture directory and file path.
 */
async function createFixture(t, cellValues = {}) {
  const directory = await temporaryDirectory(t);
  const filePath = path.join(directory, 'configuration.xlsx');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Server');
  sheet.getCell('A1').value = 'Legend';
  sheet.getCell('A1').font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell('A3').fill = fill('c6e0b4');
  sheet.getCell('A4').fill = fill(gray);
  sheet.getCell('A5').fill = fill(red);
  sheet.getCell('A6').value = marker;
  sheet.getCell('B6').value = 'dbgap';
  sheet.getRow(8).values = [
    'Resource type', 'FHIR name', 'Type', 'Custom name',
    'Show/Hide', 'Data type', 'FHIRPath', 'Description'
  ];
  sheet.getRow(8).font = { name: 'Arial', size: 11, bold: true };
  const rows = [
    ['Observation'],
    ['', 'body-site', 'search parameter', '', 'hide', 'token'],
    ['', 'value-quantity', 'search parameter', '', 'hide', 'Quantity'],
    ['', 'bodySite', 'column', '', 'show'],
    ['', 'value[x]', 'column', '', 'disable'],
    ['', 'subject', 'column', '', 'show'],
    ['', 'code', 'search parameter', '', 'hide', 'token'],
    ['', 'reference-param', 'search parameter', '', 'show', 'reference'],
    ['', 'composite-param', 'search parameter', '', 'show', 'composite'],
    ['', 'custom', 'search parameter', '', 'show'],
    ['', 'effective', 'search parameter', '', 'show', 'dateTime'],
    ['', 'unknown', 'column', '', 'show'],
    ['MedicationRequest'],
    ['', 'medication', 'search parameter', '', 'show', 'token'],
    ['', 'medication[x]', 'column', '', 'show'],
    ['Patient'],
    ['', 'bodySite', 'column', '', 'show'],
    ['', 'code', 'search parameter', '', 'show', 'token'],
    ['', 'code', 'column', '', 'show']
  ];
  rows.forEach((row, index) => { sheet.getRow(index + 9).values = row; });
  for (const row of [12, 13, 14, 20, 23, 25, 27]) {
    for (let column = 1; column <= 27; column++) {
      sheet.getCell(row, column).fill = fill(green);
    }
  }
  sheet.getCell('F12').fill = fill('ffc7ce');
  sheet.getCell('B12').font = { name: 'Arial', size: 14, italic: true };
  sheet.getCell('B12').alignment = { wrapText: true, vertical: 'top' };
  sheet.getCell('B12').border = { bottom: { style: 'thin' } };
  sheet.getCell('B12').numFmt = '@';
  sheet.getRow(12).height = 31;
  sheet.getColumn('A').width = 24;
  sheet.getColumn('H').width = 44.375;
  sheet.getColumn('AA').width = 18;
  sheet.getCell('Z2').value = 0;
  sheet.getCell('AA2').value = false;

  for (const name of ['default_R4', 'default']) {
    const fallback = workbook.addWorksheet(name);
    fallback.getCell('A1').value = 'Legend';
    fallback.getCell('A3').fill = fill(green);
    fallback.getCell('A4').fill = fill(gray);
    fallback.getCell('A5').fill = fill(red);
    fallback.getCell('A6').value = marker;
    fallback.getCell('B6').value = name;
    fallback.getRow(8).values = sheet.getRow(8).values;
    fallback.getRow(9).values = ['Patient'];
    fallback.getRow(10).values = ['', 'name', 'search parameter', '', 'hide', 'string'];
    fallback.getRow(11).values = ['', 'name', 'column', '', 'disable'];
  }
  for (const [name, values] of Object.entries(cellValues)) {
    for (const [address, value] of Object.entries(values)) {
      workbook.getWorksheet(name).getCell(address).value = value;
    }
  }
  await workbook.xlsx.writeFile(filePath);
  return { directory, filePath };
}


/**
 * Builds formatted runs whose text must be read without altering run styles.
 * @param {...string} parts - Text runs to concatenate.
 * @returns {Object} ExcelJS rich-text value with contrasting fonts.
 */
function richText(...parts) {
  return { richText: parts.map((text, index) => ({
    text, font: { bold: index === 0, italic: index !== 0 }
  })) };
}


/**
 * Builds a hyperlink with a target deliberately different from its label.
 * @param {string|Object} text - Plain or rich-text display label.
 * @returns {Object} ExcelJS hyperlink value.
 */
function hyperlink(text) {
  return { text, hyperlink: 'https://example.test/not-the-cell-label' };
}


/**
 * Resolves the synthetic fixture's searches without accessing a server.
 * @param {string} url - Search URL.
 * @returns {Promise<boolean>} Fixture availability.
 */
async function fixtureQuery(url) {
  return url.includes('value-quantity') ||
    (url.includes('/Observation?') && url.includes('_filter=code%20'));
}


/**
 * Creates an offline HTTPS stub with independently controlled header/body events.
 * @param {Object[]} responses - Per-request statusCode/body descriptors; error
 *   and timeout fail before headers; aborted, responseError, requestError and
 *   responseTimeout fail on the next turn after headers. Optional onResponse
 *   receives the body stream and takes responsibility for ending it.
 * @returns {Function} A substitute for https.get.
 */
function fakeGet(responses) {
  /**
   * Delivers the next scripted response without opening a socket.
   * @param {string} url - Requested URL, used in unexpected-request diagnostics.
   * @param {Function} callback - Receives the response when headers arrive.
   * @returns {EventEmitter} Request supporting errors, destruction and timeout.
   */
  return (url, callback) => {
    const result = responses.shift();
    assert.ok(result, `Unexpected request: ${url}`);
    const request = new EventEmitter();
    let timeoutCallback;
    /**
     * Simulates request destruction by delivering the supplied failure.
     * @param {Error} error - Transport failure.
     * @returns {boolean} Whether an error listener handled the failure.
     */
    request.destroy = (error) => request.emit('error', error);
    /**
     * Records the inactivity callback or schedules a pre-header timeout.
     * @param {number} ms - Positive timeout interval.
     * @param {Function} onTimeout - Callback that destroys the request.
     * @returns {EventEmitter} Request for chaining.
     */
    request.setTimeout = (ms, onTimeout) => {
      assert.ok(ms > 0);
      timeoutCallback = onTimeout;
      if (result.timeout) queueMicrotask(onTimeout);
      return request;
    };
    queueMicrotask(() => {
      if (result.timeout) return;
      if (result.error) return request.emit('error', result.error);
      const response = new PassThrough();
      response.statusCode = result.statusCode ?? 200;
      callback(response);
      if (result.onResponse) return result.onResponse(response);
      setImmediate(() => {
        if (result.aborted || result.responseError || result.requestError ||
          result.responseTimeout) {
          response.write('partial body');
          if (result.aborted) return response.emit('aborted');
          if (result.responseError) return response.destroy(result.responseError);
          if (result.requestError) return request.destroy(result.requestError);
          return timeoutCallback();
        }
        response.end(result.body ?? '{"entry":[]}');
      });
    });
    return request;
  };
}


test('reads scalar labels and cached formulas without modifying cells', () => {
  const sheet = new Workbook().addWorksheet('Values');
  const cell = sheet.getCell('B10');
  const cases = [
    ...[null, 0, false, '', 'token'].map((value) => [value, value]),
    [hyperlink('dbgap'), 'dbgap'],
    [hyperlink(richText('db', 'gap')), 'dbgap'],
    [richText('body-', 'site'), 'body-site'],
    ...[0, false, '', 'token'].map((result) => [
      { formula: 'UNSUPPORTED_FUNCTION()', result }, result
    ]),
    [{ sharedFormula: 'B9', result: false }, false]
  ];
  cell.font = { name: 'Arial', bold: true };
  for (const [value, expected] of cases) {
    cell.value = value;
    const original = structuredClone({ value: cell.value, style: cell.style });
    assert.equal(getCellValue(cell), expected);
    assert.deepEqual({ value: cell.value, style: cell.style }, original);
  }
});


test('rejects missing caches and unsupported cell objects with locations', () => {
  const sheet = new Workbook().addWorksheet('Values');
  const cell = sheet.getCell('B10');
  for (const value of [{ formula: '1' }, { sharedFormula: 'B9' }]) {
    cell.value = value;
    assert.throws(() => getCellValue(cell), {
      message: `${missingCache}: "Values"!B10. ${cacheGuidance}`
    });
  }
  for (const value of [
    { error: '#VALUE!' }, new Date('2026-09-09T00:00:00Z'),
    { formula: '1/0', result: { error: '#DIV/0!' } },
    { richText: [{ text: 42 }] }, { text: 42, hyperlink: 'https://example.test' },
    hyperlink({ richText: [{ text: 42 }] }), hyperlink(null)
  ]) {
    cell.value = value;
    assert.throws(() => getCellValue(cell), /Unsupported cell value: "Values"!B10/);
  }
});


test('round-trips real R4/R5 workbook semantics and unchanged CSV output', async (t) => {
  const directory = await temporaryDirectory(t);
  const baselines = new Map();
  for (const version of ['R4', 'R5']) {
    const name = `column-and-parameter-descriptions-${version}.xlsx`;
    const filename = path.join(directory, name);
    await fs.copyFile(path.join(sourceDirectory, name), filename);
    baselines.set(filename, snapshot(await readWorkbook(filename)));
  }
  const expectedCsv = await csvOutput(directory);
  for (const [filename, expected] of baselines) {
    const workbook = await readWorkbook(filename);
    await workbook.xlsx.writeFile(filename);
    assert.deepEqual(snapshot(await readWorkbook(filename)), expected);
  }
  assert.deepEqual(await csvOutput(directory), expectedCsv);
});


/**
 * Verifies the fixture's full update, including queries, styles and CSV output.
 * @param {Object} t - Node test context owning temporary workbooks.
 * @param {Object} [cellValues] - Cell overrides indexed by sheet and address.
 * @returns {Promise<Object>} Updated CSV text indexed by service URL.
 */
async function checkFixtureUpdate(t, cellValues) {
  const { directory, filePath } = await createFixture(t, cellValues);
  const expected = await readWorkbook(filePath);
  const sheet = expected.getWorksheet('Server');
  for (const [row, value] of [[10, 'hide'], [12, 'disable'], [13, 'show'],
    [19, 'hide'], [22, 'hide'], [26, 'hide'], [27, 'disable']]) {
    sheet.getCell(`E${row}`).value = value;
  }
  for (const [row, color] of [[12, gray], [13, green], [27, gray]]) {
    for (let column = 1; column <= sheet.columnCount; column++) {
      if (row === 12 && column === 6) continue;
      sheet.getCell(row, column).style = {
        ...sheet.getCell(row, column).style, fill: fill(color)
      };
    }
  }
  const expectedDirectory = await temporaryDirectory(t);
  await expected.xlsx.writeFile(path.join(expectedDirectory, 'configuration.xlsx'));
  const requests = [];
  await fs.chmod(filePath, 0o640);
  await updateExcelConfigurations({
    filePath, logger: quiet,
    /**
     * Records the normalized search URL and returns fixture availability.
     * @param {string} url - Generated FHIR search URL.
     * @returns {Promise<boolean>} Availability for the synthetic fixture.
     */
    async queryServer(url) {
      requests.push(url);
      return fixtureQuery(url);
    }
  });
  const actual = await readWorkbook(filePath);
  assert.deepEqual(snapshot(actual), snapshot(expected));
  const csv = await csvOutput(directory);
  assert.deepEqual(csv, await csvOutput(expectedDirectory));
  const base = 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1';
  assert.deepEqual(requests, [
    `${base}/Observation?_count=1&_format=json&_filter=body-site%20ne%20zzz`,
    `${base}/Observation?_count=1&_format=json&_filter=value-quantity%20ne%20000`,
    `${base}/Observation?_count=1&_format=json&_filter=code%20ne%20zzz`,
    `${base}/Observation?_count=1&_format=json&effective=gt1000-01-01`,
    `${base}/MedicationRequest?_count=1&_format=json&_filter=medication%20ne%20zzz`,
    `${base}/Patient?_count=1&_format=json&_filter=code%20ne%20zzz`
  ]);
  assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
  if (process.platform !== 'win32') assert.equal((await fs.stat(filePath)).mode & 0o777, 0o640);
  return csv;
}


test('updates plain and formatted workbooks with identical CSV output', async (t) => {
  const plainCsv = await checkFixtureUpdate(t);
  const formattedCsv = await checkFixtureUpdate(t, {
    Server: {
      A1: richText('Leg', 'end'),
      A6: { formula: '"unused"', result: marker },
      B6: hyperlink(richText('db', 'gap')),
      A9: richText('Obser', 'vation'), B10: hyperlink(richText('body-', 'site')),
      C10: hyperlink('search parameter'), F10: { formula: '""', result: 'token' },
      B11: { formula: '""', result: 'value-quantity' }, F11: richText('Quan', 'tity'),
      B12: hyperlink('bodySite'), C12: richText('col', 'umn'),
      B13: { formula: '""', result: 'value[x]' },
      C13: { formula: '""', result: 'column' }, E13: richText('dis', 'able'),
      B14: richText('sub', 'ject'), B15: richText('co', 'de'), E15: hyperlink('hide'),
      F16: richText('ref', 'erence'), F17: hyperlink('composite'),
      F19: richText('date', 'Time'),
      A21: { formula: '""', result: 'MedicationRequest' },
      B23: richText('medication', '[x]'), A24: hyperlink('Patient')
    },
    default: { A6: richText(marker), B6: richText('def', 'ault') },
    default_R4: { B6: { formula: '""', result: 'default_R4' } }
  });
  assert.deepEqual(formattedCsv, plainCsv);
});


test('rejects formula overwrites at every visibility assignment without saving', async (t) => {
  for (const kind of ['ordinary', 'shared master', 'shared follower', 'array']) {
    for (const [address, result, available, desired, requestCount] of [
      ['E10', 'show', false, 'hide', 1],
      ['E10', 'hide', true, 'show', 1],
      ['E12', 'show', false, 'disable', 6],
      ['E13', 'disable', true, 'show', 6]
    ]) {
      const value = { formula: `"${result}"`, result };
      const cells = { [address]: value };
      if (kind === 'shared master') {
        Object.assign(value, { shareType: 'shared', ref: `${address}:E18` });
        cells.E18 = { sharedFormula: address, result: 0 };
      } else if (kind === 'shared follower') {
        cells.D9 = { ...value, shareType: 'shared', ref: `D9:${address}` };
        cells[address] = { sharedFormula: 'D9', result };
      } else if (kind === 'array') {
        Object.assign(value, { shareType: 'array', ref: address });
      }
      const { directory, filePath } = await createFixture(t, { Server: cells });
      const original = await fs.readFile(filePath);
      let requests = 0;
      await assert.rejects(updateExcelConfigurations({
        filePath, logger: quiet,
        /**
         * Counts queries to check that a rejected change stops execution.
         * @returns {Promise<boolean>} Availability for this test variant.
         */
        async queryServer() { requests++; return available; },
        /**
         * Ensures formula rejection happens before writing any workbook.
         * @throws {Error} Always fails if the writer is reached.
         */
        writeWorkbook() { assert.fail('Formula overwrites must not be saved'); }
      }), {
        message: `Cannot overwrite formula cell "Server"!${address}` +
          (kind === 'array' ? ` (array range ${address})` : '') +
          `: requested value "${desired}".`
      });
      assert.equal(requests, requestCount, `${kind}: ${address}`);
      assert.deepEqual(await fs.readFile(filePath), original);
      assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
    }
  }
});


test('rejects scalar array results at interior and boundary cells', async (t) => {
  for (const [ref, address, result, desired] of [
    ['D9:F11', 'E10', 'show', 'hide'],
    ['D9:E10', 'E10', 'show', 'hide'],
    ['E9:F10', 'E10', null, 'hide'],
    ['D10:F11', 'E10', false, 'hide'],
    ['$D$9:$E$10', 'E10', 0, 'hide'],
    ['D12:E12', 'E12', 'show', 'disable'],
    ['D13:F14', 'E13', 'disable', 'show']
  ]) {
    const master = ref.split(':')[0].replace(/\$/g, '');
    const { directory, filePath } = await createFixture(t, {
      Server: {
        [master]: { formula: '"cached"', result: 'cached', shareType: 'array', ref },
        [address]: result
      }
    });
    const original = await fs.readFile(filePath);
    assert.equal((await readWorkbook(filePath)).getWorksheet('Server')
      .getCell(address).value, result);
    await assert.rejects(updateExcelConfigurations({
      filePath, logger: quiet, queryServer: fixtureQuery,
      /**
       * Prevents any output when an array-result value would change.
       * @throws {Error} Always fails if the writer is reached.
       */
      writeWorkbook() { assert.fail('Array overwrites must not be saved'); }
    }), {
      message: `Cannot overwrite formula cell "Server"!${address}` +
        ` (array range ${ref}): requested value "${desired}".`
    });
    assert.deepEqual(await fs.readFile(filePath), original);
    assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
  }
});


test('allows value changes immediately outside each array boundary', async (t) => {
  for (const ref of ['D9:D11', 'F9:G11', 'D8:F9', 'D11:F11']) {
    const master = ref.split(':')[0];
    const { filePath } = await createFixture(t, {
      Server: {
        [master]: { formula: '1', result: 1, shareType: 'array', ref },
        E10: 'show'
      },
      default: {
        D9: { formula: '1', result: 1, shareType: 'array', ref: 'D9:F11' }
      }
    });
    await updateExcelConfigurations({
      filePath, logger: quiet, queryServer: fixtureQuery
    });
    const sheet = (await readWorkbook(filePath)).getWorksheet('Server');
    assert.equal(sheet.getCell('E10').value, 'hide');
    assert.equal(sheet.getCell(master).value.ref, ref);
  }
});


test('preserves shared and array metadata while allowing no-ops and recoloring', async (t) => {
  const { filePath } = await createFixture(t, {
    Server: {
      E10: { formula: '"hide"', result: 'hide', shareType: 'shared', ref: 'E10:E19' },
      E16: { sharedFormula: 'E10', result: false },
      E17: { sharedFormula: 'E10', result: 0 },
      E19: { sharedFormula: 'E10', result: 'hide' },
      D12: { formula: '"disable"', result: 'disable', shareType: 'array', ref: 'D12:E12' },
      E12: 'disable',
      E13: { formula: '"show"', result: 'show' },
      E15: { formula: '"hide"', result: 'hide' },
      X3: { formula: '1+1', result: 2, shareType: 'array', ref: 'X3:X4' },
      X4: 2,
      Y3: { formula: 'UNSUPPORTED_FUNCTION()', result: 0 },
      Z10: {
        formula: 'SUM(A:A)+SUM(10:10)+SUM(Table1[A1])+IF(A1="R4",1,0)',
        result: 0, shareType: 'shared', ref: 'Z10:AA11'
      },
      AA11: { sharedFormula: 'Z10', result: false }
    },
    default_R4: {
      E10: { formula: '"hide"', result: 'hide', shareType: 'shared', ref: 'E10:E11' },
      E11: { sharedFormula: 'E10', result: 'disable' }
    },
    default: {
      E10: { formula: '"hide"', result: 'hide', shareType: 'array', ref: 'E10:E11' }
    }
  });
  const original = await readWorkbook(filePath);
  await updateExcelConfigurations({
    filePath, logger: quiet, queryServer: fixtureQuery
  });
  const updated = await readWorkbook(filePath);
  const before = original.getWorksheet('Server');
  const after = updated.getWorksheet('Server');
  for (const address of ['E10', 'E16', 'E17', 'E19', 'D12', 'E12', 'E13',
    'E15', 'X3', 'X4', 'Y3', 'Z10', 'AA11']) {
    assert.deepEqual(after.getCell(address).value, before.getCell(address).value);
    assert.equal(after.getCell(address).result, before.getCell(address).result);
  }
  for (const address of ['D12', 'E12']) {
    assert.equal(before.getCell(address).fill.fgColor.argb, green);
    assert.equal(after.getCell(address).fill.fgColor.argb, gray);
  }
  assert.deepEqual(snapshot(updated).slice(1), snapshot(original).slice(1));
});


test('does not expand sparse array ranges into worksheet cells', async (t) => {
  const { filePath } = await createFixture(t, {
    Server: {
      Z3: { formula: '1', result: 1, shareType: 'array', ref: 'Z3:AA1048576' }
    }
  });
  const original = await readWorkbook(filePath);
  const before = original.getWorksheet('Server');
  await updateExcelConfigurations({ filePath, logger: quiet, queryServer: fixtureQuery });
  const after = (await readWorkbook(filePath)).getWorksheet('Server');
  assert.equal(after.rowCount, before.rowCount);
  assert.equal(after.columnCount, before.columnCount);
  assert.equal(after.getCell('Z3').value.ref, 'Z3:AA1048576');
});


test('preserves formulas and formatted visibility labels on no-op updates', async (t) => {
  const { filePath } = await createFixture(t, {
    Server: {
      E10: { formula: '"hide"', result: 'hide' },
      E12: hyperlink(richText('dis', 'able')),
      E13: { formula: '"show"', result: 'show' },
      E19: richText('hi', 'de'), E22: hyperlink('hide'),
      E26: { formula: '"hide"', result: 'hide' },
      E27: { formula: '"disable"', result: 'disable' }
    }
  });
  const original = await readWorkbook(filePath);
  await updateExcelConfigurations({ filePath, logger: quiet, queryServer: fixtureQuery });
  const updated = await readWorkbook(filePath);
  for (const address of ['E10', 'E12', 'E13', 'E19', 'E22', 'E26', 'E27']) {
    assert.deepEqual(updated.getWorksheet('Server').getCell(address).value,
      original.getWorksheet('Server').getCell(address).value);
  }
});


test('keeps lockfile release versions synchronized with package.json', () => {
  const { version } = require('../package.json');
  const lock = require('../package-lock.json');
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
});


test('updates a real R4 copy sequentially and leaves its default sheet intact', async (t) => {
  const directory = await temporaryDirectory(t);
  const filePath = path.join(directory, 'configuration.xlsx');
  await fs.copyFile(path.join(sourceDirectory, 'column-and-parameter-descriptions-R4.xlsx'), filePath);
  const original = await readWorkbook(filePath);
  const defaultSheet = snapshot(original).find((sheet) => sheet.name === 'Default R4 resources');
  let active = 0;
  let requests = 0;
  await updateExcelConfigurations({
    filePath, logger: quiet,
    /**
     * Checks that requests never overlap and reports no data.
     * @param {string} url - Generated HTTPS search URL.
     * @returns {Promise<boolean>} Always false after an asynchronous turn.
     */
    async queryServer(url) {
      assert.match(url, /^https:\/\//);
      assert.equal(active++, 0);
      await Promise.resolve();
      active--;
      requests++;
      return false;
    }
  });
  assert.ok(requests > 0);
  const updated = await readWorkbook(filePath);
  assert.deepEqual(snapshot(updated).find((sheet) => sheet.name === 'Default R4 resources'), defaultSheet);
  assert.deepEqual(updated.worksheets.map((sheet) => sheet.name), original.worksheets.map((sheet) => sheet.name));
  assert.ok(Object.keys(await csvOutput(directory)).length > 0);
});


test('does not leak data availability between updater invocations', async (t) => {
  const { filePath } = await createFixture(t);
  const options = {
    filePath, logger: quiet,
    /** @returns {Promise<boolean>} No data during the first updater invocation. */
    async queryServer() { return false; }
  };
  await updateExcelConfigurations(options);
  const workbook = await readWorkbook(filePath);
  const sheet = workbook.getWorksheet('Server');
  sheet.getCell('F10').value = 'reference';
  sheet.getCell('E12').value = 'show';
  await workbook.xlsx.writeFile(filePath);
  await updateExcelConfigurations({
    ...options,
    /** @returns {Promise<boolean>} Data during the second updater invocation. */
    async queryServer() { return true; }
  });
  assert.equal((await readWorkbook(filePath)).getWorksheet('Server').getCell('E12').value, 'show');
});


test('keeps the original after query, response parsing and retry failures', async (t) => {
  const { directory, filePath } = await createFixture(t);
  const original = await fs.readFile(filePath);
  const queries = [
    /** @returns {Promise<boolean>} Always rejects with a network failure. */
    async () => { throw new Error('Network unavailable'); },
    /** @returns {Promise<undefined>} Invalid non-boolean query result. */
    async () => undefined,
    /**
     * Simulates malformed JSON in an otherwise successful HTTP response.
     * @param {string} url - Generated search URL.
     * @returns {Promise<boolean>} Rejects when parsing the response.
     */
    (url) => querySearchParameter(url, { get: fakeGet([{ body: 'not JSON' }]) }),
    /**
     * Simulates a completed retryable response with no remaining retries.
     * @param {string} url - Generated search URL.
     * @returns {Promise<boolean>} Rejects with retry exhaustion.
     */
    (url) => querySearchParameter(url, {
      get: fakeGet([{ statusCode: 502 }]), maxRetries: 0
    })
  ];
  for (const queryServer of queries) {
    await assert.rejects(updateExcelConfigurations({ filePath, logger: quiet, queryServer }));
    assert.deepEqual(await fs.readFile(filePath), original);
    assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
  }
});


test('keeps the original and cleans partial output after a write failure', async (t) => {
  const { directory, filePath } = await createFixture(t);
  const original = await fs.readFile(filePath);
  await assert.rejects(updateExcelConfigurations({
    filePath, logger: quiet, queryServer: fixtureQuery,
    /**
     * Writes deliberately incomplete output before simulating a disk failure.
     * @param {Workbook} workbook - Updated workbook passed to the writer.
     * @param {string} temporaryPath - Staging path beside the source workbook.
     * @returns {Promise<void>} Always rejects after writing partial output.
     * @throws {Error} Simulated write failure, requiring staging cleanup.
     */
    async writeWorkbook(workbook, temporaryPath) {
      assert.ok(workbook instanceof Workbook);
      assert.notEqual(temporaryPath, filePath);
      assert.equal(path.dirname(path.dirname(temporaryPath)), directory);
      assert.deepEqual(await fs.readFile(filePath), original);
      await fs.writeFile(temporaryPath, 'partial workbook');
      throw new Error('Write failed');
    }
  }), /Write failed/);
  assert.deepEqual(await fs.readFile(filePath), original);
  assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
});


test('keeps the original and removes temporary output if rename fails', async (t) => {
  const { directory, filePath } = await createFixture(t);
  const original = await fs.readFile(filePath);


  /**
   * Simulates an atomic-replacement failure without moving either file.
   * @returns {Promise<void>} Always rejects with the simulated rename failure.
   */
  async function failRename() {
    throw new Error('Rename failed');
  }
  t.mock.method(fs, 'rename', failRename);
  await assert.rejects(updateExcelConfigurations({
    filePath, logger: quiet, queryServer: fixtureQuery
  }), /Rename failed/);
  assert.deepEqual(await fs.readFile(filePath), original);
  assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
});


test('rejects malformed workbooks and missing metadata before querying', async (t) => {
  const { directory, filePath } = await createFixture(t);
  let requests = 0;
  const options = {
    filePath, logger: quiet,
    /**
     * Counts queries to prove that invalid metadata fails before networking.
     * @returns {Promise<boolean>} Always false if unexpectedly called.
     */
    async queryServer() { requests++; return false; }
  };
  const workbook = await readWorkbook(filePath);
  workbook.getWorksheet('Server').getCell('A3').fill = fill('not-a-color');
  await workbook.xlsx.writeFile(filePath);
  const original = await fs.readFile(filePath);
  await assert.rejects(updateExcelConfigurations(options), /legend fill/);
  assert.deepEqual(await fs.readFile(filePath), original);
  workbook.getWorksheet('Server').getCell('B6').value = null;
  await workbook.xlsx.writeFile(filePath);
  await assert.rejects(updateExcelConfigurations(options), /Missing service base URL/);
  await fs.writeFile(filePath, 'invalid XLSX');
  await assert.rejects(updateExcelConfigurations(options));
  assert.equal(await fs.readFile(filePath, 'utf8'), 'invalid XLSX');
  assert.equal(requests, 0);
  assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
});


test('keeps the source intact when normalized workbook values are invalid', async (t) => {
  for (const [address, value, message] of [
    ['B6', { formula: '"url"' }, missingCache],
    ['A9', { error: '#VALUE!' }, 'Unsupported cell value'],
    ['B10', { formula: '"body-site"' }, missingCache],
    ['A10', { formula: '""', result: '' }, missingCache],
    ['F18', { formula: '""', result: '' }, missingCache],
    ['C10', { error: '#VALUE!' }, 'Unsupported cell value'],
    ['F10', { formula: '1/0', result: { error: '#DIV/0!' } }, 'Unsupported cell value'],
    ['B12', { error: '#VALUE!' }, 'Unsupported cell value'],
      ['E13', { error: '#VALUE!' }, 'Unsupported cell value'],
      ['E10', { formula: '"hide"' }, missingCache],
      ['E10', { formula: '"hide"', shareType: 'array', ref: 'E10' }, missingCache],
      ['E12', { formula: '""', result: '' }, missingCache]
  ]) {
    const { directory, filePath } = await createFixture(t, {
      Server: { [address]: value }
    });
    const original = await fs.readFile(filePath);
    await assert.rejects(updateExcelConfigurations({
      filePath, logger: quiet, queryServer: fixtureQuery
    }), {
      message: `${message}: "Server"!${address}` +
        (message === missingCache ? `. ${cacheGuidance}` : '')
    });
    assert.deepEqual(await fs.readFile(filePath), original);
    assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
  }
});


test('waits for completed HTTP errors before hiding or retrying', async () => {
  for (const statusCode of [400, 429, 502]) {
    const headers = Promise.withResolvers();
    const responses = [{
      statusCode,
      /**
       * Exposes a paused error response so the test controls its completion.
       * @param {PassThrough} response - Body stream after headers arrive.
       */
      onResponse(response) { headers.resolve(response); }
    }, { body: '{"entry":[{}]}' }];
    let settled = false;
    let waits = 0;
    let ended = false;
    const pending = querySearchParameter('https://example.test', {
      get: fakeGet(responses),
      /**
       * Verifies retries only begin after the previous response finishes.
       * @param {number} ms - Expected backoff interval.
       * @returns {Promise<void>} Immediate completion without real delay.
       */
      async wait(ms) {
        assert.equal(ms, 1000);
        assert.equal(ended, true);
        waits++;
      }
    });
    pending.then(() => { settled = true; }, () => { settled = true; });
    const response = await headers.promise;
    response.on('end', () => { ended = true; });
    response.write('not JSON: incomplete HTTP error body');
    await new Promise(setImmediate);
    assert.equal(settled, false);
    assert.equal(waits, 0);
    assert.equal(responses.length, 1);
    response.end();
    assert.equal(await pending, statusCode !== 400);
    assert.equal(waits, statusCode === 400 ? 0 : 1);
  }
});


test('keeps the workbook intact after post-header transport failures', async (t) => {
  const { directory, filePath } = await createFixture(t);
  const original = await fs.readFile(filePath);
  for (const statusCode of [200, 400, 429, 502]) {
    for (const [failure, message] of [
      [{ aborted: true }, /Aborted request/],
      [{ responseError: new Error('Truncated response') }, /Truncated response/],
      [{ requestError: new Error('Connection reset after headers') }, /Connection reset/],
      [{ responseTimeout: true }, /Request timed out/]
    ]) {
      await assert.rejects(updateExcelConfigurations({
        filePath, logger: quiet,
        /**
         * Sends each workbook query through a transport that fails after headers.
         * @param {string} url - Generated FHIR search URL.
         * @returns {Promise<boolean>} Rejects for the scripted transport failure.
         */
        queryServer(url) {
          return querySearchParameter(url, {
            get: fakeGet([{ statusCode, ...failure }]),
            /**
             * Fails if a transport error is mistaken for a retryable status.
             * @throws {Error} Always fails because transport errors must abort.
             */
            wait() { assert.fail('Transport failures must not be retried'); }
          });
        }
      }), message);
      assert.deepEqual(await fs.readFile(filePath), original);
      assert.deepEqual(await fs.readdir(directory), ['configuration.xlsx']);
    }
  }
});


test('allows exactly three retries for completed 429/502 responses', async () => {
  for (const statusCode of [429, 502]) {
    for (const exhausted of [false, true]) {
      const responses = Array.from({ length: 3 }, () => ({ statusCode }));
      responses.push(exhausted ? { statusCode } : { statusCode: 400 });
      let waits = 0;
      const pending = querySearchParameter('https://example.test', {
        get: fakeGet(responses),
        /**
         * Counts retry delays without waiting a second per attempt.
         * @param {number} ms - Expected backoff interval.
         * @returns {Promise<void>} Immediate completion.
         */
        async wait(ms) { assert.equal(ms, 1000); waits++; }
      });
      if (exhausted) {
        await assert.rejects(pending, new RegExp(`HTTP ${statusCode}: retries exhausted`));
      } else {
        assert.equal(await pending, false);
      }
      assert.equal(waits, 3);
      assert.equal(responses.length, 0);
    }
  }
});


test('retries 429/502, preserves HTTP-error hiding, and rejects transport errors', async () => {
  let waits = 0;
  const options = {
    get: fakeGet([{ statusCode: 429 }, { statusCode: 502 }, { body: '{"entry":[{}]}' }]),
    /**
     * Counts retry delays without incurring real backoff time.
     * @param {number} ms - Expected backoff interval.
     * @returns {Promise<void>} Immediate completion.
     */
    async wait(ms) { assert.equal(ms, 1000); waits++; }
  };
  assert.equal(await querySearchParameter('https://example.test', options), true);
  assert.equal(waits, 2);
  for (const result of [{ statusCode: 400 }, { body: '{"entry":[]}' }]) {
    assert.equal(await querySearchParameter('https://example.test', { get: fakeGet([result]) }), false);
  }
  for (const result of [
    { error: new Error('Connection reset') }, { timeout: true },
    { aborted: true }, { body: 'null' }, { body: '{"entry":"invalid"}' }
  ]) {
    await assert.rejects(querySearchParameter('https://example.test', { get: fakeGet([result]) }));
  }
});
