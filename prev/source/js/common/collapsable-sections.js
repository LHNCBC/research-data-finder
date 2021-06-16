import { slice, toggleCssClass } from './utils';

/**
 * Adds the ability to collapse for each section
 */
export function initCollapsibleSections() {
  slice(document.querySelectorAll('.section')).forEach((element) => {
    if (!element.querySelector('.section__header')) {
      element.insertAdjacentHTML(
        'afterbegin',
        `
<div class="section__header" onclick="toggleSection(this);" onkeydown="keydownToClick(event)" tabindex="0"></div>`
      );
      const titleElement = element.querySelector('.section__title');
      element.querySelector('.section__header').appendChild(titleElement);
    }
  });
}

/**
 * Click event handler for section header
 * @param {HTMLElement} sectionHeader
 */
window.toggleSection = function (sectionHeader) {
  const sectionElement = sectionHeader.closest('.section');
  const isCollapsed = toggleCssClass(sectionElement, 'section_collapsed');

  if (isCollapsed) {
    const rect = sectionElement.getBoundingClientRect();
    if (rect.top < 0) {
      window.scrollTo(window.scrollX, window.scrollY + rect.top - 10);
    }
  }
};

/**
 * Converts pressing the spacebar or enter to a click event
 * @param {KeyboardEvent} event
 */
window.keydownToClick = function (event) {
  if (
    (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') &&
    event.target === event.currentTarget
  ) {
    event.target.click();
    event.preventDefault();
  }
};
