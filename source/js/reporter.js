import { toggleCssClass, removeCssClass, addCssClass } from './common/utils';

/**
 * Enumeration of supported metrics for the report
 */
export const Metric = Object.freeze({
  ENCOUNTER_COUNT: 'The number of Encounters satisfying the search criteria',
  ENCOUNTER: 'Encounter resources loaded',
  PATIENT_COUNT: 'The number of Patients satisfying the search criteria',
  PATIENT: 'Patient resources loaded',
  PATIENT_CHECKED: 'Patient resources checked',
  OBSERVATION_REQUESTS: 'Requests for Observation resources',
  OBSERVATION: 'Observation resources loaded'
});

/**
 * Defines which metric should have a duration
 * @type {{[Metric]: boolean}}
 */
const calculateDuration = {
  [Metric.ENCOUNTER_COUNT]: true,
  [Metric.ENCOUNTER]: true,
  [Metric.PATIENT_COUNT]: true,
  [Metric.PATIENT]: true,
  [Metric.PATIENT_CHECKED]: true,
  [Metric.OBSERVATION_REQUESTS]: true,
  // [Metric.OBSERVATION]: true
}

/**
 * Class for creating a popup with a report
 */
export class Reporter {
  constructor() {
    this._isVisible = false;

    this._id = 'stat-popup';
    if (!document.getElementById(this._id)) {
      const id = this._id;
      document.body.insertAdjacentHTML('beforeend', `\
<div id="${id}" class="report-popup hide">
  <div class="report-popup_window">
    <div class="report-popup_content">
    </div>
    <div class="report-popup_close-btn">&times;</div>
  </div>
</div>`);
      document.querySelector(`#${id} .report-popup_close-btn`).addEventListener('click', () => this.hide());
      document.querySelector(`#${id}`).addEventListener('mousedown', event => {
        if (event.target === event.currentTarget && document.querySelector(`#${id} .report-popup_close-btn.hide`) === null) {
          this.hide();
        }
      });
    }

    this.clear();
  }

  /**
   * Show popup with the report
   */
  show() {
    this._isVisible = true;
    this._updateWindowImmediately();
    removeCssClass('#' + this._id, 'hide');
  }

  /**
   * Hide popup with the report
   */
  hide() {
    this._isVisible = false;
    addCssClass('#' + this._id, 'hide');
  }

  /**
   * Clear the report
   */
  clear() {
    this._info = {
      currentProcess: null,
      startDate: null,
      stat: [],
      _index: {}
    };
    this._updateWindowImmediately();
  }

  /**
   * (Re)Initialize the report
   */
  initialize() {
    this.clear();
    this._info.startDate = Date.now();
    // Uncomment this string to show popup with progressbar:
    // this.show();
  }

  /**
   * Finalize the report
   */
  finalize() {
    this._info.duration = Date.now() - this._info.startDate;
    this.clearProgress();
  }

  /**
   * Set progressbar state
   * @param {string} description - label for progressbar
   * @param {number} percent - percentage progress
   */
  setProgress(description, percent) {
    this._info.currentProcess = { description, percent };
    this._updateWindow();
  }

  /**
   * Remove progressbar
   */
  clearProgress() {
    this._info.currentProcess = null;
    this._updateWindow();
  }

  /**
   * Update popup window
   * @private
   */
  _updateWindowImmediately() {
    if(!this._isVisible) {
      return;
    }
    window.cancelAnimationFrame(this._updateHandle);
    this._updateHandle = window.requestAnimationFrame(() => {
      let html='';
      if (this._info.currentProcess) {
        if (this._info.currentProcess.percent !== undefined) {
          html += `\
<label for="${this._id}-progress">${this._info.currentProcess.description}</label>
<progress id="${this._id}-progress" max="100" value="${this._info.currentProcess.percent}" style="width:100%">${this._info.currentProcess.percent}%</progress>`;
        } else {
          html = `<label>${this._info.currentProcess.description}</label>`;
        }
      }

      if (typeof this._info.duration === 'number' && this._info.stat.filter(item => calculateDuration[item.name]).length !== 1) {
        html += `
<label class="report-popup_item">
Overall time:
<span class="report-popup_item-space"></span>
${(this._info.duration / 1000).toFixed(1)} s
</label>`;
      }

      this._info.stat.forEach(metricInfo => {
        const duration = calculateDuration[metricInfo.name] ? ` in ${(metricInfo.duration / 1000).toFixed(1)} s` : '';
        html += `\
<div class="report-popup_item">
${metricInfo.name}:
<span class="report-popup_item-space"></span>
<label>${metricInfo.count}${duration}</label>
</div>`;
      })
      document.querySelector(`#${this._id} .report-popup_content`).innerHTML = html;
      toggleCssClass(`#${this._id} .report-popup_close-btn`, 'hide', !!this._info.currentProcess);
    });
  }

  /**
   * Wrapper for the update popup window method with throttling
   * @private
   */
  _updateWindow() {
    if(this._updateScheduled || !this._isVisible) {
      return;
    }

    this._updateScheduled = setTimeout(() => {
      delete this._updateScheduled;
      this._updateWindowImmediately();
    }, 100);
  }

  /**
   * Record start of measurement
   * @param {Metric} name
   */
  startProcess(name) {
    if (!this._getMeasurement(name)) {
      this._info._index[name] = this._info.stat.length;
      this._info.stat.push({
        name: name,
        count: 0,
        startTime: Date.now(),
        ...(calculateDuration[name] ? {duration: 0} : {})
      });
      this._updateWindow();
    }
  }

  /**
   * Record current measurement status
   * @param {Metric} name
   * @param {number} count
   */
  updateProcess(name, count) {
    let measurement = this._getMeasurement(name);

    measurement.count = count;
    if (calculateDuration[name]) {
      measurement.duration = Date.now() - measurement.startTime;
    }
    this._updateWindow();
  }

  /**
   * Get current measurement status
   * @param {Metric} name
   */
  _getMeasurement(name) {
    let index = this._info._index[name];
    if (typeof index === 'number') {
      return this._info.stat[index];
    }
  }

  /**
   * Increment current measurement count
   * @param {Metric} name
   * @param {number} [inc]
   */
  incrementCount(name, inc) {
    this.updateProcess(name, this._getMeasurement(name).count + (typeof inc === 'number' ? inc : 1));
  }

}