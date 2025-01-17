import 'cypress-file-upload';

describe('Research Data Finder (baseR4)', () => {

  it( 'should show spinner during server initialization', () => {
    cy.visit('/?server=https://lforms-fhir.nlm.nih.gov/baseR4&prev-version=enable');
    cy.get('app-fhir-server-select.loading')
      .should('exist');
    cy.get('app-fhir-server-select.loading', {timeout: 30000})
      .should('not.exist');
  });

  it('should display welcome message for the first step', () => {
    cy.contains('app-stepper > p:first-child', 'This is a query tool')
      .should('be.visible');
  });

  it('should display all steps', () => {
    cy.checkStepCount(4);
  });

  it('should select the "Settings" step by default', () => {
    cy.isStepSelected('Settings');
  });

  it('should not allow skipping the Define cohort step', () => {
    cy.selectStep('View cohort');
    cy.isStepSelected('Settings');
  });

  it('should allow to proceed to the Define cohort step', () => {
    cy.clickButton('Define cohort')
    cy.isStepSelected('Define cohort');
  });

  it('should be an autocomplete field for DocumentReference.contenttype', () => {
    cy.clickButton('Add criteria for a record type');
    cy.typeTextToInput(
      'mat-form-field.resource-type app-autocomplete input',
      'DocumentReference'
    );
    cy.clickButton('Add a criterion for the DocumentReference record');
    cy.typeTextToInput(
      'mat-form-field.parameter-name app-autocomplete input',
      'contenttype'
    );
    cy.get('#autocomplete-test-value-1').focus();
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li').should('not.be.empty');
    cy.get('button.remove-btn').eq(0).click();
  });

  it('should be an autocomplete field for Encounter.type', () => {
    cy.clickButton('Add criteria for a record type');
    cy.typeTextToInput(
      'mat-form-field.resource-type app-autocomplete input',
      'Encounter'
    );
    cy.clickButton('Add a criterion for the Encounter record');
    cy.typeTextToInput(
      'mat-form-field.parameter-name app-autocomplete input',
      'type'
    );
    cy.get('#autocomplete-test-value-2').focus();
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li').should('not.be.empty');
    cy.get('button.remove-btn').eq(0).click();
  });

  it('should add search criterion', () => {
    cy.clickButton('Add criteria for a record type');
    cy.typeTextToInput(
      'mat-form-field.resource-type app-autocomplete input',
      'Observation'
    );
    cy.clickButton('Add a criterion for the Observation record');
    cy.typeTextToInput(
      'mat-form-field.parameter-name app-autocomplete input',
      'variable name'
    );
    cy.typeTextToInput('#code-selector-1', 'Height cm');
    cy.get('#completionOptions').should('be.visible');
    cy.get('#completionOptions > ul > li:first-child').click();
  });

  it('should not allow skipping patient search before the "View Cohort" step', () => {
    cy.selectStep('View cohort');
    cy.isStepSelected('Define cohort');
  });

  it('should allow to proceed to the "View cohort" step', () => {
    cy.clickButton('Search for Patients');
    cy.isStepSelected('View cohort');
  });

  it('should save cohort', () => {
    cy.clickButton('Save the cohort and criteria for later');
    cy.readFile(`${Cypress.config('downloadsFolder')}/cohort-100.json`, {
      timeout: 15000
    }).should('not.be.null');
    cy.task('removeCohortFileIfExist');
  });

  it('should load cohort', () => {
    cy.selectStep('Define cohort');
    cy.get('#hiddenFileInput').attachFile('cohort-to-upload.json');
    cy.contains('Cohort of 4 Patient resources').should('exist');
    // Verify that 4 rows are loaded in table, same as in upload file.
    cy.get('table tbody tr').should('have.length', 4);
  });

  it('should allow to proceed to the "Pull data for the cohort" step', () => {
    cy.clickButton('Pull data for the cohort');
    cy.isStepSelected('Pull data for the cohort');
  });

  it('should use default observation codes for the "Pull data for the cohort" step', () => {
    cy.get('app-search-parameter-group .autocomp_selected > ul > li').should(
      'have.text',
      '×Height cm'
    );
  });

  it('should load Observation table', () => {
    cy.clickButton('Load Observations');
    cy.get('app-resource-table[context="pull-data"]').should('exist');
  });

  it('should show value column in Observations table', () => {
    cy.get('app-resource-table[context="pull-data"] thead', { timeout: 10000 })
      .contains('Value')
      .should('exist');
  });
});
