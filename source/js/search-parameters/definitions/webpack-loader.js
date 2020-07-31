/**
 * Webpack loader for "definitions/index.json".
 * This loader fills result object with data from "search-parameters.json" from https://www.hl7.org/fhir/downloads.html
 * Also uses "profiles-types.json", "profiles-resources.json", "valuesets.json" and "v3-codesystems.json" from the same directory.
 */
const { getOptions }  = require('loader-utils');
const fs = require('fs');

/**
 * Extracts search parameter description for specified resource type from a description of the search parameter
 * @param {string} resourceType
 * @param {string} description
 * @return {string}
 */
function getDescription(resourceType, description) {
  const descriptions = description.split('\r\n')
  const reDescription = new RegExp(`\\[${resourceType}][^:]*:\\s*(.*)`);
  let result = descriptions[0];
  if (descriptions.length > 1) {
    for (let i = 0; i < descriptions.length; ++i) {
      if(reDescription.test(descriptions[i])) {
        result = RegExp.$1;
        break;
      }
    }
  }
  return result.trim();
}

/**
 * Extract search parameters configuration from JSON FHIR Definitions (part of FHIR specification)
 * @param {string} directoryPath - directory where JSON files are located
 * @param {Array<string>} resourceTypes - list of resource types for which you want to get search parameters configuration
 * @param {Array<string>} additionalExpressions - list of additional expressions to extract value sets
 * @return {{}}
 */
