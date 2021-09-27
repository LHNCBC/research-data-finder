/**
 * This program updates src/conf/xlsx/column-and-parameter-descriptions.xlsx for show/hide
 * properties of search parameters, depending on whether server has data.
 * When server data might have updated, run:
 *     node update-excel-configurations.js
 *     npm run build
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

/**
 * Constructs data of a sheet row to be used by write-excel-file library.
 * @param sheet WorkSheet object
 * @param rowNum current row number in the sheet
 * @param columnCount total number of columns
 */
function getRowData(sheet, rowNum, columnCount) {
  const row = [];
  for (let i = 0; i < columnCount; i++) {
    const cell = sheet[`${xlsxColumnHeaders[i]}${rowNum}`];
    if (!cell) {
      row.push({ value: '' });
    } else if (cell.s.fgColor) {
      row.push({ value: cell.v, backgroundColor: `#${cell.s.fgColor.rgb}` });
    } else {
      row.push({ value: cell.v });
    }
  }
  return row;
}

fs.unlinkSync(filePath);
const httpPromises = [];
// Update first 2 sheets to hide search parameters that don't have data on the corresponding server.
for (let i = 0; i < 2; i++) {
  const sheet = file.Sheets[file.SheetNames[i]];
  let serviceBaseUrl = '';
  let resourceType;
  const maxRowNumber = sheet['!ref'].slice(4);
  for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
    if (sheet[`A${rowNum}`]?.v) {
      resourceType = sheet[`A${rowNum}`]?.v;
      if (sheet[`A${rowNum}`]?.v === SERVICEBASEURL) {
        serviceBaseUrl = sheet[`B${rowNum}`]?.v;
      }
    }
    if (sheet[`C${rowNum}`]?.v === SEARCHPARAMETER) {
      const url = `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${
        sheet[`B${rowNum}`].v
      }:not=zzz`;
      const promise = new Promise((resolve, _) => {
        https.get(url, (res) => {
          const { statusCode } = res;
          if (statusCode < 200 || statusCode >= 300) {
            console.error(
              `Hide! ${resourceType} ${
                sheet[`B${rowNum}`].v
              } - HTTPS failed with code ${statusCode}`
            );
            sheet[`E${rowNum}`].v = 'hide';
            resolve();
          }
          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            const parsedData = JSON.parse(rawData);
            if (parsedData.entry && parsedData.entry.length > 0) {
              console.log(`Show! ${resourceType} ${sheet[`B${rowNum}`].v}`);
              sheet[`E${rowNum}`].v = 'show';
              resolve();
            } else {
              console.log(`Hide! ${resourceType} ${sheet[`B${rowNum}`].v}`);
              sheet[`E${rowNum}`].v = 'hide';
              resolve();
            }
          });
        });
      });
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
  writeXlsxFile(sheetsData, {
    sheets: file.SheetNames,
    filePath
  });
});
