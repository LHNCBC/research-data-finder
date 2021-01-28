import { Component, OnInit } from '@angular/core';

// TODO: temporary type
export interface PatientElement {
  id: string;
  name: string;
}

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
  patientColumns: string[] = ['id', 'name'];
  patientDataSource: PatientElement[] = Array.from({length: 50}, (v, i) => ({
    id: `id-${i}`,
    name: `Patient name - ${i}`
  }));

  constructor() { }

  ngOnInit(): void {
  }

}
