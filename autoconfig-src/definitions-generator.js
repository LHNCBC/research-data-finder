/**
 * Shared CSV/capability utilities used by autoconfig scripts and tests.
 *
 * These helpers parse definition CSV files, index capability metadata, and
 * filter rows based on server support and sample data presence.
 */
const fhirpath = require('fhirpath');
const { stringify } = require('csv-stringify/sync');

// Regex-based CSV parser used for fixture and generated-definition files.
const CSV_PARSE_REGEX = /(,|\r?\n|\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^,\r\n]*))/gi;

/**
 * Parses a CSV string into a row/column matrix.
 * @param {string} csvString - Raw CSV source text.
 * @returns {string[][]|null} Parsed rows, or `null` on malformed input.
 */
function parseCsvString(csvString) {
  const result = [[]];
  let lastIndex = 0;
  let matches;
  // eslint-disable-next-line no-cond-assign
  while ((matches = CSV_PARSE_REGEX.exec(csvString))) {
    if (matches[1].length && matches[1] !== ',') {
      result.push([]);
    }
    result[result.length - 1].push(
      matches[2] !== undefined ? matches[2].replace(/""/g, '"') : matches[3]
    );
    lastIndex = CSV_PARSE_REGEX.lastIndex;
  }
  return lastIndex === csvString.length ? result : null;
}

/**
 * Serializes row data into CSV text.
 * @param {Array<Array<unknown>>} rows - CSV rows to stringify.
 * @returns {string} CSV string output.
 */
function stringifyCsvRows(rows) {
  return stringify(rows);
}

/**
 * Builds a compact index from CapabilityStatement resources and search params.
 * @param {object|null|undefined} capabilityStatement - Parsed capability JSON.
 * @returns {{
 *   resourceTypes: Set<string>,
 *   searchParamsByType: Map<string, Set<string>>
 * }} Indexed capability information.
 */
function buildCapabilityIndex(capabilityStatement) {
  const resourceTypes = new Set();
  const searchParamsByType = new Map();
  const rest = capabilityStatement?.rest || [];
  rest.forEach((restItem) => {
    (restItem.resource || []).forEach((resource) => {
      if (!resource?.type) {
        return;
      }
      resourceTypes.add(resource.type);
      const params = new Set(
        (resource.searchParam || []).map((param) => param.name).filter(Boolean)
      );
      searchParamsByType.set(resource.type, params);
    });
  });
  return { resourceTypes, searchParamsByType };
}

/**
 * Collects unique resource types in appearance order from definition rows.
 * @param {string[][]} rows - Parsed definition CSV rows.
 * @returns {string[]} Ordered unique resource types.
 */
function collectResourceTypes(rows) {
  const types = [];
  const seen = new Set();
  rows.forEach((row) => {
    const resourceType = row?.[0];
    if (resourceType && !seen.has(resourceType)) {
      types.push(resourceType);
      seen.add(resourceType);
    }
  });
  return types;
}


/**
 * Collects search parameter metadata grouped by resource type.
 * @param {string[][]} rows - Parsed definition CSV rows.
 * @returns {Map<string, Map<string, {type: string}>>}
 *   Search parameter metadata by resource.
 */
function collectSearchParamInfoByResource(rows) {
  const map = new Map();
  let currentResource = null;
  rows.forEach((row) => {
    if (row?.[0]) {
      currentResource = row[0];
      if (!map.has(currentResource)) {
        map.set(currentResource, new Map());
      }
      return;
    }
    if (!currentResource || row?.[2] !== 'search parameter') {
      return;
    }
    const element = row?.[1];
    if (!element) {
      return;
    }
    map.get(currentResource).set(element, {
      type: (row?.[5] || '').trim()
    });
  });
  return map;
}

