// ***********************************************
// This example namespace declaration will help
// with Intellisense and code completion in your
// IDE or Text Editor.
// ***********************************************
// declare namespace Cypress {
//   interface Chainable<Subject = any> {
//     customCommand(param: any): typeof customCommand;
//   }
// }
//
// function customCommand(param: any): void {
//   console.warn(param);
// }
//
// NOTE: You can use it like so:
// Cypress.Commands.add('customCommand', customCommand);
//
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Custom command to initialize the application at the specified URL.
     * Also checks if spinner is displayed during initialization.
     * @param url - application URL
     * @example cy.initApp('/?server=https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1&prev-version=disable')
     */
    initApp(url: string): Chainable<Subject>;
    /**
     * Custom command to click on a visible button with the specified text content.
     * @param text - text or regular expression
     * @example cy.clickButton('text')
     */
    clickButton(text: string | RegExp): Chainable<Subject>;
    /**
     * Custom command to click on a visible label with the specified text content.
     * @param text - text or regular expression
     * @example cy.clickLabel('text')
     */
    clickLabel(text: string | RegExp): Chainable<Subject>;
    /**
     * Custom command to click on a step header with the specified name.
     * @param name - full step name
     * @example cy.selectStep('text')
     */
    selectStep(name: string): Chainable<Subject>;
    /**
     * Custom command to check if a step with the specified name is selected.
     * @param name - full step name
     * @example cy.isStepSelected('text')
     */
    isStepSelected(name: string): Chainable<Subject>;
    /**
     * Custom command to check the number of visible steps.
     * @param num - number of visible steps
     * @example cy.checkStepCount(2)
     */
    checkStepCount(num: number): Chainable<Subject>;
    /**
     * Custom command to type text into an input field.
     * @param selector - selector for the input field
     * @param text - some text
     * @example cy.typeTextToInput('#inputId', 'text')
     */
    typeTextToInput(selector: string, text: string): Chainable<Subject>;
  }
}

Cypress.Commands.add('initApp', (url) => {
  cy.visit(url);
  cy.get('app-fhir-server-select.loading')
    .should('exist');
  return cy.get('app-fhir-server-select.loading', {timeout: 30000})
    .should('not.exist');
});

Cypress.Commands.add('clickButton', (containedText) => {
  return cy.contains('button:visible', containedText).click({timeout: 10000});
});

Cypress.Commands.add('clickLabel', (containedText) => {
  return cy.contains('label', containedText).click({timeout: 10000});
});

Cypress.Commands.add('selectStep', (name) => {
  return cy.contains('.mat-step-header .mat-step-text-label', name).click();
});

Cypress.Commands.add('isStepSelected', (name) => {
  return cy.get('.mat-step-header .mat-step-label-selected .mat-step-text-label')
    .should('have.text', name);
});

Cypress.Commands.add('checkStepCount', (num) => {
  return cy.get('mat-step-header').should('have.length', num);
});

Cypress.Commands.add('typeTextToInput', (selector, text) => {
  cy.get(selector).type(text, {force: true});
  return cy.get(selector).blur({force: true});
});
