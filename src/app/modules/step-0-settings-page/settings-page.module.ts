import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsPageComponent } from './settings-page.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FhirServerSelectComponent } from './fhir-server-select/fhir-server-select.component';
import { MatButtonModule } from '@angular/material/button';
import { AppRoutingModule } from '../../app-routing.module';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";

@NgModule({
  declarations: [
    SettingsPageComponent,
    FhirServerSelectComponent
  ],
  exports: [SettingsPageComponent],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatButtonModule,
    AppRoutingModule,
    FormsModule,
    MatProgressSpinnerModule
  ]
})
export class SettingsPageModule {}
