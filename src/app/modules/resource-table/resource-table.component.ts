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
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ColumnDescription } from '../../types/column.description';
import { distinctUntilChanged, filter, sample, tap } from 'rxjs/operators';
import { escapeStringForRegExp } from '../../shared/utils';
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
import * as fhirpath from 'fhirpath';
import * as fhirPathModelR4 from 'fhirpath/fhir-context/r4';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ResourceTableFilterComponent } from '../resource-table-filter/resource-table-filter.component';
import { FilterType } from '../../types/filter-type';
import { CustomDialog } from '../../shared/custom-dialog/custom-dialog.service';
import Resource = fhir.Resource;
import { MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { isEqual, pickBy } from 'lodash-es';

type TableCells = { [key: string]: string };

interface TableRow {
  cells: TableCells;
  resource: Resource;
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
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    private ngZone: NgZone,
    public columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService,
    private settings: SettingsService,
    private liveAnnoncer: LiveAnnouncer,
    private dialog: CustomDialog
  ) {
    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(filter((status) => status === ConnectionStatus.Ready))
        .subscribe(() => {
          this.fhirPathModel = {
            R4: fhirPathModelR4
          }[fhirBackend.currentVersion];
          this.compiledExpressions = {};
        })
    );
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
            this.dataSource.filter = { ...value } as string;
            // setTimeout is needed to update the table after this.dataSource changes
            setTimeout(() => this.onScroll());
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
    return output;
  }

  @ContentChild('prefix') prefixTemplate: TemplateRef<any>;
  get prefixContext(): any {
    return {};
  }
  @ViewChild('panel') panel: MatExpansionPanel;
  @ViewChild(TableItemSizeDirective) itemSizeDirective: TableItemSizeDirective;
  @Input() columnDescriptions: ColumnDescription[];
  // If true, client-side filtering is applied by default.
  // To enable server-side filtering, define a "(filterChanged)" handler.
  @Input() enableFiltering = false;
  @Input() enableSelection = false;
  @Input() resourceType;
  @Input() context = '';
  @Input() resources: Resource[];
  @Input() loading: boolean;
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
  // A number that identifies a timer to periodically load the next page.
  // This is necessary to avoid expiration of the link to the next page.
  loadNextPageTimer: any;
  // Interval in milliseconds to force the next page to load
  keepAliveTimeout = 120000;
  @Output() filterChanged = new EventEmitter();
  @Output() sortChanged = new EventEmitter();
  @Input() sort: Sort;
  columns: string[] = [];
  columnsWithData: { [element: string]: boolean } = {};
  selectedResources = new SelectionModel<Resource>(true, []);
  @Output() selectionChange = this.selectedResources.changed;
  filtersForm: FormGroup = new FormBuilder().group({});
  dataSource = new TableVirtualScrollDataSource<TableRow>([]);
  loadTime = 0;
  startTime: number;
  loadedDateTime: number;
  subscriptions: Subscription[] = [];
  fhirPathModel: any;
  readonly listFilterColumns: string[];
  compiledExpressions: { [expression: string]: (row: Resource) => any };

  @HostBinding('class.fullscreen') fullscreen = false;

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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.loadingStatistics && this.loadingStatistics.length === 0) {
      this.panel?.close();
    }
    // Handle a change of loading status
    if (changes['loading']) {
      if (this.loading) {
        this.columnsWithData = {};
        this.liveAnnoncer.announce(
          `The ${this.resourceType} resources loading process has started`
        );
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
              this.liveAnnoncer.announce(`${progressValue}% loaded`);
            }
          })
        );
      } else if (changes['loading'].previousValue) {
        this.loadedDateTime = Date.now();
        this.loadTime =
          Math.round((this.loadedDateTime - this.startTime) / 100) / 10;
        this.liveAnnoncer.announce(
          `The ${this.resourceType} resources loading process has finished. ` +
            `${this.resources.length} rows loaded. ` +
            this.getSortMessage()
        );
        this.progressBarPosition$ = null;
      }
    }

    // Update resource table rows
    if (changes['resources'] && changes['resources'].currentValue) {
      const allColumns = this.columnDescriptionsService.getAvailableColumns(
        this.resourceType,
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

      if (this.enableFiltering) {
        // Move selectable studies to the beginning of table.
        this.dataSource.data = [...newRows].sort((a: TableRow, b: TableRow) => {
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
        this.dataSource.data = [...newRows];
      }
      if (columnsWithDataChanged) {
        this.columnDescriptionsService.setColumnsWithData(
          this.resourceType,
          this.context,
          Object.keys(this.columnsWithData)
        );
      }
      // setTimeout is needed to update the table after this.dataSource changes
      setTimeout(() => this.onScroll());
    }

    // Update resource table columns
    if (changes['columnDescriptions'] && this.columnDescriptions) {
      this.columns.length = 0;
      if (this.enableSelection || this.context === 'browse') {
        this.columns.push('select');
      }

      this.setTableColumns();
    }
  }

  /**
   * Set material table columns from column descriptions.
   * Set up filter form and table filtering logic if client filtering is enabled.
   */
  setTableColumns(): void {
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
          this.filtersForm.addControl(column, new FormControl(''), {
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
  }

  /**
   * Returns a function for evaluating the passed FHIRPath expression.
   * @param expression - FHIRPath expression
   */
  getEvaluator(expression: string): (row: Resource) => any {
    let compiledExpression = this.compiledExpressions[expression];
    if (!compiledExpression) {
      compiledExpression = fhirpath.compile(expression, this.fhirPathModel);
      this.compiledExpressions[expression] = compiledExpression;
    }
    return compiledExpression;
  }

  /**
   * Returns string values to display in a cell
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   */
  getCellStrings(row: Resource, column: ColumnDescription): string[] {
    const expression = column.expression || column.element.replace('[x]', '');
    const fullPath = expression ? this.resourceType + '.' + expression : '';

    for (const type of column.types) {
      const output = this.columnValuesService.valueToStrings(
        this.getEvaluator(fullPath)(row),
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
   * Sort dataSource on table header click
   * @param sort - sorting event object containing info of table column and sort direction
   */
  sortData(sort: Sort): void {
    this.sort = sort;
    if (!sort.active || sort.direction === '') {
      return;
    }
    if (this.sortChanged.observers.length) {
      this.scrollViewport.scrollToIndex(0);
      this.sortChanged.emit(sort);
      return;
    }
    // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
    const isAsc = sort.direction === 'desc';
    const sortingColumnDescription = this.columnDescriptions.find(
      (c) => c.element === sort.active
    );
    const filterType = this.getFilterType(sortingColumnDescription);
    this.dataSource.data.sort((a: TableRow, b: TableRow) => {
      const cellValueA = a.cells[sortingColumnDescription.element];
      const cellValueB = b.cells[sortingColumnDescription.element];
      return filterType === FilterType.Number
        ? (+cellValueA - +cellValueB) * (isAsc ? 1 : -1)
        : cellValueA.localeCompare(cellValueB) * (isAsc ? 1 : -1);
    });
    // Table will re-render only after data reference changed.
    this.dataSource.data = this.dataSource.data.slice();
    this.liveAnnoncer.announce(this.getSortMessage());
  }

  /**
   * Creates Blob for download table
   */
  getBlob(): Blob {
    const columnDescriptions = this.columnDescriptions;
    const header = columnDescriptions
      .map((columnDescription) => columnDescription.displayName)
      .join(',');
    const rowsToDownload = this.enableFiltering
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const rows = rowsToDownload.map((row) =>
      columnDescriptions
        .map((columnDescription) => {
          const cellText = row.cells[columnDescription.element];
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
            return '"' + cellText.replace(/"/g, '""') + '"';
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
        value: this.filtersForm.get(column.element).value,
        filterType,
        options
      }
    });

    dialogRef.afterClosed$.subscribe((value) => {
      this.filtersForm.get(column.element).setValue(value);
    });
  }

  /**
   * Whether the column has filter criteria entered.
   */
  hasFilter(column: string): boolean {
    return (
      this.filtersForm.get(column).value &&
      this.filtersForm.get(column).value.length
    );
  }

  /**
   * Get filter type for column description.
   */
  getFilterType(column: ColumnDescription): FilterType {
    return this.listFilterColumns.includes(column.element)
      ? FilterType.Autocomplete
      : column.types.length === 1 && column.types[0] === 'Count'
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

      clearTimeout(this.loadNextPageTimer);
      if (isNotDetached && delta >= bottomDistance) {
        this.loadNextPage.emit();
      } else {
        // In any case, load the next page after the specified time has elapsed
        // so that the link to the next page does not expire:
        this.loadNextPageTimer = setTimeout(
          () => this.loadNextPage.emit(),
          this.keepAliveTimeout
        );
      }
    }
  }

  /**
   * Whether the specified column is sortable.
   * @param column - column description
   */
  isSortable(column: ColumnDescription): boolean {
    return this.sortChanged.observers.length ? !column.expression : true;
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
    this.liveAnnoncer.announce(tooltip.message);
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
    return this.sort?.active
      ? `The data was sorted by ${this.sort.active} in ${
          // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
          this.sort.direction === 'desc' ? 'ascending' : 'descending'
        } order.`
      : '';
  }
}
