import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectAnAreaOfInterestComponent } from './select-an-area-of-interest.component';
import { MatRadioModule } from '@angular/material/radio';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [SelectAnAreaOfInterestComponent],
  exports: [SelectAnAreaOfInterestComponent],
  imports: [
    CommonModule,
    MatRadioModule,
    ResourceTableModule,
    ReactiveFormsModule
  ]
})
export class SelectAnAreaOfInterestModule {}
