import { AppPage } from './app.po';
import { $, browser, logging, $$, by, protractor } from 'protractor';
import { ProtractorHarnessEnvironment } from '@angular/cdk/testing/protractor';
import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { ContentContainerComponentHarness } from '@angular/cdk/testing/component-harness';

// Page objects & harnesses
// See https://material.angular.io/cdk/test-harnesses/overview for details
let page: AppPage;
let stepper: MatStepperHarness;
let stepsArray: Array<MatStepHarness>;
let settingsStep: MatStepHarness;
let defineCohortStep: MatStepHarness;
let viewCohortStep: MatStepHarness;
let pullDataStep: MatStepHarness;
let fileName: string;

beforeAll(async () => {
  fileName = `${os.tmpdir()}/e2e_temp/cohort-100.json`;
  // Initialize common page objects & harnesses
  page = new AppPage();
  await page.navigateTo('?server=https://lforms-fhir.nlm.nih.gov/baseR4');
  // TODO: ProtractorHarnessEnvironment should be replaced when migrating to Cypress.
  //       See the "FAQs" section here:
  //       https://github.com/angular/protractor/issues/5502
  const harnessLoader = ProtractorHarnessEnvironment.loader();
  stepper = await harnessLoader.getHarness(MatStepperHarness);
  stepsArray = await stepper.getSteps();
  [settingsStep, defineCohortStep, viewCohortStep, pullDataStep] = stepsArray;
});

describe('Research Data Finder (FHIR Tools project FHIR server)', () => {
  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;
  let currentStep: MatStepHarness;

  beforeEach(async () => {
    try {
      // Initialize current step next button harness
      currentStep = (await stepper.getSteps({ selected: true }))[0];
      nextPageBtn = await currentStep.getHarness(MatStepperNextHarness);
    } catch (err) {
      console.log('No next step.');
    }
  });

  it('should display welcome message', async () => {
    expect(await page.getAppDescription().isDisplayed()).toBe(true);
  });

  it('should display all steps', () => {
    expect(stepsArray.length).toBe(4);
  });

  it('should select the Settings step by default', async () => {
    expect(await settingsStep.isSelected()).toBe(true);
  });

  it('should not allow skipping the Define cohort step', async () => {
    await viewCohortStep.select();
    expect(await settingsStep.isSelected()).toBe(true);
  });

  it('should allow to proceed to the Define cohort step', async () => {
    await nextPageBtn.click();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should add search criterion', async () => {
    const addResourceBtn = await currentStep.getHarness(
      MatButtonHarness.with({ text: 'Add criteria for a record type' })
    );
    await addResourceBtn.click();
    const resourceType = $('app-autocomplete[label="Record type"]');
    expect(await resourceType.isDisplayed()).toBe(true);
    await resourceType.$('input').sendKeys('Patient');
    // Blur out of record type input so its dropdown doesn't block #addSearchCriterion button.
    await $('app-define-cohort-page').click();
    const addCriterionBtn = await currentStep.getHarness(
      MatButtonHarness.with({
        text: 'Add a criterion for the Patient record'
      })
    );
    await addCriterionBtn.click();

    await fillMatFormFieldInput(currentStep, 'Search parameter name', 'name');
    await fillMatFormFieldInput(currentStep, 'Search parameter value', 'a');
  });

  it('should not allow skipping the View cohort (search for patients) step', async () => {
    await pullDataStep.select();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should allow to proceed to the View cohort step', async () => {
    await nextPageBtn.click();
    expect(await viewCohortStep.isSelected()).toBe(true);
  });

  it('should save and load cohort', async () => {
    // If not set, protractor scripts will hang for some reason once you download file.
    await browser.waitForAngularEnabled(false);
    if (fs.existsSync(fileName)) {
      // Make sure the browser doesn't have to rename the download.
      fs.unlinkSync(fileName);
    }
    $('mat-icon[svgIcon="save"]').click();
    await browser.driver.wait(() => fs.existsSync(fileName));

    const absolutePath = path.resolve(__dirname, 'cohort-to-upload.json');
    await defineCohortStep.select();
    $('#hiddenFileInput').sendKeys(absolutePath);
    expect(await viewCohortStep.isSelected()).toBe(true);
    // Verify that 4 rows are loading in table, same as in upload file.
    expect(await $$('table tbody tr').count()).toEqual(4);
  });

  it('should be able to proceed to the Pull data for cohort step', async () => {
    await nextPageBtn.click();
    expect(await pullDataStep.isSelected()).toBe(true);
  });

  it('should load Observations table', async () => {
    const loadObservationBtn = await currentStep.getHarness(
      MatButtonHarness.with({ text: 'Load Observations' })
    );
    await loadObservationBtn.click();
    const resourceTable = $('app-resource-table[context="pull-data"]');
    expect(await resourceTable.isDisplayed()).toBe(true);
  });

  it('should show value column in Observations table', async () => {
    const resourceTable = $('app-resource-table[context="pull-data"]');
    const valueHeader = resourceTable.element(
      by.xpath('//span[contains(text(), "Value")]')
    );
    await browser.wait(
      protractor.ExpectedConditions.presenceOf(valueHeader),
      5000,
      'Value header not found in time.'
    );
    expect(await valueHeader.isDisplayed()).toBe(true);
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser
      .manage()
      .logs()
      .get(logging.Type.BROWSER)
      .then((entries) => {
        // Ignore these errors:
        // * sorting parameter "age-at-event" is not supported
        // * $lastn on Observation is not supported
        // * favicon.ico is missing
        // * ResearchSubject query fails without a consent group
        // * interpretation search parameter is not supported
        return entries.filter(
          (entry) =>
            !/Observation\?_sort=age-at-event|code:text=zzzzz|\/favicon\.ico|ResearchSubject|interpretation/.test(
              entry.message
            )
        );
      });
    expect(logs).not.toContain(
      jasmine.objectContaining({
        level: logging.Level.SEVERE
      } as logging.Entry)
    );
  });
});

/**
 * Puts text in an input field inside a MatFormField component with the
 * specified text of the form field's floating label.
 * @param parent - parent component where to start searching for the input field
 * @param floatingLabelText - filter based on the text of the form field's
 *   floating label.
 * @param text - text to fill the input field
 */
async function fillMatFormFieldInput(
  parent: ContentContainerComponentHarness,
  floatingLabelText: string | RegExp,
  text: string
): Promise<void> {
  const matFormField = await parent.getHarness(
    MatFormFieldHarness.with({
      floatingLabelText
    })
  );
  await (await (await matFormField.getControl()).host()).sendKeys(text);
}
