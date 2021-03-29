import {ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {SelectionModel} from "@angular/cdk/collections";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MatTableDataSource} from "@angular/material/table";
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import {ColumnDescription} from "../../types/column.description";

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit {
  @Input() columnDescriptions: ColumnDescription[];
  @Input() initialUrl: string;
  columns: string[] = ['select'];
  filterColumns = [];
  nextBundleUrl: string;
  selectedResources = new SelectionModel<BundleEntry>(true, []);
  filtersForm: FormGroup;
  dataSource = new MatTableDataSource<BundleEntry>([]);
  lastResourceElement: HTMLElement;
  isLoading = false;

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef
  ) {
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
  }

  ngOnInit(): void {
    this.columns = this.columns.concat(this.columnDescriptions.map(c => c.element));
    this.filterColumns = this.columns.map(c => c + 'Filter');
    this.filtersForm = new FormBuilder().group({});
    this.columnDescriptions.forEach(column => {
      this.filtersForm.addControl(column.element, new FormControl());
    });
    this.filtersForm.valueChanges.subscribe(value => {
      this.dataSource.filter = {...value} as string;
      // re-observe last row of resource for scrolling when search is cleared
      if (Object.values(value).every(v => !v)) {
        this.createIntersectionObserver();
      }
    });
    this.callBatch(this.initialUrl);
  }

  /**
   * Call and load a bundle of resources
   */
  callBatch(url: string) {
    this.isLoading = true;
    this.http.get(url)
      .subscribe((data: Bundle) => {
        this.isLoading = false;
        this.nextBundleUrl = data.link.find(l => l.relation === 'next')?.url;
        this.dataSource.data = this.dataSource.data.concat(data.entry);
        if (this.nextBundleUrl) { // if bundle has no more 'next' link, do not create watcher for scrolling
          this.createIntersectionObserver();
        }
      });
  }

  /**
   * Create watcher to call next bundle when user scrolls to last row
   */
  createIntersectionObserver() {
    this.cd.detectChanges();
    // last row element of what's rendered
    this.lastResourceElement = document.getElementById(this.dataSource.data[this.dataSource.data.length - 1].resource.id);
    // watch for last row getting displayed
    let observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        // when last row of resource is displayed in viewport, unwatch this element and call next batch
        if (entry.intersectionRatio > 0) {
          obs.disconnect();
          this.callBatch(this.nextBundleUrl);
        }
      });
    });
    observer.observe(this.lastResourceElement);
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
