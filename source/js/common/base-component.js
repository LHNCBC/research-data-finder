/**
 * BaseComponent is the core class for visual components.
 */
export class BaseComponent {
  /**
   * Constructor
   * @param {Object<Function>} callbacks - callback functions that the component
   *        uses for input/output, for example:
   *        callbacks.addComponentToPage is a required function which is used to
   *        add an HTML of the component to the page
   */
  constructor({ callbacks }) {
    this.callbacks = callbacks;

    // The array of functions to execute when calling detachControls
    this.detachFns = [];

    // Create component identifier
    const className = this.constructor.name;
    this._id = addIndexToId(className);
  }

  /**
   * Initializes the component
   * @return {BaseComponent}
   */
  initialize() {
    this.callbacks.addComponentToPage(this.getHtml());
    this.attachControls();
    return this;
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    return '';
  }

  /**
   * Initializes controls created in getHtml
   */
  attachControls() {}

  /**
   * Removes links to controls created in attachControls and attachEvent.
   * Also automatically clears properties which refer to HTML elements.
   */
  detachControls() {
    Object.keys(this).forEach((key) => {
      if (this[key] instanceof HTMLElement) {
        this[key] = null;
        // console.log('>>> Remove element', key);
      } else {
        if (this[key] instanceof BaseComponent) {
          // console.log('>>> Start detach component', key);
          this[key].detachControls();
          // console.log('>>> End detach component', key);
        }
      }
    });

    this.detachFns.forEach((fn) => fn());
    this.detachFns.length = 0;
  }

  /**
   * Adds event listener to DOM element and return remover for this listener
   * @param {HTMLElement} element
   * @param {string} type
   * @param {Function} handler
   * @return {Function}
   */
  attachEvent(element, type, handler) {
    element.addEventListener(type, handler);

    return this.createDetachFn(() => {
      element.removeEventListener(type, handler);
    });
  }

  /**
   * Creates a wrapper function to call "fn" once
   * when directly accessing or when calling "detachControls"
   * @param {Function} fn
   * @return {Function}
   */
  createDetachFn(fn) {
    const remover = () => {
      const index = this.detachFns.indexOf(remover);
      if (index > -1) {
        fn();
        this.detachFns.splice(index, 1);
      }
    };

    this.detachFns.push(remover);

    return remover;
  }

  /**
   * Adds a prefix with the component identifier to the passed string idSuffix
   * @param {string} idSuffix
   * @return {string}
   */
  generateId(idSuffix) {
    return this._id + '-' + idSuffix;
  }

  /**
   * Adds a prefix with the component identifier and a suffix with index number
   * to the passed string idPart
   * @param {string} idPart
   * @return {string}
   */
  generateUniqueId(idPart) {
    return addIndexToId(this.generateId(idPart));
  }
}

const uniqueIdGenerator = {};
/**
 * Adds a suffix with index number to the passed string idBase
 * @param {string} idBase
 * @return {string}
 */
function addIndexToId(idBase) {
  const index = (uniqueIdGenerator[idBase] =
    (uniqueIdGenerator[idBase] || 0) + 1);
  return idBase + '-' + index;
}
