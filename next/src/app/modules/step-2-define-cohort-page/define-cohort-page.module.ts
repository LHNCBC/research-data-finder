import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefineCohortPageComponent } from './define-cohort-page.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SearchParametersModule } from '../search-parameters/search-parameters.module';
import { MatInputModule } from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [DefineCohortPageComponent],
  exports: [DefineCohortPageComponent],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    SearchParametersModule,
    MatInputModule,
  ],
})
export class DefineCohortPageModule {}
