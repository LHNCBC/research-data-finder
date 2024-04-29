import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectAnAreaOfInterestComponent } from './select-an-area-of-interest.component';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';

@NgModule({
  declarations: [SelectAnAreaOfInterestComponent],
  exports: [SelectAnAreaOfInterestComponent],
  imports: [
    CommonModule,
    MatRadioModule,
    ResourceTableModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatTooltipModule
  ]
})
export class SelectAnAreaOfInterestModule {}
