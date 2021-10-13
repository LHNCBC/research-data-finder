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
const COLUMN = 'column';
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
 * Makes https request to server, retries if server returns 429 or 502.
 */
function callServer(resolve, url, resourceType, rowNum, sheet, retryCount = 0) {
  https.get(url, (res) => {
    const { statusCode } = res;
    const paramName = sheet[`B${rowNum}`].v;
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
// for (let i = 0; i < file.SheetNames.length; i++) {
//   const sheet = file.Sheets[file.SheetNames[i]];
//   let serviceBaseUrl = '';
//   let resourceType;
//   // sheet['!ref'] returns the sheet range as in format 'A1:H100'.
//   const maxRowNumber = sheet['!ref'].slice(4);
//   for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
//     if (sheet[`A${rowNum}`]?.v) {
//       resourceType = sheet[`A${rowNum}`]?.v;
//       if (sheet[`A${rowNum}`]?.v === SERVICEBASEURL) {
//         serviceBaseUrl = sheet[`B${rowNum}`]?.v;
//         // Do not update default sheet.
//         if (serviceBaseUrl === 'default') {
//           break;
//         }
//       }
//     }
//     if (
//       sheet[`C${rowNum}`]?.v === SEARCHPARAMETER &&
//       !doNotUpdateList.some(
//         (x) => x[0] === resourceType && x[1].test(sheet[`B${rowNum}`]?.v)
//       )
//     ) {
//       const paramName = sheet[`B${rowNum}`].v;
//       const paramType = sheet[`F${rowNum}`].v;
//       const url =
//         paramType === 'date' || paramType === 'dateTime'
//           ? `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}=gt1000-01-01`
//           : `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${paramName}:not=zzz`;
//       const promise = createHttpsPromise(url, resourceType, rowNum, sheet);
//       httpPromises.push(promise);
//     }
//   }
// }

function camelCaseToHyphenated(camel) {
  return camel
    .split(/(?=[A-Z])/)
    .join('_')
    .toLowerCase();
}

function getShowHideValueFromMultipleTypes(sheet, rowNum) {
  const reg = `^${RegExp.$1}-?.*$`;
  const regEx = new RegExp(reg);
  let showHide;
  let rowNumLow = rowNum - 1;
  while (
    regEx.test(sheet[`B${rowNumLow}`]?.v) &&
    sheet[`C${rowNumLow}`].v === SEARCHPARAMETER
  ) {
    showHide = sheet[`E${rowNumLow}`].v;
    if (showHide === 'show') {
      return showHide;
    }
    rowNumLow--;
  }
  let rowNumHigh = rowNum + 1;
  while (
    regEx.test(sheet[`B${rowNumHigh}`]?.v) &&
    sheet[`C${rowNumHigh}`].v === SEARCHPARAMETER
  ) {
    showHide = sheet[`E${rowNumHigh}`].v;
    if (showHide === 'show') {
      return showHide;
    }
    rowNumLow++;
  }
  return showHide;
}

function paintRow(sheet, rowNum, columnCount, color) {
  console.log(`Row number ${rowNum}, color ${color}`);
  for (let i = 0; i < columnCount; i++) {
    sheet[`${xlsxColumnHeaders[i]}${rowNum}`].s = {
      patternType: 'solid',
      fgColor: { rgb: color },
      bgColor: { indexed: 64 }
    };
  }
}

function updateColumnRows() {
  for (let i = 0; i < file.SheetNames.length; i++) {
    const sheet = file.Sheets[file.SheetNames[i]];
    // Do not update sheets without cell colors (the default sheet).
    if (sheet['A1']?.v !== 'Legend') {
      continue;
    }
    const colorWithData = sheet['A3'].s.fgColor.rgb;
    const colorWithoutData = sheet['A4'].s.fgColor.rgb;
    const colorLegend = {
      show: colorWithData,
      hide: colorWithoutData
    };
    console.log(colorLegend);
    const maxRowNumber = sheet['!ref'].slice(4);
    const maxColumnLetter = sheet['!ref'].charAt(3);
    const columnCount =
      xlsxColumnHeaders.findIndex((x) => x === maxColumnLetter) + 1;
    for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
      if (sheet[`C${rowNum}`]?.v !== COLUMN) {
        continue;
      }
      const fhirName = sheet[`B${rowNum}`].v;
      if (
        (sheet[`B${rowNum - 1}`]?.v === fhirName ||
          sheet[`B${rowNum - 1}`]?.v === camelCaseToHyphenated(fhirName)) &&
        sheet[`C${rowNum - 1}`].v === SEARCHPARAMETER
      ) {
        const updateShowHideValue = sheet[`E${rowNum - 1}`].v;
        sheet[`E${rowNum}`].v = updateShowHideValue;
        paintRow(sheet, rowNum, columnCount, colorLegend[updateShowHideValue]);
        continue;
      }
      if (
        (sheet[`B${rowNum + 1}`]?.v === fhirName ||
          sheet[`B${rowNum + 1}`]?.v === camelCaseToHyphenated(fhirName)) &&
        sheet[`C${rowNum + 1}`].v === SEARCHPARAMETER
      ) {
        const updateShowHideValue = sheet[`E${rowNum + 1}`].v;
        sheet[`E${rowNum}`].v = updateShowHideValue;
        paintRow(sheet, rowNum, columnCount, colorLegend[updateShowHideValue]);
        continue;
      }
      if (/^(.+)\[x\]$/.test(fhirName)) {
        const updateShowHideValue = getShowHideValueFromMultipleTypes(
          sheet,
          rowNum
        );
        if (updateShowHideValue !== undefined) {
          paintRow(
            sheet,
            rowNum,
            columnCount,
            colorLegend[updateShowHideValue]
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