/**
 * Returns true when a search parameter name should skip capability validation.
 *
 * We treat names that include whitespace, modifiers (e.g. `:missing`), or
 * reserved underscore parameters (e.g. `_id`, `_count`) as special because
 * they are either not literal search parameter names or are handled by FHIR
 * servers outside the CapabilityStatement searchParam list.
 *
 * @param {string} name - Search parameter name from the CSV definition.
 * @returns {boolean} True when the parameter should be accepted as-is.
 */
function isSpecialSearchParamName(name) {
  return /\s|:/.test(name) || name.startsWith('_');
}

/**
 * Evaluates whether a column/expression has any data in sample resources.
 * @param {object[]|null|undefined} resources - Sample resources to inspect.
 * @param {string|undefined} expression - Optional FHIRPath expression.
 * @param {string|undefined} element - Fallback element path.
 * @param {object|undefined} model - FHIRPath model context (R4/R5).
 * @returns {boolean|null}
 *   `true` when data exists, `false` when confirmed absent, `null` when
 *   indeterminate (no resources or expression errors).
 */
function evaluateColumnHasData(resources, expression, element, model) {
  if (!resources || resources.length === 0) {
    return null;
  }
  const baseExpression = expression || element;
  if (!baseExpression) {
    return null;
  }
  const useExpression = /\[x\]/.test(baseExpression)
    ? baseExpression.replace(/\[x\]/g, '')
    : baseExpression;
  let hasNull = false;
  for (const resource of resources) {
    if (!resource) {
      hasNull = true;
      continue;
    }
    try {
      const result = fhirpath.evaluate(resource, useExpression, null, model);
      if (Array.isArray(result)) {
        if (result.length > 0) {
          return true;
        }
      } else if (result) {
        return true;
      }
    } catch (err) {
      hasNull = true;
    }
  }
  return hasNull ? null : false;
}

/**
 * Filters definition rows based on resource/search support and column data.
 * @param {string[][]} rows - Parsed definition CSV rows.
 * @param {Map<string, {
 *   supported: boolean,
 *   sampleResources: object[],
 *   searchParamSupport: Map<string, boolean>
 * }>} resourceInfoByType - Support/data information by resource type.
 * @param {{
 *   skipColumnChecks?: boolean,
 *   forceShowByResource?: Map<string, Set<string>>,
 *   model?: object
 * }} [options={}] - Filtering options.
 * @returns {string[][]} Filtered CSV rows.
 */
function filterDefinitionRows(rows, resourceInfoByType, options = {}) {
  const outputRows = [];
  let currentResource = null;
  let currentInfo = null;
  const skipColumnChecks = Boolean(options.skipColumnChecks);
  const forceShowByResource = options.forceShowByResource || new Map();
  const model = options.model;
  rows.forEach((row) => {
    const resourceType = row?.[0];
    if (resourceType) {
      currentResource = resourceType;
      currentInfo = resourceInfoByType.get(resourceType);
      if (currentInfo?.supported) {
        outputRows.push(row);
      }
      return;
    }
    if (!currentInfo?.supported) {
      return;
    }
    const rowType = row?.[2];
    if (rowType === 'search parameter') {
      const element = row?.[1];
      const support = currentInfo.searchParamSupport?.get(element);
      if (support === false) {
        return;
      }
      if (element && forceShowByResource.get(currentResource)?.has(element)) {
        row[4] = 'show';
      }
      outputRows.push(row);
      return;
    }
    if (rowType === 'column') {
      if (skipColumnChecks) {
        outputRows.push(row);
        return;
      }
      const expression = row?.[6];
      const element = row?.[1];
      const hasData = evaluateColumnHasData(
        currentInfo.sampleResources,
        expression,
        element,
        model
      );
      if (hasData === false) {
        return;
      }
      outputRows.push(row);
      return;
    }
    outputRows.push(row);
  });
  return outputRows;
}

// Exported for autoconfig CLI, harness, and unit tests.
module.exports = {
  parseCsvString,
  stringifyCsvRows,
  buildCapabilityIndex,
  collectResourceTypes,
  collectSearchParamInfoByResource,
  isSpecialSearchParamName,
  filterDefinitionRows
};
