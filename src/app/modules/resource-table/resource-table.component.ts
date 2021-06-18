import {
  Component,
  HostBinding,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SelectionModel } from '@angular/cdk/collections';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ColumnDescription } from '../../types/column.description';
import { bufferCount } from 'rxjs/operators';
import { capitalize, escapeStringForRegExp } from '../../shared/utils';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import { Subject } from 'rxjs';
import Resource = fhir.Resource;
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { SettingsService } from '../../shared/settings-service/settings.service';
import { Sort } from '@angular/material/sort';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() columnDescriptions: ColumnDescription[];
  @Input() enableClientFiltering = false;
  @Input() enableSelection = false;
  @Input() resourceType;
  @Input() resourceStream: Subject<Resource>;
  @Input() loadingStatistics: (string | number)[][] = [];
  columns: string[] = [];
  filterColumns = [];
  selectedResources = new SelectionModel<Resource>(true, []);
  filtersForm: FormGroup = new FormBuilder().group({});
  dataSource = new TableVirtualScrollDataSource<Resource>([]);
  lastResourceElement: HTMLElement;
  isLoading = true;
  loadTime = 0;
  loadedDateTime: number;

  @HostBinding('class.fullscreen') fullscreen = false;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService,
    private settings: SettingsService,
    private liveAnnoncer: LiveAnnouncer
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  /**
   * Use columns present in bundle info as default, if empty column descriptions is passed in
   */
  private setColumnsFromBundle(): void {
    // Don't update if no data is available
    if (!this.dataSource.data.length) {
      return;
    }

    const allColumns = this.columnDescriptionsService.getAvailableColumns(
      this.resourceType
    );
    const hiddenByDefault = (
      this.settings.get('hideElementsByDefault')?.[this.resourceType] || []
    ).concat(this.settings.get('hideElementsByDefault')?.['*'] || []);
    this.columnDescriptions = allColumns.filter(
      (x) =>
        hiddenByDefault.indexOf(x.element) === -1 &&
        this.getCellStrings(this.dataSource.data[0], x).length
    );
    // Save column selections of default
    window.localStorage.setItem(
      this.resourceType + '-columns',
      this.columnDescriptions.map((x) => x.element).join(',')
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    // update resource table if user searches again
    if (changes['resourceStream'] && changes['resourceStream'].currentValue) {
      this.dataSource.data.length = 0;
      this.isLoading = true;
      this.liveAnnoncer.announce(
        `The ${this.resourceType} resources loading process has started`
      );
      const startTime = Date.now();
      this.resourceStream.pipe(bufferCount(50)).subscribe(
        (resouceses) => {
          this.dataSource.data = this.dataSource.data.concat(resouceses);
          if (!this.columnDescriptions.length) {
            this.setColumnsFromBundle();
            this.setTableColumns();
          }
        },
        () => {},
        () => {
          this.loadedDateTime = Date.now();
          this.loadTime =
            Math.round((this.loadedDateTime - startTime) / 100) / 10;
          this.isLoading = false;
          this.liveAnnoncer.announce(
            `The ${this.resourceType} resources loading process has finished. ` +
              `${this.dataSource.data.length} rows loaded.`
          );
        }
      );
    }
    if (changes['columnDescriptions']) {
      this.columns.length = 0;
      if (this.enableSelection) {
        this.columns.push('select');
      }
      if (!this.columnDescriptions.length) {
        this.setColumnsFromBundle();
      }
      this.setTableColumns();
    }
  }

  setTableColumns(): void {
    this.columns = this.columns.concat(
      this.columnDescriptions.map((c) => c.element)
    );
    if (this.enableClientFiltering) {
      this.filtersForm = new FormBuilder().group({});
      this.filterColumns = this.columns.map((c) => c + 'Filter');
      this.columnDescriptions.forEach((column) => {
        this.filtersForm.addControl(column.element, new FormControl());
      });
      this.dataSource.filterPredicate = ((data, filter) => {
        for (const [key, value] of Object.entries(filter)) {
          if (value) {
            const columnDescription = this.columnDescriptions.find(
              (c) => c.element === key
            );
            const cellValue = this.getCellStrings(data, columnDescription);
            const reCondition = new RegExp(
              '\\b' + escapeStringForRegExp(value as string),
              'i'
            );
            if (!cellValue.some((item) => reCondition.test(item))) {
              return false;
            }
          }
        }
        return true;
        // casting method signature here because filterPredicate defines filter param as string
        // tslint:disable-next-line:variable-name
      }) as (BundleEntry, string) => boolean;
      this.filtersForm.valueChanges.subscribe((value) => {
        this.dataSource.filter = { ...value } as string;
      });
    }
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected(): boolean {
    const numSelected = this.selectedResources.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle(): void {
    this.isAllSelected()
      ? this.selectedResources.clear()
      : this.dataSource.data.forEach((row) =>
          this.selectedResources.select(row)
        );
  }

  /**
   * Clear filters on all columns
   */
  clearColumnFilters(): void {
    this.filtersForm.reset();
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;
  }

  /**
   * Returns string values to display in a cell
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   */
  getCellStrings(row: Resource, column: ColumnDescription): string[] {
    const fullPath = column.element
      ? this.resourceType + '.' + column.element
      : '';

    for (const type of column.types) {
      const element = column.element.replace('[x]', capitalize(type));
      const output = this.columnValuesService.valueToStrings(
        row[element],
        type,
        column.isArray,
        fullPath
      );

      if (output && output.length) {
        return output;
      }
    }
    return [];
  }

  /**
   * Get loading message according to loading status
   */
  get loadingMessage(): string {
    if (this.isLoading) {
      return 'Loading ...';
    } else if (this.dataSource.data.length === 0) {
      return `No ${this.resourceType} resources were found on the server.`;
    } else {
      return 'Loading complete.';
    }
  }

  /**
   * Get count message according to number of resources loaded
   */
  get countMessage(): string {
    if (this.dataSource.data.length === 0) {
      return '';
    } else {
      let output = '';
      if (this.enableSelection) {
        output += `Selected ${this.selectedResources.selected.length} out of `;
      }
      output += `${this.dataSource.data.length} rows loaded.`;
      return output;
    }
  }

  /**
   * Sort dataSource on table header click
   * @param sort - sorting event object containing info of table column and sort direction
   */
  sortData(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      return;
    }
    const isAsc = sort.direction === 'asc';
    const sortingColumnDescription = this.columnDescriptions.find(
      (c) => c.element === sort.active
    );
    this.dataSource.data.sort((a: Resource, b: Resource) => {
      const cellValueA = this.getCellStrings(a, sortingColumnDescription).join(
        '; '
      );
      const cellValueB = this.getCellStrings(b, sortingColumnDescription).join(
        '; '
      );
      return cellValueA.localeCompare(cellValueB) * (isAsc ? 1 : -1);
    });
    // Table will re-render only after data reference changed.
    this.dataSource.data = this.dataSource.data.slice();
  }

  /**
   * Creates Blob for download table
   */
  getBlob(): Blob {
    const columnDescriptions = this.columnDescriptions;
    const header = columnDescriptions
      .map((columnDescription) => columnDescription.displayName)
      .join(',');
    const rows = this.dataSource.data.map((resource) =>
      columnDescriptions
        .map((columnDescription) => {
          const cellText = this.getCellStrings(
            resource,
            columnDescription
          ).join('; ');
          if (/["\s,]/.test(cellText)) {
            // According to RFC-4180 which describes common format for CSV files:
            // Fields containing line breaks (CRLF), double quotes, and commas
            // should be enclosed in double-quotes.
            // If double-quotes are used to enclose fields, then a double-quote
            // appearing inside a field must be escaped by preceding it with
            // another double quote.
            // Also, according to https://en.wikipedia.org/wiki/Comma-separated_values:
            // In CSV implementations that do trim leading or trailing spaces,
            // fields with such spaces as meaningful data must be quoted.
            // Therefore, to avoid any problems, data with any spaces is also quoted.
            return '"' + cellText.replace(/"/, '""') + '"';
          } else {
            return cellText;
          }
        })
        .join(',')
    );

    return new Blob([[header].concat(rows).join('\n')], {
      type: 'text/plain;charset=utf-8',
      endings: 'native'
    });
  }

  /**
   * Select a list of items by ID in table.
   */
  setSelectedIds(ids: string[]): void {
    this.selectedResources.clear();
    const items = this.dataSource.data.filter((r) => ids.includes(r.id));
    this.selectedResources.select(...items);
  }
}
