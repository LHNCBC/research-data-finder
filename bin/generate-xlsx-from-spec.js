/**
 * This file contains the script that I used to create the initial version of the XLSX configuration files.
 * I leave it just for reference. This is not a script that needs to be run regularly.
 */
const writeXlsxFile = require('write-excel-file/node');
const path = require('path');
const fs = require('fs');
const https = require('https');
const dbGapUrl = 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1';
const versionName = process.argv[2] && process.argv[2].toUpperCase();

if (!versionName || (versionName !== 'R4' && versionName !== 'R5')) {
  console.log('Usage: node generate-xlsx-from-spec.js [version]\n');
  console.log(
    'This script can be used to create the initial version of the XLSX configuration files.\n'
  );
  console.log('Parameters:');
  console.log('\tversion - R4 or R5');
  process.exit(1);
}

const webpackOptions = require('../src/app/shared/definitions/webpack-options.json');
const webpackLoader = require('../src/app/shared/definitions/webpack-loader').bind(
  {
    context: path.resolve(__dirname, '../src/app/shared/definitions'),
    getOptions: () => webpackOptions
  }
);
const definitionsIndex = JSON.parse(
  webpackLoader(
    fs.readFileSync(
      path.resolve(__dirname, '../src/app/shared/definitions/index.json')
    )
  )
);

let sheetNames;
let sheetDescriptions;
let urlsPerSheet;
let outputFilename;

if (versionName === 'R4') {
  sheetNames = [
    'Resources on LForms R4 server',
    'Resources on dbGap server',
    'Default R4 resources'
  ];
  sheetDescriptions = [
    ['List of resources that exist on LForms server.'],
    ['List of resources that exist on dbGap server.'],
    [
      'List of all available resources on R4 servers. This sheet is used if no custom configuration is provided.',
      'You can add sheets with a custom configuration for any server. To do that copy this sheet and provide service base URL(s) in the cell next to "---SERVICE BASE URL".'
    ]
  ];

  urlsPerSheet = [
    { 'https://lforms-fhir.nlm.nih.gov/baseR4': true },
    { [dbGapUrl]: true },
    {}
  ];

  outputFilename = 'column-and-parameter-descriptions-R4.xlsx';
} else {
  sheetNames = ['Resources on LForms R5 server', 'Default R5 resources'];
  sheetDescriptions = [
    ['List of resources that exist on LForms R5 server.'],
    [
      'List of all available resources on R5 servers. This sheet is used if no custom configuration is provided.',
      'You can add sheets with a custom configuration for any server. To do that copy this sheet and provide service base URL(s) in the cell next to "---SERVICE BASE URL".'
    ]
  ];
  urlsPerSheet = [{ 'https://lforms-fhir.nlm.nih.gov/baseR5': true }, {}];

  outputFilename = 'column-and-parameter-descriptions-R5.xlsx';
}

/**
 * Definitions of columns, search params, value sets for the FHIR version.
 */
const definitions = (function getCurrentDefinitions() {
  const definitions = definitionsIndex.configByVersionName[versionName];

  // Initialize common definitions
  if (!definitions.initialized) {
    // Add default common column "id"
    Object.keys(definitions.resources).forEach((resourceType) => {
      definitions.resources[resourceType].columnDescriptions.unshift({
        types: ['string'],
        element: 'id',
        isArray: false
      });
    });

    // prepare definitions on first request
    const valueSets = definitions.valueSets;
    const valueSetMaps = (definitions.valueSetMaps = Object.keys(
      valueSets
    ).reduce((valueSetsMap, entityName) => {
      valueSetsMap[entityName] =
        typeof valueSets[entityName] === 'string'
          ? valueSets[entityName]
          : valueSets[entityName].reduce((entityMap, item) => {
              entityMap[item.code] = item.display;
              return entityMap;
            }, {});
      return valueSetsMap;
    }, {}));

    Object.keys(definitions.valueSetByPath).forEach((path) => {
      definitions.valueSetMapByPath[path] =
        valueSetMaps[definitions.valueSetByPath[path]];
      definitions.valueSetByPath[path] =
        valueSets[definitions.valueSetByPath[path]];
    });
    definitions.initialized = true;
  }
  return definitions;
})();

/**
 * The legend background colors for the resulting Excel file.
 */
