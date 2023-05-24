import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
import { getHarness } from '@jscutlery/cypress-harness';

describe('Research Data Finder (dbGap alpha version)', () => {
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
    cy.visit(
      '/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&alpha-version=enable'
    )
      // Waiting for application initialization
      .get('.init-spinner-container')
      .should('exist')
      .get('.init-spinner-container', { timeout: 30000 })
      .should('not.exist')
      .then(() => getHarness(MatStepperHarness))
      .then((result: MatStepperHarness) => {
        stepper = result;
        return stepper.getSteps();
      })
      .then((stepsArr) => {
        stepsArray = stepsArr;
        [settingsStep, selectAnActionStep] = stepsArray;
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

  it('should display 2 steps', () => {
    expect(stepsArray.length).to.equal(2);
  });

  it('should select the Settings step by default', (done) => {
    settingsStep.isSelected().then((isSelected) => {
      expect(isSelected).to.equal(true);
      done();
    });
  });

  describe('in Settings step', () => {
    before((done) => {
      settingsStep
        .select()
        .then(() => settingsStep.getHarness(MatExpansionPanelHarness))
        .then((advancedSettings) => {
          advancedSettings.expand();
          done();
        });
    });

    [
      ['server URL', 'serviceBaseUrl'],
      ['Request per batch', 'maxRequestsPerBatch'],
      ['Maximum active requests', 'maxActiveRequests']
    ].forEach(([displayName, controlName]) => {
      it(`should not allow empty "${displayName}"`, () => {
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
          .then(() => cy.get('@inputField').type(value));
      });
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

  it('should save cohort', () => {
    cy.contains('Save the cohort and criteria for later', { timeout: 10000 })
      .should('be.enabled')
      .click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/cohort-100.json`, {
      timeout: 5000
    }).should('not.be.null');
    cy.task('removeCohortFileIfExist');
  });

  it('should load cohort', () => {
    cy.contains('Select records').click();
    cy.get('#hiddenFileInput3').selectFile(
      'test/cypress/fixtures/cohort-to-upload-dbgap.json',
      {
        force: true
      }
    );
    cy.contains('Cohort of 3 Patient resources').should('exist');
    cy.contains('Select records').click();
    cy.contains('Variables').click();
    cy.contains('Variables in Cart').should('be.visible');
    cy.contains('selected test variable constraint').should('be.visible');
  });
});
