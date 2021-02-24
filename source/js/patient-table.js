import {
  addressToStringArray,
  getPatientAge,
  getPatientContactsByType,
  humanNameToString
} from './common/utils';
import { getCurrentDefinitions } from './search-parameters/common-descriptions';
import { ResourceTable } from './resource-table';

export class PatientTable extends ResourceTable {
  constructor({ callbacks }) {
    super({ callbacks });

    // Mapping for each cell in a row for display:
    // title - column caption
    // columnName - if a value is specified, then this column is displayed by the condition
    //              that this value is present in the column array for display (this._additionalColumns),
    //              also this value specifies column name for a request to the FHIR server;
    //              otherwise, if no value is specified, this column is constantly displayed.
    // text - callback to get cell text/html
    this.viewCellsTemplate = [
      {
        title: 'Id',
        text: (pat) => pat.id
      },
      {
        title: 'Name',
        text: (pat) => pat._name
      },
      {
        title: 'Gender',
        columnName: 'gender',
        text: (pat) =>
          this.valueSetMapByPath['Patient.gender'][pat.gender] || ''
      },
      {
        title: 'Age',
        columnName: 'age',
        text: (pat) => pat._age || ''
      },
      {
        title: 'Birth date',
        columnName: 'birthdate',
        text: (pat) => pat.birthDate || ''
      },
      {
        title: 'Death date',
        columnName: 'death-date',
        text: (pat) => pat.deceasedDateTime || ''
      },
      {
        title: 'Address',
        columnName: 'address',
        text: (pat) => pat._address.join('<br>')
      },
      {
        title: 'Phone',
        columnName: 'phone',
        text: (pat) => pat._phone.join('<br>')
      },
      {
        title: 'Email',
        columnName: 'email',
        text: (pat) => pat._email.join('<br>')
      },
      {
        title: 'Language',
        columnName: 'language',
        text: (pat) => {
          const communication = pat.communication;
          return (communication && communication.language) || '';
        }
      }
    ];

    this._additionalColumns = [];
  }

  getHeader() {
    return `<thead><tr><th>${this._getViewCellsTemplate()
      .map((cell) => cell.title)
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

  /**
   * Fill HTML table with observations data
   * @param {{patients: Object[], observations: Object[]}} data - result of
   *        requests to server for observations and patients
   * @param {Object} rawCriteria - control values for criteria
   * @param {number} maxPatientCount - maximum number of patients
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server
   *        from which data is being pulled
   */
  fill({ data, rawCriteria, maxPatientCount, serviceBaseUrl }) {
    // Prepare data for show & download
    this.serviceBaseUrl = serviceBaseUrl;
    this.valueSetMapByPath = getCurrentDefinitions().valueSetMapByPath;
    this._rawInputData = {
      data,
      rawCriteria,
      maxPatientCount,
      serviceBaseUrl
    };
    this.data = data.map((patient) => {
      patient._name = humanNameToString(patient.name);
      patient._age = getPatientAge(patient);
      patient._address = addressToStringArray(
        this.valueSetMapByPath,
        patient.address
      );
      patient._email = getPatientContactsByType(
        this.valueSetMapByPath,
        patient,
        'email'
      );
      patient._phone = getPatientContactsByType(
        this.valueSetMapByPath,
        patient,
        'phone'
      );
      return patient;
    });

    // Update table
    const viewCellsTemplate = this._getViewCellsTemplate();

    document.getElementById(this._id).innerHTML =
      this.getHeader() +
      '<tbody><tr>' +
      this.data
        .map((obs) => {
          return (
            '<td>' +
            viewCellsTemplate.map((cell) => cell.text(obs)).join('</td><td>') +
            '</td>'
          );
        })
        .join('</tr><tr>') +
      '</tr></tbody>';
  }

  /**
   * Restores the state of the table to the moment when method getRawData was called
   * @param {Object} rawData
   */
  setRawData(rawData) {
    this.setAdditionalColumns(rawData.additionalColumns);
    this.fill(rawData);
  }

  /**
   * Returns data describing the state of the table
   * @return {Object}
   */
  getRawData() {
    return {
      additionalColumns: this._additionalColumns,
      ...this._rawInputData
    };
  }

  /**
   * Returns default Cohort filename
   * @return {string}
   */
  getDefaultFileName() {
    return `cohort-${this._rawInputData.data.length}.json`;
  }

  /**
   * Checks data for errors and returns the first error if any
   * @param {Object} blobData
   * @param {Object} options
   * @param {string} options.serviceBaseUrl - the Service Base URL of the FHIR
   *        server from which data is being pulled
   * @return {Error|null}
   */
  checkBlobData(blobData, options) {
    const { data, rawCriteria, maxPatientCount, serviceBaseUrl } = blobData;
    const readableData =
      serviceBaseUrl &&
      rawCriteria &&
      maxPatientCount &&
      data &&
      data.length &&
      data[0].resourceType === 'Patient';
    if (!readableData) {
      return new Error('Unreadable data.');
    } else if (options.serviceBaseUrl !== serviceBaseUrl) {
      return new Error(
        'Inapplicable data, because it was downloaded from another server.'
      );
    }
    return null;
  }
}
