import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperComponent } from './stepper.component';
import { MatStepperModule } from '@angular/material/stepper';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SearchParametersModule } from 'src/app/modules/search-parameters/search-parameters.module';
import { SettingsPageModule } from '../step-1-settings-page/settings-page.module';
import { DefineCohortPageModule } from '../step-2-define-cohort-page/define-cohort-page.module';
import { ViewCohortPageModule } from '../step-3-view-cohort-page/view-cohort-page.module';
import { PullDataPageModule } from '../step-4-pull-data-page/pull-data-page.module';
import { MatDialogModule } from '@angular/material/dialog';
import { SelectColumnsModule } from '../select-columns/select-columns.module';

@NgModule({
  declarations: [StepperComponent],
  exports: [StepperComponent],
  imports: [
    CommonModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    SearchParametersModule,
    SettingsPageModule,
    DefineCohortPageModule,
    ViewCohortPageModule,
    PullDataPageModule,
    MatDialogModule,
    SelectColumnsModule
  ]
})
export class StepperModule {}
