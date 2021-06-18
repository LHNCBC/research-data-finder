import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectAnAreaOfInterestComponent } from './select-an-area-of-interest.component';
import { MatRadioModule } from '@angular/material/radio';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';

@NgModule({
  declarations: [SelectAnAreaOfInterestComponent],
  exports: [SelectAnAreaOfInterestComponent],
  imports: [
    CommonModule,
    MatRadioModule,
    ResourceTableModule,
    ReactiveFormsModule,
    MatCheckboxModule
  ]
})
export class SelectAnAreaOfInterestModule {}
