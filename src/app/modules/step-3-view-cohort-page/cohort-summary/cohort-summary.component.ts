import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DistributionItem } from './distribution/distribution.component';
import Patient = fhir.Patient;
import { DistributionComponent } from 'src/app/modules/step-3-view-cohort-page/cohort-summary/distribution/distribution.component';
import {
  FhirBackendService
} from 'src/app/shared/fhir-backend/fhir-backend.service';
import {
  FhirBackendModule
} from 'src/app/shared/fhir-backend/fhir-backend.module';

/**
 * Grouping strategy for distribution values
 */
export type GroupingStrategy =
  | 'none' // No grouping, use raw values
  | 'age-decades' // Group ages by 10-year ranges (0-9, 10-19, etc.)
  | 'age-categories' // Group ages as: Pediatric (0-17), Adult (18-64), Senior (65+)
  | 'age-ranges' // Custom age ranges defined in groupingRanges
  | 'boolean' // Convert to Yes/No
  | 'date-year' // Extract year from date
  | 'date-month' // Extract month from date
  | 'number-ranges'; // Group numbers into custom ranges

/**
 * Sorting strategy for distribution items
 */
export type SortingStrategy =
  | 'count-desc' // Sort by count descending (most common first)
  | 'count-asc' // Sort by count ascending (least common first)
  | 'label-asc' // Sort alphabetically by label
  | 'label-desc'; // Sort reverse alphabetically by label

/**
 * JSON-serializable configuration for a distribution chart using FHIRPath expressions
 * All properties are simple data types that can be stored in JSON
 *
 * @interface DistributionConfig
 */
export interface DistributionConfig {
  /** Unique identifier for this distribution */
  id: string;

  /** Display title for the distribution chart */
  title: string;

  /**
   * FHIRPath expression to extract data from the Patient resource
   *
   * Examples:
   * - "gender" - Simple field
   * - "address.first().state" - Nested field with function
   * - "birthDate.toDate().toString()" - Date manipulation
   * - "telecom.where(system='phone').value.first()" - Filtered query
   * - "extension.where(url='http://example.com/race').valueString" - Extensions
   * - "deceased.exists()" - Boolean check
   * - "age()" - Calculate age (if supported by FHIRPath implementation)
   */
  fhirPathExpression: string;

  /**
   * Strategy for grouping values
   * @default 'none'
   */
  grouping?: GroupingStrategy;

  /**
   * Custom ranges for grouping strategies
   * Used with 'age-ranges' or 'number-ranges' grouping
   * Format: Array of {max: number, label: string}
   * Example: [{max: 17, label: 'Pediatric'}, {max: 64, label: 'Adult'}, {max: 999, label: 'Senior'}]
   */
  groupingRanges?: Array<{ max: number; label: string }>;

  /**
   * Strategy for sorting the distribution items
   * @default 'count-desc'
   */
  sorting?: SortingStrategy;

  /**
   * Whether to exclude null/undefined values from the distribution
   * @default false
   */
  excludeNull?: boolean;

  /**
   * Whether to exclude empty strings from the distribution
   * @default false
   */
  excludeEmpty?: boolean;

  /**
   * Optional mapping of raw values to display labels
   * Example: {'male': 'Male', 'female': 'Female', 'other': 'Other'}
   */
  labelMap?: Record<string, string>;

  /**
   * Optional prefix to add to all labels
   * Example: '📊 ' would turn 'Male' into '📊 Male'
   */
  labelPrefix?: string;

  /**
   * Optional suffix to add to all labels
   * Example: ' patients' would turn 'Male' into 'Male patients'
   */
  labelSuffix?: string;

  /**
   * Maximum number of items to display (show top N)
   * Useful for limiting large distributions
   * @default undefined (show all)
   */
  maxItems?: number;
}

