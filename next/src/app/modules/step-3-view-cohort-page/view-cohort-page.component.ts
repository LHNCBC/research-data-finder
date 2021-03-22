import { Component, OnInit } from '@angular/core';
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get('https://lforms-fhir.nlm.nih.gov/baseR4/Patient?_elements=id,name,birthDate,active&_count=100')
      .subscribe((data: Bundle) => {
        this.patientDataSource = data.entry;
      });
  }

}
