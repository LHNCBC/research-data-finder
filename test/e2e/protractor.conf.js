// Protractor configuration
// https://github.com/angular/protractor/blob/master/referenceConf.js

'use strict';

const os = require("os");

exports.config = {
  // The timeout for each script run on the browser. This should be longer
  // than the maximum time your application needs to stabilize between tasks.
  allScriptsTimeout: 110000,

  // A base URL for your application under test. Calls to protractor.get()
  // with relative paths will be prepended with this.
  baseUrl: 'http://localhost:4029',

  // If true, only chromedriver will be started, not a standalone selenium.
  // Tests for browsers other than chrome will not run.
  // directConnect: true,

  // list of files / patterns to load in the browser
  specs: [
    './**/*.spec.js' // relative to this file
  ],

  // Patterns to exclude.
  exclude: [],

  // ----- Capabilities to be passed to the webdriver instance ----
  //
  // For a full list of available capabilities, see
  // https://github.com/SeleniumHQ/selenium/blob/master/javascript/webdriver/capabilities.js
  capabilities: {
    'browserName': 'chrome',
    'chromeOptions': {
      // Set download path and avoid prompting for download even though
      // this is already the default on Chrome but for completeness
      prefs: {
        'download': {
          'prompt_for_download': false,
          'default_directory': os.tmpdir(),
          'directory_upgrade': true
        }
      }
    }
  },

  // Fix the port number so we can restrict access to it via iptables
  seleniumPort: 4444,

  // ----- The test framework -----
  //
  // Jasmine and Cucumber are fully supported as a test and assertion framework.
  // Mocha has limited beta support. You will need to include your own
  // assertion framework if working with mocha.
  framework: 'jasmine2',

  // ----- Options to be passed to minijasminenode -----
  //
  // See the full list at https://github.com/juliemr/minijasminenode
  jasmineNodeOpts: {
    defaultTimeoutInterval: 30000,
    print: function() {}
  },

  onPrepare: function(){
    /**
     * By default, protracotor expects it to be angular application. This is used
     * to switch between angular and non angular sites.
     *
     * @param {Boolean} flag
     * @returns {Void}
     */
    global.setAngularSite = function(flag){
      browser.ignoreSynchronization = !flag;
    };

    // disable animation
    // http://stackoverflow.com/questions/26584451/how-to-disable-animations-in-protractor-for-angular-js-appliction
    var disableNgAnimate = function() {
      angular
        .module('disableNgAnimate', [])
        .run(['$animate', function($animate) {
          $animate.enabled(false);
        }]);
    };

    var disableCssAnimate = function() {
      angular
        .module('disableCssAnimate', [])
        .run(function() {
          var style = document.createElement('style');
          style.type = 'text/css';
          style.innerHTML = '* {' +
            '-webkit-transition: none !important;' +
            '-moz-transition: none !important' +
            '-o-transition: none !important' +
            '-ms-transition: none !important' +
            'transition: none !important' +
            '}';
          document.getElementsByTagName('head')[0].appendChild(style);
        });
    };

    // disable ng-animate during the testing
    browser.addMockModule('disableNgAnimate', disableNgAnimate);
    browser.addMockModule('disableCssAnimate', disableCssAnimate);

    // Replace default dot reporter with something better.
    var SpecReporter = require('jasmine-spec-reporter').SpecReporter;
    // add jasmine spec reporter
    jasmine.getEnv().addReporter(new SpecReporter({summary:{displayStacktrace: true}}));

  }

};
