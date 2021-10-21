import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParametersComponent } from './search-parameters.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';
import { QueryBuilderModule } from '../../../query-builder/public-api';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { AutocompleteModule } from '../autocomplete/autocomplete.module';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';

@NgModule({
  declarations: [SearchParametersComponent],
  exports: [SearchParametersComponent],
  imports: [
    CommonModule,
    SearchParameterGroupModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    QueryBuilderModule,
    FormsModule,
    MatSelectModule,
    MatRadioModule,
    AutocompleteModule,
    SearchParameterModule
  ]
})
export class SearchParametersModule {}
