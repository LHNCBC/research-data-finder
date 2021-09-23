const reader = require('xlsx');
const fs = require('fs');
const https = require('https');

const filePath = 'src/conf/xlsx/column-and-parameter-descriptions.xlsx';
const filePath_old = 'src/conf/xlsx/column-and-parameter-descriptions_old.xlsx';
const file = reader.readFile(filePath, { cellStyles: true });
reader.writeFile(file, filePath_old);
