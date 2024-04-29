import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsPageComponent } from './settings-page.component';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { FhirServerSelectComponent } from './fhir-server-select/fhir-server-select.component';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { AppRoutingModule } from '../../app-routing.module';
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";

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
