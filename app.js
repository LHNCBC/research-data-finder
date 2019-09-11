// Imports for webpack to find assets
import './app.css';
import './USAgov.gif';
import './lhncbc.jpg';

// "Real" imports
import * as catData from './categoryList';

var noResultsMsg = document.getElementById('noResults');
var resultsSection = document.getElementById('results');
var catLimitRow = document.getElementById('catSel');
var testLimitRow = document.getElementById('testSel');
var loadButton = document.getElementById('load');
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
}

/**
 *  Enables the display of the results portion of the page.
 */
function showResults() {
  noResultsMsg.style.display = 'none';
  resultsSection.style.display = '';
}


/**
 *  Builds a patient name string from a Patient resource.
 * @param res the Patient resource
 * @return the name string, or null if one could not be constructed.
 */
function patientNameStr(res) {
  var rtn = null;
  if (res.name && res.name.length > 0) {
    var nameStr = '';
    var name = res.name[0];
    if (name.given && name.given.length > 0)
      nameStr = name.given[0];
    if (name.family) {
      if (nameStr.length > 0)
        nameStr += ' ';
      nameStr += name.family;
    }
    if (nameStr.length > 0)
      rtn = nameStr;
  }
  return rtn;
}


/**
 *  Handles the request to load the observations.
 */
export function loadObs() {
  loadButton.disabled = true;
  var perPatientPerTest = document.getElementById('perPatientPerTest').value || Number.POSITIVE_INFINITY;
  var serverURL = document.getElementById('fhirServer').value;
  var patientToCodeToCount = {};
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
        // Separate Observations from Patients, and create name strings for the Patients
        var obs=[]
        var pRefToName = {};
        for (var i=0, len=data.entry.length; i<len; ++i) {
          var res = data.entry[i].resource;
          if (res.resourceType === 'Observation')
            obs.push(res);
          else { // assume Patient for now
            var pName = patientNameStr(res);
            if (pName)
              pRefToName['Patient/'+res.id] = pName;
          }
        }

        showResults();
        var tbody = document.getElementById('resultsTBody');
        tbody.innerHTML = ''; // clear previous results
        for (var i=0, len=obs.length; i<len; ++i) {
          // Per Clem, we will only show perPatientPerTest results per patient
          // per test.
          var res = obs[i];
          var patient = res.subject.display || pRefToName[res.subject.reference];
          if (!patient)
            patient = res.subject.reference;
          var codeToCount = patientToCodeToCount[patient] ||
            (patientToCodeToCount[patient]={});
          var codeStr;
          var codeableConcept = res.code;
          // For now skip Observations without a code in the first coding.
          if (codeableConcept && codeableConcept.coding &&
              codeableConcept.coding.length > 0 &&
              codeableConcept.coding[0].code) {
            codeStr = codeableConcept.coding[0].code;
            var codeCount = codeToCount[codeStr] || (codeToCount[codeStr] = 0);
            if (codeCount < perPatientPerTest) {
              ++codeToCount[codeStr];
              var row = createElem('tr', tbody);
              createElem('td', row, patient);
              var date = res.effectiveDateTime;
              var time = '';
              var tIndex = date.indexOf('T');
              if (tIndex >= 0) {
                time = date.slice(tIndex+1);
                date = date.slice(0, tIndex);
              }
              createElem('td', row, date);
              createElem('td', row, time);
              var obsName = codeableConcept.text || codeableConcept.coding[0].display;
              createElem('td', row, obsName);
              var resKeys = Object.keys(res);
              var valKey = undefined;
              for (var j=0, jLen=resKeys.length; j<jLen && !valKey; ++j) {
                if (resKeys[j].match(/^value/))
                  valKey = resKeys[j];
              }
              var value = res[valKey];
              var unit = '';
              if (valKey == 'valueQuantity') {
                unit = value.unit;
                value = value.value;
              }
              else if (valKey == 'valueCodeableConcept' && value.coding && value.coding.length)
                value = value.text || value.coding[0].display;
              createElem('td', row, value);
              createElem('td', row, unit);
              var obsCell = createElem('td', row);
              var obsLink = createElem('a', obsCell, res.id);
              obsLink.setAttribute('href', serverURL + '/Observation/'+res.id);
              obsLink.setAttribute('target', '_blank');
            }
          }
        }
      }
      console.log("Processed response in "+(new Date() - startProcessingTime));
    }
    loadButton.disabled = false;
  });
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
 *  Creates a element with the given tagName and (optional) textContent, and
 *  adds it to the given parent element.
 */
function createElem(tagName, parent, textContent) {
  var elem = document.createElement(tagName);
  if (textContent != undefined)
    elem.innerText = textContent;
  parent.appendChild(elem);
  return elem;
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
setLimitType(true);

var categoryRadio = document.getElementById('limit1');
categoryRadio.addEventListener('change', handleLimitSelection);
document.getElementById('limit2').addEventListener('change', handleLimitSelection);

// On a page reload, the browser sometimes remembers the last setting of a radio
// button group.  Make sure the first option is the one selected.
categoryRadio.click();
