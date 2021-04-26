import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { SearchParameterComponent } from './search-parameter.component';
import { ObservationCodeLookupModule } from '../observation-code-lookup/observation-code-lookup.module';
import { DatesFromToComponent } from './dates-from-to.component';
import { ObservationTestValueComponent } from './observation-test-value.component';
import { MatSelectModule } from '@angular/material/select';

@NgModule({
  declarations: [
    SearchParameterComponent,
    DatesFromToComponent,
    ObservationTestValueComponent
  ],
  exports: [SearchParameterComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatInputModule,
    ObservationCodeLookupModule,
    MatSelectModule
  ]
})
export class SearchParameterModule {}
