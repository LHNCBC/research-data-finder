describe('Research Data Finder (baseR4)', () => {

  it( 'should show spinner during server initialization', () => {
    cy.visit('/?server=https://lforms-fhir.nlm.nih.gov/baseR4&prev-version=disable');
    cy.get('app-fhir-server-select.loading')
      .should('exist');
    cy.get('app-fhir-server-select.loading', {timeout: 30000})
      .should('not.exist');
  });

  it('should display welcome message for the first step', () => {
    cy.contains('app-stepper > p:first-child', 'This is a query tool')
      .should('be.visible');
  });

  it('should display 2 steps at the beginning', () => {
    cy.checkStepCount(2);
  });

  it('should select the "Settings" step by default', () => {
    cy.isStepSelected('Settings');
  });

  it('should allow to proceed to the "Select An Action" step', () => {
    cy.clickButton( 'Select an action');
    cy.isStepSelected( 'Select an action');
  });

  it('should not display welcome message for the next steps', () => {
    cy.contains('app-stepper > p:first-child', 'This is a query tool')
      .should('not.exist');
  });

  it('should display all steps after selecting cart approach', () => {
    cy.clickLabel('Create a cohort of patients by browsing and selecting records');
    cy.checkStepCount(5);
  });

  it('should allow to proceed to the "Select Records" step', () => {
    cy.clickButton('Next');
    cy.isStepSelected('Select records');
  });

  it('should not allow skipping patient search before the "View Cohort" step', () => {
    cy.selectStep('View cohort');
    cy.isStepSelected('Select records');
  });

  it('should allow to proceed to the "View cohort" step', () => {
    cy.clickButton('Search for Patients');
    cy.isStepSelected('View cohort');
  });

  it('should allow to proceed to the "Pull data for the cohort" step', () => {
    cy.clickButton('Pull data for the cohort');
    cy.isStepSelected('Pull data for the cohort');
  });

});
