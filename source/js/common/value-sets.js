export const valueSets = {
  administrativeGenderList: [
    { display: 'Male', code: 'male'},
    { display: 'Female', code: 'female'},
    { display: 'Other', code: 'other'},
    { display: 'Unknown', code: 'unknown'},
  ],
  addressUse: [
    { display: 'Home', code: 'home'},
    { display: 'Work', code: 'work'},
    { display: 'Temporary', code: 'temp'},
    { display: 'Old/Incorrect', code: 'old'},
    { display: 'Billing', code: 'billing'},
  ],
  contactPointUse: [
    { display: 'Home', code: 'home'},
    { display: 'Work', code: 'work'},
    { display: 'Temp', code: 'temp'},
    { display: 'Old', code: 'old'},
    { display: 'Mobile', code: 'mobile'},
  ],
  // See: https://www.hl7.org/fhir/v3/ActEncounterCode/vs.html
  actEncounterCode: [
    { display: 'ambulatory', code: 'AMB'},
    { display: 'emergency', code: 'EMER'},
    { display: 'field', code: 'FLD'},
    { display: 'home health', code: 'HH'},
    { display: 'inpatient encounter', code: 'IMP'},
    { display: 'inpatient acute', code: 'ACUTE'},
    { display: 'inpatient non-acute', code: 'NONAC'},
    { display: 'observation encounter', code: 'OBSENC'},
    { display: 'pre-admission', code: 'PRENC'},
    { display: 'short stay', code: 'SS'},
    { display: 'virtual', code: 'VR'}
  ],
  // See: https://www.hl7.org/fhir/valueset-encounter-participant-type.html
  participantType: [
    { display: 'admitter', code: 'ADM'},
    { display: 'attender', code: 'ATND'},
    { display: 'callback contact', code: 'CALLBCK'},
    { display: 'consultant', code: 'CON'},
    { display: 'discharger', code: 'DIS'},
    { display: 'escort', code: 'ESC'},
    { display: 'referrer', code: 'REF'},
    { display: 'secondary performer', code: 'SPRF'},
    { display: 'primary performer', code: 'PPRF'},
    { display: 'Participation', code: 'PART'},
    { display: 'Translator', code: 'translator'},
    { display: 'Emergency', code: 'emergency'}
  ],
  // See: https://www.hl7.org/fhir/valueset-encounter-status.html
  encounterStatus: [
    { display: 'Planned', code: 'planned'},
    { display: 'Arrived', code: 'arrived'},
    { display: 'Triaged', code: 'triaged'},
    { display: 'In Progress', code: 'in-progress'},
    { display: 'On Leave', code: 'onleave'},
    { display: 'Finished', code: 'finished'},
    { display: 'Cancelled', code: 'cancelled'},
    { display: 'Entered in Error', code: 'entered-in-Error'},
    { display: 'Unknown', code: 'unknown'}
  ],
  // See: https://www.hl7.org/fhir/codesystem-encounter-type.html
  encounterType: [
    { display: '', code: ''},
    { display: '', code: ''},
    { display: '', code: ''},
    { display: '', code: ''},
  ]
};


export const valueSetsMap = Object.keys(valueSets).reduce((_valueSetsMap, entityName) => {
  _valueSetsMap[entityName] = valueSets[entityName].reduce((_entityMap, item) => {
    _entityMap[item.code] = item.display;
    return _entityMap;
  }, {});
  return _valueSetsMap;
}, {});

