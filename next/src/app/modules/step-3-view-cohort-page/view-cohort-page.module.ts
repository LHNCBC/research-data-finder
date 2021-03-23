import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewCohortPageComponent } from './view-cohort-page.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from "@angular/material/checkbox";


@NgModule({
  declarations: [ViewCohortPageComponent],
  exports: [
    ViewCohortPageComponent
  ],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    MatExpansionModule,
    MatTableModule,
    MatCheckboxModule
  ]
})
export class ViewCohortPageModule { }
