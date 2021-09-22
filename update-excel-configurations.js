const reader = require('xlsx');
const fs = require('fs');

const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const filePath_old = 'src/conf/xlsx/column-and-parameter-descriptions_old.xlsx';
const file = reader.readFile(filePath);
//fs.rename(filePath, filePath_old, () => {
const sheets = file.SheetNames;
const wb = reader.utils.book_new();
for (let i = 0; i < sheets.length; i++) {
  let data = [];
  const temp = reader.utils.sheet_to_json(file.Sheets[file.SheetNames[i]], {
    header: 'A',
    blankrows: true
  });
  temp.forEach((res) => {
    if (res.C === 'search parameter') {
      res.E = 'hide';
    }
    data.push(res);
  });
  console.log(data);

  const ws = reader.utils.json_to_sheet(data, {
    header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    skipHeader: true
  });
  reader.utils.book_append_sheet(wb, ws, file.SheetNames[i]);
}
reader.writeFile(wb, filePath_old);
//});
