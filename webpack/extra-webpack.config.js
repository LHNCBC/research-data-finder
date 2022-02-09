const path = require('path');
const fs = require('fs');
const readXlsxFile = require('read-excel-file/node');
const JSON5 = require('json5');
const json5Writer = require('json5-writer');

const xlsxFolder = './src/conf/xlsx';
const csvFolder = './src/conf/csv';
const settingsPath = './src/assets/settings.json5';
const definitionsFilePropName = 'definitionsFile';

/**
 * Converts array of cell values to CSV row
 * @param {Array} row
 * @return {string}
 */
function createCsvRow(row) {
  return row
    .map((cell) => {
      if (/["\s,]/.test(cell)) {
        return '"' + cell.replace(/"/g, '""') + '"';
      } else {
        return cell;
      }
    })
    .join(',');
}

/**
 * Returns an object which maps service base URLs to CSV data extracted from XLSX files.
 * @returns {Promise<Object>}
 */
async function prepareCsvData() {
  // Cell value to mark the beginning of data
  const marker = '---SERVICE BASE URL:';
  // Index offset of the row from which the data starts relative to the row with URL
  const dataOffset = 3;
  // Read all XLSX files in the folder
  const fileNames = fs.readdirSync(xlsxFolder);
  const url2desc = {};
  for (let i = 0; i < fileNames.length; i++) {
    if (/(.*)\.xlsx$/.test(fileNames[i])) {
      const filename = RegExp.$1;
      const fromFilename = filename + '.xlsx';
      const sheets = await readXlsxFile(xlsxFolder + '/' + fromFilename, {
        getSheets: true
      });

      for (let j = 1; j <= sheets.length; j++) {
        const rows = await readXlsxFile(xlsxFolder + '/' + fromFilename, {
          sheet: j
        });

        const urlIndex = rows.findIndex((row) => row[0] === marker);
        const urls = rows[urlIndex][1].split(',');
        const desc = rows
          .slice(urlIndex + dataOffset)
          .filter(([, , type, , hideShow, , ,]) =>
            // Skip hidden search parameters and disabled columns
            type === 'search parameter'
              ? hideShow !== 'hide'
              : hideShow !== 'disable'
          );
        urls.forEach((url) => {
          url2desc[url] = (url2desc[url] || []).concat(desc);
        });
      }
    }
  }
  return url2desc;
}

/**
 * Updates settings.json5 and creates CSV-files.
 * @param {Object} url2desc - object which maps service base URLs to CSV
 *   data extracted from XLSX files.
 */
function updateAppSettings(url2desc) {
  const allUrls = Object.keys(url2desc);
  const updateSettingsObj = { default: {}, customization: {} };
  const settingsJsonString = fs.readFileSync(settingsPath).toString();
  const settings = JSON5.parse(settingsJsonString);

  for (let i = 0; i < allUrls.length; i++) {
    const url = allUrls[i];
    const toFilename = 'desc-' + i + '.csv';
    if (url === 'default') {
      updateSettingsObj.default[definitionsFilePropName] = toFilename;
    } else {
      updateSettingsObj.customization[url] = {
        [definitionsFilePropName]: toFilename
      };
    }

    fs.writeFileSync(
      csvFolder + '/' + toFilename,
      url2desc[url].map((row) => createCsvRow(row)).join('\n')
    );
  }

  // json5-writer will remove any property that does not exist in updateSettingsObj.
  // To keep an existing properties, we need to pass undefined.
  Object.keys(settings.default).forEach((key) => {
    if (key !== definitionsFilePropName) {
      updateSettingsObj.default[key] = undefined;
    }
  });
  Object.keys(settings.customization).forEach((url) => {
    if (!updateSettingsObj.customization[url]) {
      updateSettingsObj.customization[url] = {};
    }
    Object.keys(settings.customization[url]).forEach((key) => {
      if (key !== definitionsFilePropName) {
        updateSettingsObj.customization[url][key] = undefined;
      }
    });
  });

  const settingsWriter = json5Writer.load(settingsJsonString);
  settingsWriter.write(updateSettingsObj);
  fs.writeFileSync(settingsPath, settingsWriter.toSource());
}

module.exports = async (config) => {
  updateAppSettings(await prepareCsvData());

  config.module.rules.push(
    {
      test: /definitions\/index.json$/,
      use: [
        {
          loader: path.resolve(
            'prev/source/js/search-parameters/definitions/webpack-loader.js'
          ),
          options: require(path.resolve(
            'prev/source/js/search-parameters/definitions/webpack-options.json'
          ))
        }
      ]
    },
    {
      test: /package.json$/,
      use: [
        {
          loader: path.resolve('webpack/package-json-loader.js')
        }
      ]
    }
  );

  return config;
};
