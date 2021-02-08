import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchParametersComponent } from './search-parameters.component';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';



@NgModule({
  declarations: [ SearchParametersComponent ],
  exports: [ SearchParametersComponent ],
    imports: [
        CommonModule,
        SearchParameterModule,
        MatIconModule,
        ReactiveFormsModule,
        MatButtonModule
    ]
})
export class SearchParametersModule { }
