const reader = require('xlsx');
const fs = require('fs');
const https = require('https');

const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const filePath_old = 'src/conf/xlsx/column-and-parameter-descriptions_old.xlsx';
const file = reader.readFile(filePath);

//fs.rename(filePath, filePath_old, () => {
const sheets = file.SheetNames;
const wb = reader.utils.book_new();
const sheetPromises = [];
// update first 2 sheets to hide search parameters that don't have data on the corresponding server.
for (let i = 0; i < 2; i++) {
  let data = [];
  const sheetJsonObj = reader.utils.sheet_to_json(
    file.Sheets[file.SheetNames[i]],
    {
      header: 'A',
      blankrows: true
    }
  );
  const serviceBaseUrl = sheetJsonObj[8].B;
  const httpPromises = [];
  let resourceType;
  sheetJsonObj.forEach((row) => {
    if (row.A) {
      resourceType = row.A;
    }
    if (row.C === 'search parameter') {
      const url = `${serviceBaseUrl}/${resourceType}?_count=1&_type=json&${row.B}:not=zzz`;
      const promise = new Promise((resolve, reject) => {
        https.get(url, (res) => {
          const { statusCode } = res;
          if (statusCode !== 200) {
            console.error(
              `Status! ${row.B} hide - HTTPS failed with code ${statusCode}`
            );
            row.E = 'hide';
            reject();
          }
          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              if (parsedData.entry && parsedData.entry.length > 0) {
                console.log(`Success! ${row.B} show.`);
                row.E = 'show';
                resolve();
              } else {
                console.log(`Length! ${row.B} hide.`);
                row.E = 'hide';
                reject();
              }
            } catch (e) {
              console.error(e.message);
              row.E = 'hide';
              reject();
            }
          });
        });
      });
      httpPromises.push(promise);
    }
    data.push(row);
  });

  const sheetPromise = Promise.allSettled(httpPromises).then(() => {
    const ws = reader.utils.json_to_sheet(data, {
      header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      skipHeader: true
    });
    reader.utils.book_append_sheet(wb, ws, file.SheetNames[i]);
  });
  sheetPromises.push(sheetPromise);
}

Promise.all(sheetPromises).then(() => {
  reader.writeFile(wb, filePath_old);
});
//});
