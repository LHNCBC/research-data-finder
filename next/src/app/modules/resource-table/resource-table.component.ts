import {AfterViewInit, Component, Input, NgZone, OnInit, ViewChild} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {SelectionModel} from "@angular/cdk/collections";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MatTableDataSource} from "@angular/material/table";
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import {ColumnDescription} from "../../types/column.description";
import {debounceTime} from "rxjs/operators";
import {CdkScrollable} from "@angular/cdk/overlay";

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit, AfterViewInit {
  @Input() columnDescriptions: ColumnDescription[];
  @Input() initialUrl: string;
  @Input() enableClientFiltering: boolean = false;
  columns: string[] = ['select'];
  filterColumns = [];
  nextBundleUrl: string;
  selectedResources = new SelectionModel<BundleEntry>(true, []);
  filtersForm: FormGroup = new FormBuilder().group({});
  dataSource = new MatTableDataSource<BundleEntry>([]);
  lastResourceElement: HTMLElement;
  isLoading = false;
  @ViewChild(CdkScrollable) scrollable: CdkScrollable;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
  }

  ngOnInit(): void {
    this.columns = this.columns.concat(this.columnDescriptions.map(c => c.element));
    if (this.enableClientFiltering) {
      this.filterColumns = this.columns.map(c => c + 'Filter');
      this.columnDescriptions.forEach(column => {
        this.filtersForm.addControl(column.element, new FormControl());
      });
      this.dataSource.filterPredicate = ((data, filter) => {
        for (const [key, value] of Object.entries(filter)) {
          if (value) {
            const columnDescription = this.columnDescriptions.find(c => c.element === key);
            const cellValue = this.getCellDisplay(data, columnDescription);
            if (!cellValue.toLowerCase().startsWith((<string>value).toLowerCase())) {
              return false;
            }
          }
        }
        return true;
      }) as (BundleEntry, string) => boolean;
      this.filtersForm.valueChanges.subscribe(value => {
        this.dataSource.filter = {...value} as string;
      });
    }
    this.callBatch(this.initialUrl);
  }

  ngAfterViewInit(): void {
    this.scrollable.elementScrolled()
      .pipe(debounceTime(1000))
      .subscribe(e => {
        this.ngZone.run(() => {
          this.onTableScroll(e);
        });
      });
  }

  /**
   * Call and load a bundle of resources
   */
  callBatch(url: string) {
    this.isLoading = true;
    this.nextBundleUrl = '';
    this.http.get(url)
      .subscribe((data: Bundle) => {
        this.isLoading = false;
        this.nextBundleUrl = data.link.find(l => l.relation === 'next')?.url;
        this.dataSource.data = this.dataSource.data.concat(data.entry);
      });
  }

  /**
   * Table viewport scroll handler
   */
  onTableScroll(e) {
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
  isAllSelected() {
    const numSelected = this.selectedResources.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected == numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected() ?
      this.selectedResources.clear() :
      this.dataSource.data.forEach(row => this.selectedResources.select(row));
  }

  /**
   * Clear filters on all columns
   */
  clearColumnFilters() {
    this.filtersForm.reset();
  }

  /**
   * Get cell display
   */
  getCellDisplay(row: BundleEntry, column: ColumnDescription): string {
    if (column.types.length === 1) {
      return this.getCellDisplayByType(row, column.types[0], column.element);
    }
    for (let type of column.types) {
      let upperCaseType = type.charAt(0).toUpperCase() + type.slice(1);
      let output = this.getCellDisplayByType(row, type, column.element.replace('[x]', upperCaseType));
      if (output) {
        return output;
      }
    }
    return '';
  }

  /**
   * Get cell display by type
   */
  getCellDisplayByType(row: BundleEntry, type: string, element: string): string {
    switch (type) {
      case 'Address':
        return this.getAddressDisplay(row.resource['address']);
      case 'HumanName':
        return this.humanNameToString(row.resource['name']);
      default:
        return row.resource[element];
    }
  }

  /**
   * Get address display
   */
  getAddressDisplay(addressElements): string {
    for (let address of addressElements) {
      if (address['text'])
        return address['text'];
    }
    return '';
  }

  /**
   * Get name display
   */
  humanNameToString(nameElements) {
    let rtn;
    const name = nameElements && nameElements[0];

    if (name) {
      const given = name.given || [],
        firstName = given[0] || '',
        lastName = name.family || '';
      let middleName = given[1] || '';

      if (middleName.length === 1) {
        middleName += '.';
      }
      rtn = [firstName, middleName, lastName].filter((item) => item).join(' ');
    }

    return rtn || null;
  }
}
