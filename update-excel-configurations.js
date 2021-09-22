const reader = require('xlsx');
const file = reader.readFile(
  'src/conf/xlsx/column-and-parameter-descriptions.xlsx'
);
const sheets = file.SheetNames;
for (let i = 0; i < sheets.length; i++) {
  if (i !== 0) {
    break;
  }
  let data = [];
  const temp = reader.utils.sheet_to_json(file.Sheets[file.SheetNames[i]]);
  temp.forEach((res) => {
    if (res.__EMPTY_1 === 'search parameter') {
      res.__EMPTY_3 = 'hide';
    }
    data.push(res);
  });
  console.log(data);

  const ws = reader.utils.json_to_sheet(data);
  reader.utils.book_append_sheet(file, ws, 'Sheet3');
  reader.writeFile(
    file,
    'src/conf/xlsx/column-and-parameter-descriptions.xlsx'
  );
}
