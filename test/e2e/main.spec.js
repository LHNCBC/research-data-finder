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
  it('should load observations filtered by category', function () {
    setAngularSite(false);
    browser.get('/');
    $('#categories').sendKeys('vital');
    $('#categories').sendKeys(protractor.Key.ARROW_DOWN);
    $('#categories').sendKeys(protractor.Key.TAB);
    $('#load').click();
    browser.wait(EC.visibilityOf($('#results')));
  });

  it('should load observations filtered by tests', function () {
    setAngularSite(false);
    browser.get('/');
    $('#limit2').click();
    $('#load').click();
    browser.wait(EC.visibilityOf($('#results')));
  });
});
