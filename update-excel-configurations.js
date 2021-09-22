const reader = require('xlsx');
const fs = require('fs');

const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const filePath_old = 'src/conf/xlsx/column-and-parameter-descriptions_old.xlsx';
const file = reader.readFile(filePath);
fs.rename(filePath, filePath_old, () => {
  const sheets = file.SheetNames;
  for (let i = 0; i < sheets.length; i++) {
    if (i !== 0) {
      break;
    }
    let data = [];
    const temp = reader.utils.sheet_to_json(file.Sheets[file.SheetNames[i]], {
      header: 'A',
      blankrows: true
    });
    temp.forEach((res) => {
      if (res.__EMPTY_1 === 'search parameter') {
        res.__EMPTY_3 = 'hide';
      }
      data.push(res);
    });
    console.log(data);

    const ws = reader.utils.json_to_sheet(data, {
      header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      skipHeader: true
    });
    const wb = reader.utils.book_new();
    reader.utils.book_append_sheet(wb, ws, 'Sheet3');
    reader.writeFile(wb, filePath);
  }
});
