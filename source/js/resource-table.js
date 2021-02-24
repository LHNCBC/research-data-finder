import { getCurrentDefinitions } from './search-parameters/common-descriptions';
import { humanNameToString } from './common/utils';
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
   * Prepares and returns column values using column description and resource list data.
   * @param {ColumnDescription} column - visible column description retrieved from ResourceTabPage
   *        (see JSDoc typedef of ColumnDescription in columns-dialog.js)
   * @param {{ bundles: Object[], patients: Object[]}} data - result of requests
   *        to server for resources and patients
   * @param {Object} valueSetMapByPath - map from property path to valueSet
   * @return {Array<string>} - array of values for the column.
   */
  getColumnValues(column, data, valueSetMapByPath) {
    const columnValues = [];
    const getValueDescriptor = column.types.map((type) => ({
      propertyName: column.element ? column.element.replace('[x]', type) : '',
      getValue: getValueFn(type, column.isArray)
    }));
    const fullPath = column.element
      ? this.resourceType + '.' + column.element
      : '';
    let rowIndex = 0;

    data.bundles.forEach((bundle, patientIndex) => {
      const patient = data.patients[patientIndex];
      const context = {
        patient,
        valueSetMapByPath
      };
      (bundle.entry || []).forEach((entry) => {
        getValueDescriptor.find(({ propertyName, getValue }) => {
          let prop = propertyName
            ? entry.resource[propertyName]
            : entry.resource;
          if (prop) {
            const value = getValue(prop, context, fullPath);
            if (value) {
              columnValues[rowIndex] = value;
              return true;
            }
          }
        });
        rowIndex++;
      });
    });

    return columnValues;
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
      const columnValues = this.getColumnValues(
        column,
        data,
        valueSetMapByPath
      );
      // Columns without data will be excluded.
      if (columnValues.length > 0) {
        this.columnNames.push(column.name);
        this.columnValues.push(columnValues);
      }
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
        .map((columnValue) => {
          return columnValue[index] || '';
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

// Mapping from type to value getter
export const getValueFnDescriptor = {
  Identifier: getIdentifierAsText,
  code: getCodeAsText,
  CodeableConcept: getCodeableConceptAsText,
  string: identity,
  Reference: getReferenceAsText,
  Period: getPeriodAsText,
  dateTime: identity,
  canonical: identity,
  uri: identity,
  ContactPoint: getContactPointAsText,
  Quantity: getQuantityAsText,
  decimal: identity,
  Money: getMoneyAsText,
  boolean: identity,
  instant: identity,
  Coding: getCodingAsText,
  Duration: getQuantityAsText,
  date: identity,
  HumanName: getHumanNameAsText,
  Address: getAddressAsText,
  // Unsupported types:
  // 'Annotation': getAnnotationAsText,
  // 'BackboneElement': getBackboneElementAsText,
  // 'Timing': getTiming,
  // 'Attachment': getAttachment,
  // 'DataRequirement': getDataRequirement,
  // 'markdown': getmarkdown,
  // 'Dosage': getDosage,
  // Custom types:
  'context-patient-name': getContextPatientName
};

/**
 * Returns a function to get the column value
 * @param {string} type - type of value
 * @param {boolean} isArray - true if max cardinality greater than 1
 * @return {Function}
 */
function getValueFn(type, isArray) {
  const singleValueFn = getValueFnDescriptor[type];
  if (isArray) {
    return (value, context, fullPath) => {
      if (value && value.length) {
        // Currently we will show first item in array
        return singleValueFn(value[0], context, fullPath);
      } else {
        return null;
      }
    };
  } else {
    return singleValueFn;
  }
}
/**
 * Returns a textual representation of "Identifier" value
 * see https://www.hl7.org/fhir/datatypes.html#Identifier
 * @param {Object} v
 * @return {string}
 */
function getIdentifierAsText(v) {
  return v.value;
}

/**
 * Returns a textual representation of "code" value
 * see https://www.hl7.org/fhir/datatypes.html#code
 * @param {Object} v - value of type "code"
 * @param {Object} context - context data object
 * @param {Object} context.valueSetMapByPath - map from property path to valueSet
 * @param {Object} fullPath - property path to value started with resourceType
 * @return {string}
 */
function getCodeAsText(v, context, fullPath) {
  const valueSet =
    context.valueSetMapByPath[fullPath] instanceof Object
      ? context.valueSetMapByPath[fullPath]
      : null;
  return (valueSet && valueSet[v]) || v;
}

/**
 * Returns value as is. No transformation needed.
 * @param {*} v - value
 * @return {*}
 */
function identity(v) {
  return v;
}

/**
 * Returns a textual representation of "CodeableConcept" value
 * see https://www.hl7.org/fhir/datatypes.html#CodeableConcept
 * @param {Object} v - value of type "CodeableConcept"
 * @param {Object} context - context data object
 * @param {Object} fullPath - property path to value started with resourceType
 * @return {string|null}
 */
function getCodeableConceptAsText(v, context, fullPath) {
  if (v.text) {
    return v.text;
  }
  return v.coding && v.coding[0]
    ? getCodingAsText(v.coding[0], context, fullPath + '.coding')
    : null;
}

/**
 * Returns a textual representation of "Coding" value
 * see https://www.hl7.org/fhir/datatypes.html#Coding
 * @param {Object} v - value of type "Coding"
 * @param {Object} context - context data object
 * @param {Object} context.valueSetMapByPath - map from property path to valueSet
 * @param {Object} fullPath - property path to value started with resourceType
 * @return {string}
 */
function getCodingAsText(v, context, fullPath) {
  if (v.display) {
    return v.display;
  }

  const valueSet =
    context.valueSetMapByPath[fullPath] instanceof Object
      ? context.valueSetMapByPath[fullPath]
      : null;
  return (valueSet && valueSet[v.code]) || v.code;
}

/**
 * Returns a textual representation of "Reference" value
 * see https://www.hl7.org/fhir/references.html#Reference
 * @param {Object} v - value of type "Reference"
 * @param {Object} context - context data object
 * @param {Object} context.patient - current Patient resource
 * @param {Object} [context.patientName] - shared context variable
 * @return {string|null}
 */
function getReferenceAsText(v, context) {
  if (v.display) {
    return v.display;
  } else if (v.reference) {
    if (
      `${context.patient.resourceType}/${context.patient.id}` === v.reference
    ) {
      if (context.patientName === undefined) {
        context.partientName = humanNameToString(context.patient.name);
      }
      return context.patientName || v.reference;
    } else {
      return v.reference;
    }
  } else if (v.identifier) {
    return getIdentifierAsText(v.identifier);
  }

  return null;
}

/**
 * Returns a textual representation of "Period" value
 * see https://www.hl7.org/fhir/datatypes.html#Period
 * @param {Object} v - value of type "Period"
 * @return {string|null}
 */
function getPeriodAsText(v) {
  if (v.start || v.end) {
    return `${v.start || ''}&ndash;${v.end || ''}`;
  } else {
    return null;
  }
}

/**
 * Returns a textual representation of "ContactPoint" value
 * see https://www.hl7.org/fhir/datatypes.html#ContactPoint
 * @param {Object} v - value of type "ContactPoint"
 * @return {string}
 */
function getContactPointAsText(v) {
  return v.value;
}

/**
 * Returns a textual representation of "Quantity" value
 * see https://www.hl7.org/fhir/datatypes.html#Quantity
 * @param {Object} v - value of type "Quantity"
 * @return {string|null}
 */
function getQuantityAsText(v) {
  return v.value != null ? v.value + (v.unit ? ' ' + v.unit : '') : null;
}

/**
 * Returns a textual representation of "Money" value
 * see https://www.hl7.org/fhir/datatypes.html#Money
 * @param {Object} v - value of type "Money"
 * @return {string|null}
 */
function getMoneyAsText(v) {
  return v.value != null ? v.value + '' + v.currency : null;
}

/**
 * Returns a textual representation of "HumanName" value
 * https://www.hl7.org/fhir/datatypes.html#HumanName
 * @param {Object} v - value of type "HumanName"
 * @return {string|null}
 */
function getHumanNameAsText(v) {
  return humanNameToString(v);
}

/**
 * Returns a textual representation of "Address" value
 * https://www.hl7.org/fhir/datatypes.html#Address
 * @param {Object} v - value of type "Address"
 * @param {Object} context - context data object
 * @param {Object} context.valueSetMapByPath - map from property path to valueSet
 * @param {Object} fullPath - property path to value started with resourceType
 * @return {string|null}
 */
function getAddressAsText(v, context, fullPath) {
  const addressString = [v.line, v.city, v.state, v.postalCode, v.country]
    .filter((item) => item)
    .join(', ');
  return v.use
    ? `${context.valueSetMapByPath[fullPath + '.use'][v.use]}: ${addressString}`
    : addressString;
}

/**
 * Returns a textual representation of "Patient name" value
 * @param {Object} v - unused value
 * @param {Object} context - context data object
 * @param {Object} context.patient - Patient resource data
 * @return {string|null}
 */
function getContextPatientName(v, context) {
  return humanNameToString(context.patient.name);
}
