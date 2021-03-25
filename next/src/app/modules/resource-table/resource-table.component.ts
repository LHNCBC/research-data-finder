import {ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import {HttpClient} from "@angular/common/http";
import {SelectionModel} from "@angular/cdk/collections";
import {FormBuilder, FormGroup} from "@angular/forms";
import {MatTableDataSource} from "@angular/material/table";

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit {
  // TODO: temporarily hard coded column options
  patientColumns = ['select', 'id', 'name', 'gender', 'birthDate', 'deceased', 'address', 'active'];
  nextBundleUrl: string;
  selectedResources = new SelectionModel<BundleEntry>(true, []);
  filtersForm: FormGroup;
  patientDataSource = new MatTableDataSource<BundleEntry>([]);
  patientFilterColumns = [];
  lastResourceElement: HTMLElement;
  emptySearchCriteria = {
    id: '',
    name: '',
    gender: '',
    birthDate: '',
    deceased: '',
    address: '',
    active: ''
  };
  isLoading = false;
  genderSearchOptions: string[] = [];
  activeSearchOptions: string[] = [];

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef
  ) {
    this.patientDataSource.filterPredicate = ((data, filter) => {
      const a = !filter.id || data.resource.id.toLowerCase().includes(filter.id).toLowerCase();
      const b = !filter.name || data.resource.name[0].family?.toLowerCase()?.includes(filter.name.toLowerCase()) ||
        data.resource.name[0].given[0]?.toLowerCase()?.includes(filter.name.toLowerCase());
      const c = !filter.gender || data.resource.gender.toLowerCase() === filter.gender;
      const d = !filter.birthDate || data.resource.birthDate.toLowerCase().includes(filter.birthDate.toLowerCase());
      const e = !filter.deceased || data.resource.deceasedDateTime?.toLowerCase()?.includes(filter.deceased.toLowerCase()) ||
        data.resource.deceasedBoolean?.toLowerCase()?.includes(filter.deceased.toLowerCase());
      const f = !filter.address || data.resource.address[0].text.toLowerCase().includes(filter.address.toLowerCase());
      const g = !filter.active || data.resource.active.toString().toLowerCase() === filter.active;
      return a && b && c && d && e && f && g;
    }) as (BundleEntry, string) => boolean;
    this.filtersForm = new FormBuilder().group({
      id: '',
      name: '',
      gender: '',
      birthDate: '',
      deceased: '',
      address: '',
      active: ''
    });
    this.filtersForm.valueChanges.subscribe(value => {
      this.patientDataSource.filter = {...value} as string;
      // re-observe last row of resource for scrolling when search is cleared
      if (!value.id && !value.name && !value.gender && !value.birthDate && !value.deceased && !value.address && !value.active) {
        this.createIntersectionObserver();
      }
    });
  }

  ngOnInit(): void {
    this.patientFilterColumns = this.patientColumns.map(c => c + 'Filter');
    // TODO: temporarily calling this test server manually here
    this.callBatch('https://lforms-fhir.nlm.nih.gov/baseR4/Patient?_elements=id,name,birthDate,active,deceased,identifier,telecom,gender,address&_count=10');
  }

  callBatch(url: string) {
    this.isLoading = true;
    this.http.get(url)
      .subscribe((data: Bundle) => {
        this.isLoading = false;
        this.nextBundleUrl = data.link.find(l => l.relation === 'next')?.url;
        this.patientDataSource.data = this.patientDataSource.data.concat(data.entry);
        if (this.nextBundleUrl) { // if bundle has no more 'next' link, do not create watcher for scrolling
          this.createIntersectionObserver();
        }
        // update search options for select controls from column values
        data.entry.forEach(e => {
          if (!this.genderSearchOptions.includes(e.resource['gender'].toLowerCase())) {
            this.genderSearchOptions.push(e.resource['gender'].toLowerCase());
          }
          if (!this.activeSearchOptions.includes(e.resource['active'].toString().toLowerCase())) {
            this.activeSearchOptions.push(e.resource['active'].toString().toLowerCase());
          }
        });
      });
  }

  createIntersectionObserver() {
    this.cd.detectChanges();
    // last row element of what's rendered
    this.lastResourceElement = document.getElementById(this.patientDataSource.data[this.patientDataSource.data.length - 1].resource.id);
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
    const numRows = this.patientDataSource.data.length;
    return numSelected == numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected() ?
      this.selectedResources.clear() :
      this.patientDataSource.data.forEach(row => this.selectedResources.select(row));
  }

  clearSearchCriteria() {
    this.filtersForm.setValue(this.emptySearchCriteria);
  }
}
