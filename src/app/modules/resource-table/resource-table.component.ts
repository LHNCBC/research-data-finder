import {
  Component,
  ContentChild,
  EventEmitter,
  HostBinding,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SelectionModel } from '@angular/cdk/collections';
import {
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup
} from '@angular/forms';
import { ColumnDescription } from '../../types/column.description';
import { distinctUntilChanged, sample, tap } from 'rxjs/operators';
import {
  dispatchWindowResize,
  escapeStringForRegExp,
  getPluralFormOfRecordName, getPluralFormOfResourceType
} from '../../shared/utils';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import {
  TableItemSizeDirective,
  TableVirtualScrollDataSource
} from 'ng-table-virtual-scroll';
import { SettingsService } from '../../shared/settings-service/settings.service';
import { Sort } from '@angular/material/sort';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { ResourceTableFilterComponent } from '../resource-table-filter/resource-table-filter.component';
import { FilterType } from '../../types/filter-type';
import { CustomDialog } from '../../shared/custom-dialog/custom-dialog.service';
import Resource = fhir.Resource;
import { MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { isEqual, pickBy } from 'lodash-es';
import { saveAs } from 'file-saver';
import Observation = fhir.Observation;
import { RasTokenService } from '../../shared/ras-token/ras-token.service';

type TableCells = { [key: string]: string };

export interface TableRow {
  cells: TableCells;
  resource?: Resource;
  valueQuantityData?: fhir.Quantity;
}

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit, OnChanges, OnDestroy {
  constructor(
    public fhirBackend: FhirBackendService,
    public rasToken: RasTokenService,
    private http: HttpClient,
    private ngZone: NgZone,
    public columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService,
    private settings: SettingsService,
    private liveAnnouncer: LiveAnnouncer,
    private dialog: CustomDialog
  ) {
    this.listFilterColumns = settings.get('listFilterColumns') || [];

    // The method to determine if a row satisfies all filter criteria by returning
    // true or false. filterValues is extracted from this.filtersForm.
    this.dataSource.filterPredicate = ((data, filterValues) => {
      for (const [key, value] of Object.entries(filterValues)) {
        if (!value || (value as string[]).length === 0) {
          continue;
        }
        const columnDescription = this.columnDescriptions.find(
          (c) => c.element === key
        );
        const cellValue = data.cells[columnDescription.element];
        const filterType = this.getFilterType(columnDescription);
        if (filterType === FilterType.Autocomplete) {
          if (!(value as string[]).includes(cellValue)) {
            return false;
          }
        }
        if (filterType === FilterType.Text) {
          const reCondition = new RegExp(
            '\\b' + escapeStringForRegExp(value as string),
            'i'
          );
          if (!reCondition.test(cellValue)) {
            return false;
          }
        }
        if (filterType === FilterType.Number) {
          if (
            !ResourceTableComponent.checkNumberFilter(
              cellValue,
              value as string
            )
          ) {
            return false;
          }
        }
      }
      return true;
      // casting method signature here because filterPredicate defines filter param as string
      // tslint:disable-next-line:variable-name
    }) as (BundleEntry, string) => boolean;

    this.subscriptions.push(
      this.filtersForm.valueChanges
        .pipe(
          distinctUntilChanged((prev, curr) =>
            isEqual(pickBy(prev), pickBy(curr))
          )
        )
        .subscribe((value) => {
          if (this.filterChanged.observers.length) {
            this.scrollViewport.scrollToIndex(0);
            this.filterChanged.next(value);
          } else {
            this.setClientFilter({ ...value });
          }
        })
    );
  }

  /**
   * Tooltip text for a record checkbox.
   */
  @Input() checkboxTooltipText: string;

  /**
   * Get loading message according to loading status
   */
  get loadingMessage(): string {
    if (this.loading) {
      return (
        'Loading ... ' + (this.progressValue ? this.progressValue + '%' : '')
      );
    } else if (this.dataSource.data.length === 0) {
      return `No matching ${this.resourceType} resources were found on the server.`;
    } else {
      return 'Loading complete.';
    }
  }

  /**
   * Get count message according to number of resources loaded
   */
  get countMessage(): string {
    let output = '';
    if (this.enableSelection) {
      output += `Selected ${this.selectedResources.selected.length} out of `;
    }
    output += `${this.dataSource.data.length} ${this.resourceType} resources loaded.`;
    if (this.failedRequests) {
      // Show number of failed requests after displaying successful records in table.
      output += ` (${this.failedRequests} requests failed)`;
    }
    return output;
  }

  @ContentChild('prefix') prefixTemplate: TemplateRef<any>;
  @ContentChild('buttonPrefix') buttonPrefixTemplate: TemplateRef<any>;
  @ContentChild('header') headerTemplate: TemplateRef<any>;
  @ContentChild('rowAction') rowActionTemplate: TemplateRef<any>;
  get templateContext(): any {
    return {};
  }
  @ViewChild('panel') panel: MatExpansionPanel;
  @ViewChild(TableItemSizeDirective) itemSizeDirective: TableItemSizeDirective;
  @Input() columnDescriptions: ColumnDescription[];
  // If true, client-side filtering is applied by default.
  // To enable server-side filtering, define a "(filterChanged)" handler.
  @Input() enableFiltering = false;
  @Input() enableSelection = false;
  // Whether highlighting is used for selected rows
  @Input() highlightSelection = false;
  // The resource type for the rows
  @Input() resourceType;
  // The "resource type" for display columns, e.g. observations can be treated as variables
  @Input() resourceTypeColumns;
  @Input() context = '';
  @Input() resources: Resource[];
  @Input() total: number;

  // Used to get notifications from outside of the component about
  // starting/stopping of the loading process.
  @Input('loading') isLoading: boolean;

  /**
   * Returns loading state for the table.
   * It depends on the isLoading input parameter but ignores its frequent
   * changes to avoid flickering the loading indicator.
   */
  get loading(): boolean {
    return this.continuouslyLoading;
  };

  @Input() failedRequests = 0;

  @Input() set progressValue(value) {
    this.progressValue$.next(Math.round(value));
  }

  get progressValue(): number {
    return this.progressValue$.value;
  }

  progressValue$ = new BehaviorSubject(0);
  progressBarPosition$: Observable<number>;
  @Input() loadingStatistics: (string | number)[][] = [];
  @Input() myStudyIds: string[] = [];
  @Input() selectAny = false;
  @ViewChild(CdkVirtualScrollViewport) scrollViewport: CdkVirtualScrollViewport;
  @Output() loadNextPage = new EventEmitter();
  // Subscription to interval to periodically preload the next page.
  // This is necessary to avoid expiration of the link to the next page.
  preloadSubscription: Subscription;
  // Event emitter to preload the next page
  @Output() preloadNextPage = new EventEmitter();
  // Interval in milliseconds to periodically preload another page of results
  keepAliveTimeout = 1000;
  @Output() filterChanged = new EventEmitter();
  @Output() sortChanged = new EventEmitter();
  // Whether we need to enable sorting on the client side for all columns using
  // `(sortChanged)` handler
  @Input() forceClientSort = false;
  @Input() sort: Sort;
  columns: string[] = [];
  columnsWithData: { [element: string]: boolean } = {};
  selectedResources = new SelectionModel<Resource>(true, []);
  @Output() selectionChange = this.selectedResources.changed;
  filtersForm: UntypedFormGroup = new UntypedFormBuilder().group({});
  dataSource = new TableVirtualScrollDataSource<TableRow>([]);
  @Input('loadTime') externalLoadTime: number;
  @Input('loadedDateTime') externalLoadedDateTime: number;
  loadTime = 0;
  startTime: number;
  loadedDateTime: number;
  subscriptions: Subscription[] = [];
  readonly listFilterColumns: string[];

  @HostBinding('class.fullscreen') fullscreen = false;

  // Selected Observation codes at "pull data" step, used to display a matching code
  // in Observation table "Code" column.
  @Input() pullDataObservationCodes: Map<string, string> = null;

  // Whether the table is in the process of continuously loading records - triggering
  // next queries for more records right away.
  continuouslyLoading = false;
  // A timeout for reading "loading finished" message.
  continuouslyLoadingTimeout: any;

  /**
   * Whether it's a valid click event in accessibility sense.
   * A mouse click, The ENTER key or the SPACE key.
   */
  private static isA11yClick(event): boolean {
    if (event.type === 'click') {
      return true;
    }
    return (
      event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')
    );
  }

  /**
   * Check if a cell value satisfies the number (range) filter.
   * @param cellValue - table cell display.
   * @param filterValue - filter, examples: Type a range filter, examples: >5000, <=10, 50, 10 - 19.
   * @private
   */
  public static checkNumberFilter(
    cellValue: string,
    filterValue: string
  ): boolean {
    const cellNumber = +cellValue;
    if (isNaN(cellNumber)) {
      return false;
    }
    if (/^\d+\s*-\s*\d+$/.test(filterValue)) {
      const filterTextNumberMatches = filterValue.match(/\d+/g);
      if (
        cellNumber < +filterTextNumberMatches[0] ||
        cellNumber > +filterTextNumberMatches[1]
      ) {
        return false;
      }
    } else {
      const filterTextNumberMatch = /\d+/.exec(filterValue);
      const filterNumber = +filterTextNumberMatch[0];
      const compareOperator = filterValue
        .slice(0, filterTextNumberMatch.index)
        .trim();
      switch (compareOperator) {
        case '>':
          if (cellNumber <= filterNumber) {
            return false;
          }
          break;
        case '>=':
          if (cellNumber < filterNumber) {
            return false;
          }
          break;
        case '<':
          if (cellNumber >= filterNumber) {
            return false;
          }
          break;
        case '<=':
          if (cellNumber > filterNumber) {
            return false;
          }
          break;
        case '':
          if (cellNumber !== filterNumber) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.preloadSubscription?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.loadingStatistics && this.loadingStatistics.length === 0) {
      this.panel?.close();
    }
    const pluralRecordName = getPluralFormOfRecordName(this.resourceType);
    // Handle a change of loading status
    if (changes['isLoading']) {
      if (this.isLoading) {
        this.columnsWithData = {};
        // Don't read too many "loading started" messages during continuous loading.
        if (!this.continuouslyLoading) {
          this.liveAnnouncer.announce(
            `The ${pluralRecordName} loading process has started`
          );
        }
        this.continuouslyLoading = true;
        clearTimeout(this.continuouslyLoadingTimeout);
        this.startTime = Date.now();
        let i = 0;
        this.progressBarPosition$ = this.progressValue$.pipe(
          // A pause while updating the progress bar position is needed
          // to avoid restarting the animation.
          sample(interval(500)),
          tap((progressValue) => {
            // A pause while announcing the progress bar position is needed
            // to avoid a large number of announcements.
            if (++i % 4 === 0) {
              this.liveAnnouncer.announce(`${progressValue}% loaded`);
            }
          })
        );
      } else if (changes['isLoading'].previousValue) {
        this.progressBarPosition$ = null;
        // Read the "loading finished" message after a delay, so that we get to
        // clear the timeout without reading it in case of continuous loading.
        // For example, the Variables table finds 0 records and RDF immediately
        // triggers the loading of next page in this.onScroll() to look for more
        // items - we only read the "loading finished" message once after the last
        // query has returned.
        this.continuouslyLoadingTimeout = setTimeout(() => {
          this.continuouslyLoading = false;
          this.loadedDateTime = Date.now();
          this.loadTime =
            Math.round((this.loadedDateTime - this.startTime) / 100) / 10;
          this.liveAnnouncer.announce(
            `The ${pluralRecordName} loading process has finished. ` +
            `${this.resources?.length || 0} ${pluralRecordName} loaded. ` +
            (this.total
              ? `Total ${pluralRecordName}` +
              (this.hasFilters() ? ' for the selected filters' : '') +
              ': ' +
              this.total +
              '.'
              : '') +
            this.getSortMessage(),
            'assertive'
          );
        }, 100);
      }
    }

    // Update resource table rows
    if (changes['resources'] && changes['resources'].currentValue) {
      const allColumns = this.columnDescriptionsService.getAvailableColumns(
        this.resourceTypeColumns || this.resourceType,
        this.context
      );
      let columnsWithDataChanged = false;
      const newRows: TableRow[] = this.resources.map((resource) => ({
        resource,
        cells: allColumns.reduce((desc, columnDesc) => {
          const cellText = this.getCellStrings(resource, columnDesc).join('; ');
          desc[columnDesc.element] = cellText;
          if (!this.columnsWithData[columnDesc.element] && cellText) {
            this.columnsWithData[columnDesc.element] = true;
            columnsWithDataChanged = true;
          }
          return desc;
        }, {} as TableCells)
      }));

      if (!this.sortChanged.observers.length) {
        this.clientSort(newRows);
      }

      if (this.enableFiltering) {
        // Move selectable studies to the beginning of table.
        this.dataSource.data = newRows.sort((a: TableRow, b: TableRow) => {
          if (
            !this.myStudyIds.includes(a.resource.id) &&
            this.myStudyIds.includes(b.resource.id)
          ) {
            return 1;
          }
          if (
            this.myStudyIds.includes(a.resource.id) &&
            !this.myStudyIds.includes(b.resource.id)
          ) {
            return -1;
          }
          return 0;
        });
      } else {
        this.dataSource.data = newRows;
      }
      if (columnsWithDataChanged) {
        this.columnDescriptionsService.setColumnsWithData(
          this.resourceTypeColumns || this.resourceType,
          this.context,
          Object.keys(this.columnsWithData)
        );
      }
      this.preloadSubscription?.unsubscribe();
      // setTimeout is needed to update the table after this.dataSource changes
      setTimeout(() => {
        this.onScroll();
      });
      this.runPreloadEvents();
    }

    // Update resource table columns
    if (changes['columnDescriptions'] && this.columnDescriptions) {
      const scrollViewport = this.scrollViewport?.elementRef.nativeElement;

      this.columns.length = 0;
      if (this.enableSelection) {
        this.columns.push('select');
      }

      this.setTableColumns(
        !!scrollViewport?.querySelector(
          '.cdk-keyboard-focused .mat-sort-header-container'
        )
      );
    }
  }

  /**
   * Starts emitting preload events.
   */
  runPreloadEvents(): void {
    if (this.preloadNextPage.observers.length > 0) {
      this.preloadSubscription = interval(this.keepAliveTimeout).subscribe(
        () => {
          // Preload the next page after the specified time has elapsed
          // so that the link to the next page does not expire:
          this.preloadNextPage.emit();
        }
      );
    }
  }

  /**
   * Set material table columns from column descriptions.
   * Set up filter form and table filtering logic if client filtering is enabled.
   * @param isSortHeaderFocused - is there focus on the column header and should
   *  it be maintained after redrawing the table header.
   */
  setTableColumns(isSortHeaderFocused: boolean): void {
    this.columns = this.columns.concat(
      this.columnDescriptions.map((c) => c.element)
    );
    if (this.enableFiltering) {
      // Remove controls for removed columns
      Object.keys(this.filtersForm.controls).forEach((controlName) => {
        if (this.columns.indexOf(controlName) === -1) {
          this.filtersForm.removeControl(controlName, { emitEvent: false });
        }
      });
      // Add controls for added columns
      this.columns.forEach((column) => {
        if (!this.filtersForm.contains(column)) {
          this.filtersForm.addControl(column, new UntypedFormControl(''), {
            emitEvent: false
          });
        }
      });

      if (!this.filterChanged.observers.length) {
        this.filtersForm.updateValueAndValidity({
          onlySelf: true,
          emitEvent: true
        });
      }
    }
    // ng-table-virtual-scroll updates the sticky header position when scrolling
    // the table content. But when the header content changes, the position
    // attributes are reset. In this case, manually update the header position.
    setTimeout(() => {
      const strategy = this.itemSizeDirective?.scrollStrategy;
      if (strategy) {
        strategy.stickyChange.next(
          strategy.viewport.getOffsetToRenderedContentStart()
        );
      }
      if (isSortHeaderFocused) {
        const scrollViewport = this.scrollViewport.elementRef.nativeElement;
        const toFocus =
          // Focus on the sorted column header
          (this.sort &&
            scrollViewport.querySelector<HTMLElement>(
              `.mat-column-${this.sort.active} .mat-sort-header-container`
            )) ||
          // otherwise (if the sorted column is hidden) on the first column header
          scrollViewport.querySelector<HTMLElement>(
            `.mat-sort-header-container`
          );
        toFocus?.focus();
      }
    });
  }

  /** Whether the number of selected elements matches the total number of selectable rows. */
  isAllSelected(): boolean {
    const numSelected = this.selectedResources.selected.length;
    const numRows = this.myStudyIds.length;
    return numSelected === numRows;
  }

  /** Selects all applicable rows if they are not all selected; otherwise clear selection. */
  masterToggle(): void {
    this.isAllSelected()
      ? this.selectedResources.clear()
      : this.dataSource.data.forEach((row) => {
          if (this.myStudyIds.includes(row.resource.id)) {
            this.selectedResources.select(row.resource);
          }
        });
  }

  /**
   * Checks if the specified row is the last selected
   * @param row - table row to check
   */
  isLastSelected(row: TableRow): boolean {
    return (
      this.selectedResources.selected[
        this.selectedResources.selected.length - 1
      ] === row.resource
    );
  }

  /**
   * Adds the ability to select multiple rows in a table with a mouse click
   * while holding down the Shift key.
   * @param $event - event produced by click
   * @param row - clicked table row
   */
  checkboxClick($event: MouseEvent, row: TableRow): void {
    if ($event.shiftKey) {
      const from = this.selectedResources.selected[
        this.selectedResources.selected.length - 1
      ];
      if (from) {
        const fromIndex = this.dataSource.data.findIndex(
          (r) => r.resource === from
        );
        if (fromIndex !== -1) {
          const toIndex = this.dataSource.data.indexOf(row);
          const direction = Math.sign(toIndex - fromIndex);

          for (
            let i = fromIndex;
            direction * i <= direction * toIndex;
            i = i + direction
          ) {
            this.selectedResources.select(this.dataSource.data[i].resource);
          }
          $event.preventDefault();
        }
      }
    }
    $event.stopPropagation();
  }

  /**
   * Deselect all rows.
   */
  clearSelection(): void {
    this.selectedResources.clear();
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
    setTimeout(() => {
      dispatchWindowResize();
    }, 200);
  }

  /**
   * Returns string values to display in a cell
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   */
  getCellStrings(row: Resource, column: ColumnDescription): string[] {
    // Pass pullDataObservationCodes only for Observation "Variable Name" or "Code" column.
    const pullDataObservationCodes =
      row.resourceType === 'Observation' &&
      (column.element === 'codeText' || column.element === 'code') &&
      this.pullDataObservationCodes
        ? this.pullDataObservationCodes
        : undefined;

    return this.columnValuesService.getCellStrings(row, column, pullDataObservationCodes);
  }

  /**
   * Sort dataSource on table header click
   * @param sort - sorting event object containing info of table column and sort direction
   */
  sortData(sort: Sort): void {
    this.sort = sort;
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.scrollViewport.scrollToIndex(0);
    if (this.sortChanged.observers.length) {
      this.sortChanged.emit(sort);
      return;
    }
    // Table will re-render only after data reference changed.
    this.dataSource.data = this.clientSort(this.dataSource.data.slice());
    this.liveAnnouncer.announce(this.getSortMessage());
  }

  /**
   * Sorts array of table rows in place and returns a reference to the same array.
   * @param data - array of table rows.
   */
  clientSort(data: TableRow[]): TableRow[] {
    if (!this.sort) {
      return data;
    }

    // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
    const isAsc = this.sort.direction === 'asc';
    const allColumns = this.columnDescriptionsService.getAvailableColumns(
      this.resourceTypeColumns || this.resourceType,
      this.context
    );
    const sortingColumnDescription = allColumns.find(
      (c) => c.element === this.sort.active
    );
    const filterType = this.getFilterType(sortingColumnDescription);
    return data.sort((a: TableRow, b: TableRow) => {
      const cellValueA = a.cells[sortingColumnDescription.element];
      const cellValueB = b.cells[sortingColumnDescription.element];
      return filterType === FilterType.Number
        ? (+cellValueA - +cellValueB) * (isAsc ? 1 : -1)
        : cellValueA.localeCompare(cellValueB) * (isAsc ? 1 : -1);
    });
  }

  /**
   * Creates Blob for download table
   */
  getBlob(): Blob {
    const columnDescriptions = this.columnDescriptions;
    const header = columnDescriptions
      .map((columnDescription) => {
        if (
          this.resourceType === 'Observation' &&
          columnDescription.element === 'value[x]'
        ) {
          // Separate value column into value & unit columns in export
          return 'Value,Unit';
        }
        return columnDescription.displayName;
      })
      .join(',');
    const rowsToDownload = this.enableFiltering
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const rows = rowsToDownload.map((row) =>
      columnDescriptions
        .map((columnDescription) => {
          const valueQuantity =
            this.resourceType === 'Observation' &&
            columnDescription.element === 'value[x]' &&
            (row.resource as Observation).valueQuantity;
          const cellTexts = valueQuantity
            ? // Separate value column into value & unit columns in export
              [valueQuantity.value ?? '', valueQuantity.unit ?? '']
            : [row.cells[columnDescription.element]];
          return cellTexts
            .map((cellText) => {
              if (typeof cellText === 'string' && /["\s,]/.test(cellText)) {
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
                return '"' + cellText.replace(/"/g, '""') + '"';
              } else {
                return cellText;
              }
            })
            .join(',');
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
    const items = this.dataSource.data.filter((r) =>
      ids.includes(r.resource.id)
    );
    this.selectedResources.select(...items.map((r) => r.resource));
  }

  /**
   * Open popup of filter criteria right below the table header of interest.
   * Filter input could be plain text or multi-select with a list of possible column values.
   * @param event - click event
   * @param column - column description of the header being clicked
   */
  openFilterDialog(event, column: ColumnDescription): void {
    event.preventDefault();
    event.stopPropagation();
    // The button that sits inside the table header with mat-sort-header attribute does not
    // fire the 'click' event properly. Have to listen to 'keydown' event here.
    if (!ResourceTableComponent.isA11yClick(event)) {
      return;
    }

    const filterType = this.getFilterType(column);
    let options: string[] = [];
    if (filterType === FilterType.Autocomplete) {
      const columnValues = this.dataSource.data.map(
        (row) => row.cells[column.element]
      );
      options = [...new Set(columnValues)]
        .filter((v) => v)
        .sort((a, b) => a.localeCompare(b));
    }

    const dialogRef = this.dialog.open({
      content: ResourceTableFilterComponent,
      origin: event.target,
      data: {
        value: this.filtersForm.controls[column.element].value,
        filterType,
        options
      }
    });

    dialogRef.afterClosed$.subscribe((value) => {
      this.filtersForm.controls[column.element].setValue(value);
    });
  }

  /**
   * Whether the column has filter criteria entered.
   */
  hasFilter(column: string): boolean {
    return (
      this.filtersForm.controls[column].value &&
      this.filtersForm.controls[column].value.length
    );
  }

  /**
   * Whether the table has any filter criteria entered.
   */
  hasFilters(): boolean {
    return Object.values(this.filtersForm.value).some((v) => !!v);
  }

  /**
   * Get filter type for column description.
   */
  getFilterType(column: ColumnDescription): FilterType {
    return this.listFilterColumns.includes(column.element)
      ? FilterType.Autocomplete
      : column.types.length === 1 && (column.types[0] === 'Count' || column.types[0] === 'unsignedInt')
        ? FilterType.Number
        : FilterType.Text;
  }

  /**
   * Emits the next page load event when scrolling to the bottom of the table
   */
  onScroll(): void {
    const scrollViewport = this.scrollViewport?.elementRef.nativeElement;
    if (scrollViewport) {
      const delta = 150;
      // scrollHeight === 0, when the table is in an inactive MatTab (tab content is detached)
      const isNotDetached = scrollViewport.scrollHeight !== 0;
      const bottomDistance =
        scrollViewport.scrollHeight -
        scrollViewport.scrollTop -
        scrollViewport.clientHeight;

      if (isNotDetached && delta >= bottomDistance) {
        this.loadNextPage.emit();
      }
    }
  }

  /**
   * Whether the specified column is sortable.
   * @param column - column description
   */
  isSortable(column: ColumnDescription): boolean {
    return !this.forceClientSort && this.sortChanged.observers.length
      ? !column.expression
      : true;
  }

  /**
   * Toggles tooltip.
   * Stops event propagation so that when info icon is clicked, it does not
   * sort the column.
   * @param event the click event
   * @param tooltip MatTooltip object
   */
  onInfoIconClick(event: any, tooltip: MatTooltip): void {
    event.preventDefault();
    event.stopPropagation();
    tooltip.toggle();
    this.liveAnnouncer.announce(tooltip.message);
  }

  /**
   * Overrides the default behavior of MatToolTip to show the tooltip when the
   * button is hovered over or focused. MatToolTip does this by adding event
   * listeners like 'mouseenter'.
   * @param tooltip MatTooltip object
   */
  onInfoIconFocus(tooltip: MatTooltip): void {
    setTimeout(() => {
      // We cannot call removeEventListener() since we don't have reference to
      // the anonymous event listener function set by MatToolTip, but hide(0)
      // will clear out any timeout set to show tooltip.
      tooltip.hide(0);
    }, 0);
  }

  /**
   * Returns a sort message.
   */
  getSortMessage(): string {
    let message = '';
    if (this.sort?.active) {
      const sortingColumnDescription = this.columnDescriptionsService
        .getAvailableColumns(
          this.resourceTypeColumns || this.resourceType,
          this.context
        )
        .find((c) => c.element === this.sort.active);
      message = `The data was sorted by ${
        sortingColumnDescription.displayName
      } in ${
        this.sort.direction === 'asc' ? 'ascending' : 'descending'
      } order.`;
    }

    return message;
  }

  /**
   * Sets client-side filter values
   * @param value - filter values
   */
  setClientFilter(value: any): void {
    this.dataSource.filter = { ...value } as string;
    // setTimeout is needed to update the table after this.dataSource changes
    setTimeout(() => this.onScroll());
  }

  /**
   * Handles the "mousedown" event on a row when "highlightSelection" is true.
   * @param event - mouse event
   * @param row - table row
   */
  onRowMouseDown(event: MouseEvent, row: TableRow): void {
    if (!this.highlightSelection) {
      return;
    }

    if (!(event.target as HTMLElement).closest('button')) {
      if (event.ctrlKey) {
        this.selectedResources.toggle(row.resource);
      } else if (event.shiftKey) {
        const from = this.selectedResources.selected[
          this.selectedResources.selected.length - 1
        ];
        if (from) {
          const fromIndex = this.dataSource.data.findIndex(
            (r) => r.resource === from
          );
          if (fromIndex !== -1) {
            const toIndex = this.dataSource.data.indexOf(row);
            const direction = Math.sign(toIndex - fromIndex);

            if (direction !== 0) {
              for (
                let i = fromIndex;
                direction * i <= direction * toIndex;
                i = i + direction
              ) {
                this.selectedResources.select(this.dataSource.data[i].resource);
              }
            }
          }
        }
        event.preventDefault();
      } else {
        this.selectedResources.clear();
        this.selectedResources.toggle(row.resource);
      }
    }
  }

  /**
   * Runs downloading the table row data in CSV format.
   */
  downloadCsv() {
    saveAs(
      this.getBlob(),
      getPluralFormOfResourceType(this.resourceType).toLowerCase() + '.csv'
    );
  }
}
