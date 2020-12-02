import { getCurrentDefinitions } from './search-parameters/common-descriptions';
import { getValueByPath, humanNameToString } from './common/utils';
import { BaseComponent } from './common/base-component';

/**
 * Component class for displaying a resource table of a given resource type
 */
export class ResourceTable extends BaseComponent {
  /**
   * Constructor of component
   * @param {string} resourceType
   * @param {Object<Function>} callbacks - callback functions:
   *   addComponentToPage - used to add HTML of the component to the page
   *   getColumnsToDisplay - returns an array of column descriptions
   *              to be displayed if data exists for those columns
   *              (see JSDoc typedef of ColumnDescription in columns-dialog.js)
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
    return `<thead><tr><th>${this.columnNames.join(
      '</th><th>'
    )}</th></tr></thead>`;
  }

  /**
   * Prepares column data using search parameter data and resource list data.
   * Columns without data will be excluded.
   * @param {Object} column - visible column description retrieved from ResourceTabPage
   * @param {string} column.name - search parameter name
   * @param {string} column.path - property path (started with resource type) to retrieve
   *        the value associated with the search parameter from the resource data record,
   *        with a dot as a separator
   * @param {{ bundles: Object[], patients: Object[]}} data - result of requests
   *        to server for resources and patients
   * @param {Object} valueSetMapByPath - map from property path to valueSet
   * @return {{columnNames: (string)[], columnValues: [][]}} -
   *        columnNames - array of column names,
   *        columnValues - array of array of values for these columns.
   */
  prepareColumnsData(column, data, valueSetMapByPath) {
    const columnName = column.name;
    // Possible column names
    const columnNames = [
      columnName,
      `${columnName} start`,
      `${columnName} end`
    ];
    // Possible column values
    const columnValues = [[], [], []];

    // Get path in resource object (by removing the resourceType from the beginning of the path):
    const path = column.path;
    const fullPath = this.resourceType + '.' + path;
    const valueSet =
      valueSetMapByPath[fullPath] instanceof Object
        ? valueSetMapByPath[fullPath]
        : null;

    if (path.length > 0) {
      let rowIndex = 0;
      data.bundles.forEach((bundle, patientIndex) => {
        const patient = data.patients[patientIndex];
        let partientName;
        (bundle.entry || []).forEach((res) => {
          let prop = getValueByPath(res.resource, path);
          prop = prop && prop.length === 1 ? prop[0] : prop;
          if (prop) {
            if (prop.text !== undefined) {
              columnValues[0][rowIndex] = prop.text;
            } else if (prop.coding !== undefined || prop.code !== undefined) {
              const item = prop.coding ? prop.coding[0] : prop;
              columnValues[0][rowIndex] =
                item.display || (valueSet && valueSet[item.code]) || item.code;
            } else if (prop.display !== undefined) {
              columnValues[0][rowIndex] = prop.display;
            } else if (prop.start !== undefined || prop.end !== undefined) {
              columnValues[1][rowIndex] = prop.start || '';
              columnValues[2][rowIndex] = prop.end || '';
            } else if (prop.value !== undefined) {
              columnValues[0][rowIndex] = prop.value;
            } else if (prop.reference) {
              if (patient && /^Patient\//.test(prop.reference)) {
                columnValues[0][rowIndex] =
                  partientName ||
                  (partientName = humanNameToString(patient.name));
              } else {
                columnValues[0][rowIndex] = prop.reference;
              }
            } else if (valueSet) {
              columnValues[0][rowIndex] = valueSet[prop];
            } else {
              columnValues[0][rowIndex] = prop;
            }
          }
          rowIndex++;
          return prop !== undefined;
        });
      });
    }

    return columnNames.reduce(
      (result, columnName, columnIndex) => {
        const values = columnValues[columnIndex];
        if (values.length > 0) {
          result.columnNames.push(columnName);
          result.columnValues.push(values);
        }
        return result;
      },
      {
        columnNames: [],
        columnValues: []
      }
    );
  }

  /**
   * Fill HTML table with resources data
   * @param {{ bundles: Object[], patients: Object[]}} data - result of requests
   *        to server for resources and patients
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server
   *        from which data is being pulled
   */
  fill({ data, serviceBaseUrl }) {
    const currentDefinitions = getCurrentDefinitions();
    const valueSetMapByPath = currentDefinitions.valueSetMapByPath;
    // Prepare data for show & download
    this.serviceBaseUrl = serviceBaseUrl;

    this.columnNames = [];
    this.columnValues = [];

    this.callbacks.getColumnsToDisplay().forEach((column) => {
      const { columnNames, columnValues } = this.prepareColumnsData(
        column,
        data,
        valueSetMapByPath
      );
      this.columnNames.push(...columnNames);
      this.columnValues.push(...columnValues);
    });

    document.getElementById(this._id).innerHTML =
      this.columnNames.length > 0
        ? this.getHeader() +
          '<tbody>' +
          this.columnValues[0]
            .map((c, index) => {
              return this.getRowHtml(index);
            })
            .join('') +
          '</tbody>'
        : '<tbody><tr><td>NO DATA</td></tr></tbody>';
  }

  /**
   * Returns HTML for one table row
   * @param {number} index - row number
   * @return {string}
   */
  getRowHtml(index) {
    return (
      '<tr><td>' +
      this.columnValues
        .map((column) => {
          return column[index] || '';
        })
        .join('</td><td>') +
      '</td></tr>'
    );
  }

  /**
   * Creates Blob for download table
   * @return {Blob}
   */
  getBlob() {
    const header = this.columnNames.join(','),
      rows = this.columnValues[0].map((c, index) => {
        return this.columnValues
          .map((values) => {
            const cellText = values[index];

            if (/["\s]/.test(cellText)) {
              return '"' + cellText.replace(/"/, '""') + '"';
            } else {
              return cellText;
            }
          })
          .join(',');
      });

    return new Blob([[header].concat(rows).join('\n')], {
      type: 'text/plain;charset=utf-8',
      endings: 'native'
    });
  }
}
