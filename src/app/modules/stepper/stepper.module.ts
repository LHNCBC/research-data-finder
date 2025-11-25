import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperComponent } from './stepper.component';
import { MatStepperModule } from '@angular/material/stepper';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  SearchParametersModule
} from 'src/app/modules/search-parameters/search-parameters.module';
import {
  SettingsPageModule
} from '../step-0-settings-page/settings-page.module';
import {
  DefineCohortPageModule
} from '../step-2-define-cohort-page/define-cohort-page.module';
import {
  ViewCohortPageModule
} from '../step-3-view-cohort-page/view-cohort-page.module';
import {
  PullDataPageModule
} from '../step-4-pull-data-page/pull-data-page.module';
import {
  SelectAnAreaOfInterestModule
} from '../step-1-select-an-area-of-interest/select-an-area-of-interest.module';
import {
  AnnounceIfActiveModule
} from '../../shared/announce-if-active/announce-if-active.module';
import { MatRadioModule } from '@angular/material/radio';
import {
  SelectRecordsPageModule
} from '../select-records-page/select-records-page.module';
import {
  SelectAnActionModule
} from '../select-an-action/select-an-action.module';
import {
  BrowseRecordsPageModule
} from '../browse-records-page/browse-records-page.module';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';

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
    BrowseRecordsPageModule,
    MatMenu,
    MatMenuItem,
    MatTooltip,
    MatMenuTrigger
  ]
})
export class StepperModule {}
