import { AppPage } from './app.po';
import { $, browser, logging, Key, $$ } from 'protractor';
import { ProtractorHarnessEnvironment } from '@angular/cdk/testing/protractor';
import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Page objects & harnesses
// See https://material.angular.io/cdk/test-harnesses/overview for details
let page: AppPage;
let stepper: MatStepperHarness;
let stepsArray: Array<MatStepHarness>;
let settingsStep: MatStepHarness;
let selectAnAreaOfInterestStep: MatStepHarness;
let defineCohortStep: MatStepHarness;
let viewCohortStep: MatStepHarness;
let pullDataStep: MatStepHarness;
let fileName: string;

beforeAll(async () => {
  fileName = `${os.tmpdir()}/e2e_temp/cohort-100.json`;
  // Initialize common page objects & harnesses
  page = new AppPage();
  await page.navigateTo('?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1');
  const harnessLoader = ProtractorHarnessEnvironment.loader();
  stepper = await harnessLoader.getHarness(MatStepperHarness);
  stepsArray = await stepper.getSteps();
  [
    settingsStep,
    selectAnAreaOfInterestStep,
    defineCohortStep,
    viewCohortStep,
    pullDataStep
  ] = stepsArray;
});

describe('Research Data Finder', () => {
  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;

  beforeEach(async () => {
    // Initialize current step next button harness
    const currentStep = (await stepper.getSteps({ selected: true }))[0];
    nextPageBtn = await currentStep.getHarness(MatStepperNextHarness);
  });

  it('should display welcome message', async () => {
    expect(await page.getAppDescription().isDisplayed()).toBe(true);
  });

  it('should display all steps', () => {
    expect(stepsArray.length).toBe(5);
  });

  it('should select the Settings step by default', async () => {
    expect(await settingsStep.isSelected()).toBe(true);
  });

  describe('in Settings step', () => {
    beforeAll(async () => {
      const advancedSettings: MatExpansionPanelHarness = await settingsStep.getHarness(
        MatExpansionPanelHarness
      );
      await advancedSettings.expand();
    });

    [
      ['server URL', 'serviceBaseUrl'],
      ['Request per batch', 'maxRequestsPerBatch'],
      ['Maximum active requests', 'maxActiveRequests']
    ].forEach(([displayName, controlName]) => {
      it(`should not allow empty "${displayName}"`, async () => {
        const inputField = $(
          `input[formControlName="${controlName}"],[formControlName="${controlName}"] input`
        );
        inputField.sendKeys(
          Key.chord(Key.CONTROL, 'a'),
          Key.chord(Key.CONTROL, 'x')
        );
        await nextPageBtn.click();
        expect(await settingsStep.isSelected()).toBe(true);
        inputField.sendKeys(
          Key.chord(Key.CONTROL, 'a'),
          Key.chord(Key.CONTROL, 'v')
        );
      });
    });
  });

  it('should not allow skipping the Define cohort step', async () => {
    await viewCohortStep.select();
    expect(await settingsStep.isSelected()).toBe(true);
  });

  it('should allow skipping the Select Research Studies step', async () => {
    await defineCohortStep.select();
    expect(await defineCohortStep.isSelected()).toBe(true);
    await settingsStep.select();
  });

  it('should allow to proceed to the Select Research Studies step', async () => {
    await nextPageBtn.click();
    expect(await selectAnAreaOfInterestStep.isSelected()).toBe(true);
  });

  it('should allow to proceed to the Define cohort step', async () => {
    await nextPageBtn.click();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should hide Research Study step if server has no data', async () => {
    await page.navigateTo('?server=https://lforms-fhir.nlm.nih.gov/baseR4');
    const harnessLoader = ProtractorHarnessEnvironment.loader();
    stepper = await harnessLoader.getHarness(MatStepperHarness);
    stepsArray = await stepper.getSteps();
    expect(stepsArray.length).toEqual(4);
    [settingsStep, defineCohortStep, viewCohortStep, pullDataStep] = stepsArray;
    const currentStep = (await stepper.getSteps({ selected: true }))[0];
    nextPageBtn = await currentStep.getHarness(MatStepperNextHarness);
    await nextPageBtn.click();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should add search criterion', async () => {
    await $('#addResourceType').click();
    expect(await $('.resource-type').isDisplayed()).toBe(true);
    await $('.resource-type input').sendKeys('Patient');
    // Blur out of resource type input so its dropdown doesn't block #addSearchCriterion button.
    await $('app-define-cohort-page').click();
    await $('app-define-cohort-page #addSearchCriterion').click();
    expect(await $('.parameter-name').isDisplayed()).toBe(true);
    await $('.parameter-name input').sendKeys('name');
    expect(await $('.parameter-value').isDisplayed()).toBe(true);
    await $('.parameter-value input').sendKeys('a');
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
        // * ResearchSubject query fails with consent group
        return entries.filter(
          (entry) =>
            !/Observation\?_sort=age-at-event|code:text=zzzzz|\/favicon\.ico|ResearchSubject/.test(
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
