const reValueKey = /^value/;

export class ObservationsTable {
  constructor(tableId) {
    this.tableId = tableId;

    // Mapping for each cell in a row for display
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
            href = this.serverURL + '/Observation/' + obs.id;

          return `<a href="${href}" target="_blank">${id}</a>`;
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
        }
      } else {
        return desc;
      }
    });

    this.updateHeader();
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
   *  Builds a patient name string from a Patient resource.
   *  Returns the name string, or null if one could not be constructed.
   * @param {Object} res the Patient resource
   * @return {string|null}
   */
  patientNameStr(res) {
    let rtn = null;

    if (res.name && res.name.length > 0) {
      let nameStr = '';
      const name = res.name[0];

      if (name.given && name.given.length > 0)
        nameStr = name.given[0];
      if (name.family) {
        if (nameStr.length > 0)
          nameStr += ' ';
        nameStr += name.family;
      }
      if (nameStr.length > 0)
        rtn = nameStr;
    }
    return rtn;
  }

  /**
   * Returns the patient name from Observation
   * @param {Object} obs
   * @return {string}
   */
  getPatientName(obs) {
    const patientRef = obs.subject.reference;

    return obs.subject.display || this.pRefToName[patientRef] || patientRef
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

  /**
   * Separate Observations from Patients, and create name strings for the Patients
   * @param {Object} data
   * @return {Array}
   */
  getObservations(data) {
    let obs = [];
    let pRefToName = {};

    this.pRefToName = pRefToName;

    for (let i = 0, len = data.entry.length; i < len; ++i) {
      const res = data.entry[i].resource;

      if (res.resourceType === 'Observation') {
        obs.push(res);
      } else { // assume Patient for now
        const pName = this.patientNameStr(res);

        if (pName)
          pRefToName['Patient/' + res.id] = pName;
      }
    }

    return obs;
  }

  updateHeader() {
    this.header.innerHTML = `<tr><th>${this.viewCellsTemplate.map(cell => cell.title).join('</th><th>')}</th></tr>`;
  }

  /**
   * Fill HTML table with observations data
   * @param {Object} data - result of request to server for observations
   * @param {number} perPatientPerTest - limit per patient per test
   * @param {string} serverURL - usable for making links
   */
  fill(data, perPatientPerTest, serverURL) {
    let patientToCodeToCount = {};

    // Prepare data for show & download
    this.serverURL = serverURL;
    this.data = this.getObservations(data)
      .filter(obs => {
        // Per Clem, we will only show perPatientPerTest results per patient per test.
        const patient = this.getPatientName(obs), // TODO: maybe better to use obs.subject.reference?
          codeStr = this.getObservationCode(obs);
        let codeToCount = patientToCodeToCount[patient] || (patientToCodeToCount[patient]={});

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
    this.body.innerHTML = '<tr>' + this.data.map(obs => {
      return '<td>' + this.viewCellsTemplate.map(cell => cell.text(obs)).join('</td><td>') + '</td>';
    }).join('</tr><tr>') + '</tr>';
  }

  /**
   * Creates Blob for download table
   * @return {Blob}
   */
  getBlob() {
    const header = this.exportCellsTemplate.map(cell => cell.title).join(','),
      rows = this.data.map(obs => {
        return this.exportCellsTemplate.map(cell => {
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