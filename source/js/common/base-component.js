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
   * Create a wrapper function to call "fn" once
   * when directly accessing or when calling "detachControls"
   * @param {Function} fn
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
   * Expands the passed identifier with a prefix with the component identifier
   * @param {string} id
   */
  generateId(id) {
    return this._id + '-' + id;
  }

  /**
   * Expands the passed identifier with a prefix with the component identifier
   * and postfix with index number
   * @param {string} id
   */
  generateUniqueId(id) {
    return addIndexToId(this.generateId(id));
  }
}

const uniqueIdGenerator = {};
/**
 * Expands the passed identifier with a postfix with index number
 * @param {string} id
 */
function addIndexToId(id) {
  const index = (uniqueIdGenerator[id] = (uniqueIdGenerator[id] || 0) + 1);
  return id + '-' + index;
}
