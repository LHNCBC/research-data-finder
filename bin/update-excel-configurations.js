/**
 * This program updates src/conf/xlsx/column-and-parameter-descriptions.xlsx for show/hide
 * properties of search parameters, depending on whether server has data.
 * It then updates show/hide properties of columns, based on adjacent search parameter rows.
 * When server data might have updated, run:
 *     npm run update-excel-config
 * and check in configuration file changes.
 */
const reader = require('xlsx');
const fs = require('fs');
const https = require('https');
const writeXlsxFile = require('write-excel-file/node');

const SERVICEBASEURL = '---SERVICE BASE URL:';
const SEARCHPARAMETER = 'search parameter';
const COLUMN = 'column';
const RESOURCETYPECOLUMN = 'A';
const FHIRNAMECOLUMN = 'B';
const TYPECOLUMN = 'C';
const SHOWHIDECOLUMN = 'E';
const DATATYPECOLUMN = 'F';
const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const file = reader.readFile(filePath, { cellStyles: true });
const xlsxColumnHeaders = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const doNotUpdateList = [
  ['*', /^code text$/],
  ['Observation', /^code text$/],
  ['Patient', /^name$/],
  ['Patient', /^family$/],
  ['Patient', /^given$/],
  ['Patient', /^address$/],
  ['Patient', /^address-.+$/],
  ['Observation', /^.*value-.+$/],
  ['Observation', /^code$/],
  ['Observation', /^combo-code$/],
  ['Observation', /^component-code$/],
  ['Observation', /^identifier$/]
];

/**
 * Constructs data of a sheet row to be used by write-excel-file library.
 * @param sheet WorkSheet object
 * @param rowNum current row number in the sheet
 * @param columnCount total number of columns
 */
function getRowData(sheet, rowNum, columnCount) {
  const firstCellValue = sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v;
  const isBold =
    firstCellValue === 'Legend' || firstCellValue === 'Resource type';
  const row = [];
  for (let i = 0; i < columnCount; i++) {
    const cell = sheet[`${xlsxColumnHeaders[i]}${rowNum}`];
    if (!cell) {
      row.push({ value: '' });
      continue;
    }
    let data = { value: cell.v };
    if (cell.s.fgColor) {
      data.backgroundColor = `#${cell.s.fgColor.rgb}`;
    }
    if (isBold) {
      data.fontWeight = 'bold';
    }
    row.push(data);
  }
  return row;
}

/**
 * Creates a promise that will resolve after trying to query server with the search parameter.
 * Updates sheet object for show/hide column.
 * @param url server query to determine if the search parameter has value
 * @param resourceType resource type
 * @param rowNum row number
 * @param sheet WorkSheet object
 */
function createHttpsPromise(url, resourceType, rowNum, sheet) {
  console.log(url);
  return new Promise((resolve, _) => {
    callServer(resolve, url, resourceType, rowNum, sheet);
  });
}

/**
 * Makes https request to server, retries if server returns 429 or 502.
 */
function callServer(resolve, url, resourceType, rowNum, sheet, retryCount = 0) {
  https.get(url, (res) => {
    const { statusCode } = res;
    const paramName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
    if (statusCode === 429 || statusCode === 502) {
      console.log(
        `Hide! ${resourceType} ${paramName} - HTTPS returned code ${statusCode}, retrying... ${++retryCount}`
      );
      setTimeout(() => {
        callServer(resolve, url, resourceType, rowNum, sheet, retryCount);
      }, 1000);
      return;
    }
    if (statusCode < 200 || statusCode >= 300) {
      console.error(
        `Hide! ${resourceType} ${paramName} - HTTPS failed with code ${statusCode}`
      );
      sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = 'hide';
      resolve();
      return;
    }
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => {
      rawData += chunk;
    });
    res.on('end', () => {
      const parsedData = JSON.parse(rawData);
      if (parsedData.entry && parsedData.entry.length > 0) {
        console.log(`Show! ${resourceType} ${paramName}`);
        sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = 'show';
        resolve();
      } else {
        console.log(`Hide! ${resourceType} ${paramName}`);
        sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = 'hide';
        resolve();
      }
    });
  });
}

