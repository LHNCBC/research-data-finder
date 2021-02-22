import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParametersComponent } from './search-parameters.component';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';



@NgModule({
  declarations: [ SearchParametersComponent ],
  exports: [ SearchParametersComponent ],
  imports: [
    CommonModule,
    SearchParameterModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule
  ]
})
export class SearchParametersModule { }
