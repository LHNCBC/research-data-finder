/**
 * Webpack loader for "search-parameters.json" from https://www.hl7.org/fhir/downloads.html
 * Also uses profiles-types.json and profiles-resources.json from the same directory.
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

module.exports = function loader(source) {
  const profiles = {
    resources: JSON.parse(fs.readFileSync(this.context + '/profiles-resources.json').toString()),
    types:  JSON.parse(fs.readFileSync(this.context + '/profiles-types.json').toString())
  };

  /**
   * Finds type by expression
   * @param expression
   * @return {{type: string}|{typeDescription: *, type: *}}
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

    return getTypeByPath(expression.split(' ')[0].split('.'));
  }

  /**
   * Finds a type of resource property by the property path
   * @param {string} resourceType
   * @param {Array<string>} path
   * @return {{typeDescription: *, type: *}|*}
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
        typeDescription: desc.type
      };
    } else if (type === 'BackboneElement') {
      return getTypeByPath([resourceType, path[0]+'.'+path[1], ...path.slice(2)]);
    } else {
      return getTypeByPath([desc.type[0].code, ...path.slice(1)]);
    }
  }

  const { resourceTypes } = getOptions(this);
  const input = JSON.parse(source);
  let result = {};

  resourceTypes.forEach(resourceType => {
    result[resourceType] = input.entry
      .filter(item => item.resource.base.indexOf(resourceType) !== -1)
      .map(item => {
        new RegExp(`(${resourceType}\.[^|]*)( as ([^\\s)]*)|)`).test(item.resource.expression);
        const param = {
          name: item.resource.name,
          type: RegExp.$3 && RegExp.$3.trim() || item.resource.type,
          expression: RegExp.$1.trim(),
          description: item.resource.base.length > 1 ? getDescription(resourceType, item.resource.description) : item.resource.description.trim()
        };
        if (param.type === 'token') {
          Object.assign(param, getTypeByExpression(param.expression));
        }
        return param;
      });
  });

  return JSON.stringify(result);
}