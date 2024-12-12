describe('Research Data Finder (dbGap alpha version cart-based approach)', () => {

  it( 'should show spinner during server initialization', () => {
    cy.initApp('/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&prev-version=disable');
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
        cy.contains('button:visible', 'Select an action').should('be.disabled');
        cy.selectStep( 'Select an action');
        cy.isStepSelected('Settings');
        cy.then(() => cy.get('@inputField').type(value, {force: true}));
        cy.get('@inputField').blur({force: true});
        cy.contains('button', 'Select an action', {timeout: 20000}).should('be.enabled');
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
    cy.contains('button:visible', 'Select an action').should('be.disabled');
    cy.selectStep( 'Select an action');
    cy.isStepSelected('Settings');
    cy.get('@inputField').clear({force: true});
    cy.then(() => cy.get('@inputField').type(value, {force: true}));
    cy.get('@inputField').blur({force: true});

    cy.get('app-fhir-server-select.loading').should('exist');
    cy.get('app-fhir-server-select.loading', {timeout: 20000}).should('not.exist');
  });

  it('should allow to proceed to the "Select An Action" step', () => {
    cy.clickButton( 'Select an action');
    cy.isStepSelected( 'Select an action');
  });

  it('should not display welcome message for the next steps', () => {
    cy.contains('app-stepper > p:first-child', 'This is a query tool')
      .should('not.exist');
  });

  it('should not allow to proceed to the next step without selecting an action', () => {
    cy.contains('button:visible', 'Next').should('be.disabled');
    cy.checkStepCount(2);
  });

  it('should display all steps after selecting cart approach', () => {
    cy.clickLabel('Create a cohort of patients by browsing and selecting records');
    cy.checkStepCount(5);
  });

  it('should allow to proceed to the "Select Records" step by a hack', () => {
    // Bypass RAS login in the test using a hidden button.
    cy.get('#hiddenButton').click({force: true});
    cy.selectStep('Select records');
    cy.isStepSelected( 'Select records');
  });


  it('should not allow skipping patient search before the "View Cohort" step', () => {
    cy.selectStep('View cohort');
    cy.isStepSelected('Select records');
  });

  it('should allow to proceed to the "View cohort" step', () => {
    cy.clickButton('Search for Patients');
    cy.isStepSelected('View cohort');
  });

  it('should save cohort', () => {
    cy.contains('button:visible', 'Save the cohort and criteria for later', {timeout: 30000})
      .should('be.enabled')
      .as('saveBtn');
    cy.get('@saveBtn').click();
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

  // This should be the last test in the suite. It sets a fake TST token into FhirBatchQuery._authorizationHeader,
  // and it won't work for subsequent dbGaP queries.
  it('should use new TST token after RAS login', () => {
    cy.contains('Select an action').click();
    cy.contains(
      'Create a cohort of patients by browsing and selecting records'
    ).click();
    // Stub rdf-server requests to return a fake TST token.
    cy.intercept('/rdf-server/login', (req) => {
      req.redirect('/fhir/research-data-finder/request-redirect-token-callback?tst-token=test');
    });
    cy.intercept('/rdf-server/tst-return/?tst-token=test', {
      statusCode: 200,
      body: {
        message: {
          tst: 'testTstToken'
        }
      }
    });
    // Triggers RAS login.
    cy.contains('Next').click();
    cy.intercept('https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/**', {
      statusCode: 200
    }).as('dbgapQuery');
    // Verify that the dbGaP initialization query after RAS login contains the new TST token in "Authorization" header.
    cy.wait('@dbgapQuery')
      .its('request.headers')
      .should('have.property', 'authorization', 'Bearer testTstToken');
    // Clear TST token in sessionStorage so we don't get issues when tests are re-run during "cypress open".
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });
  });

});
