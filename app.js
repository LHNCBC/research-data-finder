// Imports for webpack to find assets
import './app.css';
import './USAgov.gif';
import './lhncbc.jpg';

// "Real" imports
import * as catData from './categoryList';
import { saveAs } from 'file-saver';
import { ObservationsTable } from './observations-table'

var noResultsMsg = document.getElementById('noResults');
var resultsSection = document.getElementById('results');
var catLimitRow = document.getElementById('catSel');
var testLimitRow = document.getElementById('testSel');
var loadButton = document.getElementById('load');
var downloadButton = document.getElementById('download');
var categoryLimits = true;
var ajaxCache = {}; // url to XMLHttpRequest

new Def.Autocompleter.Prefetch('fhirServer', [
  'https://lforms-fhir.nlm.nih.gov/baseR4',
  'https://lforms-fhir.nlm.nih.gov/baseDstu3']);

var loincAC = new Def.Autocompleter.Search('loincTests',
  'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question',
  {maxSelect: '*', matchListValue: true});

// Set up propulated values
var selectedTests = [['Weight', '29463-7'], ['Body height Measured', '3137-7'],
  ['Feeling down, depressed, or hopeless?', '44255-8'], ['Current smoker', '64234-8']];
for (var i=0, len=selectedTests.length; i<len; ++i) {
  var testData = selectedTests[i];
  // TBD -- These APIs are not documented.  We should probably add something to
  // the autocompleter for setting the state of a search list.
  loincAC.storeSelectedItem(testData[0], testData[1]);
  loincAC.addToSelectedArea(testData[0]);
}

// Category list
var categoryAC = new Def.Autocompleter.Prefetch('categories', catData.display,
  {codes: catData.codes});
categoryAC.setFieldToListValue('Vital Signs');

/**
 *  Used to show a message when there are no results to display.
 */
function showNonResultsMsg(msg) {
  noResultsMsg.innerText=msg;
  noResultsMsg.style.display = '';
  resultsSection.style.display = 'none';
  downloadButton.style.display = 'none';
}

/**
 *  Enables the display of the results portion of the page.
 */
function showResults() {
  noResultsMsg.style.display = 'none';
  resultsSection.style.display = '';
  downloadButton.style.display = '';
}


const observationsTable = new ObservationsTable('resultsTable')

/**
 *  Handles the request to load the observations.
 */
export function loadObs() {
  loadButton.disabled = true;
  var perPatientPerTest = document.getElementById('perPatientPerTest').value || Number.POSITIVE_INFINITY;
  var serverURL = document.getElementById('fhirServer').value;
  var url = serverURL + '/Observation?_format=application/json&'+
    '_sort=patient,code,-date&_include=Observation:patient';
  var codes, field, count;
  if (categoryLimits) {
    codes=categoryAC.getSelectedCodes();
    field='category';
    count = 1000;
  }
  else { // test codes instead of categories
    codes=loincAC.getSelectedCodes();
    field='code';
    count = 5000;
  }
  if (codes && codes.length > 0) {
    url += '&'+field+'=' + codes.map(s=>encodeURIComponent(s)).join(',');
    showNonResultsMsg('Searching...');
  }
  else {
    count = 100;
    showNonResultsMsg('Searching across all Observations without specifying '+
      'tests or categories.  This could take a while...');
  }
  url += '&_count='+count;
  getURLWithCache(url, function(status, data) {
    if (status != 200)
      showNonResultsMsg('Could not load data for selected codes');
    else {
      var startProcessingTime = new Date();
      data = JSON.parse(data);
      if (!data.entry)
        showNonResultsMsg('No matching Observations found.');
      else {
        showResults();
        observationsTable.fill(data, perPatientPerTest, serverURL);
      }
      console.log("Processed response in "+(new Date() - startProcessingTime));
    }
    loadButton.disabled = false;
  });
}

/**
 *  Handles the request to download the observations.
 */
export function downloadObs() {
  saveAs(observationsTable.getBlob(), 'observations.csv');
}

/**
 *  Gets the response content from a URL.  The callback will be called with the
 *  status and response text.
 * @param url the URL whose data is to be retrieved.
 * @param callback the function to receive the reponse.  The callback will be
 *  passed the request status, the response text, and the XMLHttpRequest object.
 * @return the XMLHttpRequest object
 */
function getURL(url, callback) {
  var oReq = new XMLHttpRequest();
  oReq.onreadystatechange = function () {
    if (oReq.readyState === 4) {
      console.log("AJAX call returned in "+(new Date() - startAjaxTime));
      callback(oReq.status, oReq.responseText, oReq);
    }
  }
  var startAjaxTime = new Date();
  oReq.open("GET", url);
  oReq.send();
}


/**
 *  Like getURL, but uses a cache if the URL has been requested before.
 * @param url the URL whose data is to be retrieved.
 * @param callback the function to receive the reponse.  The callback will be
 *  passed the request status, the response text, and the XMLHttpRequest object.
 */
function getURLWithCache(url, callback) {
  var cachedReq = ajaxCache[url];
  if (cachedReq) {
    console.log("Using cached data");
    callback(cachedReq.status, cachedReq.responseText, cachedReq);
  }
  else {
    getURL(url, function(status, text, req) {
      ajaxCache[url] = req;
      callback(status, text, req);
    });
  }
}


/**
 *  Handles the request to change the limit type selection (category or test
 *  type).
 * @param ev the change event
 */
function handleLimitSelection(ev) {
  setLimitType(ev.target.id === 'limit1');
}

/**
 *  Sets the limit type (category or test) and adjusts the display.
 * @param isCategory true if categories are to be used.
 */
function setLimitType(isCategory) {
  categoryLimits = isCategory;
  testLimitRow.style.display = categoryLimits ? 'none' : '';
  catLimitRow.style.display = categoryLimits ? '' : 'none';
}
setLimitType(false);

var categoryRadio = document.getElementById('limit1');
categoryRadio.addEventListener('change', handleLimitSelection);
document.getElementById('limit2').addEventListener('change', handleLimitSelection);

