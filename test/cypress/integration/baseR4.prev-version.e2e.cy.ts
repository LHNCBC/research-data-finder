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
    cy.visit('/?server=https://lforms-fhir.nlm.nih.gov/baseR4&prev-version=enable')
      .get('app-fhir-server-select.loading')
      .should('exist')
      .get('app-fhir-server-select.loading', { timeout: 30000 })
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
          defineCohortStep,
          viewCohortStep,
          pullDataStep
        ] = stepsArray;
      });
  });

  // Current step next button harness
  let nextPageBtn: MatStepperNextHarness;

  beforeEach((done) => {
    stepper
      .getSteps({ selected: true })
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
    viewCohortStep
      .select()
      .then(() => settingsStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should allow to proceed to the Define cohort step', (done) => {
    nextPageBtn
      .click()
      .then(() => defineCohortStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should be an autocomplete field for DocumentReference.contenttype', () => {
    cy.contains('Add criteria for a record type').click();
    cy.get('mat-form-field.resource-type app-autocomplete input')
      .type('DocumentReference')
      .blur();
    cy.contains('Add a criterion for the DocumentReference record').click();
    cy.get('mat-form-field.parameter-name app-autocomplete input')
      .type('contenttype')
      .blur();
    cy.get('#autocomplete-test-value-1').focus();
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li').should('not.be.empty');
    cy.get('button.remove-btn').eq(0).click();
  });

  it('should be an autocomplete field for Encounter.type', () => {
    cy.contains('Add criteria for a record type').click();
    cy.get('mat-form-field.resource-type app-autocomplete input')
      .type('Encounter')
      .blur();
    cy.contains('Add a criterion for the Encounter record').click();
    cy.get('mat-form-field.parameter-name app-autocomplete input')
      .type('type')
      .blur();
    cy.get('#autocomplete-test-value-2').focus();
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li').should('not.be.empty');
    cy.get('button.remove-btn').eq(0).click();
  });

  it('should add search criterion', () => {
    cy.contains('Add criteria for a record type').click();
    cy.get('mat-form-field.resource-type app-autocomplete input')
      .type('Observation')
      .blur();
    cy.contains('Add a criterion for the Observation record').click();
    cy.get('mat-form-field.parameter-name app-autocomplete input')
      .type('variable name')
      .blur();
    cy.get('#code-selector-1').focus().type('Height cm');
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li:first-child').click();
  });

  it('should not allow skipping the View cohort (search for patients) step', (done) => {
    viewCohortStep
      .select()
      .then(() => defineCohortStep.isSelected())
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

  it('should save cohort', () => {
    cy.contains('Save the cohort and criteria for later', { timeout: 10000 })
      .should('be.enabled')
      .click();
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
    nextPageBtn
      .click()
      .then(() => pullDataStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        done();
      });
  });

  it('should use default observation codes for the "Pull data for the cohort" step', () => {
    cy.get('app-search-parameter-group .autocomp_selected > ul > li').should(
      'have.text',
      '×Height cm'
    );
  });

  it('should load Observation table', () => {
    cy.contains('Load Observations').click();
    cy.get('app-resource-table[context="pull-data"]').should('exist');
  });

  it('should show value column in Observations table', () => {
    cy.get('app-resource-table[context="pull-data"] thead', { timeout: 10000 })
      .contains('Value')
      .should('exist');
  });
});
