import { Component, ViewChild } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { CohortService } from '../../shared/cohort/cohort.service';
import { DistributionConfig } from './cohort-summary/cohort-summary.component';
import { SettingsService } from '../../shared/settings-service/settings.service';

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less'],
  standalone: false
})
export class ViewCohortPageComponent {
  @ViewChild('resourceTableComponent')
  public resourceTableComponent: ResourceTableComponent;
  showByDefault: boolean;
  distributions: DistributionConfig[] = [];

  constructor(public columnDescriptions: ColumnDescriptionsService, public cohort: CohortService, private settings: SettingsService ) {
    this.showByDefault = this.settings.get('cohortSummary.showByDefault') ?? false;
    this.distributions = this.settings.get('cohortSummary.distributions');
  }
}
