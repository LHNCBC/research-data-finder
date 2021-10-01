/**
 * This program updates src/conf/xlsx/column-and-parameter-descriptions.xlsx for show/hide
 * properties of search parameters, depending on whether server has data.
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
const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const file = reader.readFile(filePath, { cellStyles: true });
const xlsxColumnHeaders = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const doNotUpdateList = [
  ['Observation', /^code text$/],
  ['Patient', /^name$/],
  ['Patient', /^family$/],
  ['Patient', /^given$/],
  ['Patient', /^address$/],
  ['Patient', /^address-.+$/],
  ['Observation', /^.*value-.+$/]
];

/**
 * Constructs data of a sheet row to be used by write-excel-file library.
 * @param sheet WorkSheet object
 * @param rowNum current row number in the sheet
 * @param columnCount total number of columns
 */
function getRowData(sheet, rowNum, columnCount) {
  const firstCellValue = sheet[`A${rowNum}`]?.v;
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
 * Makes https request to server, retries if server returns 429.
 */
function callServer(resolve, url, resourceType, rowNum, sheet, retryCount = 0) {
  https.get(url, (res) => {
    const { statusCode } = res;
    const paramName = sheet[`B${rowNum}`].v;
    if (statusCode === 429) {
      console.log(
        `Hide! ${resourceType} ${paramName} - HTTPS returned code 429, retrying... ${++retryCount}`
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
      sheet[`E${rowNum}`].v = 'hide';
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
        sheet[`E${rowNum}`].v = 'show';
        resolve();
      } else {
        console.log(`Hide! ${resourceType} ${paramName}`);
        sheet[`E${rowNum}`].v = 'hide';
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
  const maxRowNumber = sheet['!ref'].slice(4);
  for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
    if (sheet[`A${rowNum}`]?.v) {
      resourceType = sheet[`A${rowNum}`]?.v;
      if (sheet[`A${rowNum}`]?.v === SERVICEBASEURL) {
        serviceBaseUrl = sheet[`B${rowNum}`]?.v;
        // Do not update default sheet.
        if (serviceBaseUrl === 'default') {
          break;
        }
      }
    }
    if (
      sheet[`C${rowNum}`]?.v === SEARCHPARAMETER &&
      !doNotUpdateList.some(
        (x) => x[0] === resourceType && x[1].test(sheet[`B${rowNum}`]?.v)
      )
    ) {
      const paramName = sheet[`B${rowNum}`].v;
      const paramType = sheet[`F${rowNum}`].v;
      const url =
        paramType === 'date' || paramType === 'dateTime'
          ? `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}=gt1000-01-01`
          : `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}:not=zzz`;
      const promise = createHttpsPromise(url, resourceType, rowNum, sheet);
      httpPromises.push(promise);
    }
  }
}

Promise.all(httpPromises).then(() => {
  const sheetsData = [];
  for (let i = 0; i < file.SheetNames.length; i++) {
    const sheet = file.Sheets[file.SheetNames[i]];
    const maxRowNumber = sheet['!ref'].slice(4);
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
