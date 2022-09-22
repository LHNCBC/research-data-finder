import { Component } from '@angular/core';

/**
 * Component for displaying text that can be truncated.
 * In this case, an ellipsis will be shown at the end of the visible part of
 * the text, and a tooltip with the full text will be added.
 */
@Component({
  selector: 'app-ellipsis-text',
  templateUrl: './ellipsis-text.component.html',
  styleUrls: ['./ellipsis-text.component.less']
})
export class EllipsisTextComponent {
  constructor() {}

  /**
   * Returns the text to display as a tooltip if the element's text
   * has been truncated, otherwise returns an empty string.
   * @param element - HTML element with possibly truncated text which has
   *   a special structure to recognize truncation.
   */
  getTooltipText(element: HTMLElement): string {
    // Can't use this simple check:
    //   element.clientWidth < element.scrollWidth
    // In some cases, this check will fail because these properties
    // (clientWidth & scrollWidth) will round the value to an integer, but
    // the ellipsis is displayed even if the difference is less than 0.5 pixels.
    return element.getBoundingClientRect().right <
      element.firstElementChild.getBoundingClientRect().right
      ? element.innerText
      : '';
  }
}