fs.unlinkSync(filePath);
const httpPromises = [];
// Update sheets to hide search parameters that don't have data on the corresponding server.
for (let i = 0; i < file.SheetNames.length; i++) {
  const sheet = file.Sheets[file.SheetNames[i]];
  let serviceBaseUrl = '';
  let resourceType;
  // sheet['!ref'] returns the sheet range as in format 'A1:H100'.
  const maxRowNumber = +sheet['!ref'].slice(4);
  for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
    if (sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v) {
      resourceType = sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v;
      if (sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v === SERVICEBASEURL) {
        serviceBaseUrl = sheet[`${FHIRNAMECOLUMN}${rowNum}`]?.v;
        // Do not update default sheet.
        if (serviceBaseUrl === 'default') {
          break;
        }
      }
    }
    if (
      sheet[`${TYPECOLUMN}${rowNum}`]?.v === SEARCHPARAMETER &&
      !doNotUpdateList.some(
        (x) =>
          (x[0] === '*' || x[0] === resourceType) &&
          x[1].test(sheet[`${FHIRNAMECOLUMN}${rowNum}`]?.v)
      )
    ) {
      const paramName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
      const paramType = sheet[`${DATATYPECOLUMN}${rowNum}`].v;
      const url =
        paramType === 'date' || paramType === 'dateTime'
          ? `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}=gt1000-01-01`
          : `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}:not=zzz`;
      const promise = createHttpsPromise(url, resourceType, rowNum, sheet);
      httpPromises.push(promise);
    }
  }
}

/**
 * Converts a camel case string into a hyphenated string.
 * Examples: bodySite -> body-site, episodeOfCare -> episode-of-care.
 */
function camelCaseToHyphenated(camel) {
  return camel
    .split(/(?=[A-Z])/)
    .join('-')
    .toLowerCase();
}

/**
 * Looks for matching search parameter rows of a '...[x]' column and
 * returns 'show' if any of those rows has 'show', otherwise return 'hide'.
 * If no rows match at all, return undefined.
 * Examples of matching fhir names of 'abatement[x]':
 * 'abatement', 'abatement-age', 'abatement-date', 'abatement-string'.
 * @param sheet WorkSheet object
 * @param rowNum row number corresponding to the '...[x]' column
 * @param baseString the '...' part of a '...[x]' fhir name
 * @param startRow range of rows to search for matches
 * @param endRow range of rows to search for matches
 */
function getShowHideValueFromMultipleTypes(
  sheet,
  rowNum,
  baseString,
  startRow,
  endRow
) {
  const reg = `^${baseString}-?.*$`;
  const regEx = new RegExp(reg);
  let showHide;
  for (let i = startRow; i <= endRow; i++) {
    if (
      i !== rowNum &&
      regEx.test(sheet[`${FHIRNAMECOLUMN}${i}`]?.v) &&
      sheet[`${TYPECOLUMN}${i}`].v === SEARCHPARAMETER
    ) {
      showHide = sheet[`${SHOWHIDECOLUMN}${i}`].v;
      if (showHide === 'show') {
        return showHide;
      }
    }
  }
  return showHide;
}

/**
 * Looks for a matching search parameter row of a column row and
 * returns its show/hide value.
 * If no rows match at all, return undefined.
 * Examples of matching fhir names:
 * 'relatesTo' vs 'relatesto', 'bodySite' vs 'body-site'.
 * @param sheet WorkSheet object
 * @param rowNum row number to be matched
 * @param fhirName fhir name to be matched
 * @param startRow range of rows to search for matches
 * @param endRow range of rows to search for matches
 */
function getShowHideValueFromSingleMatch(
  sheet,
  rowNum,
  fhirName,
  startRow,
  endRow
) {
  let showHide;
  for (let i = startRow; i <= endRow; i++) {
    if (
      i !== rowNum &&
      (sheet[`${FHIRNAMECOLUMN}${i}`]?.v?.toLowerCase() ===
        fhirName.toLowerCase() ||
        sheet[`${FHIRNAMECOLUMN}${i}`]?.v ===
          camelCaseToHyphenated(fhirName)) &&
      sheet[`${TYPECOLUMN}${i}`].v === SEARCHPARAMETER
    ) {
      showHide = sheet[`${SHOWHIDECOLUMN}${i}`].v;
      return showHide;
    }
  }
  // noinspection JSUnusedAssignment
  return showHide;
}

/**
 * Paints a single row into a specific color.
 * @param sheet WorkSheet object
 * @param rowNum row number to be painted
 * @param columnCount total column count
 * @param color the color this row will be painted into
 * @param doNotUpdateColor a special case that a cell will not be painted if it had this color
 */
function paintRow(sheet, rowNum, columnCount, color, doNotUpdateColor) {
  for (let i = 0; i < columnCount; i++) {
    if (
      sheet[`${xlsxColumnHeaders[i]}${rowNum}`].s?.fgColor?.rgb !==
      doNotUpdateColor
    )
      sheet[`${xlsxColumnHeaders[i]}${rowNum}`].s = {
        patternType: 'solid',
        fgColor: { rgb: color },
        bgColor: { indexed: 64 }
      };
  }
}

