import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParametersComponent } from './search-parameters.component';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';

@NgModule({
  declarations: [SearchParametersComponent],
  exports: [SearchParametersComponent],
  imports: [
    CommonModule,
    SearchParameterGroupModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule
  ]
})
export class SearchParametersModule {}
