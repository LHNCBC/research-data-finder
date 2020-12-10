import { BaseComponent } from './base-component';
import Modal from 'bootstrap/js/src/modal';
import EventHandler from 'bootstrap/js/src/dom/event-handler';

let initialized = false;

/**
 * @typedef ColumnDescription
 * @type {Object}
 * @property {string} name - column name
 * @property {string} element - property name template (could be ends with "[x]") of resource object
 * @property {string} types - possible value types in the column
 * @property {boolean} isArray - true if max cardinality greater than 1
 * @property {boolean} visible - boolean value that determines visibility of the column
 */

/**
 * Component class for the columns selection dialog
 */
export class ColumnsDialog extends BaseComponent {
  /**
   * Constructor of component
   * @param {Object<Function>} callbacks - callback functions:
   *        updateColumns - to notify that the array of column descriptions ready for use
   * @param {Array<ColumnDescription>} columns - an array of available column descriptions
   */
  constructor({ callbacks, columns }) {
    super({
      callbacks: {
        ...callbacks,
        addComponentToPage: (html) => {
          if (!initialized) {
            // Add dialog HTML to the body once.
            // This dialog markup is shareable between all instances of ColumnsDialog.
            document.body.insertAdjacentHTML('beforeend', html);
          }
          initialized = true;
        }
      }
    });

    this.columns = columns;
    this.initialize();

    this.attachEvent(
      document.getElementById('clearColumnList'),
      'click',
      () => {
        // "Clear selection" button handler
        [].slice
          .call(
            document.querySelectorAll(
              '#columnsModalDialogBody input[type="checkbox"]'
            )
          )
          .forEach((input) => (input.checked = false));
      }
    );
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    return `
<div class="modal fade" id="columnsModalDialog" tabindex="-1" role="dialog" aria-labelledby="columnsModalDialogLabel" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="columnsModalDialogLabel">Select columns to load</h5>
        <div class="modal-close-btn" data-dismiss="modal" aria-label="Close"
         tabindex="0"><span aria-hidden="true">&times;</span></div>
      </div>
      <div class="modal-header">
        <span class="description">
          If no columns are selected, the default columns will be loaded.<br>
          If the column contains no data, it will not be displayed.
        </span>
      </div>
      <div class="modal-body" id="columnsModalDialogBody">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-link" id="clearColumnList">Clear selection</button>
        <span class="flex-fill"></span>
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="saveColumnListChanges">Save changes</button>
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * Opens modal dialog to select columns.
   */
  open() {
    const EVENT_CLOSE_DIALOG = 'hidden.bs.modal';
    const dialogElement = document.querySelector('#columnsModalDialog');
    const dialog = Modal.getInstance(dialogElement) || new Modal(dialogElement);
    const removeSaveClickEvent = this.attachEvent(
      document.getElementById('saveColumnListChanges'),
      'click',
      () => {
        // "Save changes" button handler
        dialog.hide();
        this.applyColumnListChanges();
      }
    );
    this.updateColumnList();
    dialog.show();
    EventHandler.on(dialogElement, EVENT_CLOSE_DIALOG, function onClose() {
      // Close dialog handler
      removeSaveClickEvent();
      EventHandler.off(dialogElement, EVENT_CLOSE_DIALOG, onClose);
    });
  }

  /**
   * Applies column selection changes.
   */
  applyColumnListChanges() {
    this.columns.forEach((column, index) => {
      const inputId = `column-visible-${index}`;
      const input = document.getElementById(inputId);
      column.visible = input.checked;
    });
    this.callbacks.updateColumns();
  }

  /**
   * Updates list of columns in shareable dialog markup before open.
   */
  updateColumnList() {
    const dialogBody = document.getElementById('columnsModalDialogBody');
    dialogBody.innerHTML = this.columns
      .map((column, index) => {
        const inputId = `column-visible-${index}`;
        const checked = column.visible ? 'checked' : '';
        const cssClass = column.unavailable ? 'unavailable-column' : '';
        return `<label><input type=checkbox id="${inputId}" ${checked} class="${cssClass}">${column.name}</label>`;
      })
      .join('');
  }
}