/**
 * Component that displays configurable summary statistics for a cohort of patients.
 * Uses FHIRPath expressions for flexible, standards-compliant data extraction.
 *
 * All configuration is done through JSON-serializable objects with FHIRPath expressions,
 * making it suitable for storage in databases, JSON files, or API responses.
 *
 * @example
 * ```typescript
 * // Configuration using FHIRPath expressions
 * const config: DistributionConfig[] = [
 *   {
 *     id: 'gender',
 *     title: 'Gender Distribution',
 *     fhirPathExpression: 'gender'
 *   },
 *   {
 *     id: 'state',
 *     title: 'State Distribution',
 *     fhirPathExpression: 'address.first().state'
 *   },
 *   {
 *     id: 'has-email',
 *     title: 'Email Contact Available',
 *     fhirPathExpression: "telecom.where(system='email').exists()",
 *     grouping: 'boolean'
 *   }
 * ];
 * ```
 *
 * ```html
 * <app-cohort-summary
 *   [patients]="patientList"
 *   [distributions]="config">
 * </app-cohort-summary>
 * ```
 */
@Component({
  selector: 'app-cohort-summary',
  templateUrl: './cohort-summary.component.html',
  imports: [FhirBackendModule, DistributionComponent],
  styleUrl: './cohort-summary.component.less'
})
export class CohortSummaryComponent implements OnChanges {
  /** Array of FHIR Patient resources to analyze */
  @Input() patients: Patient[] = [];

  /**
   * Configuration array defining which distributions to display.
   * Uses FHIRPath expressions for data extraction.
   * If not provided, defaults to gender and age distributions.
   */
  @Input() distributions: DistributionConfig[] = [];

  /**
   * Calculated distribution data for each configured distribution.
   * Key is the distribution ID, value is the array of distribution items.
   */
  distributionData: Map<string, DistributionItem[]> = new Map();

  constructor(private fhirBackend: FhirBackendService) {}
  /**
   * Lifecycle hook that responds to changes in input properties.
   * Recalculates all distributions whenever patients or distribution configs change.
   *
   * @param changes - Object containing the changed properties
   */
  ngOnChanges(changes: SimpleChanges): void {
    // Recalculate if patients or distribution config changed
    if (changes['patients'] || changes['distributions']) {
      this.calculateAllDistributions();
    }
  }

  /**
   * Calculates all configured distributions from the patient data.
   * Clears previous data and recalculates each distribution.
   */
  private calculateAllDistributions(): void {
    // Clear previous data
    this.distributionData.clear();

    // Return early if no patients
    if (!this.patients || this.patients.length === 0) {
      return;
    }

    // Calculate each configured distribution
    this.distributions?.forEach((config) => {
      const items = this.calculateDistribution(config);
      this.distributionData.set(config.id, items);
    });
  }

  /**
   * Calculates a single distribution based on the provided configuration.
   *
   * Algorithm:
   * 1. Evaluate FHIRPath expression for each patient
   * 2. Handle array results (use first value)
   * 3. Apply grouping strategy if specified
   * 4. Filter out nulls/empties if configured
   * 5. Count occurrences of each unique value
   * 6. Calculate percentages
   * 7. Apply label mapping and formatting
   * 8. Sort according to sorting strategy
   * 9. Limit to maxItems if specified
   *
   * @param config - The distribution configuration
   * @returns Array of distribution items with counts and percentages
   */
  private calculateDistribution(config: DistributionConfig): DistributionItem[] {
    const valueMap = new Map<string, number>();
    const compiledExpression = this.fhirBackend.getEvaluator(config.fhirPathExpression);

    // Process each patient
    this.patients.forEach((patient) => {
      try {
        // Evaluate the FHIRPath expression
        // FHIRPath always returns an array, take first element
        let value = compiledExpression(patient)[0] ?? null;

        // Skip null values if configured
        if (config.excludeNull && (value === null || value === undefined)) {
          return;
        }

        // Skip empty strings if configured
        if (config.excludeEmpty && value === '') {
          return;
        }

        // Apply grouping strategy
        if (config.grouping) {
          value = this.applyGrouping(value, config.grouping, config.groupingRanges);
        }

        // Convert to string for consistent key handling
        const key = String(value ?? 'Unknown');

        // Increment count for this value
        valueMap.set(key, (valueMap.get(key) || 0) + 1);
      } catch (error) {
        console.warn(`FHIRPath evaluation error for patient ${patient.id}:`, error);
        // Continue processing other patients
      }
    });

    // Convert map to array of DistributionItems
    let items: DistributionItem[] = Array.from(valueMap.entries()).map(([key, value]) => ({
      key: this.formatLabel(key, config),
      value: value,
      percentage: Math.round((10000 * value) / this.patients.length) / 100
    }));

    // Apply sorting strategy
    this.sortItems(items, config.sorting || 'count-desc');

    // Apply maxItems limit if specified
    if (config.maxItems && config.maxItems > 0) {
      items = items.slice(0, config.maxItems);
    }

    return items;
  }

