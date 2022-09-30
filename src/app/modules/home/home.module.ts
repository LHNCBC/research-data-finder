import { NgModule } from '@angular/core';
import { StepperModule } from '../stepper/stepper.module';
import { SharedModule } from '../../shared/shared.module';
import { HttpClientModule } from '@angular/common/http';
import { MatMenuModule } from '@angular/material/menu';
import { HomeComponent } from './home.component';

@NgModule({
  declarations: [HomeComponent],
  imports: [SharedModule, HttpClientModule, StepperModule, MatMenuModule]
})
export class HomeModule {}
