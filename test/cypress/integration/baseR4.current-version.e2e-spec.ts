import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import { getHarness } from '@jscutlery/cypress-harness';
import 'cypress-file-upload';

describe('Research Data Finder (baseR4)', () => {
  // Page objects & harnesses
  // See https://material.angular.io/cdk/test-harnesses/overview for details
  let stepper: MatStepperHarness;
  let stepsArray: Array<MatStepHarness>;
  let settingsStep: MatStepHarness;
  let selectAnActionStep: MatStepHarness;
  let selectRecordsStep: MatStepHarness;
  let viewCohortStep: MatStepHarness;
  let pullDataStep: MatStepHarness;

  before(() => {
    cy.visit('/?server=https://lforms-fhir.nlm.nih.gov/baseR4&prev-version=disable')
      .get('app-initialize-spinner')
      .should('exist')
      .get('app-initialize-spinner', {timeout: 30000})
      .should('not.exist');

    // Initialize common page objects (harnesses)
    getHarness(MatStepperHarness)
      .then((result) => {
        stepper = result;
        return stepper.getSteps();
      })
      .then((stepsArr) => {
        stepsArray = stepsArr;
        [
          settingsStep,
          selectAnActionStep,
          selectRecordsStep,
          viewCohortStep,
          pullDataStep
        ] = stepsArray;
      });
  });

  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;

  beforeEach((done) => {
    stepper
      .getSteps({selected: true})
      .then(([currentStep]) =>
        currentStep
          ? currentStep.getHarness(MatStepperNextHarness).catch(() => null)
          : null
      )
      .then((btn) => {
        nextPageBtn = btn;
        done();
      });
  });

  it('should display welcome message', () => {
    cy.get('app-stepper > p:first-child').should('be.visible');
  });

  it('should display 2 steps', () => {
    expect(stepsArray.length).to.equal(2);
  });

  it('should select the Settings step by default', (done) => {
    settingsStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should allow to proceed to the Select An Action step', (done) => {
    nextPageBtn
      .click()
      .then(() => selectAnActionStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should display all steps after selecting cart approach', (done) => {
    cy.contains(
      'Create a cohort of patients by browsing and selecting records'
    ).click();
    cy.then(() => getHarness(MatStepperHarness))
      .then((result: MatStepperHarness) => {
        stepper = result;
        return stepper.getSteps();
      })
      .then((stepsArr) => {
        stepsArray = stepsArr;
        [
          settingsStep,
          selectAnActionStep,
          selectRecordsStep,
          viewCohortStep,
          pullDataStep
        ] = stepsArray;
        expect(stepsArray.length).to.equal(5);
        done();
      });
  });

  it('should allow to proceed to the Select Records step', (done) => {
    cy.contains('Select records')
      .click()
      .then(() => selectRecordsStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should not allow skipping the View cohort (search for patients) step', (done) => {
    viewCohortStep
      .select()
      .then(() => selectRecordsStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should allow to proceed to the View cohort step', (done) => {
    nextPageBtn
      .click()
      .then(() => viewCohortStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should allow to proceed to the Pull Data for cohort step', (done) => {
    nextPageBtn
      .click()
      .then(() => pullDataStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

});
