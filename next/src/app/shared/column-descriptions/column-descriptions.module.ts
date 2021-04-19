import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnDescriptionsService } from './column-descriptions.service';
import { MatDialogModule } from '@angular/material/dialog';
import { SelectColumnsModule } from '../../modules/select-columns/select-columns.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, MatDialogModule, SelectColumnsModule],
  providers: [ColumnDescriptionsService]
})
export class ColumnDescriptionsModule {}
