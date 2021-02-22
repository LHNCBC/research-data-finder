import { AppPage } from './app.po';
import { $, browser, logging, Key } from 'protractor';
import { ProtractorHarnessEnvironment } from '@angular/cdk/testing/protractor';
import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';

// Page objects & harnesses
// See https://material.angular.io/cdk/test-harnesses/overview for details
let page: AppPage;
let stepper: MatStepperHarness;
let stepsArray: Array<MatStepHarness>;
let settingsStep: MatStepHarness;
let defineCohortStep: MatStepHarness;
let viewCohortStep: MatStepHarness;
let pullDataStep: MatStepHarness;

beforeAll(async () => {
  // Initialize common page objects & harnesses
  page = new AppPage();
  await page.navigateTo();
  const harnessLoader = ProtractorHarnessEnvironment.loader();
  stepper = await harnessLoader.getHarness(MatStepperHarness);
  stepsArray = await stepper.getSteps();
  [settingsStep, defineCohortStep, viewCohortStep, pullDataStep] = stepsArray;
});

describe('Research Data Finder', () => {
  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;

  beforeEach(async () => {
    // Initialize current step next button harness
    const currentStep = (await stepper.getSteps({selected: true}))[0];
    nextPageBtn = await currentStep.getHarness(MatStepperNextHarness);
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

  it('should not allow empty server URL', async () => {
    const serviceBaseUrlInput = $('[formControlName="serviceBaseUrl"]');
    serviceBaseUrlInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.chord(Key.CONTROL, 'x'));
    await nextPageBtn.click();
    expect(await settingsStep.isSelected()).toBe(true);
    serviceBaseUrlInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.chord(Key.CONTROL, 'v'));
  });

  it('should allow to proceed to the Define cohort step', async () => {
    await nextPageBtn.click();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should not allow skipping the View cohort (search for patients) step', async () => {
    await pullDataStep.select();
    expect(await defineCohortStep.isSelected()).toBe(true);
  });

  it('should allow to proceed to the View cohort step', async () => {
    await nextPageBtn.click();
    expect(await viewCohortStep.isSelected()).toBe(true);
  });

  it('should be able to proceed to the Pull data for cohort step', async () => {
    await nextPageBtn.click();
    expect(await pullDataStep.isSelected()).toBe(true);
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(jasmine.objectContaining({
      level: logging.Level.SEVERE,
    } as logging.Entry));
  });
});
