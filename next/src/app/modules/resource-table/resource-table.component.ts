import {ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import {HttpClient} from "@angular/common/http";
import {SelectionModel} from "@angular/cdk/collections";

/**
 * Component for loading table of resources
 */
@Component({
  selector: 'app-resource-table',
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.less']
})
export class ResourceTableComponent implements OnInit {
  patientColumns: string[] = ['select', 'id', 'url'];
  patientDataSource: BundleEntry[] = [];
  nextBundleUrl: string;
  selectedResources = new SelectionModel<BundleEntry>(true, []);

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // TODO: temporarily calling this test server manually here
    this.callBatch('https://lforms-fhir.nlm.nih.gov/baseR4/Patient?_elements=id,name,birthDate,active&_count=100');
  }

  callBatch(url: string) {
    this.http.get(url)
      .subscribe((data: Bundle) => {
        this.nextBundleUrl = data.link.find(l => l.relation === 'next')?.url;
        this.patientDataSource = this.patientDataSource.concat(data.entry);
        if (this.nextBundleUrl) { // if bundle has no more 'next' link, do not create watcher for scrolling
          this.createIntersectionObserver();
        }
      });
  }

  createIntersectionObserver() {
    this.cd.detectChanges();
    // last row element of what's rendered
    let lastResourceElement = document.getElementById(this.patientDataSource[this.patientDataSource.length - 1].resource.id);
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
    observer.observe(lastResourceElement);
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selectedResources.selected.length;
    const numRows = this.patientDataSource.length;
    return numSelected == numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected() ?
      this.selectedResources.clear() :
      this.patientDataSource.forEach(row => this.selectedResources.select(row));
  }
}
