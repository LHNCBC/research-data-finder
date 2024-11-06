import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { SelectColumnsModule } from '../../modules/select-columns/select-columns.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, MatDialogModule, SelectColumnsModule]
})
export class ColumnDescriptionsModule {}
