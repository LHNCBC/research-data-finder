/**
 * This program updates src/conf/xlsx/column-and-parameter-descriptions-R4.xlsx for show/hide
 * properties of search parameters, depending on whether server has data.
 * It then updates show/hide properties of columns, based on adjacent search parameter rows.
 * When server data might have updated, run:
 *     npm run update-excel-config
 * and check in configuration file changes.
 */
const { Workbook } = require('devextreme-exceljs-fork');
const fs = require('fs/promises');
const https = require('https');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');

const SERVICEBASEURL = '---SERVICE BASE URL:';
const DBGAPBASEURL = 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1';
const SEARCHPARAMETER = 'search parameter';
const COLUMN = 'column';
const RESOURCETYPECOLUMN = 'A';
const FHIRNAMECOLUMN = 'B';
const TYPECOLUMN = 'C';
const SHOWHIDECOLUMN = 'E';
const DATATYPECOLUMN = 'F';
const defaultFilePath = path.resolve(
  __dirname,
  '../src/conf/xlsx/column-and-parameter-descriptions-R4.xlsx'
);
const doNotUpdateList = [
  ['*', /^code text$/],
  ['Observation', /^observation value$/],
  ['Observation', /^.*value-.+$/],
  ['Observation', /^code$/],
  ['Observation', /^combo-code$/],
  ['Observation', /^component-code$/],
  ['Observation', /^identifier$/]
];


/**
 * Waits for a complete response, rejecting transport, timeout and JSON errors.
 * Non-success bodies are drained without buffering or JSON parsing.
 * @param {string} url - FHIR search URL.
 * @param {Function} get - HTTPS request implementation.
 * @param {number} timeoutMs - Request inactivity timeout.
 * @returns {Promise<{statusCode: number, hasData?: boolean}>} Search result.
 */
