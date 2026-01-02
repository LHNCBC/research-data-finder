import { AfterViewInit, Component, ElementRef, HostListener, Input } from '@angular/core';

/**
 * Represents a single item in a distribution chart
 * @interface DistributionItem
 */
export interface DistributionItem {
  /** The label/category key for this distribution item */
  key: string;
  /** The absolute count/value for this item */
  value: number;
  /** The calculated percentage (0-100) of this item relative to total */
  percentage?: number;
}

/**
 * Component that displays a distribution chart with horizontal bars
 * showing categorical data with percentages and counts.
 *
 * Features:
 * - Horizontal bar chart visualization
 * - Auto-adjusting labels for small bars
 * - Responsive layout with window resize handling
 *
 * @example
 * ```html
 * <app-distribution
 *   title="Gender distribution"
 *   [items]="genderDistribution">
 * </app-distribution>
 * ```
 */
@Component({
  selector: 'app-distribution',
  templateUrl: './distribution.component.html',
  styleUrl: './distribution.component.less'
})
export class DistributionComponent implements AfterViewInit {
  /** The title displayed at the top of the distribution chart */
  @Input() title: string;

  /** Array of distribution items to display as bars */
  @Input() items: DistributionItem[] = [];

  /**
   * Creates an instance of DistributionComponent
   * @param elementRef - Reference to the host element for DOM manipulation
   */
  constructor(private elementRef: ElementRef) {}

  /**
   * Lifecycle hook called after the view has been initialized.
   * Triggers initial label adjustment for all bars.
   */
  ngAfterViewInit() {
    this.adjustBarLabels();
  }

  /**
   * Adjusts the position of bar labels based on available space.
   * Labels that don't fit inside the bar are moved outside to the right.
   * This method is called on initialization and whenever the window is resized.
   *
   * The adjustment works by:
   * 1. Measuring the width of each bar
   * 2. Measuring the width of the label inside
   * 3. Adding 'small-bar' class if label doesn't fit, which moves it outside
   *
   * @listens window:resize - Automatically adjusts labels when window is resized
   */
  @HostListener('window:resize')
  adjustBarLabels(): void {
    // Query all bar elements within this component
    const bars = (this.elementRef.nativeElement as HTMLElement).querySelectorAll('.bar');

    bars.forEach((bar: HTMLElement) => {
      // Get the actual rendered width of the bar
      const barWidth = bar.offsetWidth;

      // Find the label element inside this bar
      const label: HTMLElement = bar.querySelector('.bar-label');
      const labelWidth = label ? label.offsetWidth : 0;

      // If label doesn't fit inside the bar (with implicit padding), move it outside
      // The 'small-bar' class positions the label to the right of the bar
      if (barWidth < labelWidth) {
        bar.classList.add('small-bar');
      } else {
        bar.classList.remove('small-bar');
      }
    });
  }
}
