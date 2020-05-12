import * as moment from 'moment';
import { valueSetsMap } from "./value-sets";
import { addressToStringArray, humanNameToString } from "./utils";

const reValueKey = /^value/;

export class ObservationsTable {
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
        text: obs => obs.subject.reference.replace(/^Patient\//, '')
      },
      {
        title: 'Patient',
        text: obs => this.getPatientName(obs)
      },
      {
        title: 'Gender',
        columnName: 'gender',
        text: obs => valueSetsMap.administrativeGenderList[this.getPatient(obs).gender] || ''
      },
      {
        title: 'Age',
        columnName: 'age',
        text: obs => this.getPatient(obs)._age || ''
      },
      {
        title: 'Birth date',
        columnName: 'birthdate',
        text: obs => this.getPatient(obs).birthDate || ''
      },
      {
        title: 'Death date',
        columnName: 'death-date',
        text: obs => this.getPatient(obs).deceasedDateTime || ''
      },
      {
        title: 'Address',
        columnName: 'address',
        text: obs => this.getPatient(obs)._address.join('<br>')
      },
      {
        title: 'Phone',
        columnName: 'phone',
        text: obs => this.getPatient(obs)._phone.join('<br>')
      },
      {
        title: 'Email',
        columnName: 'email',
        text: obs => this.getPatient(obs)._email.join('<br>')
      },
      {
        title: 'Language',
        columnName: 'language',
        text: obs => {
          const communication = this.getPatient(obs).communication;
          return communication && communication.language || '';
        }
      },
      // TODO: Can't just get a Practitioner name from Patient data
      // {
      //   title: 'General practitioner',
      //   columnName: 'general-practitioner',
      //   text: obs => {
      //     const patient = this.getPatient(obs);
      //     return patient && patient.generalPractitioner && patient.generalPractitioner[0]
      //       && patient.generalPractitioner[0].reference || '';
      //   }
      // },
      {
        title: 'Date',
        text: obs => {
          const date = obs.effectiveDateTime,
            tIndex = date.indexOf('T');

          return tIndex >= 0 ? date.slice(0, tIndex) : date;
        }
      },
      {
        title: 'Time',
        text: obs => {
          const date = obs.effectiveDateTime,
            tIndex = date.indexOf('T');

          return tIndex >= 0 ? date.slice(tIndex + 1) : '';
        }
      },
      {
        title: 'Test Name',
        text: obs => obs.code.text || obs.code.coding[0].display
      },
      {
        title: 'Value',
        text: obs => this.getObservationValue(obs).value
      },
      {
        title: 'Unit',
        text: obs => this.getObservationValue(obs).unit
      },
      {
        title: 'FHIR Observation',
        text: obs => {
          const id = obs.id,
            href = this.serviceBaseUrl + '/Observation/' + obs.id;

          return `<a href="${href}" target="_blank" rel="noopener noreferrer">${id}</a>`;
        }
      },
      {
        title: 'Interpretation',
        text: obs => {
          const codeableConcept = obs.interpretation && obs.interpretation[0];



          return codeableConcept && (codeableConcept.text ||
            codeableConcept.coding && codeableConcept.coding.length > 0 && (
              codeableConcept.coding[0].display || codeableConcept.coding[0].code
            )) || '';
        }
      }
    ];

    // Mapping for each cell in a row for export to CSV-file
    this.exportCellsTemplate = this.viewCellsTemplate.map(desc => {
      if (desc.title === 'FHIR Observation') {
        return {
          title: desc.title,
          text: obs => obs.id,
        };
      } if (['phone', 'email', 'address'].indexOf(desc.columnName) !== -1) {
        return {
          title: desc.title,
          columnName: desc.columnName,
          text: obs => this.getPatient(obs)['_' + desc.columnName].join('\n')
        };
      } else {
        return desc;
      }
    });

    this._additionalColumns = [];
  }

  /**
   * Get thead element for update table header.
   * @return {HTMLElement}
   */
  get header() {
    return document.getElementById(this.tableId).tHead;
  }

  /**
   * Get tbody element for fill table.
   * @return {HTMLElement}
   */
  get body() {
    return document.getElementById(this.tableId).tBodies[0];
  }



  /**
   * Returns the name of the Patient who is the subject of the Observation
   * @param {Object} obs
   * @return {string}
   */
  getPatientName(obs) {
    const patientRef = obs.subject.reference;

    return obs.subject.display || (this.refToPatient[patientRef] || {})._name || patientRef
  }

  /**
   * Returns the Patient resource data from the Observation
   * @param {Object} obs
   * @return {Object}
   */
  getPatient(obs) {
    return this.refToPatient[obs.subject.reference] || {};
  }

  /**
   * Returns the age of the Patient from the Patient Resource
   * @param {Object} res the Patient resource
   * @return {number|undefined}
   */
  getPatientAge(res) {
    const birthDateStr = res.birthDate;
    if (birthDateStr) {
      return Math.floor(moment.duration(moment().diff(new Date(birthDateStr))).asYears());
    }
  }

  /**
   * Returns the html for email/phone column of the Patient from the Patient Resource
   * @param {Object} res the Patient resource
   * @param {String} system 'email'/'phone'
   * @return {String}
   */
  getPatientTelecom(res, system) {
    return (res.telecom || [])
      .filter(item => item.system === system)
      .map(item => {
        const use = valueSetsMap.contactPointUse[item.use];
        return `${use ? use + ': ' : ''} ${item.value}`
      });
  }

  /**
   * Returns Observation code
   * @param {Object} obs
   * @return {string|null}
   */
  getObservationCode(obs) {
    const codeableConcept = obs.code;

    return codeableConcept && codeableConcept.coding &&
      codeableConcept.coding.length > 0 &&
      codeableConcept.coding[0].code || null;
  }

  /**
   * Returns Observation value/unit
   * @param {Object} obs
   * @return {{value: string, unit: string}}
   */
  getObservationValue(obs) {
    let result = {
      value: '',
      unit: ''
    };

    Object.keys(obs).some(key => {
      const valueFound = reValueKey.test(key);
      if (valueFound) {
        const value = obs[key];
        if (key === 'valueQuantity') {
          result = {
            value: value.value,
            unit: value.unit
          };
        } else if (key === 'valueCodeableConcept' && value.coding && value.coding.length) {
          result.value = value.text || value.coding[0].display;
        } else {
          result.value = value
        }
      }
      return valueFound;
    });

    return result;
  }

  updateHeader() {
    this.header.innerHTML = `<tr><th>${this._getViewCellsTemplate().map(cell => cell.title).join('</th><th>')}</th></tr>`;
  }

  setAdditionalColumns(columns) {
    this._additionalColumns = columns || [];
  }

  _getViewCellsTemplate() {
    return this.viewCellsTemplate.filter(item => !item.columnName || this._additionalColumns.indexOf(item.columnName) !== -1);
  }
  _getExportCellsTemplate() {
    return this.exportCellsTemplate.filter(item => !item.columnName || this._additionalColumns.indexOf(item.columnName) !== -1);
  }

  /**
   * Fill HTML table with observations data
   * @param {{patients: Object[], observations: Object[]}} data - result of requests to server for observations and patients
   * @param {number} perPatientPerTest - limit per patient per test
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server from which data is being pulled
   */
  fill(data, perPatientPerTest, serviceBaseUrl) {
    let patientToCodeToCount = {};

    this.updateHeader();

    // Prepare data for show & download
    this.serviceBaseUrl = serviceBaseUrl;
    this.refToPatient = data.patients.reduce((refs, patient) => {
      patient._name = humanNameToString(patient.name);
      patient._age = this.getPatientAge(patient);
      patient._address = addressToStringArray(patient.address);
      patient._email = this.getPatientTelecom(patient, 'email');
      patient._phone = this.getPatientTelecom(patient, 'phone');
      refs[`${patient.resourceType}/${patient.id}`] = patient;
      return refs;
    },{});
    this.data = data.observations
      .filter(obs => {
        // Per Clem, we will only show perPatientPerTest results per patient per test.
        const patientRef = obs.subject.reference,
          codeStr = this.getObservationCode(obs);
        let codeToCount = patientToCodeToCount[patientRef] || (patientToCodeToCount[patientRef]={});

        // For now skip Observations without a code in the first coding.
        if (codeStr) {
          const codeCount = codeToCount[codeStr] || (codeToCount[codeStr] = 0);
          if (codeCount < perPatientPerTest) {
            ++codeToCount[codeStr];
            return true;
          }
        }
        return false;
      });

    // Update table
    const viewCellsTemplate = this._getViewCellsTemplate();
    this.body.innerHTML = '<tr>' + this.data.map(obs => {
      return '<td>' + viewCellsTemplate.map(cell => cell.text(obs)).join('</td><td>') + '</td>';
    }).join('</tr><tr>') + '</tr>';
  }

  /**
   * Creates Blob for download table
   * @return {Blob}
   */
  getBlob() {
    const cellsTemplate = this._getExportCellsTemplate();
    const header = cellsTemplate.map(cell => cell.title).join(','),
      rows = this.data.map(obs => {
        return cellsTemplate.map(cell => {
          const cellText = cell.text(obs);

          if (/["\s]/.test(cellText)) {
            return '"' + cellText.replace(/"/, '""') + '"';
          } else {
            return cellText;
          }
        }).join(',');
      });

    return new Blob([[header].concat(rows).join('\n')],
      {type: 'text/plain;charset=utf-8', endings: 'native'});
  }
}