function requestSearchResult(url, get, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      const { statusCode } = response;
      response.on('error', reject);
      response.on('aborted', () => {
        reject(new Error(`Aborted request: ${url}`));
      });
      if (statusCode < 200 || statusCode >= 300) {
        response.on('end', () => resolve({ statusCode }));
        response.resume();
        return;
      }
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const bundle = JSON.parse(body);
          if (
            !bundle || typeof bundle !== 'object' || Array.isArray(bundle) ||
            (bundle.entry !== undefined && !Array.isArray(bundle.entry))
          ) {
            reject(new Error(`Invalid FHIR search response: ${url}`));
            return;
          }
          resolve({ statusCode, hasData: !!bundle.entry?.length });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timed out: ${url}`));
    });
  });
}


/**
 * Checks availability, retrying completed 429/502 responses; other completed
 * HTTP errors mean no data. Transport failures reject without retrying.
 * @param {string} url - FHIR search URL.
 * @param {Object} [options] - Injectable transport and retry settings.
 * @param {Function} [options.get=https.get] - HTTPS request implementation.
 * @param {Function} [options.wait=delay] - Retry delay implementation.
 * @param {number} [options.maxRetries=3] - Retries after the first attempt.
 * @param {number} [options.timeoutMs=30000] - Request inactivity timeout.
 * @returns {Promise<boolean>} Whether the search returned entries.
 */
async function querySearchParameter(url, {
  get = https.get,
  wait = delay,
  maxRetries = 3,
  timeoutMs = 30000
} = {}) {
  for (let attempt = 0; ; attempt++) {
    const result = await requestSearchResult(url, get, timeoutMs);
    if (result.statusCode === 429 || result.statusCode === 502) {
      if (attempt >= maxRetries) {
        throw new Error(
          `HTTP ${result.statusCode}: retries exhausted for ${url}`
        );
      }
      await wait(1000);
      continue;
    }
    return result.statusCode >= 200 && result.statusCode < 300
      ? result.hasData : false;
  }
}


/**
 * Reads a solid RGB fill, normalizing six/eight digit colors to uppercase ARGB.
 * @param {Object} cell - ExcelJS cell, possibly empty but styled.
 * @returns {string|undefined} Normalized color, or undefined for other fills.
 */
function getFillColor(cell) {
  const fill = cell.fill;
  if (fill?.type !== 'pattern' || fill.pattern !== 'solid') return undefined;
  const color = fill.fgColor?.argb;
  if (typeof color !== 'string') return undefined;
  if (/^[\da-f]{6}$/i.test(color)) return `FF${color.toUpperCase()}`;
  return /^[\da-f]{8}$/i.test(color) ? color.toUpperCase() : undefined;
}


/**
 * Reads a scalar without changing cell values, formulas or rich-text styles.
 * Hyperlinks use plain or rich display text; rich-text runs are concatenated. Formulas
 * (including shared formulas) use cell.result, never evaluation or value.result,
 * because ExcelJS omits falsy cached results from cell.value.
 * On disk, empty-string formula caches are lost by the reader and unsupported.
 * @param {Object} cell - ExcelJS cell with worksheet and address information.
 * @returns {string|number|boolean|null|undefined} Scalar value or empty cell.
 * @throws {Error} If a formula has no cache or a cell value is unsupported.
 */
function getCellValue(cell) {
  let value = cell.value;
  const location = `"${cell.worksheet.name}"!${cell.address}`;
  if (value && typeof value === 'object' &&
    ('formula' in value || 'sharedFormula' in value)) {
    value = cell.result;
    if (value === undefined || value === null) {
      throw new Error(
        `Missing or unsupported empty cached formula result: ${location}. ` +
        'Use a literal value, or a blank cell where allowed.'
      );
    }
  }
  if (value === null || value === undefined ||
    ['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }
  if (typeof value.hyperlink === 'string') {
    value = value.text;
    if (typeof value === 'string') return value;
  }
  if (Array.isArray(value?.richText) &&
    value.richText.every((run) => typeof run?.text === 'string')) {
    return value.richText.map((run) => run.text).join('');
  }
  throw new Error(`Unsupported cell value: ${location}`);
}


/**
 * Reads normalized sheet metadata before any server queries are made.
 * @param {Object} sheet - ExcelJS worksheet.
 * @returns {Object} Sheet, server URL, default flag, dimensions, legend and
 *   declared array-formula bounds (collected only for non-default sheets).
 * @throws {Error} If metadata, legend colors or array ranges are invalid.
 */
function describeSheet(sheet) {
  let serviceBaseUrl;
  const rowCount = sheet.rowCount;
  const columnCount = sheet.columnCount;
  for (let row = 1; row <= rowCount; row++) {
    if (getCellValue(sheet.getCell(`${RESOURCETYPECOLUMN}${row}`)) === SERVICEBASEURL) {
      serviceBaseUrl = getCellValue(sheet.getCell(`${FHIRNAMECOLUMN}${row}`));
      break;
    }
  }
  if (typeof serviceBaseUrl !== 'string' || !serviceBaseUrl.trim()) {
    throw new Error(`Missing service base URL in worksheet "${sheet.name}"`);
  }
  const isDefault = /^default(?:_|$)/.test(serviceBaseUrl);
  if (serviceBaseUrl === 'dbgap') serviceBaseUrl = DBGAPBASEURL;
  let colors;
  if (!isDefault && getCellValue(sheet.getCell('A1')) === 'Legend') {
    colors = ['A3', 'A4', 'A5'].map((address) => {
      const color = getFillColor(sheet.getCell(address));
      if (!color) {
        throw new Error(
          `Expected solid RGB legend fill: ${sheet.name}!${address}`
        );
      }
      return color;
    });
  }
  const arrayFormulaRanges = isDefault ? [] : getArrayFormulaRanges(sheet);
  return {
    sheet, serviceBaseUrl, isDefault, rowCount, columnCount, colors,
    arrayFormulaRanges
  };
}


/**
 * Collects rectangular bounds from array masters' declared range metadata.
 * Does not evaluate formulas, infer spill ranges or create cells in the range.
 * @param {Object} sheet - Non-default ExcelJS worksheet.
 * @returns {Object[]} Array ranges with ref, top, bottom, left and right bounds.
 * @throws {Error} If an array master has a missing or malformed range.
 */
function getArrayFormulaRanges(sheet) {
  const ranges = [];
  sheet.eachRow((row) => row.eachCell((cell) => {
    const value = cell.value;
    if (value?.shareType !== 'array') return;
    const bounds = /^\$?([A-Z]{1,3})\$?([1-9]\d*)(?::\$?([A-Z]{1,3})\$?([1-9]\d*))?$/i
      .exec(value.ref || '');
    if (!bounds) {
      throw new Error(
        `Invalid array formula range: "${sheet.name}"!${cell.address}`
      );
    }
    const [left, right] = [bounds[1], bounds[3] || bounds[1]].map((letters) =>
      [...letters.toUpperCase()].reduce(
        (column, letter) => column * 26 + letter.charCodeAt(0) - 64, 0
      )
    );
    ranges.push({
      ref: value.ref,
      top: Number(bounds[2]), bottom: Number(bounds[4] || bounds[2]),
      left, right
    });
  }));
  return ranges;
}


/**
 * Changes a visibility value only when it differs and is not formula-owned.
 * Uses metadata only; checks array membership after comparing cached values.
 * Formatting-only changes remain allowed through paintRow.
 * @param {Object} cell - ExcelJS visibility cell.
 * @param {string} desired - New visibility label.
 * @param {Object[]} arrayFormulaRanges - This worksheet's array range bounds.
 * @throws {Error} If reading the value fails or a formula-owned value must change.
 */
function setCellValue(cell, desired, arrayFormulaRanges) {
  if (getCellValue(cell) === desired) return;
  const value = cell.value;
  const arrayRange = arrayFormulaRanges.find((range) =>
    cell.row >= range.top && cell.row <= range.bottom &&
    cell.col >= range.left && cell.col <= range.right
  );
  if (arrayRange || (value && typeof value === 'object' &&
    ('formula' in value || 'sharedFormula' in value))) {
    throw new Error(
      `Cannot overwrite formula cell "${cell.worksheet.name}"!${cell.address}` +
      (arrayRange ? ` (array range ${arrayRange.ref})` : '') +
      `: requested value "${desired}".`
    );
  }
  cell.value = desired;
}


/**
 * Changes search visibility, matching exceptions by normalized parameter name,
 * and stores availability without changing the parameter cell's formatting.
 * Preserves unchanged formulas and labels; rejects formula-owned value changes.
 * @param {Object} availabilityOfData - Per-run server/resource/parameter map.
 * @param {string} serviceBaseUrl - Server base URL.
 * @param {string} resourceType - FHIR resource type.
 * @param {number} rowNum - Search parameter's row number.
 * @param {Object} sheet - ExcelJS worksheet.
 * @param {boolean} available - Whether the search returned data.
 * @param {Object[]} arrayFormulaRanges - This worksheet's array range bounds.
 * @throws {Error} If a visibility change would overwrite a formula-owned value.
 */
function updateSearchParamInfo(
  availabilityOfData, serviceBaseUrl, resourceType, rowNum, sheet, available,
  arrayFormulaRanges
) {
  const paramName = getCellValue(sheet.getCell(`${FHIRNAMECOLUMN}${rowNum}`));
  if (!doNotUpdateList.some(
    (x) => (x[0] === '*' || x[0] === resourceType) && x[1].test(paramName)
  )) {
    const visibility = sheet.getCell(`${SHOWHIDECOLUMN}${rowNum}`);
    const desired = available ? 'show' : 'hide';
    setCellValue(visibility, desired, arrayFormulaRanges);
  }
  availabilityOfData[serviceBaseUrl] =
    availabilityOfData[serviceBaseUrl] || Object.create(null);
  availabilityOfData[serviceBaseUrl][resourceType] =
    availabilityOfData[serviceBaseUrl][resourceType] || Object.create(null);
  availabilityOfData[serviceBaseUrl][resourceType][paramName] = available;
}


/**
 * Matches column names to search parameters, including polymorphic [x] names.
 * @param {Object} availabilityOfData - Per-run server/resource/parameter map.
 * @param {string} serviceBaseUrl - Server base URL.
 * @param {string} resourceType - FHIR resource type.
 * @param {string} fhirName - Column's FHIR element name.
 * @returns {boolean|undefined} Availability, or undefined if not queried.
 */
function hasData(availabilityOfData, serviceBaseUrl, resourceType, fhirName) {
  const parameters = availabilityOfData[serviceBaseUrl]?.[resourceType];
  if (!parameters) return undefined;
  const choice = /^(.+)\[x]$/.exec(fhirName);
  const choicePattern = choice && new RegExp(`^${choice[1]}-?.*$`);
  const names = Object.keys(parameters).filter((name) => choicePattern
    ? choicePattern.test(name)
    : name.toLowerCase() === fhirName.toLowerCase() ||
      name === camelCaseToHyphenated(fhirName)
  );
  return names.length ? names.some((name) => parameters[name]) : undefined;
}


/**
 * Converts a camel case element name to its hyphenated search parameter name.
 * @param {string} camel - Element name, for example bodySite.
 * @returns {string} Hyphenated name, for example body-site.
 */
function camelCaseToHyphenated(camel) {
  return camel.split(/(?=[A-Z])/).join('-').toLowerCase();
}


/**
 * Paints a row's full width without changing protected fills or other styles.
 * @param {Object} sheet - ExcelJS worksheet.
 * @param {number} rowNum - Row to paint.
 * @param {number} columnCount - Worksheet width, including styled blanks.
 * @param {string} color - Normalized ARGB fill to apply.
 * @param {string} doNotUpdateColor - Normalized protected ARGB fill.
 */
function paintRow(sheet, rowNum, columnCount, color, doNotUpdateColor) {
  for (let column = 1; column <= columnCount; column++) {
    const cell = sheet.getCell(rowNum, column);
    if (getFillColor(cell) === doNotUpdateColor) continue;
    // Loaded cells can share style objects. Replace, never mutate, that style.
    cell.style = {
      ...cell.style,
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
        bgColor: { indexed: 64 }
      }
    };
  }
}


/**
 * Updates column visibility and colors using matching parameter availability.
 * Reads normalized cell values without rewriting names or unchanged visibility.
 * @param {Object[]} sheets - Validated worksheet metadata.
 * @param {Object} availabilityOfData - Per-run server/resource/parameter map.
 * @throws {Error} If a visibility change would overwrite a formula-owned value.
 */
function updateColumnRows(sheets, availabilityOfData) {
  for (const info of sheets) {
    const {
      sheet, serviceBaseUrl, rowCount, columnCount, colors, arrayFormulaRanges
    } = info;
    if (info.isDefault || !colors) continue;
    let resourceType = '';
    const [colorWithData, colorWithoutData, doNotUpdateColor] = colors;
    for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
      resourceType =
        getCellValue(sheet.getCell(`${RESOURCETYPECOLUMN}${rowNum}`)) || resourceType;
      if (getCellValue(sheet.getCell(`${TYPECOLUMN}${rowNum}`)) !== COLUMN) continue;
      const fhirName = getCellValue(sheet.getCell(`${FHIRNAMECOLUMN}${rowNum}`));
      // Subject refers to a patient; medication is the main code field.
      if (fhirName === 'subject' || fhirName === 'medication[x]') continue;
      const available = hasData(
        availabilityOfData, serviceBaseUrl, resourceType, fhirName
      );
      if (available === undefined) continue;
      const visibility = sheet.getCell(`${SHOWHIDECOLUMN}${rowNum}`);
      if (!available) {
        setCellValue(visibility, 'disable', arrayFormulaRanges);
      } else if (getCellValue(visibility) === 'disable') {
        setCellValue(visibility, 'show', arrayFormulaRanges);
      }
      paintRow(
        sheet, rowNum, columnCount,
        available ? colorWithData : colorWithoutData, doNotUpdateColor
      );
    }
  }
}


/**
 * Writes a workbook beside the original and renames only after a full write.
 * @param {Object} workbook - Updated ExcelJS workbook.
 * @param {string} filePath - Original workbook path.
 * @param {Function} writeWorkbook - Asynchronous workbook writer.
 * @returns {Promise<void>} Resolves after replacement and temporary cleanup.
 */
async function replaceWorkbook(workbook, filePath, writeWorkbook) {
  const { mode } = await fs.stat(filePath);
  const directory = await fs.mkdtemp(
    path.join(path.dirname(filePath), `.${path.basename(filePath)}-`)
  );
  const temporaryPath = path.join(directory, path.basename(filePath));
  try {
    await writeWorkbook(workbook, temporaryPath);
    await fs.chmod(temporaryPath, mode);
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}


/**
 * Updates an R4 configuration workbook without changing unrelated formatting.
 * Interprets hyperlink/rich-text labels and cached formulas as scalar values.
 * Preserves formulas and rejects value changes to formula cells or declared
 * array-formula ranges. Formatting-only changes remain allowed.
 * @param {Object} [options] - Paths and injectable I/O for offline tests.
 * @param {string} [options.filePath] - Defaults to the repository's R4 workbook.
 * @param {Function} [options.queryServer] - Resolves a search URL to a boolean.
 * @param {Function} [options.writeWorkbook] - Writes (workbook, temporaryPath).
 * @param {Object} [options.logger=console] - Receives progress via log().
 * @returns {Promise<Workbook>} The updated workbook after a successful write.
 * @throws {Error} If values, formula guards, queries or I/O fail; keeps the source
 *   intact and lets the CLI report failure without saving partial changes.
 */
async function updateExcelConfigurations({
  filePath = defaultFilePath,
  queryServer = querySearchParameter,
  writeWorkbook = (workbook, filename) => workbook.xlsx.writeFile(filename),
  logger = console
} = {}) {
  filePath = path.resolve(filePath);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets = workbook.worksheets.map(describeSheet);
  const availabilityOfData = Object.create(null);

  for (const info of sheets) {
    const { sheet, serviceBaseUrl, isDefault, rowCount, arrayFormulaRanges } = info;
    if (isDefault) continue;
    let resourceType = '';
    for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
      resourceType =
        getCellValue(sheet.getCell(`${RESOURCETYPECOLUMN}${rowNum}`)) || resourceType;
      if (getCellValue(sheet.getCell(`${TYPECOLUMN}${rowNum}`)) !== SEARCHPARAMETER) {
        continue;
      }
      const paramName = getCellValue(sheet.getCell(`${FHIRNAMECOLUMN}${rowNum}`));
      const paramType = getCellValue(sheet.getCell(`${DATATYPECOLUMN}${rowNum}`));
      // Preserve the exclusion of custom, reference and composite parameters.
      if (!paramType || paramType === 'composite' || paramType === 'reference') {
        continue;
      }
      const prefix = `${serviceBaseUrl}/${resourceType}?_count=1&_format=json&`;
      const url = paramType === 'date' || paramType === 'dateTime'
        ? `${prefix}${paramName}=gt1000-01-01`
        : paramType === 'Quantity' || paramType === 'quantity'
        ? `${prefix}_filter=${paramName}%20ne%20000`
        : `${prefix}_filter=${paramName}%20ne%20zzz`;
      logger.log(url);
      const available = await queryServer(url);
      if (typeof available !== 'boolean') {
        throw new Error(`Expected boolean data availability for ${url}`);
      }
      logger.log(`${available ? 'Show' : 'Hide'}! ${resourceType} ${paramName}`);
      updateSearchParamInfo(
        availabilityOfData, serviceBaseUrl, resourceType, rowNum, sheet, available,
        arrayFormulaRanges
      );
    }
  }

  updateColumnRows(sheets, availabilityOfData);
  await replaceWorkbook(workbook, filePath, writeWorkbook);
  return workbook;
}


if (require.main === module) {
  updateExcelConfigurations().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { updateExcelConfigurations, querySearchParameter, getCellValue };
