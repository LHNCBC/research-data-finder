import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { SearchParameterComponent } from './search-parameter.component';
import { LoincVariablesSelectorModule } from '../loinc-variables-selector/loinc-variables-selector.module';

@NgModule({
  declarations: [SearchParameterComponent],
  exports: [SearchParameterComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatInputModule,
    LoincVariablesSelectorModule
  ]
})
export class SearchParameterModule {}
