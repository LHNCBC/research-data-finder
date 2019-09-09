// Imports for webpack to find assets
import './app.css';
import './USAgov.gif';
import './lhncbc.jpg';

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
new Def.Autocompleter.Prefetch('categories', ['Social History', 'Vital Signs', 'Imaging', 'Laboratory', 'Procedure', 'Survey', 'Exam', 'Therapy',
  'Activity'], {codes: ['social-history', 'vital-signs', 'laboratory', 'procedure', 'survey', 'exam', 'therapy', 'activity']});

var noResultsMsg = document.getElementById('noResults');
var resultsSection = document.getElementById('results');
var catLimitRow = document.getElementById('catSel');
var testLimitRow = document.getElementById('testSel');

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
 *  Handles the request to load the observations.
 */
export function loadObs() {
  var perPatientPerTest = document.getElementById('perPatientPerTest').value || Number.POSITIVE_INFINITY;
  var codes=loincAC.getSelectedCodes();
  if (!codes || !codes.length > 0)
    noResultsMsg
  var serverURL = document.getElementById('fhirServer').value;
  var patientToCodeToCount = {};
  var url = serverURL + '/Observation?_format=application/json&_sort=patient,code,-date';
  if (codes && codes.length > 0) {
    var count = 5000;
    url += '&code=' + codes.join(',');
    showNonResultsMsg('Searching...');
  }
  else {
    count = 1000;
    showNonResultsMsg('Searching across all Observations without specifying tests.  This could take a while...');
  }
  url += '&_count='+count;
  getURL(url, function(status, data) {
    if (status != 200)
      showNonResultsMsg('Could not load data for selected codes');
    else {
      data = JSON.parse(data);
      if (!data.entry)
        showNonResultsMsg('No matching Observations found.');
      else {
        showResults();
        var tbody = document.getElementById('resultsTBody');
        tbody.innerHTML = ''; // clear previous results
        for (var i=0, len=data.entry.length; i<len; ++i) {
          // Per Clem, we will only show perPatientPerTest results per patient
          // per test.
          var res = data.entry[i].resource;
          var patient = res.subject.display;
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
    }
  });
}

/**
 *  Gets the response content from a URL.  The callback will be called with the
 *  status and response text.
 * @param url the URL whose data is to be retrieved.
 * @param callback the function to receive the request status and data.
 */
function getURL(url, callback) {
  var oReq = new XMLHttpRequest();
  oReq.onreadystatechange = function () {
    if (oReq.readyState === 4)
      callback(oReq.status, oReq.responseText);
  }
  oReq.open("GET", url);
  oReq.send();
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
function setLimitType(ev) {
  var elem = ev.target;
  var isCatLimit = elem.id === 'limit1';
  testLimitRow.style.display = isCatLimit ? 'none' : '';
}

var categoryRadio = document.getElementById('limit1');
categoryRadio.addEventListener('change', setLimitType);
document.getElementById('limit2').addEventListener('change', setLimitType);

// On a page reload, the browser sometimes remembers the last setting of a radio
// button group.  Make sure the first option is the one selected.
categoryRadio.click();
