import {
  MatStepHarness,
  MatStepperHarness,
  MatStepperNextHarness
} from '@angular/material/stepper/testing';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
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
      '/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&alpha-version=disable'
    )
      // Waiting for application initialization
      .get('.init-spinner-container')
      .should('exist')
      .get('.init-spinner-container', {timeout: 90000})
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
        settingsStep.select();
        done();
      });
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