const legendBackColor = {
  additionalCustomColumn: '#ffe699',
  // neutral: '#ffeb9c',
  // good: '#c6efce',
  // note: '#ffffcc',
  hasData: '#c6e0b4',
  hasNoData: '#d0d0d0',
  unsupported: '#ffc7ce'
};

const resources = definitions.resources;

/**
 * Capitalize the first char and return the string
 */
function capitalize(str) {
  return str && str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Creates an array describing row data for an Excel sheet.
 * @param {string[]} values - cell values, describing search parameter or resource table column.
 * @param {Object} desc - additional options:
 * @param {boolean} desc.isExist - whether there is data on the server for
 *  the resource table column described by this row.
 * @param {boolean} desc.isSupported - whether the datatype is supported by RDF.
 * @param {boolean} desc.custom - whether the Excel row is describing a custom resource
 *  table column.
 * @return {Object[]}
 */
function createRow(values, desc) {
  return values.map((value, i) => ({
    backgroundColor:
      (desc.custom && legendBackColor.additionalCustomColumn) ||
      (i === 5 && desc.isSupported === false && legendBackColor.unsupported) ||
      (desc.isExist === true && legendBackColor.hasData) ||
      (desc.isExist === false && legendBackColor.hasNoData) ||
      '',
    value,
    // Wrap types
    wrap: i === 5,
    alignVertical: 'top'
  }));
}

/**
 * Returns request URL to get samples of records for the specified server and
 * resource type.
 * @param {string} url - server URL.
 * @param {string} resourceType - resource type.
 * @return {string}
 */
function getRequestUrl(url, resourceType) {
  return url + '/' + resourceType + '?_count = 10000';
}

const __cache = {};

/**
 * Returns promise of a bundle with record samples for the specified server and
 * resource type.
 * @param {string} url - server URL.
 * @param {string} resourceType - resource type.
 * @return {Bundle}
 */
function getSampleRecords(url, resourceType) {
  return new Promise((resolve) => {
    const requestUrl = getRequestUrl(url, resourceType);
    const cachedResponse = __cache[requestUrl];
    if (cachedResponse) {
      const err = cachedResponse.error;
      if (err) {
        resolve(null);
      } else {
        resolve(cachedResponse);
      }
    } else {
      https
        .get(requestUrl, (resp) => {
          let data = '';

          // A chunk of data has been received.
          resp.on('data', (chunk) => {
            data += chunk;
          });

          // The whole response has been received. Print out the result.
          resp.on('end', () => {
            if (resp.statusCode === 429) {
              setTimeout(() => {
                getSampleRecords(url, resourceType).then(resolve);
              }, 1000);
            } else {
              const body = JSON.parse(data);
              // TODO: check statusCode?
              __cache[requestUrl] = body;
              resolve(body);
            }
          });
        })
        .on('error', (err) => {
          __cache[requestUrl] = { error: err };
          resolve(null);
        });
    }
  });
}

/**
 * Returns promise of an array of resource types that exist on the all specified
 * servers.
 * @param {string} urls - server URLs.
 * @param {string[]} resourceTypes - resource types to check.
 * @return {string[]}
 */
function getExistingResources(urls, resourceTypes) {
  const result = [];
  return new Promise((resolve) => {
    if (urls.length === 0) {
      resolve(resourceTypes);
    } else {
      const resourceType = resourceTypes.shift();
      Promise.all(
        Object.keys(urls).map((url) =>
          getSampleRecords(url, resourceType).then((data) => ({
            data,
            include: urls[url]
          }))
        )
      ).then((res) => {
        if (
          res
            .filter(({ include }) => include)
            .every(({ data }) => data && data.entry && data.entry.length > 0) &&
          res
            .filter(({ include }) => !include)
            .every(({ data }) => !(data && data.entry && data.entry.length > 0))
        ) {
          result.push(resourceType);
        }
        if (resourceTypes.length) {
          getExistingResources(urls, resourceTypes).then(
            (otherResourceTypes) => {
              result.push(...otherResourceTypes);
              resolve(result);
            }
          );
        } else {
          resolve(result);
        }
      });
    }
  });
}

/**
 * Checks if a column exists for any of the specified servers and the specified
 * resource type.
 * @param {string[]} urls - server URLs.
 * @param {string} resourceType - resource type.
 * @param {string} fhirName - FHIR name e.g. value[x].
 * @param {string[]} types - column type e.g. Quantity.
 * @return {boolean}
 */
function checkIfColumnExists(urls, resourceType, fhirName, types) {
  return urls.some((url) => {
    const data = __cache[getRequestUrl(url, resourceType)];
    if (!data.entry) {
      return false;
    }
    return data.entry.some((entry) => {
      if (fhirName.endsWith('[x]')) {
        return types.some((type) =>
          entry.resource.hasOwnProperty(fhirName.replace(/\[x]$/, type))
        );
      }
      return entry.resource.hasOwnProperty(fhirName);
    });
  });
}

/**
 * Hash of data types supported by RDF.
 */
const supportedTypes = {
  Identifier: true,
  code: true,
  CodeableConcept: true,
  string: true,
  Reference: true,
  Period: true,
  dateTime: true,
  canonical: true,
  uri: true,
  ContactPoint: true,
  Count: true,
  Quantity: true,
  decimal: true,
  Money: true,
  boolean: true,
  instant: true,
  Coding: true,
  Duration: true,
  date: true,
  HumanName: true,
  Address: true
};

const MAGIC_CELL_TEXT = '---SERVICE BASE URL:';

/**
 * Checks if any of the specified data types are supported by RDF
 * @param {string[]} types - data types
 * @return {boolean}
 */
function isTypesSupported(types) {
  return types.filter((type) => supportedTypes[type]).length > 0;
}

/**
 * Returns a sheet of an Excel file.
 * @param {string[]} urls - server URLs used to create the sheet of the Excel file.
 * @param {string[]} sheetDescriptions - an array of string describing the contents
 *  of the sheet.
 * @param {string[]} resourceTypes - resource types.
 * @param {Object} customColumns - description of additional custom columns.
 * @return {Array}
 */
function getSheetData(urls, sheetDescriptions, resourceTypes, customColumns) {
  const sheetData = urls.length
    ? [
        [{ value: 'Legend', fontWeight: 'bold' }],
        [
          {
            value: '',
            backgroundColor: legendBackColor.additionalCustomColumn
          },
          { value: '- additional custom columns or custom search parameters' }
        ],
        [
          { value: '', backgroundColor: legendBackColor.hasData },
          { value: '- columns with data on the FHIR server', type: String }
        ],
        [
          { value: '', backgroundColor: legendBackColor.hasNoData },
          { value: '- columns without data on the FHIR server', type: String }
        ],
        [
          { value: '', backgroundColor: legendBackColor.unsupported },
          { value: '- unsupported type of column', type: String }
        ],
        []
      ]
    : [];

  sheetData.push(
    ...sheetDescriptions.map((desc) => [{ value: desc }]),
    ...[
      [],
      [
        { value: MAGIC_CELL_TEXT, type: String },
        {
          value:
            urls.length === 1 && urls[0] === dbGapUrl
              ? 'dbgap'
              : urls.length
              ? urls.join(',')
              : 'default_' + versionName,
          type: String
        }
      ],
      [],
      [
        { value: 'Resource type', fontWeight: 'bold' },
        { value: 'FHIR name', fontWeight: 'bold' },
        { value: 'Type (column/search parameter)', fontWeight: 'bold' },
        { value: 'Custom name', fontWeight: 'bold' },
        { value: 'Show/Hide', fontWeight: 'bold' },
        { value: 'Data type(s)', fontWeight: 'bold' },
        { value: 'FHIRPath expression', fontWeight: 'bold' },
        { value: 'Description', fontWeight: 'bold' }
      ]
    ]
  );

  resourceTypes.forEach((resourceType) => {
    sheetData.push([{ value: resourceType }]);
    const columns = resources[resourceType].columnDescriptions
      .concat(
        (customColumns[resourceType] || []).map((col) => {
          col.custom = true;
          return col;
        })
      )
      .map((desc) => {
        desc = Object.assign({}, desc);
        if (resourceType === 'Observation' && desc.element === 'code') {
          desc.element = 'codeText';
          desc.displayName = 'Variable Name';
          desc.expression = 'code';
          desc.custom = true;
        }
        if (urls.length && !desc.custom) {
          desc.isExist = checkIfColumnExists(
            urls,
            resourceType,
            desc.element,
            desc.types
          );
        }
        desc.isSupported = isTypesSupported(desc.types);
        return desc;
      })
      .sort((a, b) => a.element.localeCompare(b.element))
      .map((desc) => {
        return createRow(
          [
            '',
            desc.element,
            'column',
            desc.displayName ||
              capitalize(desc.element)
                .replace(/\[x]$/, '')
                .split(/(?=[A-Z])/)
                .join(' '),
            desc.isSupported
              ? desc.isExist !== false || desc.custom
                ? 'show'
                : 'hide'
              : 'hide',
            desc.types.join(','),
            desc.expression || '',
            desc.description
          ],
          desc
        );
      });
    const searchParameters = []
      .concat(
        resourceType === 'Observation'
          ? [
              {
                name: 'code text',
                custom: true,
                description:
                  'The display text associated with the code of the observation type'
              },
              {
                name: 'observation value',
                custom: true,
                description: 'The value of the observation'
              }
            ]
          : [],
        resources[resourceType].searchParameters.sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      )
      .map((desc) =>
        createRow(
          [
            '',
            desc.name,
            'search parameter',
            desc.name,
            resourceType === 'Observation' &&
            /code|value/.test(desc.name) &&
            !desc.custom
              ? 'hide'
              : 'show',
            desc.type,
            '',
            desc.description
          ],
          desc
        )
      );

    sheetData.push(
      ...searchParameters.concat(columns).sort((row1, row2) => {
        if (
          (row1[1].backgroundColor === legendBackColor.additionalCustomColumn &&
            row1[2].value === 'search parameter') ||
          (row2[1].backgroundColor === legendBackColor.additionalCustomColumn &&
            row2[2].value === 'search parameter')
        ) {
          return 0;
        }
        return row1[1].value.localeCompare(row2[1].value);
      })
    );
  });
  return sheetData;
}

Promise.all(
  urlsPerSheet.map((urls) => getExistingResources(urls, Object.keys(resources)))
).then((resourceTypesPerSheet) => {
  const sheetsData = resourceTypesPerSheet.map((resourceTypes, i) => {
    const urls = Object.keys(urlsPerSheet[i]).filter(
      (url) => urlsPerSheet[i][url]
    );
    const customColumns =
      urls.indexOf(dbGapUrl) !== -1
        ? // Additional columns per resource type
          {
            // See these column descriptions here: https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content
            ResearchStudy: [
              {
                displayName: 'Number of Analyses',
                element: 'NumAnalyses',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumAnalyses').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Documents',
                element: 'NumDocuments',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumDocuments').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Molecular Datasets',
                element: 'NumMolecularDatasets',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumMolecularDatasets').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Phenotype Datasets',
                element: 'NumPhenotypeDatasets',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumPhenotypeDatasets').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Samples',
                element: 'NumSamples',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumSamples').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Sub-studies',
                element: 'NumSubStudies',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumSubStudies').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Subjects',
                element: 'NumSubjects',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumSubjects').value",
                types: ['Count']
              },
              {
                displayName: 'Number of Variables',
                element: 'NumVariables',
                expression:
                  "extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content').extension('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/StructureDefinition/ResearchStudy-Content-NumVariables').value",
                types: ['Count']
              }
            ]
          }
        : {};
    return getSheetData(
      urls,
      sheetDescriptions[i],
      resourceTypes,
      customColumns
    );
  });

  // Calculate column widths
  let columnWidths = [];

  sheetsData.forEach((sheetData) => {
    let beginCalcWidth = false;
    sheetData.forEach((row) => {
      row.forEach((cell, i) => {
        if (beginCalcWidth) {
          columnWidths[i] = {
            width: Math.max(
              (cell && cell.value && cell.value.length) || 0,
              (columnWidths[i] && columnWidths[i].width) || 0
            )
          };
        }
      });
      if (row[0] && row[0].value === MAGIC_CELL_TEXT) {
        beginCalcWidth = true;
      }
    });
  });
  // Manual width for "Show/Hide"
  columnWidths[4] = { width: 11 };
  // Manual width for types
  columnWidths[5] = { width: 20 };
  // Manual width for FHIRPath expression
  columnWidths[6] = { width: 20 };

  const output = fs.createWriteStream(
    path.resolve(__dirname, '../src/conf/xlsx/' + outputFilename)
  );

  writeXlsxFile(sheetsData, {
    columns: sheetNames.map(() => columnWidths),
    sheets: sheetNames
  }).then((stream) => stream.pipe(output));
});
