import { Component, OnInit, ViewChild } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { CohortService } from '../../shared/cohort/cohort.service';

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less'],
  standalone: false
})
export class ViewCohortPageComponent implements OnInit {
  @ViewChild('resourceTableComponent')
  public resourceTableComponent: ResourceTableComponent;

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    public cohort: CohortService
  ) {}

  ngOnInit(): void {}
}
