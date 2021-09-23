/**
 * This program updates src/conf/xlsx/column-and-parameter-descriptions.xlsx for show/hide
 * properties of search parameters, depending on whether server has data.
 * When server data might have updated, run this program by:
 *     node update-excel-configurations.js
 * and check in configuration file changes.
 */
const reader = require('xlsx');
const fs = require('fs');
const https = require('https');

const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const file = reader.readFile(filePath, { cellStyles: true });
fs.unlinkSync(filePath);
const httpPromises = [];
// Update first 2 sheets to hide search parameters that don't have data on the corresponding server.
for (let i = 0; i < 2; i++) {
  const sheet = file.Sheets[file.SheetNames[i]];
  const serviceBaseUrl = sheet['B9'].v;
  const maxRowNumber = sheet['!ref'].slice(4);
  let resourceType;
  for (let rowNum = 12; rowNum <= maxRowNumber; rowNum++) {
    resourceType = sheet[`A${rowNum}`]?.v || resourceType;
    if (sheet[`C${rowNum}`]?.v === 'search parameter') {
      const url = `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${
        sheet[`B${rowNum}`].v
      }:not=zzz`;
      const promise = new Promise((resolve, reject) => {
        https.get(url, (res) => {
          const { statusCode } = res;
          if (statusCode < 200 || statusCode >= 300) {
            console.error(
              `Hide! ${resourceType} ${
                sheet[`B${rowNum}`].v
              } - HTTPS failed with code ${statusCode}`
            );
            sheet[`E${rowNum}`].v = 'hide';
            reject();
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
              reject();
            }
          });
        });
      });
      httpPromises.push(promise);
    }
  }
}

Promise.allSettled(httpPromises).then(() => {
  reader.writeFile(file, filePath);
});
