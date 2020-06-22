import { slice, toggleClass } from "./utils";

/**
 * Adds the ability to collapse for each section
 */
slice(document.querySelectorAll('.section')).forEach(element => {
  if (!element.querySelector('.section__header')) {
    element.insertAdjacentHTML('afterbegin', `
<div class="section__header" onclick="toggleSection(this)"></div>`);
    const titleElement = element.querySelector('.section__title');
    element.querySelector('.section__header').appendChild(titleElement);
  }
});

/**
 * Click event handler for section header
 * @param {HTMLElement} sectionHeader
 */
window.toggleSection = function(sectionHeader) {
  const sectionElement = sectionHeader.closest('.section');
  const isCollapsed = toggleClass(sectionElement, 'section_collapsed');

  if (isCollapsed) {
    const rect = sectionElement.getBoundingClientRect();
    if (rect.top < 0) {
      window.scrollTo(window.scrollX, window.scrollY + rect.top - 10);
    }
  }
}