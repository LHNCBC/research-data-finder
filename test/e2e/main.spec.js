'use strict';

const os = require("os"),
  EC = protractor.ExpectedConditions;

describe('Research Data Finder', function() {
  beforeAll(function () {
    setAngularSite(false);
    browser.get('/');
  });

  // TODO: Temporarily commented because it does not work yet
  // it('should load observations filtered by category', function () {
  //   $('#limit1').click();
  //   $('#load').click();
  //   browser.wait(EC.visibilityOf($('#results')));
  // });

  it('should load Patients', function () {
    const loadPatientBtn = $('#loadPatients');

    browser.wait(EC.elementToBeClickable(loadPatientBtn));
    loadPatientBtn.click();
    browser.wait(EC.visibilityOf($('#loadObservations')));
  });

  it('should load Observations filtered by tests', function () {
    // TODO: Temporarily commented because it does not work yet
    // $('#limit2').click();
    $('#loadObservations').click();
    browser.wait(EC.visibilityOf($('#resultsTable')));
  });

  it('should download observations', function () {
    const filename = os.tmpdir() + '/observations.csv';
    const fs = require('fs');

    if (fs.existsSync(filename)) {
      // Make sure the browser doesn't have to rename the download.
      fs.unlinkSync(filename);
    }

    $('#download').click();

    browser.driver.wait(function() {
      // Wait until the file has been downloaded.
      return fs.existsSync(filename);
    }, 30000).then(function() {
      // Checks CSV file structure: the file has columns and all lines have the same number of cells.
      const cellsInRowCount = fs.readFileSync(filename, {encoding: 'utf8'})
          .replace(/""/g, '').replace(/"[^"]*"/g, '').split('\n')
          .map(line => line.split(',').length),
        columnsCount = cellsInRowCount[0];

      expect(columnsCount > 0 && cellsInRowCount.every(cellsCount => cellsCount === columnsCount)).toBe(true);

      // Cleanup
      fs.unlinkSync(filename);
    });
  });
});
