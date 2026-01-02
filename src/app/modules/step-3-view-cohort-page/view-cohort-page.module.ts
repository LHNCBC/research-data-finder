import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewCohortPageComponent } from './view-cohort-page.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { CohortSummaryComponent } from './cohort-summary/cohort-summary.component';

@NgModule({
  declarations: [ViewCohortPageComponent],
  exports: [ViewCohortPageComponent],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    MatExpansionModule,
    ResourceTableModule,
    CohortSummaryComponent
  ]
})
export class ViewCohortPageModule {}
