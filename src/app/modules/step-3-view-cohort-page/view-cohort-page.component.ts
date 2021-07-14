import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { Subject } from 'rxjs';
import BundleEntry = fhir.BundleEntry;
import { ResourceTableComponent } from '../resource-table/resource-table.component';

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
  @Input() patientStream: Subject<BundleEntry>;
  @Input() loadingStatistics: (string | number)[][] = [];

  @ViewChild('resourceTableComponent')
  public resourceTableComponent: ResourceTableComponent;

  constructor(public columnDescriptions: ColumnDescriptionsService) {}

  ngOnInit(): void {}
}
