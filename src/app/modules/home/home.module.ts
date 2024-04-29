import { NgModule } from '@angular/core';
import { StepperModule } from '../stepper/stepper.module';
import { SharedModule } from '../../shared/shared.module';
import { HttpClientModule } from '@angular/common/http';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { HomeComponent } from './home.component';
import { CommonModule } from '@angular/common';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';

@NgModule({
  declarations: [HomeComponent],
  imports: [
    SharedModule,
    HttpClientModule,
    StepperModule,
    MatMenuModule,
    CommonModule,
    MatTooltipModule
  ]
})
export class HomeModule {}
