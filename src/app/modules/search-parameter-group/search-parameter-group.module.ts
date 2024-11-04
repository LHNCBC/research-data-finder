import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParameterGroupComponent } from './search-parameter-group.component';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
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
