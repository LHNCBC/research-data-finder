import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperComponent } from './stepper.component';
import { MatStepperModule } from '@angular/material/stepper';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { SearchParametersModule } from 'src/app/modules/search-parameters/search-parameters.module';
import { SettingsPageModule } from '../step-0-settings-page/settings-page.module';
import { DefineCohortPageModule } from '../step-2-define-cohort-page/define-cohort-page.module';
import { ViewCohortPageModule } from '../step-3-view-cohort-page/view-cohort-page.module';
import { PullDataPageModule } from '../step-4-pull-data-page/pull-data-page.module';
import { SelectAnAreaOfInterestModule } from '../step-1-select-an-area-of-interest/select-an-area-of-interest.module';
import { AnnounceIfActiveModule } from '../../shared/announce-if-active/announce-if-active.module';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { SelectRecordsPageModule } from '../select-records-page/select-records-page.module';
import { SelectAnActionModule } from '../select-an-action/select-an-action.module';
import { BrowseRecordsPageModule } from '../browse-records-page/browse-records-page.module';

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
    SelectRecordsPageModule,
    SelectAnActionModule,
    DefineCohortPageModule,
    ViewCohortPageModule,
    PullDataPageModule,
    SelectAnAreaOfInterestModule,
    AnnounceIfActiveModule,
    MatRadioModule,
    BrowseRecordsPageModule
  ]
})
export class StepperModule {}
