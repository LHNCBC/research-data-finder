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
  ['Observation', /^observation value$/],
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
 * @param serviceBaseUrl server base URL
 * @param resourceType resource type
 * @param rowNum row number
 * @param sheet WorkSheet object
 */
function createHttpsPromise(serviceBaseUrl, resourceType, rowNum, sheet) {
  return new Promise((resolve, _) => {
    callServer(resolve, serviceBaseUrl, resourceType, rowNum, sheet);
  });
}

/**
 * Makes https request to server, retries if server returns 429 or 502.
 */
function callServer(
  resolve,
  serviceBaseUrl,
  resourceType,
  rowNum,
  sheet,
  retryCount = 0
) {
  const paramName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
  const paramType = sheet[`${DATATYPECOLUMN}${rowNum}`].v;
  if (!paramType || paramType === 'composite' || paramType === 'reference') {
    // Skip custom, reference and composite parameters
    resolve();
    return;
  }
  const url =
    paramType === 'date' || paramType === 'dateTime'
      ? `${serviceBaseUrl}/${resourceType}?_count=1&_format=json&${paramName}=gt1000-01-01`
      : paramType === 'Quantity' || paramType === 'quantity'
      ? `${serviceBaseUrl}/${resourceType}?_count=1&_format=json&_filter=${paramName}%20ne%20000`
      : `${serviceBaseUrl}/${resourceType}?_count=1&_format=json&_filter=${paramName}%20ne%20zzz`;
  console.log(url);

  https.get(url, (res) => {
    const { statusCode } = res;
    const paramName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
    if (statusCode === 429 || statusCode === 502) {
      console.log(
        `${resourceType} ${paramName} - HTTPS returned code ${statusCode}, retrying... ${++retryCount}`
      );
      setTimeout(() => {
        callServer(
          resolve,
          serviceBaseUrl,
          resourceType,
          rowNum,
          sheet,
          retryCount
        );
      }, 1000);
      return;
    }
    if (statusCode < 200 || statusCode >= 300) {
      console.error(
        `Hide! ${resourceType} ${paramName} - HTTPS failed with code ${statusCode}`
      );
      updateSearchParamInfo(serviceBaseUrl, resourceType, rowNum, sheet, false);
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
        updateSearchParamInfo(
          serviceBaseUrl,
          resourceType,
          rowNum,
          sheet,
          true
        );
        resolve();
      } else {
        console.log(`Hide! ${resourceType} ${paramName}`);
        updateSearchParamInfo(
          serviceBaseUrl,
          resourceType,
          rowNum,
          sheet,
          false
        );
        resolve();
      }
    });
  });
}

/**
 * Object to store the availability of data:
 * {
 *   <serviceBaseUrl>: {
 *     <resourceType>: {
 *       <parameterName>: boolean
 *     }
 *   }
 * }
 */
const availabilityOfData = {};

/**
 * Updates the show/hide column for the search parameter and stores the data
 * availability flag used to update the visibility of the column.
 * @param serviceBaseUrl server base URL
 * @param resourceType resource type
 * @param rowNum row number
 * @param sheet WorkSheet object
 * @param hasData data availability flag (true/false)
 */
function updateSearchParamInfo(
  serviceBaseUrl,
  resourceType,
  rowNum,
  sheet,
  hasData
) {
  const paramName = sheet[`${FHIRNAMECOLUMN}${rowNum}`].v;
  if (
    !doNotUpdateList.some(
      (x) => (x[0] === '*' || x[0] === resourceType) && x[1].test(paramName)
    )
  ) {
    sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = hasData ? 'show' : 'hide';
  }
  availabilityOfData[serviceBaseUrl] = availabilityOfData[serviceBaseUrl] || {};
  availabilityOfData[serviceBaseUrl][resourceType] =
    availabilityOfData[serviceBaseUrl][resourceType] || {};
  availabilityOfData[serviceBaseUrl][resourceType][paramName] = hasData;
}

/**
 *  Looks for a matching search parameter with the specified FHIR name and
 *  returns true/false value depending on data availability for that search
 *  parameter. If none of the search parameters match, returns undefined.
 * @param serviceBaseUrl server base URL
 * @param resourceType resource type
 * @param fhirName FHIR name
 * @return {true|false|undefined}
 */
function hasData(serviceBaseUrl, resourceType, fhirName) {
  let paramNames;
  if (!availabilityOfData[serviceBaseUrl][resourceType]) {
    return undefined;
  }
  if (/^(.+)\[x]$/.test(fhirName)) {
    const baseString = RegExp.$1;
    const reg = `^${baseString}-?.*$`;
    const regEx = new RegExp(reg);

    paramNames = Object.keys(
      availabilityOfData[serviceBaseUrl][resourceType]
    ).filter((paramName) => regEx.test(paramName));
  } else {
    paramNames = Object.keys(
      availabilityOfData[serviceBaseUrl][resourceType]
    ).filter(
      (paramName) =>
        paramName.toLowerCase() === fhirName.toLowerCase() ||
        paramName === camelCaseToHyphenated(fhirName)
    );
  }
  if (paramNames.length) {
    return !!paramNames.find(
      (paramName) => availabilityOfData[serviceBaseUrl][resourceType][paramName]
    );
  } else {
    return undefined;
  }
}

fs.unlinkSync(filePath);
let requestQueuePromise = Promise.resolve();
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
    if (sheet[`${TYPECOLUMN}${rowNum}`]?.v === SEARCHPARAMETER) {
      (function (...args) {
        requestQueuePromise = requestQueuePromise.then(() =>
          createHttpsPromise(...args)
        );
      })(serviceBaseUrl, resourceType, rowNum, sheet);
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
    let serviceBaseUrl = '';
    let resourceType = '';
    // Do not update sheets without cell colors (the default sheet).
    if (sheet['A1']?.v !== 'Legend') {
      continue;
    }
    const colorWithData = sheet['A3'].s.fgColor.rgb;
    const colorWithoutData = sheet['A4'].s.fgColor.rgb;
    const doNotUpdateColor = sheet['A5'].s.fgColor.rgb;
    const colorLegend = {
      withData: colorWithData,
      withoutData: colorWithoutData
    };
    const maxRowNumber = +sheet['!ref'].slice(4);
    const maxColumnLetter = sheet['!ref'].charAt(3);
    const columnCount =
      xlsxColumnHeaders.findIndex((x) => x === maxColumnLetter) + 1;

    for (let rowNum = 1; rowNum <= maxRowNumber; rowNum++) {
      if (sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v === SERVICEBASEURL) {
        serviceBaseUrl = sheet[`${FHIRNAMECOLUMN}${rowNum}`]?.v;
      }

      // The resourceType variable will contain the resource type at the
      // moment when we process the row with the column description
      resourceType = sheet[`${RESOURCETYPECOLUMN}${rowNum}`]?.v || resourceType;

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

      const dataAvailability = hasData(serviceBaseUrl, resourceType, fhirName);
      if (dataAvailability !== undefined) {
        if (dataAvailability) {
          if (sheet[`${SHOWHIDECOLUMN}${rowNum}`].v === 'disable') {
            sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = 'show';
          }
        } else {
          sheet[`${SHOWHIDECOLUMN}${rowNum}`].v = 'disable';
        }
        paintRow(
          sheet,
          rowNum,
          columnCount,
          colorLegend[dataAvailability ? 'withData' : 'withoutData'],
          doNotUpdateColor
        );
      }
    }
  }
}

requestQueuePromise.then(() => {
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