/**
 * Updates show/hide values and row colors for columns, based on show/hide values
 * of corresponding search parameters.
 */
function updateColumnRows() {
  for (let i = 0; i < file.SheetNames.length; i++) {
    const sheet = file.Sheets[file.SheetNames[i]];
    // Do not update sheets without cell colors (the default sheet).
    if (sheet['A1']?.v !== 'Legend') {
      continue;
    }
    const colorWithData = sheet['A3'].s.fgColor.rgb;
    const colorWithoutData = sheet['A4'].s.fgColor.rgb;
    const doNotUpdateColor = sheet['A5'].s.fgColor.rgb;
    const colorLegend = {
      show: colorWithData,
      hide: colorWithoutData
    };
    const maxRowNumber = +sheet['!ref'].slice(4);
    const maxColumnLetter = sheet['!ref'].charAt(3);
    const columnCount =
      xlsxColumnHeaders.findIndex((x) => x === maxColumnLetter) + 1;

    // Row numbers of resource type rows.
    // Used to divide rows into resource type groups for matching.
    const resourceTypeRows = [];
    for (
      let rowNum = 1, startLogging = false;
      rowNum <= maxRowNumber;
      rowNum++
    ) {
      if (sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v === 'Resource type') {
        startLogging = true;
        continue;
      }
      if (startLogging && sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v) {
        resourceTypeRows.push(rowNum);
      }
    }
    resourceTypeRows.push(maxRowNumber + 1);
    console.log(resourceTypeRows);

    for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
      if (sheet[`${TYPECOLUMN}${rowNum}`]?.v !== COLUMN) {
        continue;
      }
      const fhirName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
      // Do not update "subject" column show/hide. It refers to a patient.
      if (fhirName === 'subject') {
        continue;
      }
      // Keep medication column shown, since it's the main "code" field of
      // MedicationDispense and MedicationRequest.
      if (fhirName === 'medication[x]') {
        continue;
      }
      // Keep value column shown, since it's the main field of Observation.
      if (fhirName === 'value[x]') {
        continue;
      }
      // Finds which section of resource type current rowNum belongs to.
      const resourceTypeSectionIndex = resourceTypeRows.findIndex(
        (element, index, array) => rowNum > element && rowNum < array[index + 1]
      );
      if (/^(.+)\[x]$/.test(fhirName)) {
        const updateShowHideValue = getShowHideValueFromMultipleTypes(
          sheet,
          rowNum,
          RegExp.$1,
          resourceTypeRows[resourceTypeSectionIndex] + 1,
          resourceTypeRows[resourceTypeSectionIndex + 1] - 1
        );
        if (updateShowHideValue !== undefined) {
          sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = updateShowHideValue;
          paintRow(
            sheet,
            rowNum,
            columnCount,
            colorLegend[updateShowHideValue],
            doNotUpdateColor
          );
        }
      } else {
        const updateShowHideValue = getShowHideValueFromSingleMatch(
          sheet,
          rowNum,
          fhirName,
          resourceTypeRows[resourceTypeSectionIndex] + 1,
          resourceTypeRows[resourceTypeSectionIndex + 1] - 1
        );
        if (updateShowHideValue !== undefined) {
          sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = updateShowHideValue;
          paintRow(
            sheet,
            rowNum,
            columnCount,
            colorLegend[updateShowHideValue],
            doNotUpdateColor
          );
        }
      }
    }
  }
}

Promise.all(httpPromises).then(() => {
  updateColumnRows();
  const sheetsData = [];
  for (let i = 0; i < file.SheetNames.length; i++) {
    const sheet = file.Sheets[file.SheetNames[i]];
    const maxRowNumber = +sheet['!ref'].slice(4);
    const maxColumnLetter = sheet['!ref'].charAt(3);
    const columnCount =
      xlsxColumnHeaders.findIndex((x) => x === maxColumnLetter) + 1;
    const sheetData = [];
    for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
      sheetData.push(getRowData(sheet, rowNum, columnCount));
    }
    sheetsData.push(sheetData);
  }
  // Writing with column width data from 1st sheet, since you can only pass in one column width array.
  const columns = file.Sheets[file.SheetNames[0]]['!cols'];
  writeXlsxFile(sheetsData, {
    sheets: file.SheetNames,
    columns,
    filePath
  });
});
