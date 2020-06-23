import { valueSetsMap } from './common/value-sets';
import { addressToStringArray, getPatientAge, getPatientContactsByType, humanNameToString } from './common/utils';

export class PatientTable {
  constructor(tableId) {
    this.tableId = tableId;

    // Mapping for each cell in a row for display:
    // title - column caption
    // columnName - if a value is specified, then this column is displayed by the condition
    //              that this value is present in the column array for display (this._additionalColumns),
    //              also this value specifies column name for a request to the FHIR server;
    //              otherwise, if no value is specified, this column is constantly displayed.
    // text - callback to get cell text/html
    this.viewCellsTemplate = [
      {
        title: 'Patient Id',
        text: pat => pat.id
      },
      {
        title: 'Patient',
        text: pat => pat._name
      },
      {
        title: 'Gender',
        columnName: 'gender',
        text: pat => valueSetsMap.administrativeGenderList[pat.gender] || ''
      },
      {
        title: 'Age',
        columnName: 'age',
        text: pat => pat._age || ''
      },
      {
        title: 'Birth date',
        columnName: 'birthdate',
        text: pat => pat.birthDate || ''
      },
      {
        title: 'Death date',
        columnName: 'death-date',
        text: pat => pat.deceasedDateTime || ''
      },
      {
        title: 'Address',
        columnName: 'address',
        text: pat => pat._address.join('<br>')
      },
      {
        title: 'Phone',
        columnName: 'phone',
        text: pat => pat._phone.join('<br>')
      },
      {
        title: 'Email',
        columnName: 'email',
        text: pat => pat._email.join('<br>')
      },
      {
        title: 'Language',
        columnName: 'language',
        text: pat => {
          const communication = pat.communication;
          return communication && communication.language || '';
        }
      }
    ];

    this._additionalColumns = [];
  }

  getHeader() {
    return`<thead><tr><th>${this._getViewCellsTemplate().map(cell => cell.title).join('</th><th>')}</th></tr></thead>`;
  }

  setAdditionalColumns(columns) {
    this._additionalColumns = columns || [];
  }

  _getViewCellsTemplate() {
    return this.viewCellsTemplate.filter(item => !item.columnName || this._additionalColumns.indexOf(item.columnName) !== -1);
  }


  /**
   * Fill HTML table with observations data
   * @param {{patients: Object[], observations: Object[]}} data - result of requests to server for observations and patients
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server from which data is being pulled
   */
  fill(data, serviceBaseUrl) {
    // Prepare data for show & download
    this.serviceBaseUrl = serviceBaseUrl;
    this.data = data.map((patient) => {
      patient._name = humanNameToString(patient.name);
      patient._age = getPatientAge(patient);
      patient._address = addressToStringArray(patient.address);
      patient._email = getPatientContactsByType(patient, 'email');
      patient._phone = getPatientContactsByType(patient, 'phone');
      return patient;
    });

    // Update table
    const viewCellsTemplate = this._getViewCellsTemplate();

    document.getElementById(this.tableId).innerHTML = this.getHeader()
      + '<tbody><tr>' + this.data.map(obs => {
        return '<td>' + viewCellsTemplate.map(cell => cell.text(obs)).join('</td><td>') + '</td>';
      }).join('</tr><tr>') + '</tr></tbody>';
  }
}