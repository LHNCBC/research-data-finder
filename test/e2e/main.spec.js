'use strict';

// Save original config to restore after the tests.
var path = require('path');
var EC = protractor.ExpectedConditions;

/**
 * Utility method to run a shell command
 * @param cmdStr {String} String to execute on the shell.
 * @returns {void}
 */
function execCmd(cmdStr) {
  require('child_process').execSync(cmdStr);
}

describe('Observation Viewer', function() {
  it('should load observations', function () {
    setAngularSite(false);
    browser.get('/');
    $('#fhirLink').click();
    element(by.cssContainingText('a', 'Observation Viewer')).click();
    $('#load').click();
    browser.wait(EC.visibilityOf($('#results')));
  });
});
