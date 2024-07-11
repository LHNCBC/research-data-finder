import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { SearchParameterComponent } from './search-parameter.component';
import { ObservationCodeLookupModule } from '../observation-code-lookup/observation-code-lookup.module';
import { DatesFromToComponent } from './dates-from-to.component';
import {
  SearchParameterValueComponent
} from './search-parameter-value.component';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { AutocompleteParameterValueComponent } from './autocomplete-parameter-value.component';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { FormControlCollectorModule } from '../../shared/error-manager/form-control-collector.module';
import { TabToSelectModule } from '../../shared/tab-to-select/tab-to-select.module';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { AutocompleteModule } from '../autocomplete/autocomplete.module';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';

@NgModule({
  declarations: [
    SearchParameterComponent,
    DatesFromToComponent,
    AutocompleteParameterValueComponent,
    SearchParameterValueComponent
  ],
  exports: [SearchParameterComponent, SearchParameterValueComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormControlCollectorModule,
    MatInputModule,
    ObservationCodeLookupModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TabToSelectModule,
    MatRadioModule,
    AutocompleteModule,
    MatCheckboxModule,
    FormsModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class SearchParameterModule {}
