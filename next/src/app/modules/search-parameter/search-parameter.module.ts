import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { SearchParameterComponent } from './search-parameter.component';
import { ObservationCodeLookupModule } from '../observation-code-lookup/observation-code-lookup.module';
import { DatesFromToComponent } from './dates-from-to.component';

@NgModule({
  declarations: [SearchParameterComponent, DatesFromToComponent],
  exports: [SearchParameterComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatInputModule,
    ObservationCodeLookupModule
  ]
})
export class SearchParameterModule {}
