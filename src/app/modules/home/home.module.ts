import { NgModule } from '@angular/core';
import { StepperModule } from '../stepper/stepper.module';
import { SharedModule } from '../../shared/shared.module';
import { HttpClientModule } from '@angular/common/http';
import { MatMenuModule } from '@angular/material/menu';
import { HomeComponent } from './home.component';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

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
