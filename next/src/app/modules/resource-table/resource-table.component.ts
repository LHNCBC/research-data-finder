import {
  Component,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SelectionModel } from '@angular/cdk/collections';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import { ColumnDescription } from '../../types/column.description';
import { debounceTime } from 'rxjs/operators';
import { CdkScrollable } from '@angular/cdk/overlay';
import { capitalize } from '../../shared/utils';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import { escapeStringForRegExp } from '@legacy/js/common/utils';
import { Subscription } from 'rxjs';

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
  @Input() initialBundle: Bundle;
  @Input() enableClientFiltering = false;
  @Input() enableSelection = false;
  @Input() max = 0;
  @Input() resourceType;
  columns: string[] = [];
  filterColumns = [];
  nextBundleUrl: string;
  selectedResources = new SelectionModel<BundleEntry>(true, []);
  filtersForm: FormGroup = new FormBuilder().group({});
  dataSource = new MatTableDataSource<BundleEntry>([]);
  lastResourceElement: HTMLElement;
  isLoading = false;

  scrollSubscription: Subscription;

  @ViewChild(CdkScrollable)
  set scrollable(scrollable: CdkScrollable) {
    this.scrollSubscription?.unsubscribe();
    if (scrollable) {
      this.scrollSubscription = scrollable
        .elementScrolled()
        .pipe(debounceTime(700))
        .subscribe((e) => {
          this.ngZone.run(() => {
            this.onTableScroll(e);
          });
        });
    }
  }
  resourceTotal = 0;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService
  ) {}

  ngOnInit(): void {
    // entry is not mandatory property
    this.dataSource.data = this.initialBundle.entry || [];
    this.nextBundleUrl = this.initialBundle.link.find(
      (l) => l.relation === 'next'
    )?.url;
    this.resourceTotal = this.initialBundle.total;
  }

  ngOnDestroy(): void {
    this.scrollSubscription?.unsubscribe();
  }

  /**
   * Use columns present in bundle info as default, if empty column descriptions is passed in
   */
  private setColumnsFromBundle(): void {
    // Don't update if no data is available
    if (!this.initialBundle.entry && this.initialBundle.entry.length) {
      return;
    }

    const allColumns = this.columnDescriptionsService.getAvailableColumns(
      this.resourceType
    );
    this.columnDescriptions = allColumns.filter(
      (x) => this.getCellStrings(this.initialBundle.entry[0], x).length
    );
    // Save column selections of default
    window.localStorage.setItem(
      this.resourceType + '-columns',
      this.columnDescriptions.map((x) => x.element).join(',')
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columnDescriptions']) {
      this.columns.length = 0;
      if (this.enableSelection) {
        this.columns.push('select');
      }
      if (!this.columnDescriptions.length) {
        this.setColumnsFromBundle();
      }
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
  }

  /**
   * Call and load a bundle of resources
   */
  callBatch(url: string): void {
    this.isLoading = true;
    this.nextBundleUrl = '';
    this.http.get(url).subscribe((data: Bundle) => {
      this.isLoading = false;
      // If max is defined, load no more than max number of resource rows
      if (
        this.max &&
        this.dataSource.data.length + data.entry.length > this.max
      ) {
        return;
      }
      this.nextBundleUrl = data.link.find((l) => l.relation === 'next')?.url;
      this.dataSource.data = this.dataSource.data.concat(data.entry);
    });
  }

  /**
   * Table viewport scroll handler
   */
  onTableScroll(e): void {
    // Extra safeguard in case server traffic takes longer than scroll throttle time (1000ms)
    if (!this.nextBundleUrl) {
      return;
    }
    const tableViewHeight = e.target.offsetHeight; // viewport: 300px
    const tableScrollHeight = e.target.scrollHeight; // length of all table
    const scrollLocation = e.target.scrollTop; // how far user scrolled
    // If the user has scrolled within 200px of the bottom, add more data
    const buffer = 200;
    const limit = tableScrollHeight - tableViewHeight - buffer;
    if (scrollLocation > limit) {
      this.callBatch(this.nextBundleUrl);
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
   * Returns string values to display in a cell
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   */
  getCellStrings(row: BundleEntry, column: ColumnDescription): string[] {
    const fullPath = column.element
      ? this.resourceType + '.' + column.element
      : '';

    for (const type of column.types) {
      const element = column.element.replace('[x]', capitalize(type));
      const output = this.columnValuesService.valueToStrings(
        row.resource[element],
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
   * Get count message according to total/max number of resources
   */
  get countMessage(): string {
    if (this.dataSource?.data.length === 0) {
      return `No ${this.resourceType} resources were found on the server.`;
    } else {
      let output = '';
      if (this.enableSelection) {
        output += `Selected ${this.selectedResources.selected.length} out of `;
      }
      if (!this.resourceTotal && !this.max) {
        output += `${this.dataSource.data.length} rows loaded.`;
      }
      if (!this.resourceTotal && this.max) {
        output += `${this.max} maximum rows.`;
      }
      if (this.resourceTotal && !this.max) {
        output += `${this.resourceTotal} total rows.`;
      }
      if (this.resourceTotal && this.max) {
        output +=
          this.max > this.resourceTotal
            ? `${this.resourceTotal} total rows.`
            : `${this.max} maximum rows.`;
      }
      return output;
    }
  }
}
