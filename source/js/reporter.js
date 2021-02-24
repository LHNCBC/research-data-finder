import {
  toggleCssClass,
  removeCssClass,
  addCssClass,
  trapFocusInPopup
} from './common/utils';

/**
 * Class for creating a popup with a report
 */
export class Reporter {
  constructor() {
    this._isVisible = false;

    this._id = 'stat-popup';
    if (!document.getElementById(this._id)) {
      const id = this._id;
      document.body.insertAdjacentHTML(
        'beforeend',
        `\
<div id="${id}" class="report-popup hide">
  <div class="report-popup_window">
    <div class="report-popup_content"></div>
    <div class="modal-close-btn"
         tabindex="0" onkeydown="keydownToClick(event);">&times;</div>
  </div>
</div>`
      );
      document
        .querySelector(`#${id} .modal-close-btn`)
        .addEventListener('click', () => this.hide());
      document
        .querySelector(`#${id}`)
        .addEventListener('mousedown', (event) => {
          if (
            event.target === event.currentTarget &&
            document.querySelector(`#${id} .modal-close-btn.hide`) === null
          ) {
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
    const popupElement = document.getElementById(this._id);
    removeCssClass(popupElement, 'hide');
    this.freeFocus = trapFocusInPopup(popupElement, () => this.hide());
  }

  /**
   * Hide popup with the report
   */
  hide() {
    this._isVisible = false;
    addCssClass('#' + this._id, 'hide');
    this.freeFocus();
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
    if (!this._isVisible) {
      return;
    }
    window.cancelAnimationFrame(this._updateHandle);
    this._updateHandle = window.requestAnimationFrame(() => {
      let html = '';
      if (this._info.currentProcess) {
        if (this._info.currentProcess.percent !== undefined) {
          html += `\
<label for="${this._id}-progress">${this._info.currentProcess.description}</label>
<progress id="${this._id}-progress" max="100" value="${this._info.currentProcess.percent}" style="width:100%">${this._info.currentProcess.percent}%</progress>`;
        } else {
          html = `<label>${this._info.currentProcess.description}</label>`;
        }
      }

      if (
        typeof this._info.duration === 'number' &&
        this._info.stat.filter((item) => typeof item.duration === 'number')
          .length !== 1
      ) {
        html += `
<label class="report-popup_item">
Overall time:
<span class="report-popup_item-space"></span>
${(this._info.duration / 1000).toFixed(1)} s
</label>`;
      }

      this._info.stat.forEach((measurement) => {
        const duration =
          typeof measurement.duration === 'number'
            ? ` in ${(measurement.duration / 1000).toFixed(1)} s`
            : '';
        html += `\
<div class="report-popup_item">
${measurement.name}:
<span class="report-popup_item-space"></span>
<label>${measurement.count}${duration}</label>
</div>`;
      });
      document.querySelector(
        `#${this._id} .report-popup_content`
      ).innerHTML = html;
      toggleCssClass(
        `#${this._id} .modal-close-btn`,
        'hide',
        !!this._info.currentProcess
      );
    });
  }

  /**
   * Wrapper for the update popup window method with throttling
   * @private
   */
  _updateWindow() {
    if (this._updateScheduled || !this._isVisible) {
      return;
    }

    this._updateScheduled = setTimeout(() => {
      delete this._updateScheduled;
      this._updateWindowImmediately();
    }, 100);
  }

  /**
   * @typedef MeasurementController
   * Object to control the measurement.
   * @property {function(number): void} updateCount - update measurement value
   * @property {function(number=): void} incrementCount - increase measurement value
   * @property {function(): number} getCount - get measurement value
   */
  /**
   * Records the start of metric measurement. Returns an object to control the measurement.
   * @param {string} name
   * @param {boolean} calculateDuration
   * @param {number} count
   * @return {MeasurementController}
   */
  addMetric({ name, calculateDuration = true, count = 0 }) {
    const measurement = {
      name,
      count,
      startTime: Date.now(),
      ...(calculateDuration ? { duration: 0 } : {})
    };

    this._info.stat.push(measurement);
    this._updateWindow();

    let updateCount = (count) => {
      measurement.count = count;
      if (calculateDuration) {
        measurement.duration = Date.now() - measurement.startTime;
      }
      this._updateWindow();
    };

    return {
      /**
       * Set current measurement count
       * @param {number} count
       */
      updateCount,
      /**
       * Increment current measurement count
       * @param {number} [inc]
       */
      incrementCount: (inc = 1) => updateCount(measurement.count + inc),
      /**
       * Returns current measurement count
       * @return {number}
       */
      getCount: () => {
        return measurement.count;
      }
    };
  }
}
