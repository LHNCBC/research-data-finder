import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { SelectColumnsModule } from '../../modules/select-columns/select-columns.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, MatDialogModule, SelectColumnsModule]
})
export class ColumnDescriptionsModule {}
