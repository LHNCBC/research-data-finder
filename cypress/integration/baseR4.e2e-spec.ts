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
  let defineCohortStep: MatStepHarness;
  let viewCohortStep: MatStepHarness;
  let pullDataStep: MatStepHarness;

  before(() => {
    cy.visit('/?server=https://lforms-fhir.nlm.nih.gov/baseR4');

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
          defineCohortStep,
          viewCohortStep,
          pullDataStep
        ] = stepsArray;
      });
  });

  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;

  beforeEach(() => {
    stepper
      .getSteps({ selected: true })
      .then(([currentStep]) =>
        currentStep ? currentStep.getHarness(MatStepperNextHarness) : null
      )
      .then((btn) => {
        nextPageBtn = btn;
      });
  });

  it('should display welcome message', () => {
    cy.get('app-stepper > p:first-child').should('be.visible');
  });

  it('should display all steps', () => {
    expect(stepsArray.length).to.equal(4);
  });

  it('should select the Settings step by default', (done) => {
    settingsStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should not allow skipping the Define cohort step', (done) => {
    viewCohortStep.select();
    settingsStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should allow to proceed to the Define cohort step', (done) => {
    nextPageBtn.click();
    defineCohortStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should add search criterion', () => {
    cy.contains('Add criteria for a record type').click();
    cy.get('app-autocomplete.resource-type input').type('Patient');
    cy.contains('Add a criterion for the Patient record').click();
    cy.get('app-autocomplete.parameter-name input').type('name');
    cy.get('mat-form-field.parameter-value input').type('a');
  });

  it('should not allow skipping the View cohort (search for patients) step', (done) => {
    viewCohortStep.select();
    defineCohortStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should allow to proceed to the View cohort step', (done) => {
    nextPageBtn.click();
    viewCohortStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should save cohort', () => {
    cy.contains('Save the cohort and criteria for later').click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/cohort-100.json`, {
      timeout: 5000
    }).should('not.be.null');
    cy.task('removeCohortFileIfExist');
  });

  it('should load cohort', (done) => {
    defineCohortStep.select().then(() => {
      cy.get('#hiddenFileInput').attachFile('cohort-to-upload.json');
      cy.contains('Cohort of 4 Patient resources')
        .should('exist')
        .then(() => {
          // Verify that 4 rows are loaded in table, same as in upload file.
          expect(Cypress.$('table tbody tr').length).to.equal(4);
          done();
        });
    });
  });

  it('should allow to proceed to the Pull Data for cohort step', (done) => {
    nextPageBtn.click();
    pullDataStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should load Observation table', () => {
    cy.contains('Load Observations').click();
    cy.get('app-resource-table[context="pull-data"]').should('exist');
  });

  it('should show value column in Observations table', () => {
    cy.get('app-resource-table[context="pull-data"] thead')
      .contains('Value')
      .should('exist');
  });
});
