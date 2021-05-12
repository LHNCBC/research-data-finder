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
import { MatTableDataSource } from '@angular/material/table';
import { ColumnDescription } from '../../types/column.description';
import { bufferCount, debounceTime } from 'rxjs/operators';
import { capitalize } from '../../shared/utils';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import { escapeStringForRegExp } from '@legacy/js/common/utils';
import { Subject } from 'rxjs';
import Resource = fhir.Resource;

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
  columns: string[] = [];
  filterColumns = [];
  selectedResources = new SelectionModel<Resource>(true, []);
  filtersForm: FormGroup = new FormBuilder().group({});
  dataSource = new MatTableDataSource<Resource>([]);
  lastResourceElement: HTMLElement;
  isLoading = true;

  @HostBinding('class.fullscreen') fullscreen = false;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService
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
    this.columnDescriptions = allColumns.filter(
      (x) => this.getCellStrings(this.dataSource.data[0], x).length
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
      this.resourceStream
        .asObservable()
        // update table for every 50 new rows
        .pipe(bufferCount(50))
        .subscribe(
          (resouceses) => {
            this.dataSource.data = this.dataSource.data.concat(resouceses);
            if (!this.columnDescriptions.length) {
              this.setColumnsFromBundle();
              this.setTableColumns();
            }
          },
          () => {},
          () => {
            this.isLoading = false;
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
              '\\b' + escapeStringForRegExp(value),
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
   * Get count message according to number of resources loaded
   */
  get countMessage(): string {
    if (!this.isLoading && this.dataSource?.data.length === 0) {
      return `No ${this.resourceType} resources were found on the server.`;
    } else {
      let output = '';
      if (this.enableSelection) {
        output += `Selected ${this.selectedResources.selected.length} out of `;
      }
      output += `${this.dataSource.data.length} rows loaded.`;
      return output;
    }
  }
}
