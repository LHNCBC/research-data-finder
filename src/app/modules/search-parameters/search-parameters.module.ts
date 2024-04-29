import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParametersComponent } from './search-parameters.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';
import { QueryBuilderModule } from '../../../query-builder/public-api';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { AutocompleteModule } from '../autocomplete/autocomplete.module';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { FormControlCollectorModule } from '../../shared/error-manager/form-control-collector.module';

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
    SearchParameterModule,
    FormControlCollectorModule
  ]
})
export class SearchParametersModule {}
