import { getCurrentDefinitions } from './search-parameters/common-descriptions';
import * as fhirpath from 'fhirpath';
import * as r4_model from 'fhirpath/fhir-context/r4';
import { capitalize } from './common/utils';
import { BaseComponent } from './common/base-component';

export class ResourceTable extends BaseComponent {
  constructor({ resourceType, callbacks }) {
    super({ callbacks });
    this.resourceType = resourceType;
  }

  getHtml() {
    return `<table id="${this._id}"></table>`;
  }

  getHeader() {
    return `<thead><tr><th>${this.searchParameters
      .map((item) => capitalize(item.name).replace(/-/g, ' '))
      .join('</th><th>')}</th></tr></thead>`;
  }

  setAdditionalColumns(columns) {
    this._additionalColumns = columns || [];
  }

  _getViewCellsTemplate() {
    return this.viewCellsTemplate.filter(
      (item) =>
        !item.columnName ||
        this._additionalColumns.indexOf(item.columnName) !== -1
    );
  }

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
