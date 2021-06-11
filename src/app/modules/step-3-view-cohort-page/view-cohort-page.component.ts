import { Component, Input, OnInit } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { Subject } from 'rxjs';
import BundleEntry = fhir.BundleEntry;

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

  constructor(public columnDescriptions: ColumnDescriptionsService) {}

  ngOnInit(): void {}
}