function getSearchParametersConfig(directoryPath, resourceTypes, additionalExpressions) {
  const profiles = {
    parameters: JSON.parse(fs.readFileSync(directoryPath + '/search-parameters.json').toString()),
    resources: JSON.parse(fs.readFileSync(directoryPath + '/profiles-resources.json').toString()),
    types:  JSON.parse(fs.readFileSync(directoryPath + '/profiles-types.json').toString()),
    valueSets:  JSON.parse(fs.readFileSync(directoryPath + '/valuesets.json').toString()),
    v3CodeSystems:  JSON.parse(fs.readFileSync(directoryPath + '/v3-codesystems.json').toString())
  };

  /**
   * @typedef TypeDescriptionHash
   * @type {Object}
   * @property {string} type - type name
   * @property {string} [path] - path in which this type was found, if available
   * @property {Object} [typeDescription] - full type description object useful for debugging
   * @property {string} [valueSet] - value set url
   */

  /**
   * Finds type by expression
   * @param {string} expression
   * @return {TypeDescriptionHash}
   */
  function getTypeByExpression(expression) {
    // only one expression at this moment has substring ".exists()"
    if (expression.indexOf('.exists()') !== -1) {
      return {type: 'boolean'};
    }

    // we can't parse expressions with "where" now; therefore, we will treat them as having a string type
    if (expression.indexOf('.where(') !== -1) {
      return {type: 'string'};
    }

    const path = expression.split(' ')[0];
    return { path, ...getTypeByPath(path.split('.')) };
  }

  /**
   * Finds a type of resource property by the property path
   * @param {string} resourceType
   * @param {Array<string>} path
   * @return {TypeDescriptionHash}
   */
  function getTypeByPath([resourceType, ...path]) {
    if (!path.length) {
      return {
        type: resourceType
      };
    }
    const entry = profiles.resources.entry.find(i => i.resource.id === resourceType)
      || profiles.types.entry.find(i => i.resource.id === resourceType);
    const resource = entry.resource;
    const expression = resourceType + '.' + path[0];
    const desc = resource.snapshot.element.filter(i => i.id === expression)[0] || resource.snapshot.element.filter(i => i.id.indexOf(expression) === 0)[0];
    const type = desc.type[0].code;
    if (path.length === 1) {
      return {
        type,
        typeDescription: desc.type,
        ...(desc.binding && desc.binding.valueSet ? {valueSet: desc.binding.valueSet} : {})
      };
    } else if (type === 'BackboneElement') {
      return getTypeByPath([resourceType, path[0]+'.'+path[1], ...path.slice(2)]);
    } else {
      return getTypeByPath([desc.type[0].code, ...path.slice(1)]);
    }
  }

  /**
   * Gets ValueSet or CodeSystem items array from concept array, with filtering by
   * includeCodes, and converting a CodeSystem tree of concepts to the flat list.
   * @param {string} system - value set code system
   * @param {Array<{code: string, display: string}>} concept - concept input
   *        array, each concept can have a nested concept array
   * @param {Array<string> | null} [includeCodes] - if specified, then a list
   *        of concept codes that we should include in the result array
   * @param {boolean} includeChildren - true if we should include nested
   *        concepts of matched concept in the result Array
   * @return {Array<{code: string, display: string}>}
   */
  function getValueSetItems(system, concept, includeCodes, includeChildren) {
    return concept.reduce((acc, i) => {
      if (!includeCodes || includeCodes[i.code]) {
        acc.push({
          code: i.code,
          system,
          display: i.display || i.code,
        });
      }

      return i.concept
        ? acc.concat(
            getValueSetItems(
              system,
              i.concept,
              includeChildren && includeCodes && includeCodes[i.code]
                ? null
                : includeCodes,
              includeChildren
            )
          )
        : acc;
    }, []);
  }

  /**
   * Gets an array of all ValueSet or CodeSystem items by URL.
   * If it is not possible to fill an array of items for ValueSet(CodeSystem),
   * then a string with a URL is returned. If ValueSet/CodeSystem is not
   * described in specification then result will be null.
   * @param {Object} options
   *        "options.url" is passed on the initial call, then if the "url" points to a ValueSet
   *        the function calls itself recursively for each "ValueSet.compose.include"
   *        item (see http://hl7.org/fhir/valueset.html#resource) which could point to another
   *        ValueSet or CodeSystem, this item value is passed into the "options"
   *        parameter.
   * @param {string} options.url - canonical identifier for value set, represented as a URI (globally unique)
   * @param {Array<string>} options.valueSet - array of canonical value set identifiers
   *        Example of resource which uses "compose.include[].valueSet": http://hl7.org/fhir/valueset-security-labels.json.html
   * @param {string} options.system - the system the codes come from
   *        Example of resource which uses only "compose.include[].system: http://hl7.org/fhir/valueset-address-use.json.html
   * @param {Array<{code:string, display:string}>} options.concept - a concept defined in a system
   *        Example of resource which uses "compose.include[].concept": http://hl7.org/fhir/valueset-c80-doc-typecodes.json.html
   * @param {Array<Object>} options.filter - select codes/concepts by their properties.
   *        Only one filter options is currently supported:
   *        {property: 'concept', op: 'is-a', value: string}
   *        Example of resource which uses "compose.include[].filter": http://hl7.org/fhir/v3/ActEncounterCode/v3-ActEncounterCode.json.html
   * @return {Array<{code: string, display: string}> | string | null}
   */
  function getValueSet(options) {
    if (options.valueSet) {
      return [].concat.apply(
        [],
        options.valueSet.map((i) => getValueSet({ url: i })).filter((i) => i)
      );
    }
    const url = (options.url || options.system).split('|')[0];
    const entry = (profiles.valueSets.entry.find(i => i.fullUrl === url || i.resource.url === url) || profiles.v3CodeSystems.entry.find(i => i.fullUrl === url || i.resource.url === url));
    if (!entry) {
      if (options.concept) {
        return options.concept.map(i => ({
          code: i.code,
          system: url,
          display: i.display || i.code
        }));
      }
      return null;
    }

    // resource is a ValueSet or CodeSystem resource
    const resource = entry.resource;
    let result = [];

    if (resource && resource.concept) {
      // if resource is CodeSystem:
      const includeCodes = options.concept && options.concept.reduce((acc, c) => {
          acc[c.code] = true;
          return acc;
        }, {});
      const filterCodes = options.filter && options.filter.reduce((acc, f) => {
          if (f.property !== 'concept' || f.op !== 'is-a' || !f.value) {
            // TODO: support full include specification? (see http://hl7.org/fhir/valueset.html)
            console.error('Unsupported filter value:', options);
          } else {
            acc[f.value] = true;
          }
          return acc;
        }, {});
      result = result.concat(getValueSetItems(url, resource.concept, includeCodes || filterCodes, !!filterCodes));
    }

    const compose = resource && resource.compose;
    const include = compose && compose.include;
    if (include) {
      // if resource is a ValueSet and has included ValueSets or CodeSystems:
      result = result.concat(...include.map(i => {
        const items = getValueSet(i);
        if (!items) {
          console.log('Can\'t find:', i);
        } else if (!(items instanceof Array)) {
          console.log('No values for:', items);
        }

        const excludes =
          (compose.exclude &&
            compose.exclude.filter((e) => e.system === i.system)) ||
          [];
        const excludeCodes = excludes.reduce((acc, exclude) => {
          if (!exclude.concept) {
            // TODO: support full exclude specification? (see http://hl7.org/fhir/valueset.html)
            console.error("Unsupported exclude value:", options);
          } else {
            exclude.concept.forEach(e => acc[e.code] = true);
          }
          return acc;
        }, {});

        return items instanceof Array && excludeCodes ? items.filter(j => !excludeCodes[j.code]) : items;
      }).filter(i => i instanceof Array));
    }


    if (result.length) {
      if (!result.some(item => item.system !== result[0].system)) {
        // If there is only one coding system, remove it as unnecessary
        result.forEach(item => delete item.system);
      }
      return result;
    }

    return url;
  }

  let result = {
    resources: {},
    valueSets: {},
    // to avoid duplication of objects in memory, the properties below are filled at runtime,
    // see method getCurrentDefinitions (common-descriptions.js) for details
    valueSetByPath: {},
    valueSetMaps: {},
    valueSetMapByPath: {},
  };

  resourceTypes.forEach(resourceType => {
    result.resources[resourceType] = profiles.parameters.entry
      .filter(item => item.resource.base.indexOf(resourceType) !== -1)
      .map(item => {
        new RegExp(`(${resourceType}\.[^|]*)( as ([^\\s)]*)|)`).test(item.resource.expression);
        const param = {
          name: item.resource.name,
          type: RegExp.$3 && RegExp.$3.trim() || item.resource.type,
          expression: RegExp.$1.trim(),
          description: item.resource.base.length > 1
            ? getDescription(resourceType, item.resource.description)
            : item.resource.description.trim()
        };
        if (param.type === 'token') {
          Object.assign(param, getTypeByExpression(param.expression));
        }
        // Find value set for search parameter
        if (param.valueSet && !result.valueSets[param.valueSet])  {
          const valueSet = getValueSet({ url: param.valueSet });
          result.valueSetByPath[param.path] = param.valueSet;
          result.valueSets[param.valueSet] = valueSet instanceof Array
            ? valueSet.sort((a,b) => a.display.localeCompare(b.display))
            : valueSet;
        }
        return param;
      });
  });


  // Some times we need additional value sets that no search parameters refers to.
  // For example,
  // We need value set for "Patient.telecom.use"
  // for displaying Patient phone/email in HTML table.
  // To get it, we should specify this path in option "additionalExpressions"
  // see "source/js/search-parameters/definitions/webpack-options.json"
  //
  // Find value sets for additional expressions:
  additionalExpressions.forEach(expression => {
    const param = getTypeByExpression(expression);
    if (param.valueSet && !result.valueSets[param.valueSet])  {
      const valueSet = getValueSet({ url: param.valueSet });
      result.valueSetByPath[param.path] = param.valueSet;
      result.valueSets[param.valueSet] = valueSet instanceof Array
        ? valueSet.sort((a,b) => a.display.localeCompare(b.display))
        : valueSet;
    }
  });

  return result;
}

module.exports = function loader(source) {
  const index = JSON.parse(source);
  const { resourceTypes, additionalExpressions } = getOptions(this);

  index.configByVersionName = Object.values(index.versionNameByVersionNumberRegex).reduce(
    (acc, versionName) => {
      if (!acc[versionName]) {
        acc[versionName] = getSearchParametersConfig(
          this.context + "/" + versionName,
          resourceTypes,
          additionalExpressions
        );
      }
      return acc;
    },
    {}
  );

  return JSON.stringify(index);
};