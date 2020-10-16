import { getCurrentDefinitions } from './search-parameters/common-descriptions';
import * as fhirpath from 'fhirpath';
import * as r4_model from 'fhirpath/fhir-context/r4';
import { capitalize } from './common/utils';
import { BaseComponent } from './common/base-component';

/**
 * Component class for displaying a resource table of a given resource type
 */
export class ResourceTable extends BaseComponent {
  /**
   * Constructor of component
   * @param {string} resourceType
   * @param {Object<Function>} callbacks - callback functions:
   *        addComponentToPage - used to add HTML of the component to the page,
   */
  constructor({ resourceType, callbacks }) {
    super({ callbacks });
    this.resourceType = resourceType;
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    return `<table id="${this._id}"></table>`;
  }

  /**
   * Returns HTML for table header
   * @return {string}
   */
  getHeader() {
    return `<thead><tr><th>${this.searchParameters
      .map((item) => capitalize(item.name).replace(/-/g, ' '))
      .join('</th><th>')}</th></tr></thead>`;
  }

  /**
   * Parse search parameter data to produce object with column descriptions:
   * columns - array of column names,
   * valuePath - array of functions to retrieve values for these columns
   * TODO: one search parameter could produce two column (in the next PR)
   * @param {Object} param - search parameter description retrieved from webpack-loader
   * @param {Object} param.name - search parameter name
   * @param {Object} param.expression - FHIRPath expression to retrieve the value
   *        associated with this search parameter from resource data entry
   * @return {{valuePaths: [function(*=, *=): *], columns: [string]}}
   */
  parseParam(param) {
    return {
      valuePaths: [
        fhirpath.compile(
          // temporary replace unsupported part of path
          simplifyExpression(param.expression),
          r4_model
        )
      ],
      columns: [capitalize(param.name).replace(/-/g, ' ')]
    };
  }

  /**
   * Fill HTML table with resources data
   * @param {{ bundles: Object[], patients: Object[]}} data - result of requests to server for resources and patients
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server from which data is being pulled
   */
  fill({ data, serviceBaseUrl }) {
    const currentDefinitions = getCurrentDefinitions();
    this.searchParameters = currentDefinitions.resources[this.resourceType];
    // Prepare data for show & download
    this.serviceBaseUrl = serviceBaseUrl;

    this.data = data;
    this.columnNames = [];
    this.columnValuePaths = [];

    this.searchParameters.forEach((param) => {
      const { valuePaths, columns } = this.parseParam(param);
      this.columnNames.push(...columns);
      this.columnValuePaths.push(...valuePaths);
    });

    document.getElementById(this._id).innerHTML =
      this.getHeader() +
      '<tbody>' +
      this.data.bundles
        .map((bundle, index) => {
          const patient = data.patients[index];
          const resources = fhirpath.evaluate(
            bundle,
            'Bundle.entry.resource',
            null,
            r4_model
          );

          return resources
            .map((resource) => {
              return this.getRowHtml(patient, resource);
            })
            .join('');
        })
        .join('') +
      '</tbody>';
  }

  /**
   * Returns HTML for one table row
   * @param {Object} patient - Patient resource data for which resource data entry is loaded
   * @param {Object} resource - resource data entry
   * @return {string}
   */
  getRowHtml(patient, resource) {
    return (
      '<tr><td>' +
      this.columnValuePaths
        .map((path) => {
          // TODO split columns with a date range and check
          // TODO check the display of all resource types
          // TODO remove empty columns
          const data = path(resource, null)[0];
          if (data) {
            if (data.coding) {
              return (
                data.coding[0] &&
                (data.coding[0].display || data.coding[0].code)
              );
            } else if (data.display) {
              return data.display;
            } else if (data.start || data.end) {
              return (data.start || '') + ' - ' + (data.end || '');
            } else if (data.value) {
              return data.value;
            } else if (data instanceof Object) {
              // debugger;
            }
          }
          return data;
        })
        .join('</td><td>') +
      '</td></tr>'
    );
  }
}

/**
 * Excludes unsupported parts from FHIRPath expression
 * @param {string} expression
 * @return {string}
 */
function simplifyExpression(expression) {
  return expression
    .replace(/\.where\(resolve\(\) is [^)]*\)/, '')
    .replace(/\.as\([^)]*\)/, '')
    .replace(/^\((.*)\sas\s[^)]*\)/, '$1');
}
