import {Component, OnInit} from '@angular/core';

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
  // TODO: temporarily hard coded column options
  columns = ['select', 'id', 'name', 'gender', 'birthDate', 'deceased', 'address', 'active'];

  constructor() {
  }

  ngOnInit() {
  }
}
