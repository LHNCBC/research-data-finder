'use strict';

const os = require("os"),
  Key = protractor.Key,
  EC = protractor.ExpectedConditions;

describe('Research Data Finder', function() {
  beforeAll(function () {
    setAngularSite(false);
    browser.get('/');
  });

  /**
   * "it" function to check that Observations can be loaded
   */
  function checkLoadObservations() {
    $('#loadObservations').click();
    browser.wait(EC.visibilityOf($('#resultsTable')));
  }

  /**
   * "it" function to check that Observations can be downloaded
   */
  function checkDownloadObservations() {
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
  }

  describe('without criteria(initial state)', function () {
    it('should load Patients', function () {
      const loadPatientsBtn = $('#loadPatients');

      browser.wait(EC.elementToBeClickable(loadPatientsBtn));
      loadPatientsBtn.click();
      browser.wait(EC.visibilityOf($('#loadObservations')));
    });

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });

  describe('after add a criterion to Patient resource', function () {
    it('should load Patients filtered by criteria', function () {
      const loadPatientsBtn = $('#loadPatients');
      const addCriterionBtn = $('#searchParam_add_button');
      const resourceInput = $('#searchParam_param_1_resource');
      const paramNameInput = $('#searchParam_param_1');

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      addCriterionBtn.click();

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a') + 'Patient');
      resourceInput.sendKeys(Key.ENTER);
      browser.wait(EC.textToBePresentInElementValue(paramNameInput, 'Active'), 2000);

      browser.wait(EC.elementToBeClickable(loadPatientsBtn));
      loadPatientsBtn.click();
      browser.wait(EC.visibilityOf($('#loadObservations')));
    });

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });

  describe('after add a criterion to Observation resource', function () {
    it('should load Patients filtered by criteria', function () {
      const loadPatientsBtn = $('#loadPatients');
      const addCriterionBtn = $('#searchParam_add_button');
      const loadObservationsBtn = $('#loadObservations');
      const resourceInput = $('#searchParam_param_2_resource');
      const testNameInput = $('#searchParam_param_2-test-name');
      const testRealValueInput = $('#searchParam_param_2-test-real-value');

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      addCriterionBtn.click();

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a') + 'Observation');
      resourceInput.sendKeys(Key.ENTER);
      testNameInput.sendKeys('body height measured');
      testNameInput.sendKeys(Key.ENTER);
      testRealValueInput.sendKeys('63');
      loadPatientsBtn.click();

      browser.wait(EC.visibilityOf(loadObservationsBtn));

      loadObservationsBtn.click();
      browser.wait(EC.visibilityOf($('#resultsTable')));
    });

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });

});
