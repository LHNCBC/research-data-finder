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
  ]
};


export const valueSetsMap = Object.keys(valueSets).reduce((_valueSetsMap, entityName) => {
  _valueSetsMap[entityName] = valueSets[entityName].reduce((_entityMap, item) => {
    _entityMap[item.code] = item.display;
    return _entityMap;
  }, {});
  return _valueSetsMap;
}, {});

