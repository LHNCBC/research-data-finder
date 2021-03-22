import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import Bundle = fhir.Bundle;
import BundleEntry = fhir.BundleEntry;
import {HttpClient} from "@angular/common/http";

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
  patientColumns: string[] = ['id', 'url'];
  patientDataSource: BundleEntry[] = [];
  nextBundleUrl: string;

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

}