  /**
   * Applies a grouping strategy to a value.
   *
   * @param value - The raw value to group
   * @param strategy - The grouping strategy to apply
   * @param ranges - Custom ranges for range-based strategies
   * @returns The grouped value
   */
  private applyGrouping(
    value: any,
    strategy: GroupingStrategy,
    ranges?: Array<{ max: number; label: string }>
  ): string {
    if (value === null || value === undefined) {
      return 'Unknown';
    }

    switch (strategy) {
      case 'none':
        return String(value);

      case 'age-decades': {
        const age = Number(value);
        if (isNaN(age) || age < 0) return 'Unknown';
        const decade = Math.floor(age / 10);
        const start = decade * 10;
        return `${start} - ${start + 9}`;
      }

      case 'age-categories': {
        const age = Number(value);
        if (isNaN(age) || age < 0) return 'Unknown';
        if (age < 18) return 'Pediatric (0-17)';
        if (age < 65) return 'Adult (18-64)';
        return 'Senior (65+)';
      }

      case 'age-ranges':
      case 'number-ranges': {
        if (!ranges || ranges.length === 0) {
          return String(value);
        }

        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Unknown';

        for (const range of ranges) {
          if (num <= range.max) {
            return range.label;
          }
        }

        return `${ranges[ranges.length - 1].max}+`;
      }

      case 'boolean': {
        const boolValue = value === true || value === 'true' || value === 1;
        return boolValue ? 'Yes' : 'No';
      }

      case 'date-year': {
        const date = new Date(value);
        if (isNaN(date.getTime())) return 'Unknown';
        return String(date.getFullYear());
      }

      case 'date-month': {
        const date = new Date(value);
        if (isNaN(date.getTime())) return 'Unknown';
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[date.getMonth()];
      }

      default:
        return String(value);
    }
  }

  /**
   * Formats a label according to configuration options.
   * Applies label mapping, prefix, and suffix.
   *
   * @param key - The raw key/label
   * @param config - The distribution configuration
   * @returns The formatted label
   */
  private formatLabel(key: string, config: DistributionConfig): string {
    let label = key;

    // Apply label mapping if provided
    if (config.labelMap && config.labelMap[key]) {
      label = config.labelMap[key];
    }

    // Apply prefix if provided
    if (config.labelPrefix) {
      label = config.labelPrefix + label;
    }

    // Apply suffix if provided
    if (config.labelSuffix) {
      label = label + config.labelSuffix;
    }

    return label;
  }

  /**
   * Sorts distribution items according to a sorting strategy.
   * Modifies the array in place.
   *
   * @param items - The array of distribution items to sort
   * @param strategy - The sorting strategy to apply
   */
  private sortItems(items: DistributionItem[], strategy: SortingStrategy): void {
    switch (strategy) {
      case 'count-desc':
        items.sort((a, b) => b.value - a.value);
        break;

      case 'count-asc':
        items.sort((a, b) => a.value - b.value);
        break;

      case 'label-asc':
        items.sort((a, b) => a.key.localeCompare(b.key));
        break;

      case 'label-desc':
        items.sort((a, b) => b.key.localeCompare(a.key));
        break;
    }
  }

  /**
   * Gets the distribution items for a specific distribution ID.
   * Used by the template to access calculated data.
   *
   * @param distributionId - The ID of the distribution to retrieve
   * @returns Array of distribution items, or empty array if not found
   */
  getDistributionItems(distributionId: string): DistributionItem[] {
    return this.distributionData.get(distributionId) || [];
  }
}
