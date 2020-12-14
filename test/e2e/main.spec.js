'use strict';

const os = require('os');
const Key = protractor.Key;
const EC = protractor.ExpectedConditions;
const fs = require('fs');

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
   * Scrolls an element's parent container such that the element is visible to the user
   * @param {ElementFinder} elementFinder - protractor object to represent the element
   * @return {Promise}
   */
  function scrollIntoView(elementFinder) {
    return elementFinder.getWebElement().then((element) =>
      browser.executeScript(function (element) {
        if (element.scrollIntoViewIfNeeded) {
          element.scrollIntoViewIfNeeded(true);
        } else {
          element.scrollIntoView({block: 'center'});
        }
      }, element)
    );
  }

  /**
   * Scrolls an element into view and clicks on it when it becomes clickable
   * @param {ElementFinder} elementFinder - protractor object to represent the element
   * @return {Promise}
   */
  function safeClick(elementFinder) {
    return browser
      .wait(EC.elementToBeClickable(elementFinder))
      .then(() => scrollIntoView(elementFinder))
      .then(() => elementFinder.click());
  }

   /**
   * "it" function to check that Patients can be loaded
   */
  function checkLoadPatients() {
    const loadPatientsBtn = $('#loadPatients');
    const cohortSectionHeader = $('#patientsArea > .section:nth-of-type(2) > .section__header');
    const maxPatientCountInput = $('#maxPatientCount');
    const loadObservationsBtn = $('#ObservationTabPage-1-loadBtn');

    // Random maximum number of Patients from 50 to 100
    maxPatientCountInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 50 + Math.floor(Math.random()*50));

    safeClick(loadPatientsBtn);
    safeClick(cohortSectionHeader);
    browser.wait(EC.visibilityOf(loadObservationsBtn));
  }

  /**
   * "it" function to check that Observations can be loaded
   */
  function checkLoadObservations() {
    const loadObservationsBtn = $('#ObservationTabPage-1-loadBtn');
    const observationTable = $('#ObservationTable-1');

    safeClick(loadObservationsBtn);
    browser.wait(EC.visibilityOf(observationTable));
  }

  /**
   * Returns one visible button which contain a certain string.
   * @param {string|RegExp} searchText - text search
   * @return {ElementFinder}
   */
  function getVisibleButtonByText(searchText) {
    const visibleButtons = element
      .all(by.cssContainingText('button', searchText))
      .filter((el) => el.isDisplayed());
    expect(visibleButtons.count()).toBe(1);
    return visibleButtons.get(0);
  }

  /**
   * Returns "it" function to check that resource type data can be downloaded in CSV format
   * @param {string} resourceType
   */
  function checkDownloadDataByResourceType(resourceType) {
    return () => {
      const filename = os.tmpdir() + '/' + resourceType.toLowerCase() + 's.csv';

      if (fs.existsSync(filename)) {
        // Make sure the browser doesn't have to rename the download.
        fs.unlinkSync(filename);
      }

      safeClick(getVisibleButtonByText('Download (in CSV format)'));

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
    };
  }

  /**
   * "it" function to check that column selection dialog can be opened.
   */
  function checkColumnsDialog() {
    safeClick(getVisibleButtonByText('Select columns to load'));
    browser.wait(EC.visibilityOf($('#columnsModalDialogBody')));
    expect($$('#columnsModalDialogBody input[type=checkbox]').count()).toBeGreaterThan(0);
    safeClick(getVisibleButtonByText('Close'));
  }

  /**
   * "it" function to check that Cohort can be downloaded.
   */
  function checkDownloadCohort() {
    $('#patientsCount').getText().then(patientCountText => {
      const patientsCount = parseInt(patientCountText);
      const filename = os.tmpdir() + `/cohort-${patientsCount}.json`;

      if (fs.existsSync(filename)) {
        // Make sure the browser doesn't have to rename the download.
        fs.unlinkSync(filename);
      }

      safeClick($('#saveCohort'));

      browser
        .wait(function () {
          // Wait until the file has been downloaded.
          return fs.existsSync(filename);
        }, 30000)
        .then(function () {
          // Checks JSON file structure.
          const cohortData = JSON.parse(
            fs.readFileSync(filename, { encoding: 'utf-8' })
          );
          expect(cohortData && cohortData.data && cohortData.data.length).toBe(
            patientsCount
          );

          // Cleanup will be in checkUploadCohort()
        });
    });
  }

  /**
   * "it" function to check that Cohort can be uploaded.
   */
  function checkUploadCohort() {
    const patientsCountElement = $('#patientsCount');
    const cohortFileInput = $('#cohortFile');
    const criteriaElements = $$('#SearchParameters-1 .search-parameter');
    const criteriaCount = criteriaElements.count();

    patientsCountElement.getText().then((patientCountText) => {
      const patientsCount = parseInt(patientCountText);
      const filename = os.tmpdir() + `/cohort-${patientsCount}.json`;
      const loadCohortRadioBtn = $('#loadCohortOption');

      // Clear all Patients data to check it after upload
      browser.refresh();

      // Upload file downloaded in checkDownloadCohort()
      safeClick(loadCohortRadioBtn);
      cohortFileInput.sendKeys(filename);

      browser.wait(EC.visibilityOf(patientsCountElement));
      patientsCountElement.getText().then((newPatientCountText) => {
        // Check the number of uploaded Patients
        const newPatientsCount = parseInt(newPatientCountText);
        expect(patientsCount).toBe(newPatientsCount);

        // Cleanup
        fs.unlinkSync(filename);
        safeClick($('#buildCohortOption'));

        //Check the number of uploaded Cohort criteria
        browser.wait(EC.invisibilityOf(patientsCountElement));
        expect(criteriaCount).toBe(criteriaElements.count());
      });
    });
  }


  /**
   * Select or add tab for pull data for resource type
   * @param {string} resourceType - e.g. "Observation", "Encounter" etc.
   */
  function selectTabByResourceType(resourceType) {
    $(`a[data-value="${resourceType}"]:not(.hide)`)
      .isPresent()
      .then((tabIsNotCreated) => {
        if (tabIsNotCreated) {
          const addTabBtn = $('#ResourceTabPane-1-add-btn');
          const tabLink = $(`a[data-value="${resourceType}"]`);
          safeClick(addTabBtn);
          safeClick(tabLink);
        } else {
          safeClick(element(by.cssContainingText('.tab-link', resourceType)));
        }
      });
  }

  describe('without criteria(initial state)', function () {
    it('should load Patients', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadDataByResourceType('Observation'));

    it('should download Cohort', checkDownloadCohort);

    it('should upload Cohort', checkUploadCohort);
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
      safeClick(addCriterionBtn);

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Patient');
      resourceInput.sendKeys(Key.ENTER);
      paramNameInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Date of birth');
      paramNameInput.sendKeys(Key.ENTER);

      browser.wait(
        EC.and(
          anyDateToBePresentInInput(fromInput),
          anyDateToBePresentInInput(toInput)
        )
      );
    });

    it('should select the first search parameter for selected resource by default', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const paramNameInput = $(`#${searchParamId}`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      safeClick(addCriterionBtn);

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Patient');
      resourceInput.sendKeys(Key.ENTER);
      browser.wait(
        EC.textToBePresentInElementValue(paramNameInput, 'Active')
      );
    });
  });

  describe('after adding a criteria to Patient resource', function () {
    it('should load Patients filtered by criteria', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadDataByResourceType('Observation'));

    it('should download Cohort', checkDownloadCohort);

    it('should upload Cohort', checkUploadCohort);
  });

  describe('when adding criteria to Observation resource', function () {
    it('should provide the ability to select a test name and test value', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const testNameInput = $(`#${searchParamId}-test-name`);
      const testRealValueInput = $(`#${searchParamId}-test-real-value`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      safeClick(addCriterionBtn);

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Observation');
      resourceInput.sendKeys(Key.ENTER);
      testNameInput.sendKeys('body height measured');
      testNameInput.sendKeys(Key.ARROW_DOWN);
      testNameInput.sendKeys(Key.ENTER);
      browser.wait(EC.presenceOf(testRealValueInput));
      testRealValueInput.sendKeys('63');
    });

    it('should provide the ability to select an user-defined code and test value', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const testNameInput = $(`#${searchParamId}-test-name`);
      const testRealValueInput = $(`#${searchParamId}-test-real-value`);

      browser.wait(EC.elementToBeClickable(addCriterionBtn));
      safeClick(addCriterionBtn);

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Observation');
      resourceInput.sendKeys(Key.ENTER);
      testNameInput.sendKeys('3137-7');
      testNameInput.sendKeys(Key.ENTER);
      browser.wait(EC.presenceOf(testRealValueInput));
      testRealValueInput.sendKeys('63');
    });
  });

  describe('after adding a criteria to Observation resource', function () {
    it('should load Patients filtered by criteria', checkLoadPatients);

    it('should load Observations filtered by tests', checkLoadObservations);

    it('should download Observations', checkDownloadDataByResourceType('Observation'));

    it('should download Cohort', checkDownloadCohort);

    it('should upload Cohort', checkUploadCohort);
  });

  describe('when adding criteria to Encounter resource', function () {
    it('should load minimum and maximum values for date criterion', function () {
      const searchParamId = getNextSearchParamId();
      const addCriterionBtn = $('#SearchParameters-1_add_button');
      const resourceInput = $(`#${searchParamId}_resource`);
      const paramNameInput = $(`#${searchParamId}`);
      const fromInput = $(`#${searchParamId}-date-from`);
      const toInput = $(`#${searchParamId}-date-to`);

      safeClick(addCriterionBtn);

      resourceInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Encounter');
      resourceInput.sendKeys(Key.ENTER);
      paramNameInput.sendKeys(Key.chord(Key.CONTROL, 'a'), 'Date');
      paramNameInput.sendKeys(Key.ENTER);

      browser.wait(
        EC.and(
          anyDateToBePresentInInput(fromInput),
          anyDateToBePresentInInput(toInput)
        )
      );
    });
  });

  describe('after adding a criteria to Encounter resource', function () {
    it('should load Patients filtered by criteria', checkLoadPatients);

    it('should reuse selection criteria values from the Patient selection area', function () {
      selectTabByResourceType('Encounter');
      expect($$('#SearchParameters-2 .search-parameter').count()).toBe(1);
      expect(
        $(
          '#SearchParameters-2 .search-parameter input[aria-label="Resource type"]'
        ).getAttribute('value')
      ).toBe('Encounter');
      expect(
        $(
          '#SearchParameters-2 .search-parameter input[aria-label="Search parameter name"]'
        ).getAttribute('value')
      ).toBe('Date');
    });

    it('should open column selection dialog', checkColumnsDialog);

    it('should load Encounters', () => {
      const loadEncounersBtn = $('#ResourceTabPage-1-loadBtn');
      const encounterTable = $('#ResourceTable-1');
      safeClick(loadEncounersBtn);
      browser.wait(EC.visibilityOf(encounterTable));
    })

    it('should download Encounters', checkDownloadDataByResourceType('Encounter'));

    it('should download Cohort', checkDownloadCohort);

    it('should upload Cohort', checkUploadCohort);
  });

});
