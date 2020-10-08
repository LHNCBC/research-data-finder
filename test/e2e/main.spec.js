'use strict';

const os = require('os');
const Key = protractor.Key;
const EC = protractor.ExpectedConditions;

describe('Research Data Finder', function () {
  beforeAll(function () {
    setAngularSite(false);
    browser.get('/');
  });

  const item_prefix = 'SearchParameters-1_param_';
  let item_index = 0;

  /**
   * Search parameter id generator
   * (see "addParam" method of "SearchParameters" class)
   * @return {string}
   */
  function getNextSearchParamId() {
    return item_prefix + ++item_index;
  }

  /**
   * Checks if input field value containing any date
   * @param {ElementFinder} elementFinder
   * @return {function(): Promise<boolean>}
   */
  function anyDateToBePresentInInput(elementFinder) {
    return function () {
      return elementFinder.getAttribute('value').then(function (value) {
        return /\d{4}-\d{2}-\d{2}/.test(value);
      });
    };
  }

  /**
   * "it" function to check that Patients can be loaded
   */
  function checkLoadPatients() {
    const loadPatientsBtn = $('#loadPatients');

    browser.wait(EC.elementToBeClickable(loadPatientsBtn));
    loadPatientsBtn.click();
    browser.wait(EC.visibilityOf($('#ObservationTabPage-1-loadBtn')));
  }

  /**
   * "it" function to check that Observations can be loaded
   */
  function checkLoadObservations() {
    $('#ObservationTabPage-1-loadBtn').click();
    browser.wait(EC.visibilityOf($('#ObservationTable-1')));
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

    $('#ObservationTabPage-1-downloadBtn').click();

    browser
      .wait(function () {
        // Wait until the file has been downloaded.
        return fs.existsSync(filename);
      }, 30000)
      .then(function () {
        // Checks CSV file structure: the file has columns and all lines have the same number of cells.
        const cellsInRowCount = fs
            .readFileSync(filename, { encoding: 'utf8' })
            .replace(/""/g, '')
            .replace(/"[^"]*"/g, '')
            .split('\n')
            .map((line) => line.split(',').length),
          columnsCount = cellsInRowCount[0];

        expect(
          columnsCount > 0 &&
            cellsInRowCount.every((cellsCount) => cellsCount === columnsCount)
        ).toBe(true);

        // Cleanup
        fs.unlinkSync(filename);
      });
  }

  describe('without criteria(initial state)', function () {
    it('should load Patients', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });

  describe('when adding criteria to Patient resource', function () {
    it('should load minimum and maximum values for date criterion', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const paramNameInput = $(`#${searchParamId}`);
      const fromInput = $(`#${searchParamId}-birthdate-from`);
      const toInput = $(`#${searchParamId}-birthdate-to`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      addCriterionBtn.click();

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Patient');
      resourceInput.sendKeys(Key.ENTER);
      paramNameInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Date of birth');
      paramNameInput.sendKeys(Key.ENTER);

      browser.wait(
        EC.and(
          anyDateToBePresentInInput(fromInput),
          anyDateToBePresentInInput(toInput)
        ),
        2000
      );
    });

    it('should select the first search parameter for selected resource by default', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const paramNameInput = $(`#${searchParamId}`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      addCriterionBtn.click();

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Patient');
      resourceInput.sendKeys(Key.ENTER);
      browser.wait(
        EC.textToBePresentInElementValue(paramNameInput, 'Active'),
        2000
      );
    });
  });

  describe('after adding a criteria to Patient resource', function () {
    it('should load Patients filtered by criteria', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });

  describe('when adding criteria to Observation resource', function () {
    it('should provide the ability to select a test name and test value', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const testNameInput = $(`#${searchParamId}-test-name`);
      const testRealValueInput = $(`#${searchParamId}-test-real-value`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      addCriterionBtn.click();

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Observation');
      resourceInput.sendKeys(Key.ENTER);
      testNameInput.sendKeys('body height measured');
      testNameInput.sendKeys(Key.ARROW_DOWN);
      testNameInput.sendKeys(Key.ENTER);
      testRealValueInput.sendKeys('63');
    });
  });

  describe('after adding a criteria to Observation resource', function () {
    it('should load Patients filtered by criteria', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadObservations);
  });
});
