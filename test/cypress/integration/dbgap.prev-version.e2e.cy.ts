describe('Research Data Finder (dbGap)', () => {

  it( 'should show spinner during server initialization', () => {
    cy.initApp('/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&prev-version=enable');
  });

  it('should display welcome message for the first step', () => {
    cy.contains('app-stepper > p:first-child', 'This is a query tool')
      .should('be.visible');
  });

  it('should display all steps', () => {
    cy.checkStepCount(5);
  });

  it('should select the "Settings step" by default', () => {
    cy.isStepSelected('Settings');
  });

  it('should not allow empty "Advanced Setting" fields', () => {
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

        cy.get('@inputField').clear({force: true});
        cy.get('@inputField').blur({force: true});
        cy.contains('button:visible', 'Select Research Studies').should('be.disabled');
        cy.selectStep( 'Select Research Studies');
        cy.isStepSelected('Settings');
        cy.then(() => cy.get('@inputField').type(value, {force: true}));
        cy.get('@inputField').blur({force: true});
        cy.contains('button', 'Select Research Studies', {timeout: 20000}).should('be.enabled');
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

    cy.get('@inputField').clear({force: true});
    cy.get('@inputField').type('https://dbgap-api.ncbi.nlm.nih.gov/fhir/something', {force: true});
    cy.get('@inputField').blur({force: true});

    cy.get('app-fhir-server-select.loading').should('exist');
    cy.get('app-fhir-server-select.loading', {timeout: 20000}).should('not.exist');
    cy.contains('button:visible', 'Define cohort').should('be.disabled');
    cy.selectStep( 'Define cohort');
    cy.isStepSelected('Settings');
    cy.get('@inputField').clear({force: true});
    cy.then(() => cy.get('@inputField').type(value, {force: true}));
    cy.get('@inputField').blur({force: true});

    cy.get('app-fhir-server-select.loading').should('exist');
    cy.get('app-fhir-server-select.loading', {timeout: 20000}).should('not.exist');
  });

  it('should not allow skipping the "Define cohort" step', () => {
    cy.selectStep( 'View cohort');
    cy.isStepSelected('Settings');
  });

  it('should allow skipping the "Select Research Studies" step', () => {
    cy.selectStep( 'Define cohort');
    cy.isStepSelected('Define cohort');
  });

  it('should allow to proceed to the Select Research Studies step', () => {
    cy.selectStep( 'Settings');
    cy.clickButton( 'Select Research Studies');
  });

  it('should allow to proceed to the "Define cohort" step', () => {
    cy.selectStep( 'Define cohort');
    cy.isStepSelected('Define cohort');
  });
});
