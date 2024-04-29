import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParameterGroupComponent } from './search-parameter-group.component';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { FormControlCollectorModule } from '../../shared/error-manager/form-control-collector.module';
import { TabToSelectModule } from '../../shared/tab-to-select/tab-to-select.module';

@NgModule({
  declarations: [SearchParameterGroupComponent],
  exports: [SearchParameterGroupComponent],
  imports: [
    CommonModule,
    SearchParameterModule,
    MatIconModule,
    ReactiveFormsModule,
    FormControlCollectorModule,
    MatButtonModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatInputModule,
    TabToSelectModule
  ]
})
export class SearchParameterGroupModule {}
