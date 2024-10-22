import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import { getHarness } from '@jscutlery/cypress-harness';

describe('Research Data Finder (dbGap)', () => {
  // Page objects & harnesses
  // See https://material.angular.io/cdk/test-harnesses/overview for details
  let stepper: MatStepperHarness;
  let stepsArray: Array<MatStepHarness>;
  let settingsStep: MatStepHarness;
  let selectAnAreaOfInterestStep: MatStepHarness;
  let defineCohortStep: MatStepHarness;
  let viewCohortStep: MatStepHarness;
  let pullDataStep: MatStepHarness;

  before(() => {
    cy.visit(
      '/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&prev-version=enable'
    )
      // Waiting for application initialization
      .get('app-fhir-server-select.loading')
      .should('exist')
      // When we get the initialization parameters from settings,
      // the initialization should be much faster.
      .get('app-fhir-server-select.loading', {timeout: 5000})
      .should('not.exist')
      // Initialize common page objects (harnesses)
      .then(() => getHarness(MatStepperHarness))
      .then((result: MatStepperHarness) => {
        stepper = result;
        return stepper.getSteps();
      })
      .then((stepsArr) => {
        stepsArray = stepsArr;
        [
          settingsStep,
          selectAnAreaOfInterestStep,
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
    expect(stepsArray.length).to.equal(5);
  });

  it('should select the Settings step by default', (done) => {
    settingsStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  it('should not allow empty Advanced Setting fields', () => {
    cy.get('app-settings-page mat-expansion-panel-header').click();

    ['serviceBaseUrl', 'maxRequestsPerBatch', 'maxActiveRequests']
    .forEach((controlName) => {
      let value;
      cy.get(
        `input[formControlName="${controlName}"],[formControlName="${controlName}"] input`
      )
        .as('inputField')
        .then((el) => {
          value = el.val();
        });

      cy.get('@inputField')
        .focus()
        .clear()
        .blur()
        .then(() => nextPageBtn.click())
        .then(() => settingsStep.isSelected())
        .then((isSelected) => expect(isSelected).to.be.true)
        .then(() => cy.get('@inputField').type(value).blur());
    });
  });

  it('should not allow a non-existent URL similar to dbGap', () => {
    let value;
    cy.get(
      'input[formControlName="serviceBaseUrl"],[formControlName="serviceBaseUrl"] input'
    )
      .as('inputField')
      .then((el) => {
        value = el.val();
      });

    cy.get('@inputField')
      .focus()
      .clear()
      .type('https://dbgap-api.ncbi.nlm.nih.gov/fhir/something')
      .blur();

    cy.get('app-fhir-server-select.loading')
      .should('exist')
      .get('app-fhir-server-select.loading', {timeout: 20000})
      .should('not.exist')
      .then(() => nextPageBtn.click())
      .then(() => settingsStep.isSelected())
      .then((isSelected) => expect(isSelected).to.be.true)
      .then(() => cy.get('@inputField').focus().clear().type(value).blur());

    cy.get('app-fhir-server-select.loading')
      .should('exist')
      .get('app-fhir-server-select.loading', {timeout: 20000})
      .should('not.exist');

    // Update steps data after reinitialization
    cy.then(() => getHarness(MatStepperHarness))
      .then((result: MatStepperHarness) => {
        stepper = result;
        return stepper.getSteps();
      })
      .then((stepsArr) => {
        stepsArray = stepsArr;
        [
          settingsStep,
          selectAnAreaOfInterestStep,
          defineCohortStep,
          viewCohortStep,
          pullDataStep
        ] = stepsArray;
        expect(stepsArray.length).to.equal(5);
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

  it('should allow skipping the Select Research Studies step', (done) => {
    defineCohortStep
      .select()
      .then(() => defineCohortStep.isSelected())
      .then((isSelected) => {
        expect(isSelected).to.equal(true);
        return settingsStep.select();
      })
      .then(() => done())
  });

  it('should allow to proceed to the Select Research Studies step', (done) => {
    nextPageBtn
      .click()
      .then(() => selectAnAreaOfInterestStep.isSelected())
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
});
